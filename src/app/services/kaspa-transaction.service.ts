import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, BehaviorSubject, throwError, firstValueFrom } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { WalletManagerService } from './wallet-manager.service';
import { KaspaApiService } from './kaspa-api.service';
import { ToastService } from './toast.service';
import { FeeCalculationService } from './fee-calculation.service';
import { UserContextService } from './user-context.service';
import {
  TransactionType,
  TransactionPayload,
  KaspaTransaction,
  ParsedTransaction,
  UserProfile,
  Post,
  Comment,
  Note,
  Like,
  Subscription,
  FeeEstimate,
  KaspaFeeEstimateResponse,
  TransactionAmountInfo,
  VERUM_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  isCompatibleVersion,
  isMajorVersionCompatible,
  parseProtocolVersion
} from '../types/transaction';

interface TransactionCache {
  [address: string]: {
    transactions: ParsedTransaction[];
    lastUpdated: number;
    lastTransactionId?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class KaspaTransactionService {
  private walletService = inject(WalletManagerService);
  private apiService = inject(KaspaApiService);
  private toastService = inject(ToastService);
  private feeCalculationService = inject(FeeCalculationService);
  private userContextService = inject(UserContextService);
  
  // Cache for parsed transactions
  private transactionCache = signal<TransactionCache>({});
  
  // Loading states
  private _isLoading = signal(false);
  public readonly isLoading = this._isLoading.asReadonly();
  
  // User profiles cache
  private userProfilesCache = signal<Map<string, UserProfile>>(new Map());
  
  // Fee estimates cache
  private feeEstimateCache = signal<FeeEstimate | null>(null);
  private lastFeeUpdate = 0;
  private readonly FEE_CACHE_DURATION = 60000; // 1 minute
  
  constructor() {
    this.setupWalletWatcher();
  }
  
  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    let previousAccount = '';
    
    setInterval(() => {
      const currentAccount = this.walletService.address();
      
      // If account changed (including disconnection)
      if (currentAccount !== previousAccount) {
        // Clear all caches when wallet changes
        this.clearAllCaches();
        
        previousAccount = currentAccount;
      }
    }, 500); // Check every 500ms
  }
  
  /**
   * Create and submit a transaction with JSON payload
   */
  public async createTransaction(
    payload: TransactionPayload,
    recipientAddress?: string,
    amountInKas?: number // Now optional, will be calculated based on action
  ): Promise<string> {
    try {
      if (!this.walletService.isConnected()) {
        throw new Error('Wallet not connected');
      }
      
      this._isLoading.set(true);
      
      // Get current user address
      const userAddress = this.walletService.address();
      if (!userAddress) {
        throw new Error('No wallet address available');
      }
      
      // Set timestamp if not provided
      if (!payload.timestamp) {
        payload.timestamp = Math.floor(Date.now() / 1000);
      }
      
      // Ensure verum is set
      if (!payload.verum) {
        payload.verum = VERUM_VERSION;
      }
      
      // Add v0.2+ protocol fields
      payload = this.enhancePayloadForV02Plus(payload);
      
      // Validate payload size as JSON string (max ~1000 bytes)
      const payloadJson = JSON.stringify(payload);
      const payloadSize = new TextEncoder().encode(payloadJson).length;
      
      if (payloadSize > 1000) {
        throw new Error('Payload too large. Maximum size is ~1000 bytes.');
      }
      
      // Use provided amount or calculate based on transaction type
      let finalAmountInKas = amountInKas;
      
      if (finalAmountInKas === undefined) {
        // Get calculated amount for this action type
        const actionType = payload.type;
        
        if (actionType === 'subscribe' || 
            actionType === 'comment' || 
            actionType === 'like') {
          finalAmountInKas = await firstValueFrom(this.feeCalculationService.calculateActionAmount(actionType));
        } else {
          finalAmountInKas = 0.001; // Default minimal amount for other transactions
        }
      }
      
      // Determine recipient (default to self for posts/comments)
      const recipient = recipientAddress || userAddress;
      
      // Convert KAS to sompi (1 KAS = 100,000,000 sompi)
      const amountInSompi = Math.floor(finalAmountInKas * 100000000);
      
      // Check wallet connection
      if (!this.walletService.isConnected()) {
        throw new Error('Wallet not connected');
      }
      
      // Get fee estimate (for debugging purposes)
      const feeEstimate = await this.getFeeEstimate();
      
      // Dynamic fee based on payload size and current network conditions
      // Larger payloads need higher fees, especially for story segments
      const baseFee = 1000; // 1000 sompi base
      const sizeFactor = Math.max(1, Math.floor(payloadSize / 200)); // Increase fee for larger payloads
      const fee = Math.min(baseFee * sizeFactor, 5000); // Cap at 5000 sompi
      
      console.log(`Transaction fee: ${fee} sompi (base: ${baseFee}, size factor: ${sizeFactor}, payload: ${payloadSize} bytes)`);
      
      // Create transaction payload for wallet manager
      const transactionPayload = {
        toAddress: recipient,
        amount: amountInSompi,
        priorityFee: fee,
        payload: payloadJson
      };
      
      // Create transaction with payload using wallet manager
      // Add timeout to detect wallet responsiveness issues
      const transactionPromise = this.walletService.sendTransaction(transactionPayload);
      
      // Timeout after 30 seconds to detect wallet issues
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Transaction timeout - wallet may be overloaded')), 30000);
      });
      
      const txResult = await Promise.race([transactionPromise, timeoutPromise]);
      
      // Extract transaction ID from result - handle both string and object responses
      let txId: string;
      if (typeof txResult === 'string') {
        txId = txResult;
      } else if (typeof txResult === 'object' && txResult !== null) {
        // If it's an object, try to extract the transaction ID
        txId = (txResult as any).transaction_id || 
               (txResult as any).txId || 
               (txResult as any).id || 
               JSON.stringify(txResult);
      } else {
        throw new Error('Invalid transaction result format');
      }
      
      // Ensure txId is a string and not too long (typical TX ID should be ~64 chars)
      if (typeof txId !== 'string') {
        txId = String(txId);
      }
      
      // If txId is suspiciously long (like a JSON object), try to extract just the ID
      if (txId.length > 100) {
        try {
          const parsed = JSON.parse(txId);
          txId = parsed.transaction_id || parsed.txId || parsed.id || txId.substring(0, 64);
        } catch (e) {
          // If parsing fails, just truncate to reasonable length
          txId = txId.substring(0, 64);
        }
      }
      
      // Clear cache for affected addresses
      this.clearCacheForAddress(userAddress);
      if (recipient !== userAddress) {
        this.clearCacheForAddress(recipient);
      }
      
      return txId;
      
    } catch (error: any) {
      // Check if it's a storage mass issue and adjust minimum amount
      if (error.message && error.message.toLowerCase().includes('storage mass')) {
        this.feeCalculationService.adjustMinimumAmountForMassIssue();
        
        this.toastService.error(
          `Transaction failed due to wallet storage mass. Minimum payment increased to ${this.feeCalculationService.getCurrentMinimumAmount()} KAS. Please try again.`,
          'Storage Mass Issue'
        );
      } else {
        this.toastService.error(
          error.message || 'Failed to create transaction',
          'Transaction Failed'
        );
      }
      
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }
  
  /**
   * Get all transactions for an address with caching
   */
  public getAddressTransactions(
    address: string,
    forceRefresh: boolean = false,
    limit: number = 50,
    suppressLoadingIndicator: boolean = false
  ): Observable<ParsedTransaction[]> {
    const cache = this.transactionCache();
    const cached = cache[address];
    
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && cached && cached.transactions && Date.now() - cached.lastUpdated < 30000) {
      return from([cached.transactions]);
    }
    
    if (!suppressLoadingIndicator) {
      this._isLoading.set(true);
    }
    
    return this.apiService.getAddressTransactions(address, limit, 0)
      .pipe(
        map(response => this.parseTransactionResponse(response, address)),
        map(transactions => {
          this.updateTransactionCache(address, transactions);
          if (!suppressLoadingIndicator) {
            this._isLoading.set(false);
          }
          return transactions;
        }),
        catchError(error => {
          if (!suppressLoadingIndicator) {
            this._isLoading.set(false);
          }
          return from([cached?.transactions || []]);
        })
      );
  }
  
  /**
   * Get transactions of a specific type for an address
   */
  public getTransactionsByType(
    address: string,
    type: TransactionType,
    limit: number = 50
  ): Observable<ParsedTransaction[]> {
    return this.getAddressTransactions(address, false, limit)
      .pipe(
        map(transactions => {
          const filtered = transactions.filter(tx => {
            const hasPayload = !!tx.payload;
            const payloadType = tx.payload?.type;
            const matches = payloadType === type;
            return matches;
          });
          
          // Only log for important transaction types
          if (type === TransactionType.START || type === TransactionType.POST) {
            console.log(`[TransactionService] Filtered to ${filtered.length} transactions of type ${type}`);
          }
          return filtered;
        })
      );
  }
  
  /**
   * Get user profile from start transaction
   */
  public getUserProfile(address: string, bypassCache: boolean = false, suppressLoadingIndicator: boolean = false): Observable<UserProfile | null> {
    console.log(`[TransactionService] 🔍 getUserProfile called:`, {
      address: address.substring(0, 20) + '...',
      bypassCache,
      suppressLoadingIndicator
    });
    
    // Check cache first (unless bypassing)
    if (!bypassCache) { 
      const cached = this.userProfilesCache().get(address);
      if (cached) {
        console.log(`[TransactionService] 💾 Returning cached profile for ${address.substring(0, 20)}...`);
        return from([cached]);
      }
    }
    
    console.log(`[TransactionService] 🌐 No cache hit, fetching from API for ${address.substring(0, 20)}...`);
    
    // Fetching transactions
    
    // Try v0.2 optimization first: look for any transaction with start_tx_id
    // This allows us to find the user profile without scanning for START transactions
    return from(this.tryGetProfileViaStartTxId(address, suppressLoadingIndicator)).pipe(
      switchMap(profile => {
        if (profile) {
          console.log(`[TransactionService] ✓ Found profile via v0.2 start_tx_id optimization`);
          return from([profile]);
        }
        
        console.log(`[TransactionService] No v0.2 start_tx_id found, falling back to START transaction search`);
        
        // Fallback: search for START transactions (v0.1 compatibility)  
        // Use higher limit to find older START transactions
        return this.getAddressTransactions(address, true, 100, suppressLoadingIndicator).pipe(
          switchMap(allTransactions => {        
            console.log(`[TransactionService] Found ${allTransactions.length} total transactions for ${address}`);
            // Now filter for START transactions
            return this.getTransactionsByType(address, TransactionType.START);
          }),
          map(startTransactions => {
            console.log(`[TransactionService] Found ${startTransactions.length} START transactions for ${address}`);
          
          if (startTransactions.length === 0) {
            console.log(`[TransactionService] ✗ No START transactions found for ${address}`);
            return null;
          }
          
          // Get the latest (newest) start transaction for current profile data
          const startTx = startTransactions.sort((a, b) => b.blockTime - a.blockTime)[0];
          console.log(`[TransactionService] Using START transaction: ${startTx.transactionId}`);
          console.log(`[TransactionService] Payload content: ${startTx.payload?.content?.substring(0, 100)}...`);
          
          if (!startTx.payload?.content) {  
            console.log(`[TransactionService] ✗ START transaction has no content`);
            return null;
          }
          
          // Parse nickname and avatar from content
          const [nickname, avatarBase64] = startTx.payload.content.split('|');
          console.log(`[TransactionService] Parsed nickname: ${nickname}`);
          
          const profile: UserProfile = {
            address,
            nickname: nickname || 'Anonymous',
            avatar: avatarBase64 || '',
            startTransactionId: startTx.transactionId,
            createdAt: startTx.payload?.timestamp || 0
          };
          
          // Cache the profile
          this.userProfilesCache.update(cache => {
            cache.set(address, profile);
            return cache;
          });
          
            console.log(`[TransactionService] ✓ Profile created for ${address}: ${profile.nickname}`);
            return profile;
          }),
          catchError(error => {
            console.error('[TransactionService] Error in getUserProfile fallback:', error);
            return from([null]);
          })
        );
      }),
      catchError(error => {
        console.error('[TransactionService] Error in getUserProfile:', error);
        return from([null]);
      })
    );
  }
  
  /**
   * Get posts from an address
   */
  public getPosts(address: string, limit: number = 50): Observable<Post[]> {
    console.log(`[TransactionService] Getting posts for address: ${address}`);
    return this.getTransactionsByType(address, TransactionType.POST, limit)
      .pipe(
        switchMap(transactions => {
          console.log(`[TransactionService] Found ${transactions.length} POST transactions for ${address}`);
          const posts: Post[] = transactions.map(tx => ({
            transactionId: tx.transactionId,
            authorAddress: tx.authorAddress,
            content: tx.payload?.content || '',
            timestamp: tx.payload?.timestamp || 0,
            blockTime: tx.blockTime
          }));
          
          console.log(`[TransactionService] Created ${posts.length} post objects`);
          
          // Get author profiles for all posts
          return this.enrichPostsWithProfiles(posts);
        })
      );
  }
  
  /**
   * Get notes from an address
   */
  public getNotes(address: string, limit: number = 50): Observable<Note[]> {
    console.log(`[TransactionService] Getting notes for address: ${address}`);
    return this.getTransactionsByType(address, TransactionType.NOTE, limit)
      .pipe(
        switchMap(transactions => {
          console.log(`[TransactionService] Found ${transactions.length} NOTE transactions for ${address}`);
          const notes: Note[] = transactions.map(tx => ({
            transactionId: tx.transactionId,
            authorAddress: tx.authorAddress,
            content: tx.payload?.content || '',
            timestamp: tx.payload?.timestamp || 0,
            blockTime: tx.blockTime,
            isEncrypted: true // Notes are always encrypted
          }));
          
          console.log(`[TransactionService] Created ${notes.length} note objects`);
          
          // Get author profiles for all notes
          return this.enrichNotesWithProfiles(notes);
        })
      );
  }
  
  /**
   * Get comments for a specific post
   */
  public getPostComments(postId: string, authorAddress: string): Observable<Comment[]> {
    return this.getTransactionsByType(authorAddress, TransactionType.COMMENT)
      .pipe(
        map(transactions => 
          transactions
            .filter(tx => tx.payload?.parent_id === postId)
            .map(tx => ({
              transactionId: tx.transactionId,
              authorAddress: tx.authorAddress,
              postId,
              content: tx.payload?.content || '',
              timestamp: tx.payload?.timestamp || 0,
              blockTime: tx.blockTime
            }))
        ),
        switchMap(comments => this.enrichCommentsWithProfiles(comments))
      );
  }
  
  /**
   * Get likes for a specific post
   */
  public getPostLikes(postId: string, authorAddress: string): Observable<Like[]> {
    return this.getTransactionsByType(authorAddress, TransactionType.LIKE)
      .pipe(
        map(transactions => 
          transactions
            .filter(tx => tx.payload?.parent_id === postId)
            .map(tx => ({
              transactionId: tx.transactionId,
              authorAddress: tx.authorAddress,
              postId,
              amount: tx.amount,
              timestamp: tx.payload?.timestamp || 0,
              blockTime: tx.blockTime
            }))
        )
      );
  }
  
  /**
   * Get user subscriptions (who the user is subscribed to)
   */
  public getUserSubscriptions(address: string): Observable<Subscription[]> {
    return this.getAddressTransactions(address)
      .pipe(
        map(transactions => {
          const subscriptions: Subscription[] = [];
          const unsubscriptions = new Set<string>();
          
          // Process all subscription-related transactions
          transactions.forEach(tx => {
            if (tx.payload?.type === TransactionType.SUBSCRIBE) {
              subscriptions.push({
                transactionId: tx.transactionId,
                subscriberAddress: tx.authorAddress,
                targetAddress: tx.recipientAddress!,
                amount: tx.amount,
                timestamp: tx.payload.timestamp,
                blockTime: tx.blockTime,
                isActive: true
              });
            } else if (tx.payload?.type === TransactionType.UNSUBSCRIBE) {
              unsubscriptions.add(tx.payload.content!);
            }
          });
          
          // Mark unsubscribed addresses as inactive
          subscriptions.forEach(sub => {
            if (unsubscriptions.has(sub.targetAddress)) {
              sub.isActive = false;
            }
          });
          
          return subscriptions.filter(sub => sub.isActive);
        })
      );
  }

  /**
   * Get user subscribers (who is subscribed to the user)
   * NOTE: Commented out for performance reasons - not scalable
   */
  // public getUserSubscribers(address: string): Observable<Subscription[]> {
  //   return this.getAddressTransactions(address)
  //     .pipe(
  //       map(transactions => {
  //         const subscribers: Subscription[] = [];
  //         const subscriberUnsubscriptions = new Map<string, boolean>();
  //         
  //         // First pass: collect all unsubscribe actions
  //         transactions.forEach(tx => {
  //           if (tx.payload?.type === TransactionType.UNSUBSCRIBE && 
  //               tx.payload.content === address) {
  //             subscriberUnsubscriptions.set(tx.authorAddress, true);
  //           }
  //         });
  //         
  //         // Second pass: collect subscribe transactions where this user is the recipient
  //         transactions.forEach(tx => {
  //           if (tx.payload?.type === TransactionType.SUBSCRIBE && 
  //               tx.recipientAddress === address) {
  //             // Check if this subscriber has unsubscribed
  //             const hasUnsubscribed = subscriberUnsubscriptions.has(tx.authorAddress);
  //             
  //             subscribers.push({
  //               transactionId: tx.transactionId,
  //               subscriberAddress: tx.authorAddress,
  //               targetAddress: address,
  //               amount: tx.amount,
  //               timestamp: tx.payload.timestamp,
  //               blockTime: tx.blockTime,
  //               isActive: !hasUnsubscribed
  //             });
  //           }
  //         });
  //         
  //         // Return only active subscribers
  //         return subscribers.filter(sub => sub.isActive);
  //       })
  //     );
  // }


  /**
   * Get a single transaction by ID
   */
  public getTransactionById(transactionId: string): Observable<ParsedTransaction | null> {
    // First check in cache
    const cache = this.transactionCache();
    for (const addressCache of Object.values(cache)) {
      const transaction = addressCache.transactions.find(tx => tx.transactionId === transactionId);
      if (transaction) {
        return from([transaction]);
      }
    }

    // If not in cache, query the API (would need API support)
    // For now, return null if not found in cache
    return from([null]);
  }

  /**
   * Get transactions that have a specific parent_id
   */
  public getTransactionsByParentId(parentId: string): Observable<ParsedTransaction[]> {
    // Collect all cached transactions and filter by parent_id
    const cache = this.transactionCache();
    const allTransactions: ParsedTransaction[] = [];
    
    for (const addressCache of Object.values(cache)) {
      allTransactions.push(...addressCache.transactions);
    }
    
    // Filter by parent_id
    const matchingTransactions = allTransactions.filter(tx => 
      tx.payload?.parent_id === parentId
    );
    
    return from([matchingTransactions]);
  }
  
  /**
   * Get current fee estimate
   */
  public async getFeeEstimate(): Promise<FeeEstimate> {
    const now = Date.now();
    const cached = this.feeEstimateCache();
    
    if (cached && now - this.lastFeeUpdate < this.FEE_CACHE_DURATION) {
      return cached;
    }
    
    try {
      const estimate = await this.apiService.getFeeEstimate().toPromise();
      
      if (estimate) {
        // Parse the actual API response format
        const parsedFees: FeeEstimate = {
          high_priority: estimate.priorityBucket?.feerate || 2000,
          normal_priority: estimate.normalBuckets?.[0]?.feerate || 1000,
          low_priority: estimate.lowBuckets?.[0]?.feerate || 500
        };
        
        
        this.feeEstimateCache.set(parsedFees);
        this.lastFeeUpdate = now;
        return parsedFees;
      }
    } catch (error) {
    }
    
    // Return default values if API fails - using minimal fees
    const defaultFees = {
      normal_priority: 1000,   // Minimal fee
      low_priority: 500,       // Very low fee  
      high_priority: 2000      // Low fee for priority
    };
    return defaultFees;
  }
  
  /**
   * Encode payload to hex string
   */
  public encodePayload(payload: TransactionPayload): string {
    try {
      const jsonString = JSON.stringify(payload);
      
      if (!jsonString || jsonString.trim() === '') {
        throw new Error('Empty JSON string generated');
      }
      
      const encoded = Array.from(new TextEncoder().encode(jsonString))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
        
      return encoded;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Decode hex payload to JSON
   */
  public decodePayload(hexString: string): TransactionPayload | null {
    try {
      if (!hexString || hexString.length % 2 !== 0) {
        return null;
      }
      
      // Validate hex string (only hex characters)
      if (!/^[0-9a-fA-F]+$/.test(hexString)) {
        return null;
      }
      
      const bytes = new Uint8Array(
        hexString.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      
      const jsonString = new TextDecoder().decode(bytes);
      
      if (!jsonString.trim()) {
        return null;
      }
      
      // Try to parse JSON, handle incomplete or malformed data
      let payload: any;
      try {
        payload = JSON.parse(jsonString);
      } catch (parseError) {
        return null;
      }
      
      // Ensure required fields exist
      if (!payload.type) {
        return null;
      }
      
      // Only accept transactions with a valid verum version
      if (!payload.verum) {
        console.log(`[TransactionService] ⚠️ Found transaction without verum field: type=${payload.type}, content=${payload.content?.substring(0, 50)}...`);
        // For backward compatibility, assume v0.1 if no version specified
        payload.verum = '0.1';
      }
      
      // Validate verum version using semantic versioning
      if (!isCompatibleVersion(payload.verum)) {
        console.log(`[TransactionService] ⚠️ Incompatible protocol version ${payload.verum}. Supported: [${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}]`);
        console.log(`[TransactionService] Transaction type: ${payload.type}, content: ${payload.content?.substring(0, 50)}...`);
        
        // Only reject if major version is incompatible
        if (!isMajorVersionCompatible(payload.verum)) {
          console.log(`[TransactionService] ✗ Major version incompatible, rejecting transaction`);
          return null;
        } else {
          // Minor version difference, accepting
        }
      } else {
        // Compatible version
      }
      
      return payload as TransactionPayload;
    } catch (error) {
      return null;
    }
  }
  
  
  /**
   * Clear cache for specific address
   */
  private clearCacheForAddress(address: string): void {
    this.transactionCache.update(cache => {
      delete cache[address];
      return { ...cache };
    });
    
    // Also clear user profile cache
    this.userProfilesCache.update(cache => {
      cache.delete(address);
      return new Map(cache);
    });
  }
  
  /**
   * Clear all caches (for wallet disconnect/change)
   */
  public clearAllCaches(): void {
    this.transactionCache.set({});
    this.userProfilesCache.set(new Map());
    this.feeEstimateCache.set(null);
    this.lastFeeUpdate = 0;
    this._isLoading.set(false);
  }
  
  /**
   * Enhance payload with v0.2+ protocol fields
   */
  private enhancePayloadForV02Plus(payload: TransactionPayload): TransactionPayload {
    // Add v0.2+ fields for versions 0.2 and above
    if (payload.verum === '0.2' || payload.verum === '0.3') {
      // For START transactions, don't add start_tx_id (they ARE the start transaction)
      if (payload.type !== TransactionType.START) {
        // Add reference to user's START transaction for quick profile lookup
        const startTxId = this.userContextService.getCurrentUserStartTxId();
        if (startTxId) {
          payload.start_tx_id = startTxId;
          console.log(`[TransactionService] Added start_tx_id to ${payload.type} transaction: ${startTxId.substring(0, 8)}...`);
        } else {
          console.warn(`[TransactionService] No START transaction ID available for user context`);
        }
      }
    }
    
    return payload;
  }
  
  /**
   * Try to get user profile via v0.2 start_tx_id optimization
   * This scans recent transactions for start_tx_id references, which is much faster
   * than searching through potentially hundreds of transactions for a START transaction
   */
  private async tryGetProfileViaStartTxId(address: string, suppressLoadingIndicator: boolean = false): Promise<UserProfile | null> {
    try {
      // Get a small number of recent transactions to look for start_tx_id references
      const recentTransactions = await this.getAddressTransactions(address, true, 20, suppressLoadingIndicator).toPromise();
      
      if (!recentTransactions || recentTransactions.length === 0) {
        return null;
      }
      
      // Look for any transaction with a start_tx_id field
      let startTxId: string | null = null;
      for (const tx of recentTransactions) {
        if (tx.payload?.start_tx_id) {
          startTxId = tx.payload.start_tx_id;
          console.log(`[TransactionService] Found start_tx_id reference: ${startTxId.substring(0, 8)}...`);
          break;
        }
      }
      
      if (!startTxId) {
        return null;
      }
      
      // Now fetch the START transaction directly by ID
      const startTransaction = await this.getTransactionById(startTxId).toPromise();
      if (!startTransaction || startTransaction.payload?.type !== TransactionType.START) {
        console.warn(`[TransactionService] start_tx_id ${startTxId} does not point to a valid START transaction`);
        return null;
      }
      
      // Parse the START transaction to create the profile
      if (!startTransaction.payload?.content) {
        return null;
      }
      
      const [nickname, avatarBase64] = startTransaction.payload.content.split('|');
      const profile: UserProfile = {
        address,
        nickname: nickname || 'Anonymous',
        avatar: avatarBase64 || '',
        startTransactionId: startTxId,
        createdAt: startTransaction.payload?.timestamp || 0
      };
      
      // Cache the profile
      this.userProfilesCache.update(cache => {
        cache.set(address, profile);
        return cache;
      });
      
      return profile;
      
    } catch (error) {
      console.error('[TransactionService] Error in tryGetProfileViaStartTxId:', error);
      return null;
    }
  }
  
  /**
   * Clear all data (for wallet disconnect/change)
   */
  public clearAllData(): void {
    this.clearAllCaches();
  }
  
  /**
   * Get payment amount information for a specific action
   */
  public getActionAmountInfo(action: TransactionType): Observable<TransactionAmountInfo> {
    return this.feeCalculationService.calculateActionAmount(action as any).pipe(
      map(kasAmount => {
        const priceInfo = this.feeCalculationService.getCurrentPrice();
        return firstValueFrom(priceInfo).then(info => ({
          action,
          kasAmount,
          usdEquivalent: kasAmount * info.kasPrice,
          formattedAmount: this.feeCalculationService.formatKasAmount(kasAmount),
          kasPrice: info.kasPrice
        }));
      }),
      switchMap(promise => from(promise))
    );
  }
  
  /**
   * Get all current payment amounts
   */
  public getAllAmounts(): Observable<TransactionAmountInfo[]> {
    const actions = [TransactionType.SUBSCRIBE, TransactionType.COMMENT, TransactionType.LIKE];
    return from(Promise.all(
      actions.map(action => firstValueFrom(this.getActionAmountInfo(action)))
    ));
  }
  
  /**
   * Parse API response into structured transactions
   */
  private parseTransactionResponse(
    response: any,
    address: string
  ): ParsedTransaction[] {
    // Handle both array response and object with transactions property
    const transactions = Array.isArray(response) ? response : response.transactions;
    
    if (!transactions || !Array.isArray(transactions)) {
      console.log(`[TransactionService] ⚠️ Invalid transactions format:`, {
        isArray: Array.isArray(response),
        hasTransactions: !!response?.transactions,
        type: typeof response
      });
      return [];
    }
    
    console.log(`[TransactionService] 📦 Parsing ${transactions.length} transactions for ${address.substring(0, 20)}...`);
    
    return transactions.map((tx: KaspaTransaction) => {
      const parsed: ParsedTransaction = {
        transactionId: tx.transaction_id,
        authorAddress: this.getTransactionAuthorAddress(tx),
        recipientAddress: this.getTransactionRecipientAddress(tx),
        amount: this.getTransactionAmount(tx),
        blockTime: tx.block_time,
        isAccepted: tx.is_accepted,
        rawPayload: tx.payload
      };
      
      // Decode payload if present  
      if (tx.payload) {
        // Try to decode as hex first (from blockchain)
        parsed.payload = this.decodePayload(tx.payload);
        
        // If hex decoding fails, try parsing as JSON directly
        if (!parsed.payload) {
          try {
            parsed.payload = JSON.parse(tx.payload) as TransactionPayload;
          } catch (error) {
            // Silently ignore malformed payloads
          }
        }
      }
      
      return parsed;
    }).filter((tx: ParsedTransaction) => tx.isAccepted); // Only accepted transactions
  }
  
  /**
   * Extract author address from transaction inputs
   */
  private getTransactionAuthorAddress(tx: KaspaTransaction): string {
    // Parse payload to determine transaction type
    let payload: any = null;
    try {
      if (tx.payload) {
        payload = this.decodePayload(tx.payload);
        if (!payload) {
          payload = JSON.parse(tx.payload);
        }
      }
    } catch (error) {
      // Could not parse payload
    }
    
    const isStartTransaction = payload?.type === 'start';
    
    // For START transactions, sender = recipient (self-transaction)
    if (isStartTransaction) {
      const firstOutput = tx.outputs?.find(output => 
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
  
  /**
   * Extract recipient address from transaction outputs
   */
  private getTransactionRecipientAddress(tx: KaspaTransaction): string | undefined {
    // Find the first non-OP_RETURN output
    const recipientOutput = tx.outputs?.find(output => 
      output.script_public_key_type !== 'nulldata' && 
      output.script_public_key_address
    );
    
    return recipientOutput?.script_public_key_address;
  }
  
  /**
   * Calculate transaction amount (excluding fees)
   */
  private getTransactionAmount(tx: KaspaTransaction): number {
    const totalOutput = tx.outputs
      ?.filter(output => output.script_public_key_type !== 'nulldata')
      .reduce((sum, output) => sum + parseInt(output.amount), 0) || 0;
    
    // Convert sompi to KAS
    return totalOutput / 100000000;
  }
  
  /**
   * Update transaction cache
   */
  private updateTransactionCache(address: string, transactions: ParsedTransaction[]): void {
    this.transactionCache.update(cache => ({
      ...cache,
      [address]: {
        transactions,
        lastUpdated: Date.now(),
        lastTransactionId: transactions[0]?.transactionId
      }
    }));
  }
  
  /**
   * Enrich posts with author profiles
   */
  private enrichPostsWithProfiles(posts: Post[]): Observable<Post[]> {
    const authorAddresses = [...new Set(posts.map(post => post.authorAddress))];
    
    const profileRequests = authorAddresses.map(address => 
      this.getUserProfile(address)
    );
    
    return from(Promise.all(profileRequests.map(req => req.toPromise())))
      .pipe(
        map(profiles => {
          const profileMap = new Map<string, UserProfile>();
          profiles.forEach((profile, index) => {
            if (profile) {
              profileMap.set(authorAddresses[index], profile);
            }
          });
          
          return posts.map(post => ({
            ...post,
            author: profileMap.get(post.authorAddress)
          }));
        })
      );
  }
  
  /**
   * Enrich comments with author profiles
   */
  private enrichCommentsWithProfiles(comments: Comment[]): Observable<Comment[]> {
    const authorAddresses = [...new Set(comments.map(comment => comment.authorAddress))];
    
    const profileRequests = authorAddresses.map(address => 
      this.getUserProfile(address)
    );
    
    return from(Promise.all(profileRequests.map(req => req.toPromise())))
      .pipe(
        map(profiles => {
          const profileMap = new Map<string, UserProfile>();
          profiles.forEach((profile, index) => {
            if (profile) {
              profileMap.set(authorAddresses[index], profile);
            }
          });
          
          return comments.map(comment => ({
            ...comment,
            author: profileMap.get(comment.authorAddress)
          }));
        })
      );
  }
  
  /**
   * Enrich notes with author profiles
   */
  private enrichNotesWithProfiles(notes: Note[]): Observable<Note[]> {
    const authorAddresses = [...new Set(notes.map(note => note.authorAddress))];
    
    const profileRequests = authorAddresses.map(address => 
      this.getUserProfile(address)
    );
    
    return from(Promise.all(profileRequests.map(req => req.toPromise())))
      .pipe(
        map(profiles => {
          const profileMap = new Map<string, UserProfile>();
          profiles.forEach((profile, index) => {
            if (profile) {
              profileMap.set(authorAddresses[index], profile);
            }
          });
          
          return notes.map(note => ({
            ...note,
            author: profileMap.get(note.authorAddress)
          }));
        })
      );
  }
}