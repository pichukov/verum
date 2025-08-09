/**
 * Story Reconstructor
 * 
 * Reconstructs complete stories from individual segments stored on blockchain
 */

import { 
  IndexedStory, 
  StorySegment, 
  VerumTransaction,
  ApiResponse 
} from '../types';
import { IBlockchainFetcher } from '../fetchers/blockchain-fetcher';
import { TransactionType } from '@verum/protocol';

/**
 * Interface for story reconstruction operations
 */
export interface IStoryReconstructor {
  /**
   * Reconstruct a complete story from its first segment transaction ID
   */
  reconstructStory(firstTxId: string): Promise<ApiResponse<IndexedStory>>;

  /**
   * Get all segments for a story
   */
  getStorySegments(firstTxId: string): Promise<ApiResponse<StorySegment[]>>;

  /**
   * Check if a story is complete (all segments present)
   */
  isStoryComplete(segments: StorySegment[]): boolean;

  /**
   * Validate story segment chain integrity
   */
  validateSegmentChain(segments: StorySegment[]): boolean;
}

/**
 * Story reconstruction implementation
 */
export class StoryReconstructor implements IStoryReconstructor {
  private blockchainFetcher: IBlockchainFetcher;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 120000; // 2 minutes for story data

  constructor(blockchainFetcher: IBlockchainFetcher) {
    this.blockchainFetcher = blockchainFetcher;
    this.cache = new Map();
  }

  /**
   * Reconstruct a complete story from its first segment transaction ID
   */
  async reconstructStory(firstTxId: string): Promise<ApiResponse<IndexedStory>> {
    const cacheKey = `story:${firstTxId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get the first segment transaction
      const firstTxResult = await this.blockchainFetcher.getTransactionById(firstTxId);
      if (!firstTxResult.success || !firstTxResult.data) {
        return { success: false, error: 'First segment transaction not found' };
      }

      // Parse the first segment
      const firstVerumTx = this.blockchainFetcher.parseVerumTransaction(firstTxResult.data);
      if (!firstVerumTx || firstVerumTx.payload.type !== TransactionType.STORY) {
        return { success: false, error: 'Invalid story transaction' };
      }

      // Get all segments for this story
      const segmentsResult = await this.getStorySegments(firstTxId);
      if (!segmentsResult.success || !segmentsResult.data) {
        return { success: false, error: 'Failed to fetch story segments' };
      }

      const segments = segmentsResult.data;
      
      // Validate segment chain
      if (!this.validateSegmentChain(segments)) {
        return { success: false, error: 'Invalid segment chain' };
      }

      // Reconstruct the complete story
      const story = await this.buildCompleteStory(firstVerumTx, segments);
      
      // Cache the result
      this.setCachedData(cacheKey, story);
      
      return { success: true, data: story };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reconstruct story'
      };
    }
  }

  /**
   * Get all segments for a story
   */
  async getStorySegments(firstTxId: string): Promise<ApiResponse<StorySegment[]>> {
    const cacheKey = `segments:${firstTxId}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get the first segment to determine total count and author
      const firstTxResult = await this.blockchainFetcher.getTransactionById(firstTxId);
      if (!firstTxResult.success || !firstTxResult.data) {
        return { success: false, error: 'First segment not found' };
      }

      const firstVerumTx = this.blockchainFetcher.parseVerumTransaction(firstTxResult.data);
      if (!firstVerumTx || firstVerumTx.payload.type !== TransactionType.STORY) {
        return { success: false, error: 'Invalid story transaction' };
      }

      const totalSegments = firstVerumTx.payload.params?.total || 1;
      const author = firstVerumTx.senderAddress;

      // Collect all segments
      const segments: StorySegment[] = [];
      const segmentMap = new Map<number, StorySegment>();

      // Add first segment
      const firstSegment = this.createStorySegment(firstVerumTx);
      if (firstSegment) {
        segments.push(firstSegment);
        segmentMap.set(1, firstSegment);
      }

      // If there's only one segment, return it
      if (totalSegments === 1) {
        this.setCachedData(cacheKey, segments);
        return { success: true, data: segments };
      }

      // Find subsequent segments by traversing the chain
      await this.findSubsequentSegments(firstTxId, author, totalSegments, segmentMap);

      // Convert map to sorted array
      const allSegments = Array.from(segmentMap.values())
        .sort((a, b) => a.segmentNumber - b.segmentNumber);

      // Cache the result
      this.setCachedData(cacheKey, allSegments);
      
      return { success: true, data: allSegments };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch story segments'
      };
    }
  }

  /**
   * Check if a story is complete (all segments present)
   */
  isStoryComplete(segments: StorySegment[]): boolean {
    if (segments.length === 0) return false;

    const totalSegments = segments[0]?.totalSegments || 0;
    if (totalSegments !== segments.length) return false;

    // Check for gaps in segment numbers
    const segmentNumbers = segments.map(s => s.segmentNumber).sort((a, b) => a - b);
    for (let i = 0; i < segmentNumbers.length; i++) {
      if (segmentNumbers[i] !== i + 1) return false;
    }

    // Check if the last segment is marked as final
    const lastSegment = segments.find(s => s.segmentNumber === totalSegments);
    return lastSegment?.isFinal === true;
  }

  /**
   * Validate story segment chain integrity
   */
  validateSegmentChain(segments: StorySegment[]): boolean {
    if (segments.length === 0) return false;
    if (segments.length === 1) return true;

    // Sort by segment number
    const sortedSegments = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);

    // Validate sequence
    for (let i = 0; i < sortedSegments.length; i++) {
      const segment = sortedSegments[i];
      
      // Check segment number sequence
      if (segment.segmentNumber !== i + 1) return false;
      
      // Check total segments consistency
      if (segment.totalSegments !== sortedSegments[0].totalSegments) return false;
      
      // Check timestamps are in order (allowing some tolerance for blockchain ordering)
      if (i > 0 && segment.timestamp < sortedSegments[i - 1].timestamp - 60) {
        return false; // More than 1 minute out of order is suspicious
      }
    }

    // Check final segment marking
    const lastSegment = sortedSegments[sortedSegments.length - 1];
    if (lastSegment.segmentNumber === lastSegment.totalSegments) {
      return lastSegment.isFinal;
    }

    return true;
  }

  /**
   * Find subsequent segments by traversing parent_id chain
   */
  private async findSubsequentSegments(
    firstTxId: string,
    author: string,
    totalSegments: number,
    segmentMap: Map<number, StorySegment>
  ): Promise<void> {
    try {
      // Get all transactions for the author to find segments
      const authorTxsResult = await this.blockchainFetcher.getTransactionsByAddress(author);
      if (!authorTxsResult.success || !authorTxsResult.data) {
        return;
      }

      // Filter for story transactions and find segments with matching parent chain
      for (const rawTx of authorTxsResult.data) {
        const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
        if (!verumTx || verumTx.payload.type !== TransactionType.STORY) {
          continue;
        }

        // Skip the first segment (already processed)
        if (verumTx.txId === firstTxId) continue;

        const segmentNumber = verumTx.payload.params?.segment;
        const total = verumTx.payload.params?.total;

        // Validate this belongs to our story
        if (total !== totalSegments || !segmentNumber || segmentNumber < 2) {
          continue;
        }

        // Check if this segment belongs to our story chain
        if (await this.isSegmentInChain(verumTx, firstTxId, segmentMap)) {
          const segment = this.createStorySegment(verumTx);
          if (segment && !segmentMap.has(segmentNumber)) {
            segmentMap.set(segmentNumber, segment);
          }
        }
      }
    } catch (error) {
      console.warn('Error finding subsequent segments:', error);
    }
  }

  /**
   * Check if a segment belongs to a specific story chain
   */
  private async isSegmentInChain(
    segmentTx: VerumTransaction,
    firstTxId: string,
    existingSegments: Map<number, StorySegment>
  ): Promise<boolean> {
    const segmentNumber = segmentTx.payload.params?.segment;
    if (!segmentNumber || segmentNumber < 2) return false;

    // For segment 2, parent should be the first segment
    if (segmentNumber === 2) {
      return segmentTx.payload.parent_id === firstTxId;
    }

    // For higher segments, parent should be the previous segment
    const previousSegmentNumber = segmentNumber - 1;
    const previousSegment = existingSegments.get(previousSegmentNumber);
    
    if (previousSegment) {
      return segmentTx.payload.parent_id === previousSegment.txId;
    }

    return false;
  }

  /**
   * Create a StorySegment from a VerumTransaction
   */
  private createStorySegment(verumTx: VerumTransaction): StorySegment | null {
    const params = verumTx.payload.params;
    if (!params || typeof params.segment !== 'number' || typeof params.total !== 'number') {
      return null;
    }

    return {
      txId: verumTx.txId,
      segmentNumber: params.segment,
      totalSegments: params.total,
      content: verumTx.payload.content || '',
      timestamp: verumTx.blockTime,
      isFinal: params.is_final === true
    };
  }

  /**
   * Build complete story from segments
   */
  private async buildCompleteStory(
    firstTx: VerumTransaction,
    segments: StorySegment[]
  ): Promise<IndexedStory> {
    // Sort segments by number
    const sortedSegments = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
    
    // Combine content
    const content = sortedSegments.map(segment => segment.content).join('');
    
    // Extract title from first segment (first line if it looks like a title)
    const firstLine = sortedSegments[0]?.content.split('\n')[0] || '';
    const title = firstLine.length < 100 && firstLine.endsWith(':') ? 
      firstLine.replace(':', '') : undefined;

    // TODO: In a real implementation, these would be calculated from blockchain data
    const likeCount = 0;
    const commentCount = 0;
    const isLikedByUser = false;

    return {
      firstTxId: firstTx.txId,
      author: firstTx.senderAddress,
      title,
      content: content.trim(),
      segments: sortedSegments,
      timestamp: firstTx.blockTime,
      likeCount,
      commentCount,
      isComplete: this.isStoryComplete(segments),
      isLikedByUser
    };
  }

  /**
   * Get cached data if not expired
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached data with timestamp
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}