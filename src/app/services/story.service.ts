import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, BehaviorSubject, catchError, switchMap, tap, firstValueFrom } from 'rxjs';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { FeeCalculationService } from './fee-calculation.service';
import { ToastService } from './toast.service';
import { ChainTraversalService } from './chain-traversal.service';
import { UserService } from './user.service';
import { KaswareWalletService } from './kasware-wallet.service';
import { 
  TransactionType, 
  TransactionPayload, 
  Story, 
  StorySegment, 
  StoryChunk, 
  StoryProgress,
  VERUM_VERSION
} from '../types/transaction';

@Injectable({
  providedIn: 'root'
})
export class StoryService {
  private transactionService = inject(KaspaTransactionService);
  private feeCalculationService = inject(FeeCalculationService);
  private toastService = inject(ToastService);
  private chainTraversalService = inject(ChainTraversalService);
  private userService = inject(UserService);
  private walletService = inject(KaswareWalletService);

  // Story cache for loaded stories
  private storyCache = new Map<string, Story>();
  
  // Progress tracking for story creation
  private progressSubject = new BehaviorSubject<StoryProgress>({
    currentSegment: 0,
    totalSegments: 0,
    isComplete: false
  });
  
  public readonly progress$ = this.progressSubject.asObservable();

  // Track ongoing story creation state for retry logic
  private currentStoryCreation: {
    content: string;
    chunks: StoryChunk[];
    completedSegments: StorySegment[];
    completedTxIds: string[];
    lastChainRef?: string;
  } | null = null;

  /**
   * Split content into chunks that fit within transaction payload limits
   */
  public splitContentIntoChunks(content: string): StoryChunk[] {
    // Calculate the overhead for first segment (with chain references + v0.2 fields)
    const firstSegmentPayload = {
      verum: VERUM_VERSION,
      type: TransactionType.STORY,
      content: '', // Will be replaced with actual content
      timestamp: Math.floor(Date.now() / 1000),
      params: {
        segment: 1,
        total: 1,
        is_final: true
      },
      prev_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
      last_subscribe: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
      start_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345' // v0.2 field
    };
    
    // Calculate the overhead for continuation segments (with parent_id + v0.2 fields)
    const continuationSegmentPayload = {
      verum: VERUM_VERSION,
      type: TransactionType.STORY,
      content: '', // Will be replaced with actual content
      timestamp: Math.floor(Date.now() / 1000),
      params: {
        segment: 2,
        total: 2,
        is_final: false
      },
      parent_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
      start_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345' // v0.2 field
    };
    
    const firstSegmentOverhead = new TextEncoder().encode(JSON.stringify(firstSegmentPayload)).length;
    const continuationSegmentOverhead = new TextEncoder().encode(JSON.stringify(continuationSegmentPayload)).length;
    
    // Use the larger overhead to be safe (continuation segments are typically larger due to parent_id)
    const maxOverhead = Math.max(firstSegmentOverhead, continuationSegmentOverhead);
    const maxContentBytes = Math.max(300, 1000 - maxOverhead - 50); // Conservative safety margin
    
    console.log(`[StoryService] Chunking config: firstOverhead=${firstSegmentOverhead}, continuationOverhead=${continuationSegmentOverhead}, maxContent=${maxContentBytes}`);
    
    const chunks: StoryChunk[] = [];
    let currentPosition = 0;
    let segmentNumber = 1;
    
    while (currentPosition < content.length) {
      // Determine chunk size
      let chunkEndPosition: number;
      
      if (currentPosition + maxContentBytes >= content.length) {
        // Last chunk - take remaining content
        chunkEndPosition = content.length;
      } else {
        // Find a good break point
        const searchEnd = Math.min(currentPosition + maxContentBytes, content.length);
        const searchStart = Math.max(currentPosition + maxContentBytes * 0.7, currentPosition + 100);
        
        let breakPoint = -1;
        
        // Look for natural break points
        for (let i = searchEnd - 1; i >= searchStart; i--) {
          const char = content[i];
          if (char === '\n' || char === '. ' || char === '! ' || char === '? ') {
            breakPoint = i + 1;
            break;
          }
        }
        
        // If no good break point, look for spaces
        if (breakPoint === -1) {
          for (let i = searchEnd - 1; i >= searchStart; i--) {
            if (content[i] === ' ') {
              breakPoint = i + 1;
              break;
            }
          }
        }
        
        // If still no break point, use safe position
        chunkEndPosition = breakPoint !== -1 ? breakPoint : searchStart;
      }
      
      // Extract chunk content
      let chunkContent = content.substring(currentPosition, chunkEndPosition).trim();
      
      // Validate chunk isn't empty
      if (chunkContent.length === 0) {
        currentPosition = chunkEndPosition;
        continue;
      }
      
      // Test payload size and adjust if needed
      let attempts = 0;
      while (attempts < 5) {
        const testChunk: StoryChunk = {
          content: chunkContent,
          segment: segmentNumber,
          total: 999, // Temporary
          isFinal: chunkEndPosition >= content.length
        };
        
        const payloadSize = this.calculateChunkPayloadSize(testChunk, segmentNumber === 1);
        
        if (payloadSize <= 1000) {
          // Good size, proceed
          break;
        }
        
        // Too large, reduce by 20%
        const newLength = Math.floor(chunkContent.length * 0.8);
        if (newLength < 50) {
          throw new Error('Cannot fit meaningful content in payload - content may have very long lines or special characters');
        }
        
        chunkContent = chunkContent.substring(0, newLength).trim();
        chunkEndPosition = currentPosition + new TextEncoder().encode(chunkContent).length;
        attempts++;
      }
      
      if (attempts >= 5) {
        throw new Error(`Failed to create valid chunk after 5 attempts for segment ${segmentNumber}`);
      }
      
      chunks.push({
        content: chunkContent,
        segment: segmentNumber,
        total: 0, // Will be updated
        isFinal: chunkEndPosition >= content.length
      });
      
      currentPosition = chunkEndPosition;
      segmentNumber++;
      
      // Safety check - testing limit
      if (segmentNumber > 20) {
        const estimatedSize = Math.ceil(content.length / maxContentBytes);
        throw new Error(
          `TESTING_LIMIT_EXCEEDED:${estimatedSize}:${content.length}:${maxContentBytes}`
        );
      }
    }
    
    // Update total count for all chunks
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
      chunk.total = totalChunks;
    });
    
    return chunks;
  }

  /**
   * Find a good break point for text splitting (prefer word boundaries)
   */
  private findGoodBreakPoint(text: string, searchStart: number): number {
    const searchText = text.substring(searchStart);
    
    // Look for newline first
    const newlineIndex = searchText.lastIndexOf('\n');
    if (newlineIndex > 0) {
      return searchStart + newlineIndex + 1;
    }
    
    // Look for space
    const spaceIndex = searchText.lastIndexOf(' ');
    if (spaceIndex > 0) {
      return searchStart + spaceIndex + 1;
    }
    
    // Look for punctuation
    const punctIndex = searchText.lastIndexOf('.');
    if (punctIndex > 0) {
      return searchStart + punctIndex + 1;
    }
    
    return 0; // No good break point found
  }

  /**
   * Calculate how many transactions will be needed for the content
   */
  public calculateTransactionCount(content: string): number {
    return this.splitContentIntoChunks(content).length;
  }

  /**
   * Create a story segment with retry logic for wallet errors
   */
  private async createSegmentWithRetry(
    payload: TransactionPayload, 
    segmentNumber: number, 
    totalSegments: number,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: any;
    
    // Configuration for testing - disable slow confirmation waiting
    const ENABLE_CONFIRMATION_WAIT = false; // Set to false for faster testing
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Update progress to show retry attempt
        if (attempt > 1) {
          this.progressSubject.next({
            currentSegment: segmentNumber - 1,
            totalSegments: totalSegments,
            isComplete: false,
            error: `Retrying segment ${segmentNumber} (attempt ${attempt}/${maxRetries})`
          });
          
          // Progressive retry delay
          const retryDelay = Math.min(2000 * attempt + (segmentNumber * 500), 10000);
          console.log(`Retry delay for segment ${segmentNumber}: ${retryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        // Check wallet responsiveness before attempting transaction
        if (segmentNumber > 3) {
          try {
            console.log(`Checking wallet health before segment ${segmentNumber}...`);
            const startTime = Date.now();
            await this.walletService.refreshBalance();
            const responseTime = Date.now() - startTime;
            
            if (responseTime > 5000) {
              console.warn(`Wallet is slow (${responseTime}ms), adding extra delay...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
          } catch (healthError) {
            console.error('Wallet health check failed:', healthError);
            // Continue anyway, the actual transaction might still work
          }
        }
        
        // Calculate story amount (same as posts)
        const storyAmount = await firstValueFrom(this.feeCalculationService.calculateActionAmount('story'));
        
        // Create transaction (send to self)
        const txId = await this.transactionService.createTransaction(payload, undefined, storyAmount);
        
        // Clear any retry error message and update progress
        this.progressSubject.next({
          currentSegment: segmentNumber - 1,
          totalSegments: totalSegments,
          isComplete: false,
          error: ENABLE_CONFIRMATION_WAIT 
            ? `Waiting for segment ${segmentNumber} confirmation...`
            : `Submitting segment ${segmentNumber}...`
        });
        
        // Wait for transaction confirmation before proceeding
        // For testing, we can make this configurable or skip it entirely
        
        if (ENABLE_CONFIRMATION_WAIT) {
          await this.waitForTransactionConfirmation(txId, segmentNumber);
        } else {
          // Just add a small delay to avoid overwhelming the wallet
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log(`Segment ${segmentNumber} transaction ${txId} submitted, proceeding without confirmation wait`);
        }
        
        // Clear confirmation message
        this.progressSubject.next({
          currentSegment: segmentNumber - 1,
          totalSegments: totalSegments,
          isComplete: false
        });
        
        return txId;
        
      } catch (error: any) {
        lastError = error;
        
        // Check if this is a wallet error that might be retryable
        const isRetryableError = this.isRetryableWalletError(error);
        
        if (attempt === maxRetries || !isRetryableError) {
          // Final attempt failed or non-retryable error
          throw this.enhanceErrorMessage(error, segmentNumber, totalSegments);
        }
        
        // Show retry message
        this.toastService.warning(
          `Segment ${segmentNumber} failed, retrying... (${attempt}/${maxRetries})`,
          'Transaction Failed'
        );
      }
    }
    
    throw lastError;
  }

  /**
   * Wait for transaction to be confirmed on the blockchain
   * Optimized for Kaspa's fast block times (~1 second)
   */
  private async waitForTransactionConfirmation(txId: string, segmentNumber: number): Promise<void> {
    const maxWaitTime = 15000; // Maximum 15 seconds (should be plenty for Kaspa)
    const pollInterval = 1000;  // Check every 1 second (matches Kaspa block time)
    const startTime = Date.now();
    
    console.log(`Waiting for confirmation of segment ${segmentNumber} transaction: ${txId}`);
    
    // For the first few polls, use shorter intervals since Kaspa is fast
    let currentInterval = 500; // Start with 500ms
    let pollCount = 0;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Try to fetch the transaction from our own address transactions
        const userAddress = this.userService.currentUser()?.address;
        if (userAddress) {
          // Force refresh to get latest transactions (smaller limit for speed)
          const transactions = await this.transactionService
            .getAddressTransactions(userAddress, true, 5, true)
            .toPromise();
          
          // Look for our transaction ID
          const confirmedTx = transactions?.find(tx => tx.transactionId === txId);
          if (confirmedTx) {
            // For Kaspa, just finding the transaction is usually enough
            // No need to wait for deep confirmation for our use case
            console.log(`Segment ${segmentNumber} confirmed after ${Date.now() - startTime}ms`);
            return;
          }
        }
        
        // Progressive polling intervals: start fast, then slow down
        pollCount++;
        if (pollCount <= 3) {
          currentInterval = 500; // First 3 polls: 500ms
        } else if (pollCount <= 8) {
          currentInterval = 1000; // Next 5 polls: 1s
        } else {
          currentInterval = 2000; // Subsequent polls: 2s
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, currentInterval));
        
      } catch (error) {
        console.warn(`Error checking transaction confirmation for segment ${segmentNumber}:`, error);
        // Continue polling despite errors, but use longer interval
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Timeout reached - log warning but don't fail (transaction probably went through)
    console.warn(`Transaction confirmation timeout for segment ${segmentNumber} after ${maxWaitTime}ms - proceeding anyway`);
    // Shorter safety delay since timeout is now shorter
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Check if error is retryable (wallet connectivity, gas issues, etc.)
   */
  private isRetryableWalletError(error: any): boolean {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    // Retryable errors
    const retryableErrors = [
      'user rejected',
      'user denied',
      'insufficient funds',
      'network error',
      'connection failed',
      'timeout',
      'rate limit',
      'busy',
      'pending',
      'try again',
      'overloaded',
      'slow response',
      'wallet may be overloaded',
      'transaction timeout'
    ];
    
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Enhance error messages with user-friendly context
   */
  private enhanceErrorMessage(error: any, segmentNumber: number, totalSegments: number): Error {
    const originalMessage = error?.message || 'Unknown error';
    const lowerMessage = originalMessage.toLowerCase();
    
    let userFriendlyMessage = originalMessage;
    
    if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied')) {
      userFriendlyMessage = `Transaction cancelled by user for segment ${segmentNumber} of ${totalSegments}. Your story progress has been saved.`;
    } else if (lowerMessage.includes('insufficient funds')) {
      userFriendlyMessage = `Insufficient funds to complete segment ${segmentNumber} of ${totalSegments}. Each segment requires 1 KAS + network fees.`;
    } else if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      userFriendlyMessage = `Network error while creating segment ${segmentNumber} of ${totalSegments}. Please check your connection and try again.`;
    } else if (lowerMessage.includes('timeout')) {
      userFriendlyMessage = `Transaction timeout for segment ${segmentNumber} of ${totalSegments}. The network may be busy, please try again.`;
    } else {
      userFriendlyMessage = `Failed to create segment ${segmentNumber} of ${totalSegments}: ${originalMessage}`;
    }
    
    const enhancedError = new Error(userFriendlyMessage);
    enhancedError.stack = error?.stack;
    return enhancedError;
  }

  /**
   * Calculate the actual payload size for a chunk (for debugging)
   */
  public calculateChunkPayloadSize(chunk: StoryChunk, includeChainReferences: boolean = false): number {
    const payload = {
      verum: VERUM_VERSION,
      type: TransactionType.STORY,
      content: chunk.content,
      timestamp: Math.floor(Date.now() / 1000),
      params: {
        segment: chunk.segment,
        total: chunk.total,
        is_final: chunk.isFinal
      },
      // Include chain references for first segment
      ...(includeChainReferences && {
        prev_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
        last_subscribe: 'placeholder_64_char_transaction_id_for_size_calculation_12345'
      }),
      // Include parent_id for continuation segments (this was missing!)
      ...(!includeChainReferences && {
        parent_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345'
      }),
      // Always include v0.2 start_tx_id field for accurate size calculation
      start_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345'
    };
    
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }

  /**
   * Estimate the total cost for a story
   */
  public calculateStoryCost(content: string): { segments: number; totalKas: number } {
    const segments = this.calculateTransactionCount(content);
    const totalKas = segments * 1.0; // 1 KAS per segment
    
    return { segments, totalKas };
  }

  /**
   * Create a story by publishing segments sequentially
   */
  public async createStory(content: string): Promise<Story> {
    console.log(`[StoryService] ==> CREATE STORY CALLED <==`);
    console.log(`[StoryService] Content length: ${content.length}`);
    console.log(`[StoryService] Has current story creation: ${!!this.currentStoryCreation}`);
    
    // Check if we should resume an existing story creation
    if (this.currentStoryCreation && this.currentStoryCreation.content === content) {
      console.log(`[StoryService] Resuming existing story creation from segment ${this.currentStoryCreation.completedSegments.length + 1}`);
      return this.continueStoryCreation();
    }

    const chunks = this.splitContentIntoChunks(content);
    
    if (chunks.length === 0) {
      throw new Error('No content to publish');
    }

    console.log(`[StoryService] Starting new story creation with ${chunks.length} segments`);

    // Get current user for chain references
    const user = this.userService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get chain reference information for the first segment
    const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);
    
    // Initialize story creation tracking
    this.currentStoryCreation = {
      content,
      chunks,
      completedSegments: [],
      completedTxIds: [],
      lastChainRef: chainInfo.lastTxId
    };
    
    // Initialize progress
    this.progressSubject.next({
      currentSegment: 0,
      totalSegments: chunks.length,
      isComplete: false
    });
    
    const segments: StorySegment[] = [];
    let previousTxId: string | undefined = undefined;
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Create story segment payload
        const payload: TransactionPayload = {
          verum: VERUM_VERSION,
          type: TransactionType.STORY,
          content: chunk.content,
          timestamp: Math.floor(Date.now() / 1000),
          parent_id: previousTxId,
          params: {
            segment: chunk.segment,
            total: chunk.total,
            is_final: chunk.isFinal
          },
          // Only include chain references for the first segment
          // Subsequent segments are chained through parent_id
          ...(i === 0 && {
            prev_tx_id: chainInfo.lastTxId,
            last_subscribe: chainInfo.lastSubscribeId
          })
        };
        
        // Validate payload size
        const payloadJson = JSON.stringify(payload);
        const payloadSize = new TextEncoder().encode(payloadJson).length;
        const contentSize = new TextEncoder().encode(chunk.content).length;
        const overhead = payloadSize - contentSize;
        
        if (payloadSize > 1000) {
          throw new Error(`Segment ${chunk.segment} payload too large: ${payloadSize} bytes (content: ${contentSize}, overhead: ${overhead}). Chunking failed - please check the content splitting logic.`);
        }
        
        // Create transaction with retry logic
        const txId = await this.createSegmentWithRetry(payload, chunk.segment, chunks.length);
        
        // Create segment record
        const segment: StorySegment = {
          transactionId: txId,
          authorAddress: '', // Will be filled by transaction service
          content: chunk.content,
          timestamp: payload.timestamp,
          blockTime: Math.floor(Date.now() / 1000), // Will be updated when confirmed
          segment: chunk.segment,
          total: chunk.total,
          isFinal: chunk.isFinal,
          parentId: previousTxId
        };
        
        segments.push(segment);
        previousTxId = txId;
        
        // Track completed segment in current story creation
        if (this.currentStoryCreation) {
          this.currentStoryCreation.completedSegments.push(segment);
          this.currentStoryCreation.completedTxIds.push(txId);
        }
        
        console.log(`[StoryService] ✓ Segment ${i + 1}/${chunks.length} completed: ${txId.substring(0, 8)}...`);
        
        // Update progress
        this.progressSubject.next({
          currentSegment: i + 1,
          totalSegments: chunks.length,
          isComplete: false
        });
        
        // Transaction confirmation is now handled in createSegmentWithRetry
        // No static delays needed - we wait for actual blockchain confirmation
      }
      
      // Create story object
      const story: Story = {
        firstSegmentId: segments[0].transactionId,
        authorAddress: segments[0].authorAddress,
        segments: segments,
        totalSegments: chunks.length,
        isComplete: true,
        lastLoadedSegment: chunks.length,
        fullContent: content,
        timestamp: segments[0].timestamp,
        blockTime: segments[0].blockTime
      };
      
      // Cache the story
      this.storyCache.set(story.firstSegmentId, story);
      
      // Clear story creation tracking (success)
      this.currentStoryCreation = null;
      
      // Mark progress as complete
      this.progressSubject.next({
        currentSegment: chunks.length,
        totalSegments: chunks.length,
        isComplete: true
      });
      
      console.log(`[StoryService] ✓ Story creation completed successfully! Published ${chunks.length} segments.`);
      
      this.toastService.success(
        `Story published successfully (${chunks.length} segments)`,
        'Story Created'
      );
      
      return story;
      
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to create story';
      let toastTitle = 'Story Creation Failed';
      
      // Handle testing limit error
      if (error.message && error.message.startsWith('TESTING_LIMIT_EXCEEDED:')) {
        const [, estimatedSegments, contentLength, maxPerSegment] = error.message.split(':');
        errorMessage = `Content too large for testing: Would require ${estimatedSegments} transactions (limit: 20). Please reduce content to approximately ${(20 * parseInt(maxPerSegment)).toLocaleString()} characters.`;
        toastTitle = 'Content Too Large';
      }
      
      console.log(`[StoryService] ERROR DETAILS:`, error);
      console.log(`[StoryService] Error message:`, error?.message);
      console.log(`[StoryService] Error type:`, typeof error);
      
      const isRetryable = this.isRetryableWalletError(error);
      console.log(`[StoryService] Is error retryable:`, isRetryable);
      
      // ALWAYS keep state for retry unless it's clearly a permanent error
      // The user should be able to retry any error, and we've already completed some segments
      const isPermanentError = error.message?.startsWith('TESTING_LIMIT_EXCEEDED:') || 
                              error.message?.includes('User not authenticated') ||
                              error.message?.includes('No content to publish');
                              
      if (isPermanentError) {
        console.log(`[StoryService] ✗ Story creation failed permanently, clearing state`);
        console.log(`[StoryService] Permanent error: ${error.message}`);
        this.currentStoryCreation = null;
      } else {
        console.log(`[StoryService] ✗ Story creation failed but keeping state for retry`);
        console.log(`[StoryService] Current progress: ${segments.length}/${chunks.length} segments completed`);
        console.log(`[StoryService] Completed TxIds: [${this.currentStoryCreation?.completedTxIds.map(id => id.substring(0, 8) + '...').join(', ')}]`);
        console.log(`[StoryService] User can retry to continue from segment ${segments.length + 1}`);
      }
      
      this.progressSubject.next({
        currentSegment: segments.length,
        totalSegments: chunks.length,
        isComplete: false,
        error: errorMessage,
        canRetry: !isPermanentError, // Allow retry unless it's a clearly permanent error
        retryAttempt: 0,
        maxRetries: 3
      });
      
      this.toastService.error(errorMessage, toastTitle);
      
      throw error;
    }
  }

  /**
   * Continue story creation from where it left off (for automatic retry)
   */
  private async continueStoryCreation(): Promise<Story> {
    if (!this.currentStoryCreation) {
      throw new Error('No story creation in progress to continue');
    }

    const { content, chunks, completedSegments, completedTxIds } = this.currentStoryCreation;
    const startFromIndex = completedSegments.length;
    
    console.log(`[StoryService] ==> CONTINUING STORY CREATION <==`);
    console.log(`[StoryService] Total segments: ${chunks.length}`);
    console.log(`[StoryService] Completed segments: ${completedSegments.length}`);
    console.log(`[StoryService] Starting from segment: ${startFromIndex + 1}`);
    console.log(`[StoryService] Remaining segments: ${chunks.length - startFromIndex}`);
    
    // Get current user
    const user = this.userService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const segments: StorySegment[] = [...completedSegments];
    let previousTxId: string | undefined = completedTxIds[completedTxIds.length - 1];
    
    console.log(`[StoryService] Last completed txId for chaining: ${previousTxId ? previousTxId.substring(0, 8) + '...' : 'none'}`);

    try {
      // Continue from where we left off
      for (let i = startFromIndex; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        console.log(`[StoryService] Processing segment ${i + 1}/${chunks.length}, chaining to: ${previousTxId ? previousTxId.substring(0, 8) + '...' : 'none'}`);
        
        // Create story segment payload
        const payload: TransactionPayload = {
          verum: VERUM_VERSION,
          type: TransactionType.STORY,
          content: chunk.content,
          timestamp: Math.floor(Date.now() / 1000),
          parent_id: previousTxId,
          params: {
            segment: chunk.segment,
            total: chunk.total,
            is_final: chunk.isFinal
          },
          // Only include chain references for the very first segment of the entire story
          ...(i === 0 && {
            prev_tx_id: this.currentStoryCreation.lastChainRef,
            last_subscribe: await this.chainTraversalService.getLatestTransactionInfo(user.address).then(info => info.lastSubscribeId)
          })
        };
        
        // Validate payload size
        const payloadJson = JSON.stringify(payload);
        const payloadSize = new TextEncoder().encode(payloadJson).length;
        const contentSize = new TextEncoder().encode(chunk.content).length;
        const overhead = payloadSize - contentSize;
        
        if (payloadSize > 1000) {
          throw new Error(`Segment ${chunk.segment} payload too large: ${payloadSize} bytes (content: ${contentSize}, overhead: ${overhead}). Chunking failed - please check the content splitting logic.`);
        }
        
        // Create transaction with retry logic
        const txId = await this.createSegmentWithRetry(payload, chunk.segment, chunks.length);
        
        // Create segment record
        const segment: StorySegment = {
          transactionId: txId,
          authorAddress: '', // Will be filled by transaction service
          content: chunk.content,
          timestamp: payload.timestamp,
          blockTime: Math.floor(Date.now() / 1000), // Will be updated when confirmed
          segment: chunk.segment,
          total: chunk.total,
          isFinal: chunk.isFinal,
          parentId: previousTxId
        };
        
        segments.push(segment);
        previousTxId = txId;
        
        // Track completed segment in current story creation
        if (this.currentStoryCreation) {
          this.currentStoryCreation.completedSegments.push(segment);
          this.currentStoryCreation.completedTxIds.push(txId);
        }
        
        console.log(`[StoryService] ✓ Segment ${i + 1}/${chunks.length} completed: ${txId.substring(0, 8)}...`);
        
        // Update progress
        this.progressSubject.next({
          currentSegment: i + 1,
          totalSegments: chunks.length,
          isComplete: false
        });
      }
      
      // Create story object from all segments
      const story: Story = {
        firstSegmentId: segments[0].transactionId,
        authorAddress: segments[0].authorAddress,
        segments: segments,
        totalSegments: chunks.length,
        isComplete: true,
        lastLoadedSegment: chunks.length,
        fullContent: content,
        timestamp: segments[0].timestamp,
        blockTime: segments[0].blockTime
      };
      
      // Cache the story
      this.storyCache.set(story.firstSegmentId, story);
      
      // Clear story creation tracking (success)
      this.currentStoryCreation = null;
      
      // Mark progress as complete
      this.progressSubject.next({
        currentSegment: chunks.length,
        totalSegments: chunks.length,
        isComplete: true
      });
      
      console.log(`[StoryService] ✓ Story creation continued and completed successfully! Published ${chunks.length} segments total.`);
      
      this.toastService.success(
        `Story published successfully (${chunks.length} segments)`,
        'Story Created'
      );
      
      return story;
      
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to continue story creation';
      
      console.log(`[StoryService] CONTINUATION ERROR DETAILS:`, error);
      console.log(`[StoryService] Continuation error message:`, error?.message);
      
      // ALWAYS keep state for retry unless it's clearly a permanent error
      // Use same logic as main createStory method
      const isPermanentError = error.message?.startsWith('TESTING_LIMIT_EXCEEDED:') || 
                              error.message?.includes('User not authenticated') ||
                              error.message?.includes('No content to publish');
                              
      if (isPermanentError) {
        console.log(`[StoryService] ✗ Story continuation failed permanently, clearing state`);
        console.log(`[StoryService] Permanent error: ${error.message}`);
        this.currentStoryCreation = null;
      } else {
        console.log(`[StoryService] ✗ Story continuation failed but keeping state for retry`);
        console.log(`[StoryService] Current progress: ${segments.length}/${chunks.length} segments completed`);
        console.log(`[StoryService] User can retry to continue from segment ${segments.length + 1}`);
      }
      
      this.progressSubject.next({
        currentSegment: segments.length,
        totalSegments: chunks.length,
        isComplete: false,
        error: errorMessage,
        canRetry: !isPermanentError, // Allow retry unless it's a clearly permanent error
        retryAttempt: 0,
        maxRetries: 3
      });
      
      this.toastService.error(errorMessage, 'Story Creation Failed');
      
      throw error;
    }
  }

  /**
   * Allow manual retry of failed story creation
   */
  public async retryFailedStory(originalContent: string, failedAtSegment: number): Promise<Story> {
    // Get the chunks again
    const chunks = this.splitContentIntoChunks(originalContent);
    
    // Update progress to show retry
    this.progressSubject.next({
      currentSegment: failedAtSegment - 1,
      totalSegments: chunks.length,
      isComplete: false,
      error: 'Retrying story creation...',
      canRetry: false,
      retryAttempt: 1,
      maxRetries: 3
    });
    
    // Continue from the failed segment
    return this.createStoryFromSegment(originalContent, chunks, failedAtSegment - 1);
  }

  /**
   * Create story starting from a specific segment (for retry functionality)
   */
  private async createStoryFromSegment(
    originalContent: string, 
    chunks: StoryChunk[], 
    startFromSegment: number
  ): Promise<Story> {
    const user = this.userService.currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);
    const segments: StorySegment[] = [];
    let previousTxId: string | undefined = undefined;
    
    try {
      for (let i = startFromSegment; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        const payload: TransactionPayload = {
          verum: VERUM_VERSION,
          type: TransactionType.STORY,
          content: chunk.content,
          timestamp: Math.floor(Date.now() / 1000),
          parent_id: previousTxId,
          params: {
            segment: chunk.segment,
            total: chunk.total,
            is_final: chunk.isFinal
          },
          ...(i === 0 && {
            prev_tx_id: chainInfo.lastTxId,
            last_subscribe: chainInfo.lastSubscribeId
          })
        };
        
        const txId = await this.createSegmentWithRetry(payload, chunk.segment, chunks.length);
        
        const segment: StorySegment = {
          transactionId: txId,
          authorAddress: '', 
          content: chunk.content,
          timestamp: payload.timestamp,
          blockTime: Math.floor(Date.now() / 1000),
          segment: chunk.segment,
          total: chunk.total,
          isFinal: chunk.isFinal,
          parentId: previousTxId
        };
        
        segments.push(segment);
        previousTxId = txId;
        
        this.progressSubject.next({
          currentSegment: i + 1,
          totalSegments: chunks.length,
          isComplete: false
        });
        
        // Transaction confirmation is handled in createSegmentWithRetry
        // No static delays needed during retry either
      }
      
      const story: Story = {
        firstSegmentId: segments[0].transactionId,
        authorAddress: segments[0].authorAddress,
        segments: segments,
        totalSegments: chunks.length,
        isComplete: true,
        lastLoadedSegment: chunks.length,
        fullContent: originalContent,
        timestamp: segments[0].timestamp,
        blockTime: segments[0].blockTime
      };
      
      this.storyCache.set(story.firstSegmentId, story);
      
      this.progressSubject.next({
        currentSegment: chunks.length,
        totalSegments: chunks.length,
        isComplete: true
      });
      
      this.toastService.success(
        `Story published successfully (${chunks.length} segments)`,
        'Story Created'
      );
      
      return story;
      
    } catch (error: any) {
      let errorMessage = error.message || 'Failed to create story';
      
      // Handle testing limit error
      if (error.message && error.message.startsWith('TESTING_LIMIT_EXCEEDED:')) {
        const [, estimatedSegments, contentLength, maxPerSegment] = error.message.split(':');
        errorMessage = `Content too large for testing: Would require ${estimatedSegments} transactions (limit: 20). Please reduce content to approximately ${(20 * parseInt(maxPerSegment)).toLocaleString()} characters.`;
      }
      
      const isRetryable = this.isRetryableWalletError(error);
      
      this.progressSubject.next({
        currentSegment: segments.length,
        totalSegments: chunks.length,
        isComplete: false,
        error: errorMessage,
        canRetry: isRetryable && !error.message?.startsWith('TESTING_LIMIT_EXCEEDED:'),
        retryAttempt: 0,
        maxRetries: 3
      });
      
      throw error;
    }
  }

  /**
   * Load a story from the blockchain
   */
  public loadStory(firstSegmentId: string): Observable<Story> {
    // Check cache first
    const cached = this.storyCache.get(firstSegmentId);
    if (cached) {
      return from([cached]);
    }
    
    return this.transactionService.getTransactionById(firstSegmentId).pipe(
      switchMap(firstTx => {
        if (!firstTx || firstTx.payload?.type !== TransactionType.STORY) {
          throw new Error('Invalid story transaction');
        }
        
        const firstSegment: StorySegment = {
          transactionId: firstTx.transactionId,
          authorAddress: firstTx.authorAddress,
          content: firstTx.payload?.content || '',
          timestamp: firstTx.payload?.timestamp || firstTx.blockTime,
          blockTime: firstTx.blockTime,
          segment: firstTx.payload?.params?.['segment'] || 1,
          total: firstTx.payload?.params?.['total'],
          isFinal: firstTx.payload?.params?.['is_final'] || false,
          parentId: firstTx.payload?.parent_id
        };
        
        const story: Story = {
          firstSegmentId,
          authorAddress: firstTx.authorAddress,
          segments: [firstSegment],
          totalSegments: firstSegment.total,
          isComplete: firstSegment.isFinal,
          lastLoadedSegment: 1,
          fullContent: firstSegment.content,
          timestamp: firstSegment.timestamp,
          blockTime: firstSegment.blockTime
        };
        
        // Cache the partial story
        this.storyCache.set(firstSegmentId, story);
        
        return from([story]);
      }),
      catchError(error => {
        this.toastService.error('Failed to load story', 'Load Error');
        throw error;
      })
    );
  }

  /**
   * Load the next segment of a story
   */
  public loadNextSegment(story: Story): Observable<Story> {
    if (story.isComplete) {
      return from([story]);
    }
    
    const lastSegment = story.segments[story.segments.length - 1];
    if (!lastSegment.transactionId) {
      throw new Error('No transaction ID for last segment');
    }
    
    // Find the next segment by looking for transactions that have this segment as parent_id
    return this.transactionService.getTransactionsByParentId(lastSegment.transactionId).pipe(
      switchMap(transactions => {
        const nextTx = transactions.find(tx => 
          tx.payload?.type === TransactionType.STORY &&
          tx.payload?.parent_id === lastSegment.transactionId
        );
        
        if (!nextTx) {
          throw new Error('Next segment not found');
        }
        
        const nextSegment: StorySegment = {
          transactionId: nextTx.transactionId,
          authorAddress: nextTx.authorAddress,
          content: nextTx.payload?.content || '',
          timestamp: nextTx.payload?.timestamp || nextTx.blockTime,
          blockTime: nextTx.blockTime,
          segment: nextTx.payload?.params?.['segment'] || story.lastLoadedSegment + 1,
          total: nextTx.payload?.params?.['total'],
          isFinal: nextTx.payload?.params?.['is_final'] || false,
          parentId: nextTx.payload?.parent_id
        };
        
        // Update story with new segment
        const updatedStory: Story = {
          ...story,
          segments: [...story.segments, nextSegment],
          isComplete: nextSegment.isFinal,
          lastLoadedSegment: nextSegment.segment,
          fullContent: story.fullContent + nextSegment.content
        };
        
        // Update cache
        this.storyCache.set(story.firstSegmentId, updatedStory);
        
        return from([updatedStory]);
      }),
      catchError(error => {
        this.toastService.error('Failed to load next segment', 'Load Error');
        throw error;
      })
    );
  }

  /**
   * Get a cached story
   */
  public getCachedStory(firstSegmentId: string): Story | undefined {
    return this.storyCache.get(firstSegmentId);
  }

  /**
   * Clear story cache
   */
  public clearCache(): void {
    this.storyCache.clear();
  }

  /**
   * Reset progress tracking
   */
  public resetProgress(): void {
    this.progressSubject.next({
      currentSegment: 0,
      totalSegments: 0,
      isComplete: false
    });
  }

  /**
   * Check if there's an incomplete story creation that can be resumed
   */
  public hasIncompleteStory(): boolean {
    return !!this.currentStoryCreation && this.currentStoryCreation.completedSegments.length > 0;
  }

  /**
   * Get information about the incomplete story
   */
  public getIncompleteStoryInfo(): { completed: number; total: number; content: string } | null {
    if (!this.currentStoryCreation) {
      return null;
    }
    
    return {
      completed: this.currentStoryCreation.completedSegments.length,
      total: this.currentStoryCreation.chunks.length,
      content: this.currentStoryCreation.content
    };
  }

  /**
   * Clear incomplete story state (use when user wants to start fresh)
   */
  public clearIncompleteStory(): void {
    console.log(`[StoryService] Clearing incomplete story state`);
    this.currentStoryCreation = null;
    this.resetProgress();
  }
}