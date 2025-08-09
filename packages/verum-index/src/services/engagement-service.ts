/**
 * Engagement Service
 * 
 * Handles like and comment tracking, calculation of engagement metrics
 * from blockchain data
 */

import { 
  IndexedLike,
  IndexedComment,
  ApiResponse
} from '../types';
import { IBlockchainFetcher } from '../fetchers/blockchain-fetcher';
import { TransactionType } from '@verum/protocol';

export interface EngagementMetrics {
  likeCount: number;
  commentCount: number;
  totalEngagement: number;
  recentActivity: number; // Activity in last 24 hours
}

export interface UserLikeStatus {
  hasLiked: boolean;
  likeTxId?: string;
  likedAt?: number;
}

export interface ContentEngagement {
  txId: string;
  metrics: EngagementMetrics;
  likes: IndexedLike[];
  comments: IndexedComment[];
  userLikeStatus?: UserLikeStatus;
}

export interface EngagementServiceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  batchSize: number;
  maxSearchDepth: number;
}

/**
 * Service for tracking and calculating engagement metrics from blockchain data
 */
export class EngagementService {
  private fetcher: IBlockchainFetcher;
  private config: EngagementServiceConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(fetcher: IBlockchainFetcher, config?: Partial<EngagementServiceConfig>) {
    this.fetcher = fetcher;
    this.config = {
      cacheEnabled: true,
      cacheTTL: 30000, // 30 seconds
      batchSize: 100,
      maxSearchDepth: 1000,
      ...config
    };
  }

  /**
   * Get comprehensive engagement metrics for content
   */
  async getContentEngagement(
    txId: string, 
    userAddress?: string
  ): Promise<ApiResponse<ContentEngagement>> {
    const cacheKey = `engagement:${txId}:${userAddress || 'anon'}`;
    
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    try {
      // First determine what type of content this is for debugging
      const contentType = await this.determineContentType(txId);
      console.log(`[EngagementService] Getting engagement for ${contentType} content: ${txId.substring(0, 12)}...`);

      // Get likes and comments in parallel
      const [likesResult, commentsResult] = await Promise.all([
        this.getLikesForContent(txId),
        this.getCommentsForContent(txId)
      ]);

      if (!likesResult.success || !commentsResult.success) {
        console.log(`[EngagementService] Failed to fetch engagement data for ${txId.substring(0, 12)}...`, {
          likesSuccess: likesResult.success,
          commentsSuccess: commentsResult.success
        });
        return {
          success: false,
          error: 'Failed to fetch engagement data'
        };
      }

      const likes = likesResult.data || [];
      const comments = commentsResult.data || [];

      console.log(`[EngagementService] Found ${likes.length} likes and ${comments.length} comments for ${contentType} ${txId.substring(0, 12)}...`);

      // Calculate metrics
      const metrics = this.calculateEngagementMetrics(likes, comments);

      // Check user like status if user provided
      let userLikeStatus: UserLikeStatus | undefined;
      if (userAddress) {
        userLikeStatus = this.getUserLikeStatus(likes, userAddress);
      }

      const engagement: ContentEngagement = {
        txId,
        metrics,
        likes,
        comments,
        userLikeStatus
      };

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setCachedData(cacheKey, engagement);
      }

      return { success: true, data: engagement };
    } catch (error) {
      console.error(`[EngagementService] Error getting engagement for ${txId.substring(0, 12)}...`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get engagement data'
      };
    }
  }

  /**
   * Get all likes for a piece of content
   */
  async getLikesForContent(targetTxId: string): Promise<ApiResponse<IndexedLike[]>> {
    const cacheKey = `likes:${targetTxId}`;
    
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    try {
      // Search through transactions to find likes - use a more comprehensive approach
      const likes: IndexedLike[] = [];
      let batchesSearched = 0;
      let totalTransactionsScanned = 0;
      let totalLikeTransactionsFound = 0;

      console.log(`[EngagementService] Starting like search for ${targetTxId.substring(0, 12)}...`);

      // Use a much larger single batch to get more transactions at once
      // since getRecentTransactions doesn't support pagination
      const largeBatchSize = Math.min(this.config.maxSearchDepth, 1000); // Get up to 1000 transactions
      const txResult = await this.fetcher.getRecentTransactions(largeBatchSize);
      
      if (!txResult.success || !txResult.data) {
        console.log(`[EngagementService] Failed to fetch transactions for likes`);
        return { success: false, error: 'Failed to fetch transactions' };
      }

      totalTransactionsScanned = txResult.data.length;
      console.log(`[EngagementService] Fetched ${totalTransactionsScanned} recent transactions to search`);

      // Process each transaction
      for (const rawTx of txResult.data) {
        const verumTx = this.fetcher.parseVerumTransaction(rawTx);
        if (verumTx && verumTx.payload.type === TransactionType.LIKE) {
          totalLikeTransactionsFound++;
          // Check if this like targets our content
          if (verumTx.payload.parent_id === targetTxId) {
            console.log(`[EngagementService] ✓ Found like for ${targetTxId.substring(0, 12)}... from ${verumTx.senderAddress.substring(0, 12)}... at ${new Date(verumTx.blockTime * 1000).toISOString()}`);
            const like: IndexedLike = {
              txId: verumTx.txId,
              liker: verumTx.senderAddress,
              targetTxId: targetTxId,
              targetType: await this.determineContentType(targetTxId),
              timestamp: verumTx.blockTime
            };
            likes.push(like);
          }
        }
      }

      batchesSearched = 1;

      console.log(`[EngagementService] Like search complete for ${targetTxId.substring(0, 12)}...:`);
      console.log(`  - Batches searched: ${batchesSearched}`);
      console.log(`  - Total transactions scanned: ${totalTransactionsScanned}`);
      console.log(`  - Total LIKE transactions found: ${totalLikeTransactionsFound}`);
      console.log(`  - Matching likes found: ${likes.length}`);

      // Remove duplicates (same user liking multiple times)
      console.log(`[EngagementService] Before deduplication: ${likes.length} likes`);
      const uniqueLikes = this.deduplicateLikes(likes);
      console.log(`[EngagementService] After deduplication: ${uniqueLikes.length} likes`);

      if (uniqueLikes.length !== likes.length) {
        console.log(`[EngagementService] Removed ${likes.length - uniqueLikes.length} duplicate likes`);
        console.log(`[EngagementService] Duplicate details:`, likes.map(like => ({
          user: like.liker.substring(0, 12) + '...',
          time: new Date(like.timestamp * 1000).toISOString()
        })));
      }

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setCachedData(cacheKey, uniqueLikes);
      }

      return { success: true, data: uniqueLikes };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get likes'
      };
    }
  }

  /**
   * Get all comments for a piece of content
   */
  async getCommentsForContent(parentTxId: string): Promise<ApiResponse<IndexedComment[]>> {
    const cacheKey = `comments:${parentTxId}`;
    
    if (this.config.cacheEnabled) {
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    try {
      // Search through transactions to find comments - use a more comprehensive approach
      const comments: IndexedComment[] = [];
      let totalTransactionsScanned = 0;
      let totalCommentTransactionsFound = 0;

      console.log(`[EngagementService] Starting comment search for ${parentTxId.substring(0, 12)}...`);

      // Use a much larger single batch to get more transactions at once
      const largeBatchSize = Math.min(this.config.maxSearchDepth, 1000); // Get up to 1000 transactions
      const txResult = await this.fetcher.getRecentTransactions(largeBatchSize);
      
      if (!txResult.success || !txResult.data) {
        console.log(`[EngagementService] Failed to fetch transactions for comments`);
        return { success: false, error: 'Failed to fetch transactions' };
      }

      totalTransactionsScanned = txResult.data.length;
      console.log(`[EngagementService] Fetched ${totalTransactionsScanned} recent transactions to search for comments`);

      // Process each transaction
      for (const rawTx of txResult.data) {
        const verumTx = this.fetcher.parseVerumTransaction(rawTx);
        if (verumTx && verumTx.payload.type === TransactionType.COMMENT) {
          totalCommentTransactionsFound++;
          // Check if this comment targets our content
          if (verumTx.payload.parent_id === parentTxId) {
            console.log(`[EngagementService] ✓ Found comment for ${parentTxId.substring(0, 12)}... from ${verumTx.senderAddress.substring(0, 12)}...`);
            const comment: IndexedComment = {
              txId: verumTx.txId,
              author: verumTx.senderAddress,
              parentTxId: parentTxId,
              parentType: await this.determineParentType(parentTxId),
              content: verumTx.payload.content || '',
              timestamp: verumTx.blockTime,
              likeCount: 0, // Will be calculated separately if needed
              isLikedByUser: false
            };
            comments.push(comment);
          }
        }
      }

      console.log(`[EngagementService] Comment search complete for ${parentTxId.substring(0, 12)}...:`);
      console.log(`  - Total transactions scanned: ${totalTransactionsScanned}`);
      console.log(`  - Total COMMENT transactions found: ${totalCommentTransactionsFound}`);
      console.log(`  - Matching comments found: ${comments.length}`);

      // Sort comments by timestamp (oldest first)
      comments.sort((a, b) => a.timestamp - b.timestamp);

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setCachedData(cacheKey, comments);
      }

      return { success: true, data: comments };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comments'
      };
    }
  }

  /**
   * Check if a user has liked specific content
   */
  async hasUserLikedContent(targetTxId: string, userAddress: string): Promise<ApiResponse<UserLikeStatus>> {
    try {
      const likesResult = await this.getLikesForContent(targetTxId);
      if (!likesResult.success || !likesResult.data) {
        return { success: false, error: 'Failed to get likes data' };
      }

      const userLikeStatus = this.getUserLikeStatus(likesResult.data, userAddress);
      return { success: true, data: userLikeStatus };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check like status'
      };
    }
  }

  /**
   * Calculate engagement metrics from likes and comments
   */
  async calculateEngagementForContent(txId: string): Promise<ApiResponse<EngagementMetrics>> {
    try {
      const [likesResult, commentsResult] = await Promise.all([
        this.getLikesForContent(txId),
        this.getCommentsForContent(txId)
      ]);

      if (!likesResult.success || !commentsResult.success) {
        return {
          success: false,
          error: 'Failed to fetch engagement data'
        };
      }

      const likes = likesResult.data || [];
      const comments = commentsResult.data || [];
      const metrics = this.calculateEngagementMetrics(likes, comments);

      return { success: true, data: metrics };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate engagement'
      };
    }
  }

  /**
   * Determine the type of content for likes (can be post, story, or comment)
   */
  async determineContentType(txId: string): Promise<'post' | 'story' | 'comment'> {
    try {
      const txResult = await this.fetcher.getTransactionById(txId);
      if (txResult.success && txResult.data) {
        const verumTx = this.fetcher.parseVerumTransaction(txResult.data);
        if (verumTx) {
          switch (verumTx.payload.type) {
            case TransactionType.POST:
              return 'post';
            case TransactionType.STORY:
              return 'story';
            case TransactionType.COMMENT:
              return 'comment';
            default:
              return 'post'; // Default fallback
          }
        }
      }
    } catch (error) {
      // Fallback to 'post' if we can't determine the type
    }
    return 'post';
  }

  /**
   * Determine parent type for comments (only post or story can be parents)
   */
  async determineParentType(txId: string): Promise<'post' | 'story'> {
    try {
      const txResult = await this.fetcher.getTransactionById(txId);
      if (txResult.success && txResult.data) {
        const verumTx = this.fetcher.parseVerumTransaction(txResult.data);
        if (verumTx) {
          switch (verumTx.payload.type) {
            case TransactionType.POST:
              return 'post';
            case TransactionType.STORY:
              return 'story';
            case TransactionType.COMMENT:
              // Comments cannot be parents of other comments, 
              // if we reach here, treat as post
              return 'post';
            default:
              return 'post'; // Default fallback
          }
        }
      }
    } catch (error) {
      // Fallback to 'post' if we can't determine the type
    }
    return 'post';
  }

  /**
   * Clear engagement cache
   */
  clearCache(): void {
    console.log(`[EngagementService] Clearing cache (${this.cache.size} entries)`);
    this.cache.clear();
  }

  /**
   * Temporarily disable caching for debugging
   */
  disableCaching(): void {
    console.log(`[EngagementService] Caching disabled for debugging`);
    this.config.cacheEnabled = false;
    this.clearCache();
  }

  /**
   * Re-enable caching
   */
  enableCaching(): void {
    console.log(`[EngagementService] Caching re-enabled`);
    this.config.cacheEnabled = true;
  }

  /**
   * Clear expired cache entries
   */
  cleanExpiredCache(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  // =================
  // Private Methods
  // =================

  /**
   * Calculate engagement metrics from likes and comments data
   */
  private calculateEngagementMetrics(likes: IndexedLike[], comments: IndexedComment[]): EngagementMetrics {
    const now = Date.now() / 1000; // Convert to seconds
    const oneDayAgo = now - (24 * 60 * 60); // 24 hours ago

    // Count recent activity (last 24 hours)
    const recentLikes = likes.filter(like => like.timestamp > oneDayAgo).length;
    const recentComments = comments.filter(comment => comment.timestamp > oneDayAgo).length;

    return {
      likeCount: likes.length,
      commentCount: comments.length,
      totalEngagement: likes.length + comments.length,
      recentActivity: recentLikes + recentComments
    };
  }

  /**
   * Get user's like status for content
   */
  private getUserLikeStatus(likes: IndexedLike[], userAddress: string): UserLikeStatus {
    const userLike = likes.find(like => like.liker.toLowerCase() === userAddress.toLowerCase());
    
    return {
      hasLiked: !!userLike,
      likeTxId: userLike?.txId,
      likedAt: userLike?.timestamp
    };
  }

  /**
   * Remove duplicate likes (keep the most recent like from each user)
   */
  private deduplicateLikes(likes: IndexedLike[]): IndexedLike[] {
    const likesByUser = new Map<string, IndexedLike>();

    for (const like of likes) {
      const userKey = like.liker.toLowerCase();
      const existing = likesByUser.get(userKey);
      
      // Keep the most recent like from this user
      if (!existing || like.timestamp > existing.timestamp) {
        likesByUser.set(userKey, like);
      }
    }

    return Array.from(likesByUser.values());
  }

  /**
   * Get cached data if not expired
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.config.cacheTTL) {
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