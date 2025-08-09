/**
 * Transaction Confirmation Service
 * 
 * Monitors blockchain for transaction confirmations and provides real-time status updates
 */

import { VerumIndexer } from '@verum/index';
import { TransactionStatus, OperationResult } from '../types';

export interface TransactionConfirmationConfig {
  pollingInterval: number; // milliseconds
  maxRetries: number;
  timeout: number; // milliseconds
  enableDetailedLogging: boolean;
}

export interface ConfirmationEvents {
  'confirmation:pending': (txId: string) => void;
  'confirmation:found': (txId: string, confirmations: number) => void;
  'confirmation:confirmed': (txId: string, confirmations: number) => void;
  'confirmation:failed': (txId: string, error: string) => void;
  'confirmation:timeout': (txId: string) => void;
}

/**
 * Transaction confirmation service that monitors blockchain for transaction status
 */
export class TransactionConfirmationService {
  private indexer: VerumIndexer;
  private config: TransactionConfirmationConfig;
  private trackedTransactions: Map<string, TransactionStatus> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventListeners: Map<keyof ConfirmationEvents, Function[]> = new Map();

  constructor(indexer: VerumIndexer, config?: Partial<TransactionConfirmationConfig>) {
    this.indexer = indexer;
    this.config = {
      pollingInterval: 2000, // Poll every 2 seconds
      maxRetries: 30, // 30 retries = 1 minute max
      timeout: 60000, // 1 minute timeout
      enableDetailedLogging: false,
      ...config
    };
  }

  /**
   * Start tracking a transaction for confirmation
   */
  trackTransaction(txId: string, type: string): void {
    if (this.trackedTransactions.has(txId)) {
      return; // Already tracking
    }

    const status: TransactionStatus = {
      txId,
      status: 'pending',
      confirmations: 0,
      timestamp: Date.now(),
      type
    };

    this.trackedTransactions.set(txId, status);
    this.emit('confirmation:pending', txId);

    if (this.config.enableDetailedLogging) {
      console.log(`[TransactionConfirmation] Started tracking transaction: ${txId}`);
    }

    // Start polling for this transaction
    this.startPolling(txId);

    // Set timeout for transaction
    setTimeout(() => {
      const currentStatus = this.trackedTransactions.get(txId);
      if (currentStatus && currentStatus.status === 'pending') {
        this.handleTransactionTimeout(txId);
      }
    }, this.config.timeout);
  }

  /**
   * Get status of a tracked transaction
   */
  getTransactionStatus(txId: string): TransactionStatus | null {
    return this.trackedTransactions.get(txId) || null;
  }

  /**
   * Get all tracked transactions
   */
  getTrackedTransactions(): TransactionStatus[] {
    return Array.from(this.trackedTransactions.values());
  }

  /**
   * Stop tracking a transaction
   */
  stopTracking(txId: string): void {
    const interval = this.pollingIntervals.get(txId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(txId);
    }
    this.trackedTransactions.delete(txId);

    if (this.config.enableDetailedLogging) {
      console.log(`[TransactionConfirmation] Stopped tracking transaction: ${txId}`);
    }
  }

  /**
   * Clear all completed transactions
   */
  clearCompletedTransactions(): number {
    const completed = Array.from(this.trackedTransactions.entries())
      .filter(([_, status]) => status.status === 'confirmed' || status.status === 'failed');
    
    completed.forEach(([txId, _]) => {
      this.stopTracking(txId);
    });

    return completed.length;
  }

  /**
   * Manually check transaction status
   */
  async checkTransactionStatus(txId: string): Promise<OperationResult<TransactionStatus>> {
    try {
      const result = await this.indexer.getTransaction(txId);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to fetch transaction'
        };
      }

      if (!result.data) {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }

      // Transaction exists, determine confirmation status
      const currentTime = Date.now();
      const blockTime = result.data.block_time * 1000; // Convert to milliseconds
      const confirmations = this.calculateConfirmations(blockTime, currentTime);

      const status: TransactionStatus = {
        txId,
        status: confirmations >= 1 ? 'confirmed' : 'pending',
        confirmations,
        timestamp: blockTime,
        blockHeight: result.data.block_time // Use block_time as approximate height
      };

      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Add event listener
   */
  on<K extends keyof ConfirmationEvents>(event: K, callback: ConfirmationEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as Function);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof ConfirmationEvents>(event: K, callback: ConfirmationEvents[K]): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback as Function);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    // Clear all polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    
    this.pollingIntervals.clear();
    this.trackedTransactions.clear();
    this.eventListeners.clear();
  }

  // =================
  // Private Methods
  // =================

  /**
   * Start polling for a specific transaction
   */
  private startPolling(txId: string): void {
    let retryCount = 0;

    const pollTransaction = async () => {
      try {
        const statusResult = await this.checkTransactionStatus(txId);
        const currentStatus = this.trackedTransactions.get(txId);
        
        if (!currentStatus) {
          // Transaction was removed from tracking
          this.stopPolling(txId);
          return;
        }

        if (statusResult.success && statusResult.data) {
          const newStatus = statusResult.data;
          
          // Update stored status
          this.trackedTransactions.set(txId, {
            ...currentStatus,
            status: newStatus.status,
            confirmations: newStatus.confirmations,
            blockHeight: newStatus.blockHeight
          });

          if (newStatus.status === 'confirmed') {
            this.emit('confirmation:confirmed', txId, newStatus.confirmations);
            this.stopPolling(txId);
            
            if (this.config.enableDetailedLogging) {
              console.log(`[TransactionConfirmation] Transaction confirmed: ${txId} (${newStatus.confirmations} confirmations)`);
            }
            return;
          } else if (newStatus.confirmations > currentStatus.confirmations) {
            // More confirmations found
            this.emit('confirmation:found', txId, newStatus.confirmations);
            
            if (this.config.enableDetailedLogging) {
              console.log(`[TransactionConfirmation] Transaction found on blockchain: ${txId} (${newStatus.confirmations} confirmations)`);
            }
          }
        } else {
          // Transaction not found yet
          retryCount++;
          
          if (retryCount >= this.config.maxRetries) {
            this.handleTransactionFailed(txId, 'Max retries exceeded');
            return;
          }

          if (this.config.enableDetailedLogging) {
            console.log(`[TransactionConfirmation] Transaction not found yet: ${txId} (attempt ${retryCount}/${this.config.maxRetries})`);
          }
        }
      } catch (error) {
        retryCount++;
        
        if (retryCount >= this.config.maxRetries) {
          this.handleTransactionFailed(txId, error instanceof Error ? error.message : 'Unknown error');
          return;
        }

        if (this.config.enableDetailedLogging) {
          console.error(`[TransactionConfirmation] Error checking transaction ${txId}:`, error);
        }
      }
    };

    // Poll immediately, then set interval
    pollTransaction();
    const interval = setInterval(pollTransaction, this.config.pollingInterval);
    this.pollingIntervals.set(txId, interval);
  }

  /**
   * Stop polling for a specific transaction
   */
  private stopPolling(txId: string): void {
    const interval = this.pollingIntervals.get(txId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(txId);
    }
  }

  /**
   * Handle transaction timeout
   */
  private handleTransactionTimeout(txId: string): void {
    const status = this.trackedTransactions.get(txId);
    if (status) {
      status.status = 'failed';
      status.error = 'Transaction timeout';
      this.trackedTransactions.set(txId, status);
    }

    this.emit('confirmation:timeout', txId);
    this.stopPolling(txId);

    if (this.config.enableDetailedLogging) {
      console.log(`[TransactionConfirmation] Transaction timed out: ${txId}`);
    }
  }

  /**
   * Handle transaction failure
   */
  private handleTransactionFailed(txId: string, error: string): void {
    const status = this.trackedTransactions.get(txId);
    if (status) {
      status.status = 'failed';
      status.error = error;
      this.trackedTransactions.set(txId, status);
    }

    this.emit('confirmation:failed', txId, error);
    this.stopPolling(txId);

    if (this.config.enableDetailedLogging) {
      console.log(`[TransactionConfirmation] Transaction failed: ${txId} - ${error}`);
    }
  }

  /**
   * Calculate confirmations based on block time
   */
  private calculateConfirmations(blockTime: number, currentTime: number): number {
    // Kaspa has ~1 second block time
    // Simple approximation: each ~10 seconds = 1 confirmation level
    const timeDiff = currentTime - blockTime;
    const confirmations = Math.floor(timeDiff / 10000); // 10 seconds per confirmation level
    return Math.max(0, Math.min(confirmations, 100)); // Cap at 100 confirmations
  }

  /**
   * Emit event to listeners
   */
  private emit<K extends keyof ConfirmationEvents>(event: K, ...args: Parameters<ConfirmationEvents[K]>): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          (callback as any)(...args);
        } catch (error) {
          console.error(`Error in confirmation event callback for ${event}:`, error);
        }
      });
    }
  }
}