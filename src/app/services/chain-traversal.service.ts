import { Injectable, inject } from '@angular/core';
import { KaspaApiService } from './kaspa-api.service';
import { TransactionPayload, ParsedTransaction, TransactionType, VERUM_VERSION, VERUM_PROTOCOL_CREATION_DATE, isCompatibleVersion } from '../types/transaction';

export interface ChainTraversalResult {
  transactions: ParsedTransaction[];
  subscriptions: ParsedTransaction[];
  lastTransactionId?: string;
  lastSubscribeId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChainTraversalService {
  private apiService = inject(KaspaApiService);

  /**
   * Find the most recent Verum transaction for a user and traverse backwards
   */
  async traverseUserChain(
    userAddress: string, 
    maxTransactions: number = 50,
    timeLimit?: number // Optional timestamp limit
  ): Promise<ChainTraversalResult> {
    // Step 1: Find the most recent Verum transaction
    const result = await this.findVerumEntryPoint(userAddress);
    if (!result.entryPoint) {
      return { transactions: [], subscriptions: [] };
    }

    // Step 2: Traverse the main transaction chain
    console.log(`[ChainTraversal] Entry point found for ${userAddress}: ${result.entryPoint.transactionId}`);
    console.log(`[ChainTraversal] Found ${result.allTransactions.length} pre-loaded transactions`);
    const transactions = await this.traverseTransactionChain(
      result.entryPoint, 
      maxTransactions, 
      timeLimit,
      result.allTransactions // Pass the found transactions
    );
    console.log(`[ChainTraversal] Final result: ${transactions.length} transactions for ${userAddress}`);

    // Step 3: Extract subscription transactions from the main chain
    const subscriptions = transactions.filter(tx => 
      tx.payload?.type === TransactionType.SUBSCRIBE || 
      tx.payload?.type === TransactionType.UNSUBSCRIBE
    );

    return {
      transactions,
      subscriptions,
      lastTransactionId: transactions[transactions.length - 1]?.transactionId,
      lastSubscribeId: subscriptions[subscriptions.length - 1]?.transactionId
    };
  }

  /**
   * Find the most recent Verum transaction by scanning recent transactions
   */
  private async findVerumEntryPoint(userAddress: string): Promise<{entryPoint: ParsedTransaction | null, allTransactions: ParsedTransaction[]}> {
    let offset = 0;
    const batchSize = 50;
    const maxBatches = 20; // Increased to search more thoroughly for subscription history
    const allUserTransactions: ParsedTransaction[] = []; // Local variable instead of instance property
    
    for (let batch = 0; batch < maxBatches; batch++) {
      try {
        const transactions = await this.apiService.getAddressTransactions(
          userAddress, 
          batchSize, 
          offset
        ).toPromise();

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
          break;
        }

        // Look for ALL Verum transactions for this user, not just the most recent
        const userVerumTransactions: ParsedTransaction[] = [];
        
        for (const tx of transactions) {
          // Check if transaction is older than protocol creation date
          if (tx.block_time && tx.block_time < VERUM_PROTOCOL_CREATION_DATE) {
            break; // Stop searching older transactions, but process what we found
          }

          const parsed = this.parseTransaction(tx, userAddress);
          if (parsed && this.isVerumTransaction(parsed) && parsed.authorAddress === userAddress) {
            userVerumTransactions.push(parsed);
          }
        }
        
        // Store all found transactions for later processing
        if (userVerumTransactions.length > 0) {
          allUserTransactions.push(...userVerumTransactions);
        }

        // Check if the last transaction in this batch is older than protocol creation
        const lastTx = transactions[transactions.length - 1];
        if (lastTx.block_time && lastTx.block_time < VERUM_PROTOCOL_CREATION_DATE) {
          break;
        }

        offset += batchSize;
      } catch (error) {
        console.error(`Error in batch ${batch}:`, error);
        break;
      }
    }
    
    if (allUserTransactions.length > 0) {
      // Sort by block time, newest first
      allUserTransactions.sort((a: ParsedTransaction, b: ParsedTransaction) => b.blockTime - a.blockTime);
      
      // Return the most recent one as the entry point
      const entryPoint = allUserTransactions[0];
      
      return { entryPoint, allTransactions: allUserTransactions };
    }

    return { entryPoint: null, allTransactions: [] };
  }

  /**
   * Traverse the main transaction chain - use all found transactions if chain is broken
   */
  private async traverseTransactionChain(
    startTransaction: ParsedTransaction,
    maxTransactions: number,
    timeLimit?: number,
    allFoundTransactions?: ParsedTransaction[]
  ): Promise<ParsedTransaction[]> {
    // Check if we have all transactions pre-loaded (from findVerumEntryPoint)
    if (allFoundTransactions && allFoundTransactions.length > 0) {
      // Filter by time limit if provided
      let filteredTransactions = allFoundTransactions;
      if (timeLimit) {
        filteredTransactions = allFoundTransactions.filter((tx: ParsedTransaction) => tx.blockTime >= timeLimit);
      }
      
      // Limit the number of transactions
      const limitedTransactions = filteredTransactions.slice(0, maxTransactions);
      
      return limitedTransactions;
    }
    
    // Fallback to traditional chain traversal if no pre-loaded transactions
    const transactions: ParsedTransaction[] = [startTransaction];
    let currentTx = startTransaction;
    
    while (transactions.length < maxTransactions) {
      const prevTxId = currentTx.payload?.prev_tx_id;
      
      if (!prevTxId) {
        break;
      }

      // Check protocol creation date threshold
      if (currentTx.blockTime < VERUM_PROTOCOL_CREATION_DATE) {
        break;
      }

      // Check time limit
      if (timeLimit && currentTx.blockTime < timeLimit) {
        break;
      }

      try {
        const prevTx = await this.fetchTransactionById(prevTxId);
        if (!prevTx) {
          break;
        }

        // Verify the previous transaction is also within protocol timeframe
        if (prevTx.blockTime < VERUM_PROTOCOL_CREATION_DATE) {
          break;
        }

        transactions.push(prevTx);
        currentTx = prevTx; 
      } catch (error) {
        console.error('Error fetching previous transaction:', error);
        break;
      }
    }

    return transactions;
  }


  /**
   * Fetch a single transaction by ID and parse it
   */
  private async fetchTransactionById(transactionId: string): Promise<ParsedTransaction | null> {
    try {
      const txData = await this.apiService.getTransaction(transactionId).toPromise();
      if (!txData) return null;

      // The response structure might vary, handle both direct transaction and wrapped response
      const tx = txData.transaction || txData;
      if (!tx) return null;

      return this.parseTransaction(tx, this.getTransactionAuthorAddress(tx)); // Extract author from transaction
    } catch (error) {
      console.error('Error fetching transaction:', transactionId, error);
      return null;
    }
  }

  /**
   * Parse a raw transaction into ParsedTransaction format
   */
  private parseTransaction(tx: any, userAddress: string): ParsedTransaction | null {
    try {
      if (!tx.transaction_id || !tx.block_time) {
        return null;
      }

      const parsed: ParsedTransaction = {
        transactionId: tx.transaction_id,
        authorAddress: this.getTransactionAuthorAddress(tx),
        amount: 0, // We'll calculate this if needed
        blockTime: tx.block_time,
        isAccepted: tx.is_accepted !== false,
        rawPayload: tx.payload
      };

      // Parse payload if present
      if (tx.payload) {
        parsed.payload = this.parseTransactionPayload(tx.payload);
      }

      return parsed;
    } catch (error) {
      console.error('Error parsing transaction:', error);
      return null;
    }
  }

  /**
   * Parse transaction payload from hex or script
   */
  private parseTransactionPayload(scriptData: string): TransactionPayload | null {
    try {
      let textData = '';

      // Try different parsing methods
      if (/^[0-9a-fA-F]+$/.test(scriptData)) {
        // It's hex data
        let hexData = scriptData;
        if (hexData.startsWith('6a')) {
          hexData = hexData.substring(2);
        }
        
        // Convert hex to bytes
        const bytes = new Uint8Array(hexData.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        textData = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      } else {
        // Assume it's already text
        textData = scriptData;
      }

      // Try to find JSON in the text
      const jsonMatch = textData.match(/\{.*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        
        // Only accept transactions with the current verum version
        if (!parsed.verum) {
          // Reject transactions without verum field
          return null;
        }
        
        // Validate verum version - accept compatible versions (0.1 and 0.2)
        if (!isCompatibleVersion(parsed.verum)) {
          return null;
        }
        
        return parsed as TransactionPayload;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if a transaction is a Verum protocol transaction
   */
  private isVerumTransaction(tx: ParsedTransaction): boolean {
    return tx.payload?.verum ? isCompatibleVersion(tx.payload.verum) : false;
  }

  /**
   * Get the latest transaction info for chain building
   */
  async getLatestTransactionInfo(userAddress: string): Promise<{ 
    lastTxId?: string, 
    lastSubscribeId?: string 
  }> {
    const result = await this.findVerumEntryPoint(userAddress);
    if (!result.entryPoint) {
      return {};
    }

    // Traverse the chain to find the latest subscription transaction
    const chainResult = await this.traverseUserChain(userAddress, 50);
    
    // Find the most recent subscription transaction
    const latestSubscription = chainResult.subscriptions
      .sort((a, b) => b.blockTime - a.blockTime)[0];

    return {
      lastTxId: result.entryPoint.transactionId,
      lastSubscribeId: latestSubscription?.transactionId
    };
  }

  /**
   * Extract author address from transaction outputs
   */
  private getTransactionAuthorAddress(tx: any): string {
    // Parse payload to determine transaction type
    let payload: any = null;
    try {
      if (tx.payload) {
        payload = this.parseTransactionPayload(tx.payload);
      }
    } catch (error) {
      // Could not parse payload
    }
    
    const isStartTransaction = payload?.type === 'start';
    
    // For START transactions, sender = recipient (self-transaction)
    if (isStartTransaction) {
      const firstOutput = tx.outputs?.find((output: any) => 
        output.script_public_key_type !== 'nulldata' && 
        output.script_public_key_address
      );
      
      const fallbackAddress = firstOutput?.script_public_key_address || '';
      if (fallbackAddress) {
        return fallbackAddress;
      }
      return '';
    }
    
    // For COMMENT/POST transactions, we need to determine sender from outputs
    // Pattern: output[0] = recipient (post author), output[1] = change (sender)
    if (tx.outputs && tx.outputs.length >= 2) {
      const recipientOutput = tx.outputs[0]; // Gets the payment
      const changeOutput = tx.outputs[1]; // Change back to sender
      
      if (recipientOutput?.script_public_key_address && changeOutput?.script_public_key_address) {
        const senderAddress = changeOutput.script_public_key_address;
        return senderAddress;
      }
    }
    
    // Fallback: if only one output, it might be the sender (for transactions without change)
    if (tx.outputs && tx.outputs.length === 1) {
      const singleOutput = tx.outputs[0];
      if (singleOutput?.script_public_key_address) {
        return singleOutput.script_public_key_address;
      }
    }
    
    return '';
  }
}