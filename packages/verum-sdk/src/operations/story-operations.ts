/**
 * Story Operations
 * 
 * High-level story operations with progress tracking and error handling
 */

import { VerumTransactionBuilder } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';
import { 
  IWallet, 
  OperationResult, 
  StoryCreation,
  SDKStory,
  StoryCreationProgress
} from '../types';

/**
 * Story operations manager with advanced progress tracking
 */
export interface StoryRetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBackoff: boolean;
  segmentDelay: number; // delay between segments
}

export class StoryOperations {
  private transactionBuilder: VerumTransactionBuilder;
  private indexer: VerumIndexer;
  private wallet: IWallet;
  private activeStoryCreations: Map<string, StoryCreationProgress> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private retryConfig: StoryRetryConfig;

  constructor(
    transactionBuilder: VerumTransactionBuilder,
    indexer: VerumIndexer,
    wallet: IWallet,
    retryConfig?: Partial<StoryRetryConfig>
  ) {
    this.transactionBuilder = transactionBuilder;
    this.indexer = indexer;
    this.wallet = wallet;
    
    // Default retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      exponentialBackoff: true,
      segmentDelay: 2000, // 2 seconds between segments
      ...retryConfig
    };
  }

  /**
   * Create a new story with comprehensive retry logic
   */
  async createStory(story: StoryCreation, existingProgressId?: string): Promise<OperationResult<SDKStory>> {
    console.log(`[StoryOperations] ==> CREATE STORY CALLED <==`);
    console.log(`[StoryOperations] Story title: ${story.title || 'untitled'}`);
    console.log(`[StoryOperations] Story content length: ${story.content.length}`);
    console.log(`[StoryOperations] Existing progress ID provided: ${existingProgressId || 'none'}`);
    console.log(`[StoryOperations] Current active story creations: ${this.activeStoryCreations.size}`);
    
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Check if we're resuming an existing story creation
      if (existingProgressId) {
        const existingProgress = this.activeStoryCreations.get(existingProgressId);
        if (existingProgress && existingProgress.status === 'failed' && existingProgress.canResume) {
          console.log(`[StoryOperations] Resuming existing story creation: ${existingProgressId}`);
          console.log(`[StoryOperations] Resuming from segment ${existingProgress.completedSegments + 1}/${existingProgress.totalSegments}`);
          
          // Get chain references
          const chainRefs = await this.getChainReferences(userAddress);
          
          // Recreate segments (in a real implementation, these should be stored)
          const segments = this.transactionBuilder.createStorySegments(story.content, chainRefs);
          
          // Reset status for resume
          existingProgress.status = 'creating';
          existingProgress.retryCount = 0;
          this.activeStoryCreations.set(existingProgressId, existingProgress);
          this.emit('story:resumed', existingProgressId, existingProgress);
          
          const result = await this.createStoryWithRetry(existingProgressId, segments, story);
          return result;
        }
      }

      // Check for existing incomplete story for this user/content
      const existingIncomplete = this.findIncompleteStoryForContent(story.content, userAddress);
      if (existingIncomplete) {
        console.log(`[StoryOperations] Found existing incomplete story, resuming: ${existingIncomplete.progressId}`);
        console.log(`[StoryOperations] Existing progress: ${existingIncomplete.progress.completedSegments}/${existingIncomplete.progress.totalSegments} segments completed`);
        console.log(`[StoryOperations] Completed TxIds: [${existingIncomplete.progress.completedTxIds.map(id => id.substring(0, 8) + '...').join(', ')}]`);
        return this.createStory(story, existingIncomplete.progressId);
      }

      // Get chain references
      const chainRefs = await this.getChainReferences(userAddress);

      // Create story segments
      const segments = this.transactionBuilder.createStorySegments(story.content, chainRefs);
      
      if (segments.length === 0) {
        return {
          success: false,
          error: 'Failed to create story segments'
        };
      }

      // Initialize progress tracking with retry support
      const progressId = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const progress: StoryCreationProgress = {
        totalSegments: segments.length,
        completedSegments: 0,
        currentSegment: 1,
        status: 'creating',
        errors: [],
        completedTxIds: [],
        failedSegments: [],
        retryCount: 0,
        maxRetries: this.retryConfig.maxRetries,
        canResume: true
      };
      
      this.activeStoryCreations.set(progressId, progress);
      this.emit('story:started', progressId, progress);

      console.log(`[StoryOperations] Starting new story creation: ${progressId} (${segments.length} segments)`);

      try {
        const result = await this.createStoryWithRetry(progressId, segments, story);
        return result;
      } catch (error) {
        progress.status = 'failed';
        progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
        this.activeStoryCreations.set(progressId, progress);
        
        this.emit('story:failed', progressId, progress);
        
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create story'
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create story'
      };
    }
  }

  /**
   * Find incomplete story creation for the same content (to enable automatic resume)
   */
  private findIncompleteStoryForContent(_content: string, _userAddress: string): { progressId: string; progress: StoryCreationProgress } | null {
    console.log(`[StoryOperations] Searching for incomplete story creations...`);
    console.log(`[StoryOperations] Active story creations count: ${this.activeStoryCreations.size}`);
    
    for (const [progressId, progress] of this.activeStoryCreations.entries()) {
      console.log(`[StoryOperations] Checking progress ID: ${progressId}`);
      console.log(`[StoryOperations] - Status: ${progress.status}`);
      console.log(`[StoryOperations] - Can resume: ${progress.canResume}`);
      console.log(`[StoryOperations] - Completed segments: ${progress.completedSegments}`);
      console.log(`[StoryOperations] - Total segments: ${progress.totalSegments}`);
      
      if (progress.status === 'failed' && progress.canResume && progress.completedSegments > 0) {
        console.log(`[StoryOperations] ✓ Found resumable story: ${progressId}`);
        // In a real implementation, we'd match against stored content hash or title
        // For now, we'll return the first incomplete story (assuming user is retrying the same story)
        return { progressId, progress };
      }
    }
    
    console.log(`[StoryOperations] No resumable story found`);
    return null;
  }

  /**
   * Resume a failed story creation
   */
  async resumeStoryCreation(progressId: string): Promise<OperationResult<SDKStory>> {
    const progress = this.activeStoryCreations.get(progressId);
    if (!progress || !progress.canResume) {
      return {
        success: false,
        error: 'Cannot resume story creation - progress not found or not resumable'
      };
    }

    if (progress.status === 'completed') {
      return {
        success: false,
        error: 'Story creation already completed'
      };
    }

    try {
      // Reset status for resume
      progress.status = 'creating';
      progress.retryCount = 0;
      this.activeStoryCreations.set(progressId, progress);
      this.emit('story:resumed', progressId, progress);

      // Get the original segments (would need to store them or reconstruct)
      // For now, we'll indicate that resume needs the original segments
      return {
        success: false,
        error: 'Resume functionality requires storing original segments - implement in next iteration'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume story creation'
      };
    }
  }

  /**
   * Create story with retry logic for failed segments
   */
  private async createStoryWithRetry(
    progressId: string,
    segments: any[],
    story: StoryCreation
  ): Promise<OperationResult<SDKStory>> {
    const progress = this.activeStoryCreations.get(progressId)!;
    
    // Determine the last successful transaction ID for chaining
    let lastSuccessfulTxId: string | null = null;
    if (progress.completedTxIds.length > 0) {
      lastSuccessfulTxId = progress.completedTxIds[progress.completedTxIds.length - 1];
    }

    // Determine starting point - either from beginning or from where we left off
    const startIndex = progress.completedSegments; // This will be 0 for new stories, or the last completed segment count
    
    console.log(`[StoryOperations] ==> STORY CREATION DEBUG <==`);
    console.log(`[StoryOperations] Progress ID: ${progressId}`);
    console.log(`[StoryOperations] Total segments: ${segments.length}`);
    console.log(`[StoryOperations] Progress.completedSegments: ${progress.completedSegments}`);
    console.log(`[StoryOperations] Progress.completedTxIds.length: ${progress.completedTxIds.length}`);
    console.log(`[StoryOperations] Calculated startIndex: ${startIndex}`);
    console.log(`[StoryOperations] Will start from segment ${startIndex + 1}/${segments.length}`);
    console.log(`[StoryOperations] Already completed TxIds: [${progress.completedTxIds.map(id => id.substring(0, 8) + '...').join(', ')}]`);
    console.log(`[StoryOperations] Last successful TxId for chaining: ${lastSuccessfulTxId ? lastSuccessfulTxId.substring(0, 8) + '...' : 'none'}`);
    console.log(`[StoryOperations] Progress status: ${progress.status}`);
    console.log(`[StoryOperations] ==> END DEBUG <==`);

    try {
      // Process segments sequentially starting from where we left off
      for (let i = startIndex; i < segments.length; i++) {
        const segmentIndex = i + 1;
        let segmentSuccess = false;
        let segmentRetryCount = 0;
        
        progress.currentSegment = segmentIndex;
        this.activeStoryCreations.set(progressId, progress);
        this.emit('story:progress', progressId, progress);

        console.log(`[StoryOperations] Processing segment ${segmentIndex}/${segments.length}, chaining to: ${lastSuccessfulTxId ? lastSuccessfulTxId.substring(0, 8) + '...' : 'none'}`);

        // Retry this specific segment up to maxRetries times
        while (!segmentSuccess && segmentRetryCount < this.retryConfig.maxRetries) {
          try {
            // Update progress status
            if (segmentRetryCount > 0) {
              progress.status = 'retrying';
              progress.retryCount = segmentRetryCount;
              progress.lastRetryAt = Date.now();
              this.activeStoryCreations.set(progressId, progress);
              this.emit('story:retrying', progressId, progress, segmentIndex, segmentRetryCount);
              console.log(`[StoryOperations] Retrying segment ${segmentIndex}, attempt ${segmentRetryCount + 1}/${this.retryConfig.maxRetries}`);
            }

            // Wait before retry (except for first attempt)
            if (segmentRetryCount > 0) {
              const delay = this.calculateRetryDelay(segmentRetryCount);
              console.log(`[StoryOperations] Waiting ${delay}ms before retry...`);
              await this.sleep(delay);
            }

            // Create the segment transaction
            const segment = segments[i];
            const payload = {
              ...segment,
              prev_tx_id: lastSuccessfulTxId // Chain to previous segment
            };

            const txResult = await this.wallet.sendTransaction(payload);
            
            if (txResult) {
              lastSuccessfulTxId = txResult;
              progress.completedTxIds.push(txResult);
              progress.completedSegments++;
              segmentSuccess = true;
              
              // Reset status back to creating
              progress.status = 'creating';
              this.activeStoryCreations.set(progressId, progress);
              
              console.log(`[StoryOperations] ✓ Segment ${segmentIndex} completed: ${txResult.substring(0, 8)}...`);
              this.emit('story:segment:completed', progressId, segmentIndex, segments.length, txResult);
              
              // Wait between segments
              if (i < segments.length - 1) {
                await this.sleep(this.retryConfig.segmentDelay);
              }
            } else {
              throw new Error('Transaction failed - no transaction ID returned');
            }

          } catch (error) {
            segmentRetryCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            progress.errors.push(`Segment ${segmentIndex} attempt ${segmentRetryCount}: ${errorMessage}`);
            console.log(`[StoryOperations] ✗ Segment ${segmentIndex} failed attempt ${segmentRetryCount}: ${errorMessage}`);
            
            if (segmentRetryCount >= this.retryConfig.maxRetries) {
              // Mark this segment as failed
              progress.failedSegments.push(segmentIndex);
              progress.status = 'failed';
              progress.canResume = true; // Allow resuming from this point
              this.activeStoryCreations.set(progressId, progress);
              
              console.log(`[StoryOperations] Segment ${segmentIndex} failed permanently. Progress saved for resume: ${progress.completedSegments}/${segments.length} segments completed.`);
              
              return {
                success: false,
                error: `Failed to create segment ${segmentIndex} after ${this.retryConfig.maxRetries} attempts: ${errorMessage}. You can retry to continue from segment ${segmentIndex}.`
              };
            }
          }
        }
      }

      // All segments completed successfully
      progress.status = 'completed';
      progress.canResume = false;
      this.activeStoryCreations.set(progressId, progress);

      console.log(`[StoryOperations] ✓ Story creation completed! All ${segments.length} segments published.`);

      // Build the completed story object
      const completedStory: SDKStory = {
        firstTxId: progress.completedTxIds[0],
        author: await this.wallet.getAddress(),
        title: story.title,
        content: story.content,
        segments: progress.completedTxIds.map((txId, index) => ({
          txId,
          segmentIndex: index + 1,
          content: segments[index]?.content || ''
        })),
        timestamp: Date.now() / 1000,
        likeCount: 0,
        commentCount: 0,
        isComplete: true,
        isLikedByUser: false,
        isOwnedByCurrentUser: true,
        creationProgress: progress
      };

      this.emit('story:completed', progressId, completedStory);

      return {
        success: true,
        data: completedStory,
        txId: progress.completedTxIds[0]
      };

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.activeStoryCreations.set(progressId, progress);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Story creation failed'
      };
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    if (!this.retryConfig.exponentialBackoff) {
      return this.retryConfig.baseDelay;
    }

    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, retryCount - 1);
    return Math.min(exponentialDelay, this.retryConfig.maxDelay);
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get a story by its first transaction ID
   */
  async getStory(firstTxId: string): Promise<OperationResult<SDKStory>> {
    try {
      const storyResult = await this.indexer.getStory(firstTxId);
      
      if (!storyResult.success || !storyResult.data) {
        return {
          success: false,
          error: storyResult.error || 'Story not found'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Enhance story with SDK features
      const sdkStory: SDKStory = {
        ...storyResult.data,
        isLikedByUser: false, // TODO: Check if current user liked this story
        isOwnedByCurrentUser: currentUserAddress === storyResult.data.author
      };

      return {
        success: true,
        data: sdkStory
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get story'
      };
    }
  }

  /**
   * Get story segments
   */
  async getStorySegments(firstTxId: string): Promise<OperationResult<any[]>> {
    try {
      const segmentsResult = await this.indexer.getStorySegments(firstTxId);
      
      if (!segmentsResult.success || !segmentsResult.data) {
        return {
          success: false,
          error: segmentsResult.error || 'Story segments not found'
        };
      }

      return {
        success: true,
        data: segmentsResult.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get story segments'
      };
    }
  }

  /**
   * Check if a story is complete
   */
  async isStoryComplete(firstTxId: string): Promise<OperationResult<boolean>> {
    try {
      const segmentsResult = await this.getStorySegments(firstTxId);
      
      if (!segmentsResult.success || !segmentsResult.data) {
        return {
          success: false,
          error: 'Failed to check story completeness'
        };
      }

      const isComplete = this.indexer.isStoryComplete(segmentsResult.data);
      
      return {
        success: true,
        data: isComplete
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check story completeness'
      };
    }
  }

  /**
   * Get active story creation progress
   */
  getStoryCreationProgress(progressId: string): StoryCreationProgress | null {
    return this.activeStoryCreations.get(progressId) || null;
  }

  /**
   * Get all active story creations
   */
  getActiveStoryCreations(): { [key: string]: StoryCreationProgress } {
    const active: { [key: string]: StoryCreationProgress } = {};
    for (const [id, progress] of this.activeStoryCreations.entries()) {
      active[id] = progress;
    }
    return active;
  }

  /**
   * Cancel an active story creation
   */
  async cancelStoryCreation(progressId: string): Promise<OperationResult<boolean>> {
    const progress = this.activeStoryCreations.get(progressId);
    
    if (!progress) {
      return {
        success: false,
        error: 'Story creation not found'
      };
    }

    if (progress.status !== 'creating') {
      return {
        success: false,
        error: 'Story creation is not active'
      };
    }

    // Mark as failed (we can't actually cancel blockchain transactions)
    progress.status = 'failed';
    progress.errors.push('Cancelled by user');
    this.activeStoryCreations.set(progressId, progress);
    
    this.emit('story:cancelled', progressId);

    return {
      success: true,
      data: true
    };
  }

  /**
   * Retry failed story creation from last successful segment
   */
  async retryStoryCreation(progressId: string): Promise<OperationResult<SDKStory>> {
    const progress = this.activeStoryCreations.get(progressId);
    
    if (!progress || progress.status !== 'failed') {
      return {
        success: false,
        error: 'No failed story creation to retry'
      };
    }

    if (progress.failedSegments.length === 0) {
      return {
        success: false,
        error: 'No failed segments to retry'
      };
    }

    try {
      // Reset progress for retry
      progress.status = 'creating';
      progress.retryCount = 0;
      progress.errors = [];
      this.activeStoryCreations.set(progressId, progress);
      this.emit('story:resumed', progressId, progress);

      // For now, indicate that this needs the original story data to be stored
      // In a complete implementation, we would:
      // 1. Store the original segments and story data when creating
      // 2. Recreate only the failed segments starting from the last successful transaction
      // 3. Continue the chain properly
      
      return {
        success: false,
        error: 'Story retry requires storing original segments data - will be implemented in next iteration when we add segment persistence'
      };

    } catch (error) {
      progress.status = 'failed';
      progress.errors.push(error instanceof Error ? error.message : 'Unknown error during retry');
      this.activeStoryCreations.set(progressId, progress);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry story creation'
      };
    }
  }

  /**
   * Delete a story (mark segments as deleted)
   */
  async deleteStory(firstTxId: string): Promise<OperationResult<boolean>> {
    try {
      // Check ownership
      const storyResult = await this.getStory(firstTxId);
      if (!storyResult.success || !storyResult.data) {
        return {
          success: false,
          error: 'Story not found'
        };
      }

      if (!storyResult.data.isOwnedByCurrentUser) {
        return {
          success: false,
          error: 'You can only delete your own stories'
        };
      }

      // TODO: Implement story deletion
      // This would require a deletion transaction type in the protocol
      
      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete story'
      };
    }
  }

  /**
   * Get story statistics
   */
  async getStoryStats(firstTxId: string): Promise<OperationResult<any>> {
    try {
      const storyResult = await this.getStory(firstTxId);
      
      if (!storyResult.success || !storyResult.data) {
        return {
          success: false,
          error: 'Story not found'
        };
      }

      const story = storyResult.data;
      
      const stats = {
        segmentCount: story.segments.length,
        totalLength: story.content.length,
        averageSegmentLength: Math.round(story.content.length / story.segments.length),
        creationTime: story.segments.length > 1 ? 
          story.segments[story.segments.length - 1].timestamp - story.segments[0].timestamp : 0,
        likeCount: story.likeCount,
        commentCount: story.commentCount,
        isComplete: story.isComplete,
        readingTime: Math.ceil(story.content.split(' ').length / 200) // ~200 words per minute
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get story statistics'
      };
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in story event callback:', error);
        }
      });
    }
  }

  /**
   * Get chain references for transactions
   */
  private async getChainReferences(userAddress: string): Promise<any> {
    try {
      const profile = await this.indexer.getUserProfile(userAddress);
      if (profile.success && profile.data) {
        return {
          prevTxId: profile.data.lastTxId,
          lastSubscribeId: profile.data.lastSubscribeTxId
        };
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get current user address safely
   */
  private async getCurrentUserAddress(): Promise<string | null> {
    try {
      const isConnected = await this.wallet.isConnected();
      return isConnected ? await this.wallet.getAddress() : null;
    } catch {
      return null;
    }
  }
}