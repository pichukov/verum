/**
 * Story Chunker Utility
 * 
 * Splits long story content into multiple segments that fit within protocol limits
 */

import { StoryChunk } from '../types';
import { PROTOCOL_LIMITS } from '../constants';

export interface StoryChunkerConfig {
  maxSegmentSize: number;
  minSegmentSize: number;
  maxSegments: number;
}

export class StoryChunker {
  private config: StoryChunkerConfig;

  constructor(config: Partial<StoryChunkerConfig> = {}) {
    this.config = {
      maxSegmentSize: config.maxSegmentSize || PROTOCOL_LIMITS.MAX_SEGMENT_SIZE,
      minSegmentSize: config.minSegmentSize || PROTOCOL_LIMITS.MIN_SEGMENT_SIZE,
      maxSegments: config.maxSegments || PROTOCOL_LIMITS.MAX_STORY_SEGMENTS
    };
  }

  /**
   * Split content into chunks that fit within transaction payload limits
   */
  splitIntoChunks(content: string): StoryChunk[] {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error('Content cannot be empty');
    }

    const chunks: StoryChunk[] = [];
    let currentPosition = 0;
    let segmentNumber = 1;

    while (currentPosition < trimmedContent.length) {
      // Check segment limit
      if (segmentNumber > this.config.maxSegments) {
        throw new Error(
          `Content too large - would require more than ${this.config.maxSegments} segments`
        );
      }

      // Determine chunk boundaries
      const { chunkContent, nextPosition } = this.extractChunk(
        trimmedContent,
        currentPosition
      );

      chunks.push({
        content: chunkContent,
        segment: segmentNumber,
        total: 0, // Will be updated after all chunks are created
        isFinal: nextPosition >= trimmedContent.length
      });

      currentPosition = nextPosition;
      segmentNumber++;
    }

    // Update total count for all chunks
    chunks.forEach(chunk => {
      chunk.total = chunks.length;
    });

    return chunks;
  }

  /**
   * Extract a single chunk from the content
   */
  private extractChunk(
    content: string,
    startPosition: number
  ): { chunkContent: string; nextPosition: number } {
    const remainingContent = content.length - startPosition;
    
    // If remaining content fits in one chunk, return it
    if (remainingContent <= this.config.maxSegmentSize) {
      return {
        chunkContent: content.substring(startPosition).trim(),
        nextPosition: content.length
      };
    }

    // Find a good break point
    const idealEnd = startPosition + this.config.maxSegmentSize;
    const minEnd = startPosition + Math.max(
      this.config.minSegmentSize,
      Math.floor(this.config.maxSegmentSize * 0.7)
    );

    // Look for natural break points (in order of preference)
    const breakPoints = [
      { char: '\n\n', offset: 2 },  // Paragraph break
      { char: '\n', offset: 1 },    // Line break
      { char: '. ', offset: 2 },    // Sentence end
      { char: '! ', offset: 2 },    // Exclamation
      { char: '? ', offset: 2 },    // Question
      { char: '; ', offset: 2 },    // Semicolon
      { char: ', ', offset: 2 },    // Comma
      { char: ' ', offset: 1 }      // Space
    ];

    let breakPosition = -1;

    // Search for break points from ideal position backwards
    for (const breakPoint of breakPoints) {
      const searchStart = Math.max(minEnd, startPosition);
      const searchEnd = Math.min(idealEnd, content.length);
      
      for (let i = searchEnd; i >= searchStart; i--) {
        if (content.substring(i).startsWith(breakPoint.char)) {
          breakPosition = i + breakPoint.offset;
          break;
        }
      }
      
      if (breakPosition !== -1) break;
    }

    // If no good break point found, use the minimum end position
    if (breakPosition === -1) {
      breakPosition = minEnd;
    }

    const chunkContent = content.substring(startPosition, breakPosition).trim();
    
    // Validate chunk size
    if (chunkContent.length < this.config.minSegmentSize) {
      // If chunk is too small, extend to minimum size
      breakPosition = Math.min(
        startPosition + this.config.minSegmentSize,
        content.length
      );
    }

    return {
      chunkContent: content.substring(startPosition, breakPosition).trim(),
      nextPosition: breakPosition
    };
  }

  /**
   * Calculate how many segments would be needed for the given content
   */
  calculateSegmentCount(content: string): number {
    try {
      const chunks = this.splitIntoChunks(content);
      return chunks.length;
    } catch (error) {
      // If content is too large, return estimated count
      return Math.ceil(content.length / this.config.maxSegmentSize);
    }
  }

  /**
   * Check if content would fit within segment limits
   */
  isWithinLimits(content: string): boolean {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return false;
    }
    
    try {
      const count = this.calculateSegmentCount(content);
      return count <= this.config.maxSegments;
    } catch {
      return false;
    }
  }
}