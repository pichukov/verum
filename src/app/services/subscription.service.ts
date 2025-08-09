import { Injectable, inject, signal, computed } from '@angular/core';
import { KaswareWalletService } from './kasware-wallet.service';
import { KaspaApiService } from './kaspa-api.service';
import { UserService } from './user.service';
import { ToastService } from './toast.service';
import { FeeCalculationService } from './fee-calculation.service';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { ChainTraversalService } from './chain-traversal.service';
import { firstValueFrom } from 'rxjs';
import { VERUM_VERSION, VERUM_PROTOCOL_CREATION_DATE, isCompatibleVersion } from '../types/transaction';

export interface Subscription {
  address: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  subscribedAt: number;
  isActive: boolean;
}

export interface UserSearchResult {
  address: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  hasProfile: boolean;
  startTransactionId?: string;
}

export enum TransactionType {
  START = 'start',
  POST = 'post',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe'
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private walletService = inject(KaswareWalletService);
  private apiService = inject(KaspaApiService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private feeCalculationService = inject(FeeCalculationService);
  private transactionService = inject(KaspaTransactionService);
  private chainTraversalService = inject(ChainTraversalService);

  // State
  private _subscriptions = signal<Subscription[]>([]);
  private _isLoading = signal(false);
  private _isSearching = signal(false);

  // Public readonly signals
  public readonly subscriptions = this._subscriptions.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isSearching = this._isSearching.asReadonly();

  // Computed values
  public readonly activeSubscriptions = computed(() => 
    this._subscriptions().filter(sub => sub.isActive)
  );
  
  constructor() {
    this.setupWalletWatcher();
  }
  
  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    let previousUser: string | null = null;
    
    setInterval(() => {
      const currentUser = this.userService.currentUser();
      const currentUserAddress = currentUser?.address || null;
      
      // If user changed (including logout)
      if (currentUserAddress !== previousUser) {
        
        // Clear subscriptions when user changes
        this.clearAllSubscriptions();
        
        previousUser = currentUserAddress;
      }
    }, 500); // Check every 500ms
  }

  /**
   * Validate Kaspa address format based on current network
   */
  validateKaspaAddress(address: string): { valid: boolean; error?: string } {
    if (!address || address.trim() === '') {
      return { valid: false, error: 'Address is required' };
    }

    const trimmedAddress = address.trim();
    const currentNetwork = this.walletService.network();


    // Network-specific validation
    if (currentNetwork === 'kaspa_mainnet') {
      // Mainnet addresses start with 'kaspa:' or are bare (without prefix)
      if (trimmedAddress.startsWith('kaspa:')) {
        // Validate kaspa: prefixed address
        const addressPart = trimmedAddress.substring(6);
        if (!/^[a-z0-9]+$/.test(addressPart) || addressPart.length < 58 || addressPart.length > 65) {
          return { valid: false, error: 'Invalid mainnet address format' };
        }
      } else {
        // Validate bare mainnet address
        if (!/^[a-z0-9]+$/.test(trimmedAddress) || trimmedAddress.length < 58 || trimmedAddress.length > 65) {
          return { valid: false, error: 'Invalid mainnet address format' };
        }
      }
    } else if (currentNetwork === 'kaspa_testnet_11' || currentNetwork === 'kaspa_testnet_10') {
      // Testnet addresses start with 'kaspatest:' or are bare
      if (trimmedAddress.startsWith('kaspatest:')) {
        // Validate kaspatest: prefixed address
        const addressPart = trimmedAddress.substring(10);
        if (!/^[a-z0-9]+$/.test(addressPart) || addressPart.length < 58 || addressPart.length > 65) {
          return { valid: false, error: 'Invalid testnet address format' };
        }
      } else {
        // Validate bare testnet address (less common but possible)
        if (!/^[a-z0-9]+$/.test(trimmedAddress) || trimmedAddress.length < 58 || trimmedAddress.length > 65) {
          return { valid: false, error: 'Invalid testnet address format' };
        }
      }
    } else if (currentNetwork === 'kaspa_devnet') {
      // Devnet addresses are typically bare
      if (!/^[a-z0-9]+$/.test(trimmedAddress) || trimmedAddress.length < 58 || trimmedAddress.length > 65) {
        return { valid: false, error: 'Invalid devnet address format' };
      }
    } else {
      // Unknown network, do basic validation
      if (trimmedAddress.startsWith('kaspa:') || trimmedAddress.startsWith('kaspatest:')) {
        const prefix = trimmedAddress.startsWith('kaspatest:') ? 'kaspatest:' : 'kaspa:';
        const addressPart = trimmedAddress.substring(prefix.length);
        if (!/^[a-z0-9]+$/.test(addressPart) || addressPart.length < 58 || addressPart.length > 65) {
          return { valid: false, error: 'Invalid address format' };
        }
      } else {
        if (!/^[a-z0-9]+$/.test(trimmedAddress) || trimmedAddress.length < 58 || trimmedAddress.length > 65) {
          return { valid: false, error: 'Invalid address format' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Search for user profile by address
   */
  async searchUserProfile(address: string, suppressLoadingIndicator: boolean = false): Promise<UserSearchResult | null> {
    try {
      if (!suppressLoadingIndicator) {
        this._isSearching.set(true);
      }

      // Validate address first
      const validation = this.validateKaspaAddress(address);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid address');
      }


      // Check current API network
      const currentApiNetwork = this.apiService.getCurrentNetwork();
      
      // Ensure API is on correct network for wallet
      this.ensureCorrectNetwork();

      // Get transaction history for the address
      const transactionResponse = await this.apiService.getAddressTransactions(address).toPromise();
      
      
      // Check if response is directly an array (like the curl response)
      let transactions: any[] = [];
      if (Array.isArray(transactionResponse)) {
        transactions = transactionResponse;
      } else if (transactionResponse?.transactions) {
        transactions = transactionResponse.transactions;
      } else {
        return {
          address,
          nickname: 'Unknown User',
          hasProfile: false
        };
      }
      
      
      // Filter transactions to only those within protocol timeframe
      const validTransactions = transactions.filter((tx: any) => {
        return tx.block_time && tx.block_time >= VERUM_PROTOCOL_CREATION_DATE;
      });

      // Look for START transaction (profile creation)
      const startTransaction = validTransactions.find((tx: any) => {
        try {

          // Check if transaction has a payload (Verum transactions store data in payload field)
          if (!tx.payload) {
            return false;
          }


          // Try to parse the payload
          const payload = this.parseTransactionPayload(tx.payload);
          
          
          if (!payload) {
            return false;
          }

          const isStartTransaction = isCompatibleVersion(payload.verum) && payload.type === TransactionType.START;

          return isStartTransaction;
        } catch (error) {
          return false;
        }
      });

      if (!startTransaction) {
        return {
          address,
          nickname: 'Unknown User',
          hasProfile: false
        };
      }

      // Parse user data from START transaction payload
      const payload = this.parseTransactionPayload(startTransaction.payload);
      
      if (!payload || !payload.content) {
        return {
          address,
          nickname: 'Unknown User',
          hasProfile: false
        };
      }

      // Parse user data (nickname|avatar format)
      const [nickname, avatar] = payload.content.split('|');

      return {
        address,
        nickname: nickname || 'Anonymous',
        avatar: avatar || undefined,
        hasProfile: true,
        startTransactionId: startTransaction.transaction_id
      };

    } catch (error: any) {
      throw error;
    } finally {
      if (!suppressLoadingIndicator) {
        this._isSearching.set(false);
      }
    }
  }

  /**
   * Subscribe to a user
   */
  async subscribeToUser(userProfile: UserSearchResult): Promise<void> {
    try {
      this._isLoading.set(true);

      if (!userProfile.hasProfile) {
        throw new Error('Cannot subscribe to user without profile');
      }

      // Get current user to prevent self-subscription
      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Prevent self-subscription
      if (userProfile.address === currentUser.address) {
        throw new Error('Cannot subscribe to yourself');
      }

      // Get chain reference information
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(currentUser.address);
      
      // Create SUBSCRIBE transaction (this becomes the new last_subscribe)
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.SUBSCRIBE,
        content: userProfile.address,
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId // Previous subscription in chain
      };

      const payloadJson = JSON.stringify(payload);
      const payloadSize = new TextEncoder().encode(payloadJson).length;

      if (payloadSize > 1000) {
        throw new Error('Subscription data too large for blockchain storage');
      }

      // Get calculated amount for subscription
      const subscriptionAmount = await firstValueFrom(
        this.feeCalculationService.calculateActionAmount('subscribe')
      );
      
      // Send transaction to the target address with calculated amount
      const txId = await this.walletService.sendKaspa(
        userProfile.address,
        subscriptionAmount,
        { payload: payloadJson }
      );

      // Add to local subscriptions
      const newSubscription: Subscription = {
        address: userProfile.address,
        nickname: userProfile.nickname,
        avatar: userProfile.avatar,
        bio: userProfile.bio,
        subscribedAt: Date.now(),
        isActive: true
      };

      this._subscriptions.update(subs => [...subs, newSubscription]);

      // Save to localStorage
      this.saveSubscriptions();

      this.toastService.success(
        `Successfully subscribed to ${userProfile.nickname}`,
        'Subscription Added'
      );


    } catch (error: any) {
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Unsubscribe from a user
   */
  async unsubscribeFromUser(subscription: Subscription): Promise<void> {
    try {
      this._isLoading.set(true);

      // Get current user for chain info
      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Get chain reference information  
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(currentUser.address);
      
      // Create UNSUBSCRIBE transaction
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.UNSUBSCRIBE,
        content: subscription.address,
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId
      };

      // Create transaction using transaction service (sends to self with 1 KAS)
      const txId = await this.transactionService.createTransaction(
        payload,
        undefined, // undefined = send to self
        1 // 1 KAS to avoid storage mass issues
      );

      // Mark as inactive locally
      this._subscriptions.update(subs => 
        subs.map(sub => 
          sub.address === subscription.address 
            ? { ...sub, isActive: false }
            : sub
        )
      );

      // Save to localStorage
      this.saveSubscriptions();

      this.toastService.success(
        `Successfully unsubscribed from ${subscription.nickname}`,
        'Subscription Removed'
      );


    } catch (error: any) {
      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load subscriptions from blockchain and localStorage
   */
  async loadSubscriptions(suppressLoadingIndicator: boolean = false): Promise<void> {
    try {
      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        return;
      }
      
      // Load subscriptions from blockchain transactions
      await this.loadSubscriptionsFromBlockchain(currentUser.address, suppressLoadingIndicator);
      
    } catch (error) {
      console.error('Failed to load subscriptions from blockchain:', error);
      // Fallback to localStorage if blockchain loading fails
      this.loadSubscriptionsFromStorage();
    }
  }

  /**
   * Load subscriptions from blockchain using chain traversal
   */
  private async loadSubscriptionsFromBlockchain(userAddress: string, suppressLoadingIndicator: boolean = false): Promise<void> {
    try {
      console.log(`[SubscriptionService] Loading subscriptions for ${userAddress}`);
      // Use chain traversal to get user's transaction history (increased limit for subscription history)
      const chainResult = await this.chainTraversalService.traverseUserChain(userAddress, 200);
      
      console.log(`[SubscriptionService] Chain result: ${chainResult.transactions.length} transactions, ${chainResult.subscriptions.length} subscription transactions`);
      
      if (!chainResult.subscriptions || chainResult.subscriptions.length === 0) {
        console.log(`[SubscriptionService] No subscription transactions found`);
        this._subscriptions.set([]);
        return;
      }
      
      const subscriptions: Subscription[] = [];
      const unsubscriptions = new Set<string>();
      let subscribeCount = 0;
      let unsubscribeCount = 0;
      
      // Process subscription transactions in chronological order (oldest first)
      const sortedTransactions = chainResult.subscriptions.sort((a, b) => a.blockTime - b.blockTime);
      
      for (const tx of sortedTransactions) {
        if (!tx.payload) continue;
        
        if (tx.payload.type === TransactionType.SUBSCRIBE && tx.payload.content) {
          const targetAddress = tx.payload.content;
          subscribeCount++;
          console.log(`[SubscriptionService] Processing SUBSCRIBE to ${targetAddress}`);
          
          // Ignore self-subscriptions
          if (targetAddress === userAddress) {
            console.log(`[SubscriptionService] Ignoring self-subscription`);
            continue;
          }
          
          // Remove from unsubscriptions if it was there
          unsubscriptions.delete(targetAddress);
          
          // Remove any existing subscription to this address (in case of re-subscribe)
          const existingIndex = subscriptions.findIndex(sub => sub.address === targetAddress);
          if (existingIndex !== -1) {
            subscriptions.splice(existingIndex, 1);
          }
          
          // Try to get profile for the subscribed user using the main transaction service
          // This ensures consistency with how profiles are loaded in the feed
          try {
            const profile = await this.transactionService.getUserProfile(targetAddress, false, suppressLoadingIndicator).toPromise();
            console.log(`[SubscriptionService] Profile search result for ${targetAddress}:`, profile ? 'FOUND' : 'NOT FOUND');
            if (profile) {
              subscriptions.push({
                address: targetAddress,
                nickname: profile.nickname,
                avatar: profile.avatar,
                bio: undefined, // Subscriptions don't have bio field in the schema
                subscribedAt: (tx.payload.timestamp || 0) * 1000, // Convert to milliseconds
                isActive: true
              });
              console.log(`[SubscriptionService] Added subscription to ${profile.nickname} (${targetAddress})`);
            } else {
              console.log(`[SubscriptionService] Profile not found for ${targetAddress}, adding as Unknown User`);
              // Add subscription even without profile
              subscriptions.push({
                address: targetAddress,
                nickname: 'Unknown User',
                subscribedAt: (tx.payload.timestamp || 0) * 1000,
                isActive: true
              });
              console.log(`[SubscriptionService] Added subscription to Unknown User (${targetAddress})`);
            }
          } catch (error) {
            console.log(`[SubscriptionService] Error getting profile for ${targetAddress}, adding as Unknown User:`, error);
            // Add subscription even without profile
            subscriptions.push({
              address: targetAddress,
              nickname: 'Unknown User',
              subscribedAt: (tx.payload.timestamp || 0) * 1000,
              isActive: true
            });
            console.log(`[SubscriptionService] Added subscription to Unknown User (${targetAddress}) after error`);
          }
        } else if (tx.payload.type === TransactionType.UNSUBSCRIBE && tx.payload.content) {
          const targetAddress = tx.payload.content;
          unsubscribeCount++;
          
          unsubscriptions.add(targetAddress);
          
          // Remove from subscriptions
          const existingIndex = subscriptions.findIndex(sub => sub.address === targetAddress);
          if (existingIndex !== -1) {
            subscriptions.splice(existingIndex, 1);
          }
        }
      }
      
      // Debug logging to help diagnose subscription filtering issues
      console.log('Subscription processing complete:', {
        totalTransactionsProcessed: sortedTransactions.length,
        subscribeTransactions: subscribeCount,
        unsubscribeTransactions: unsubscribeCount,
        finalActiveSubscriptions: subscriptions.length,
        activeAddresses: subscriptions.map(s => ({
          address: s.address.substring(0, 20) + '...',
          nickname: s.nickname,
          subscribedAt: new Date(s.subscribedAt).toISOString()
        })),
        unsubscribedAddresses: Array.from(unsubscriptions)
      });
      
      this._subscriptions.set(subscriptions);
      
      // Save to localStorage for faster loading next time
      this.saveSubscriptions();
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load subscriptions from localStorage (fallback)
   */
  private loadSubscriptionsFromStorage(): void {
    try {
      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        return;
      }
      
      // Clean up old non-wallet-specific key if it exists
      const oldKey = 'verum_subscriptions';
      if (localStorage.getItem(oldKey)) {
        localStorage.removeItem(oldKey);
      }
      
      // Use wallet-specific key
      const storageKey = `verum_subscriptions_${currentUser.address}`;
      const saved = localStorage.getItem(storageKey);
      
      if (saved) {
        const subscriptions = JSON.parse(saved) as Subscription[];
        this._subscriptions.set(subscriptions);
      } else {
        this._subscriptions.set([]); // Ensure empty array
      }
    } catch (error) {
    }
  }

  /**
   * Save subscriptions to localStorage
   */
  private saveSubscriptions(): void {
    try {
      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        console.warn('No user available to save subscriptions');
        return;
      }
      
      // Use wallet-specific key
      const storageKey = `verum_subscriptions_${currentUser.address}`;
      localStorage.setItem(storageKey, JSON.stringify(this._subscriptions()));
    } catch (error) {
    }
  }

  /**
   * Check if user is subscribed to an address
   */
  isSubscribedTo(address: string): boolean {
    return this.activeSubscriptions().some(sub => sub.address === address);
  }

  /**
   * Get subscription by address
   */
  getSubscription(address: string): Subscription | undefined {
    return this.activeSubscriptions().find(sub => sub.address === address);
  }

  /**
   * Parse transaction payload from hex or script
   */
  private parseTransactionPayload(scriptData: string): any {
    try {

      let textData = '';

      // Try different parsing methods
      if (/^[0-9a-fA-F]+$/.test(scriptData)) {
        // It's hex data
        
        // Remove OP_RETURN prefix if present (6a = OP_RETURN)
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
        
        return parsed;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Ensure API service is using the same network as the wallet
   */
  private ensureCorrectNetwork(): void {
    const walletNetwork = this.walletService.network();
    const currentApiNetwork = this.apiService.getCurrentNetwork();
    
    
    if (!this.networksMatch(walletNetwork, currentApiNetwork)) {
      const apiNetworkName = this.mapWalletNetworkToApiNetwork(walletNetwork);
      this.apiService.setNetwork(apiNetworkName);
    }
  }

  /**
   * Check if wallet network matches API network
   */
  private networksMatch(walletNetwork: string, apiNetwork: string): boolean {
    const mappedApiNetwork = this.mapWalletNetworkToApiNetwork(walletNetwork);
    return mappedApiNetwork === apiNetwork;
  }

  /**
   * Map wallet network names to API network names
   */
  private mapWalletNetworkToApiNetwork(walletNetwork: string): string {
    const networkMap: { [key: string]: string } = {
      'kaspa_mainnet': 'kaspa-mainnet',
      'kaspa_testnet_10': 'kaspa-testnet-10',
      'kaspa_testnet_11': 'kaspa-testnet-11',
      'kaspa_devnet': 'kaspa-devnet'
    };
    
    return networkMap[walletNetwork] || 'kaspa-mainnet';
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.loadSubscriptions();
  }
  
  /**
   * Clear all subscriptions
   */
  clearAllSubscriptions(): void {
    this._subscriptions.set([]);
    this._isLoading.set(false);
    this._isSearching.set(false);
    
    // Don't clear localStorage here as we want to preserve per-wallet data
  }
  
  /**
   * Clear all data (for wallet disconnect/change)
   */
  public clearAllData(): void {
    this.clearAllSubscriptions();
  }
}