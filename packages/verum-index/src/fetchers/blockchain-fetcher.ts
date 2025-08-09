/**
 * Blockchain Data Fetcher
 * 
 * Handles fetching raw transaction data from Kaspa blockchain and Kasplex API
 */

import { 
  BlockchainConfig, 
  RawTransaction, 
  VerumTransaction, 
  ApiResponse 
} from '../types';
import { TransactionPayload } from '@verum/protocol';

/**
 * Interface for blockchain data fetching operations
 */
export interface IBlockchainFetcher {
  /**
   * Fetch transactions for a specific address
   */
  getTransactionsByAddress(
    address: string, 
    limit?: number, 
    offset?: number
  ): Promise<ApiResponse<RawTransaction[]>>;

  /**
   * Fetch a specific transaction by ID
   */
  getTransactionById(txId: string): Promise<ApiResponse<RawTransaction>>;

  /**
   * Get the latest transactions from the network
   */
  getRecentTransactions(limit?: number): Promise<ApiResponse<RawTransaction[]>>;

  /**
   * Parse Verum protocol data from transaction outputs
   */
  parseVerumTransaction(rawTx: RawTransaction): VerumTransaction | null;

  /**
   * Get transaction count for an address
   */
  getTransactionCount(address: string): Promise<number>;

  /**
   * Check if a transaction exists
   */
  transactionExists(txId: string): Promise<boolean>;
}

/**
 * Configuration for Kaspa API endpoints
 */
export interface KaspaApiConfig extends BlockchainConfig {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
}

/**
 * Kaspa blockchain data fetcher implementation
 */
export class KaspaBlockchainFetcher implements IBlockchainFetcher {
  private config: KaspaApiConfig;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 30000; // 30 seconds

  constructor(config: KaspaApiConfig) {
    this.config = {
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 100,
      ...config
    };
    this.cache = new Map();
  }

  /**
   * Fetch transactions for a specific address
   */
  async getTransactionsByAddress(
    address: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ApiResponse<RawTransaction[]>> {
    const cacheKey = `txs:${address}:${limit}:${offset}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const url = `${this.config.kasplexApiUrl}/addresses/${address}/transactions?limit=${limit}&offset=${offset}`;
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const transactions = this.mapToRawTransactions(data.transactions || []);
      
      // Cache the result
      this.setCachedData(cacheKey, transactions);
      
      return {
        success: true,
        data: transactions,
        pagination: {
          offset,
          limit,
          total: data.total,
          hasMore: (offset + limit) < (data.total || 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transactions'
      };
    }
  }

  /**
   * Fetch a specific transaction by ID
   */
  async getTransactionById(txId: string): Promise<ApiResponse<RawTransaction>> {
    const cacheKey = `tx:${txId}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const url = `${this.config.kasplexApiUrl}/transactions/${txId}`;
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          return { success: false, error: 'Transaction not found' };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const transaction = this.mapToRawTransaction(data);
      
      // Cache the result
      this.setCachedData(cacheKey, transaction);
      
      return { success: true, data: transaction };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transaction'
      };
    }
  }

  /**
   * Get the latest transactions from the network
   */
  async getRecentTransactions(limit: number = 50): Promise<ApiResponse<RawTransaction[]>> {
    const cacheKey = `recent:${limit}`;
    
    // Check cache first (shorter TTL for recent data)
    const cached = this.getCachedData(cacheKey, 10000); // 10 seconds
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const url = `${this.config.kasplexApiUrl}/transactions/recent?limit=${limit}`;
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const transactions = this.mapToRawTransactions(data.transactions || []);
      
      // Cache the result
      this.setCachedData(cacheKey, transactions);
      
      return { success: true, data: transactions };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent transactions'
      };
    }
  }

  /**
   * Parse Verum protocol data from transaction outputs
   */
  parseVerumTransaction(rawTx: RawTransaction): VerumTransaction | null {
    try {
      // Look for Verum protocol data in transaction outputs
      for (const output of rawTx.outputs) {
        if (output.script_public_key?.script) {
          const scriptData = this.decodeScriptData(output.script_public_key.script);
          if (scriptData && this.isVerumProtocolData(scriptData)) {
            const payload = JSON.parse(scriptData) as TransactionPayload;
            
            return {
              txId: rawTx.transaction_id,
              blockTime: rawTx.block_time,
              senderAddress: this.extractSenderAddress(rawTx),
              payload,
              rawTransaction: rawTx
            };
          }
        }
      }
      
      return null;
    } catch (error) {
      // Invalid JSON or malformed data
      return null;
    }
  }

  /**
   * Get transaction count for an address
   */
  async getTransactionCount(address: string): Promise<number> {
    const cacheKey = `count:${address}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const url = `${this.config.kasplexApiUrl}/addresses/${address}/stats`;
      const response = await this.fetchWithRetry(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const count = data.transaction_count || 0;
      
      // Cache the result
      this.setCachedData(cacheKey, count);
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check if a transaction exists
   */
  async transactionExists(txId: string): Promise<boolean> {
    const result = await this.getTransactionById(txId);
    return result.success;
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, retries: number = 0): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Verum-Index/0.1.0'
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (retries < (this.config.maxRetries || 3)) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Map API response to RawTransaction array
   */
  private mapToRawTransactions(apiTransactions: any[]): RawTransaction[] {
    return apiTransactions.map(tx => this.mapToRawTransaction(tx));
  }

  /**
   * Map API response to RawTransaction
   */
  private mapToRawTransaction(apiTx: any): RawTransaction {
    return {
      transaction_id: apiTx.transaction_id || apiTx.txid,
      block_time: apiTx.block_time || apiTx.timestamp,
      inputs: (apiTx.inputs || []).map((input: any) => ({
        previous_outpoint: {
          transaction_id: input.previous_outpoint?.transaction_id || input.txid,
          index: input.previous_outpoint?.index || input.vout || 0
        },
        signature_script: input.signature_script || input.scriptSig || '',
        sequence: input.sequence || 0
      })),
      outputs: (apiTx.outputs || []).map((output: any) => ({
        amount: output.amount || output.value || 0,
        script_public_key: {
          version: output.script_public_key?.version || 0,
          script: output.script_public_key?.script || output.scriptPubKey || ''
        },
        address: output.address
      }))
    };
  }

  /**
   * Decode script data from hex string
   */
  private decodeScriptData(script: string): string | null {
    try {
      // Remove '0x' prefix if present
      const cleanScript = script.replace(/^0x/, '');
      
      // Convert hex to buffer
      const buffer = Buffer.from(cleanScript, 'hex');
      
      // Try to decode as UTF-8
      return buffer.toString('utf8');
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if decoded data is Verum protocol data
   */
  private isVerumProtocolData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed.verum === 'string' && typeof parsed.type === 'string';
    } catch {
      return false;
    }
  }

  /**
   * Extract sender address from transaction inputs
   */
  private extractSenderAddress(rawTx: RawTransaction): string {
    // In a real implementation, this would derive the address from the first input
    // For now, return a placeholder that should be replaced with actual address derivation
    return 'kaspa:qr' + rawTx.inputs[0]?.previous_outpoint.transaction_id.substring(0, 61) || 'unknown';
  }

  /**
   * Get cached data if not expired
   */
  private getCachedData(key: string, ttl: number = this.CACHE_TTL): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < ttl) {
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

  /**
   * Clear expired cache entries (available for future use)
   */
  // @ts-ignore - method reserved for future use
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }
}