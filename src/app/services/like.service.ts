import { Injectable, inject, signal } from '@angular/core';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { UserService } from './user.service';
import { SubscriptionService } from './subscription.service';
import { ToastService } from './toast.service';
import { TransactionType, VERUM_VERSION } from '../types/transaction';
import { FeeCalculationService } from './fee-calculation.service';
import { ChainTraversalService } from './chain-traversal.service';
import { firstValueFrom } from 'rxjs';

export interface Like {
  id: string;
  postId: string;
  author: {
    address: string;
    nickname: string;
    avatar?: string;
    bio?: string;
  };
  timestamp: number;
  blockTime: number;
  amount: number;
}

export interface CreateLikeData {
  postId: string;
  postAuthorAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class LikeService {
  private transactionService = inject(KaspaTransactionService);
  private userService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);
  private feeCalculationService = inject(FeeCalculationService);
  private chainTraversalService = inject(ChainTraversalService);

  // State
  private _likes = signal<{ [postId: string]: Like[] }>({});
  private _userLikes = signal<Set<string>>(new Set()); // Set of post IDs the user has liked
  private _isLoading = signal(false);
  private _isCreating = signal(false);
  
  constructor() {
    this.setupWalletWatcher();
  }
  
  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    let previousUser: string | null = null;
    let isInitialized = false;
    
    setInterval(() => {
      const currentUser = this.userService.currentUser();
      const currentUserAddress = currentUser?.address || null;
      
      // Skip the first change from null to actual address (initialization)
      if (!isInitialized) {
        previousUser = currentUserAddress;
        isInitialized = true;
        return;
      }
      
      // Only clear when user actually changes (not during initialization)
      if (currentUserAddress !== previousUser) {
        // Clear likes and transaction service profile cache when user changes
        this.clearAllLikes();
        this.transactionService.clearAllCaches();
        
        previousUser = currentUserAddress;
      }
    }, 500); // Check every 500ms
  }

  // Public readonly signals
  public readonly likes = this._likes.asReadonly();
  public readonly userLikes = this._userLikes.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isCreating = this._isCreating.asReadonly();

  /**
   * Create a new like
   */
  async createLike(likeData: CreateLikeData): Promise<void> {
    try {
      this._isCreating.set(true);

      const user = this.userService.currentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Check if user already liked this post
      if (this._userLikes().has(likeData.postId)) {
        this.toastService.warning('You have already liked this post', 'Already Liked');
        return;
      }

      // Get chain reference information
      console.log('Getting latest transaction info for like chain building...');
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);

      // Create transaction payload
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.LIKE,
        content: null,
        parent_id: likeData.postId,
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId
      };

      // Get calculated amount for like
      const likeAmount = await firstValueFrom(
        this.feeCalculationService.calculateActionAmount('like')
      );
      
      // Create blockchain transaction with calculated amount payment to post author
      const txId = await this.transactionService.createTransaction(
        payload,
        likeData.postAuthorAddress,
        likeAmount
      );

      // Add to local likes immediately for better UX
      const newLike: Like = {
        id: txId,
        postId: likeData.postId,
        author: {
          address: user.address,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: undefined
        },
        timestamp: Math.floor(Date.now() / 1000),
        blockTime: Math.floor(Date.now() / 1000), // Will be updated when confirmed
        amount: likeAmount
      };

      // Add to likes for this post
      this._likes.update(likes => ({
        ...likes,
        [likeData.postId]: [
          ...(likes[likeData.postId] || []),
          newLike
        ]
      }));

      // Add to user's liked posts
      this._userLikes.update(userLikes => {
        const newSet = new Set(userLikes);
        newSet.add(likeData.postId);
        return newSet;
      });

      this.toastService.success(
        'Post liked successfully!',
        'Like Added'
      );

    } catch (error: any) {
      this.toastService.error(
        error.message || 'Failed to like post',
        'Like Failed'
      );
      
      throw error;
    } finally {
      this._isCreating.set(false);
    }
  }

  /**
   * Load likes for a specific post
   */
  async loadLikesForPost(postId: string, postAuthorAddress: string): Promise<void> {
    try {
      this._isLoading.set(true);

      // Load ALL transactions for the post author (where likes are received)
      // Likes are sent TO the post author, so we check their received transactions
      const allLikeTransactions: any[] = [];
      
      try {
        const authorTransactions$ = this.transactionService.getAddressTransactions(postAuthorAddress, true, 200); // Force refresh and get more transactions
        const authorTransactions = await authorTransactions$.toPromise();
        
        if (authorTransactions) {
          // Filter for like transactions targeting this specific post
          const postLikes = authorTransactions.filter((tx: any) => {
            const isLike = tx.payload?.type === TransactionType.LIKE;
            const isForThisPost = tx.payload?.parent_id === postId;
            
            return isLike && isForThisPost;
          });
          
          allLikeTransactions.push(...postLikes);
        }
      } catch (error) {
        console.error('Failed to load likes from post author transactions:', error);
        // Failed to load transactions for post author
      }

      // Remove duplicates by keeping only the first occurrence of each transaction ID
      const seenIds = new Set<string>();
      const uniqueTransactions = allLikeTransactions.filter(tx => {
        if (seenIds.has(tx.transactionId)) {
          return false;
        }
        seenIds.add(tx.transactionId);
        return true;
      });

      const convertedLikes: (Like | null)[] = await Promise.all(
        uniqueTransactions.map(async (tx: any) => {
          return await this.convertTransaction(tx, postAuthorAddress);
        })
      );

      const validLikes = convertedLikes.filter(l => l !== null) as Like[];
      validLikes.sort((a, b) => b.timestamp - a.timestamp);

      this._likes.update(likes => ({
        ...likes,
        [postId]: validLikes
      }));

      // Update user likes set
      const currentUser = this.userService.currentUser();
      if (currentUser) {
        const userLikedPosts = validLikes
          .filter(like => like.author.address === currentUser.address)
          .map(like => like.postId);
        
        this._userLikes.update(userLikes => {
          const newSet = new Set(userLikes);
          userLikedPosts.forEach(postId => newSet.add(postId));
          return newSet;
        });
      }

    } catch (error: any) {
      this.toastService.error(
        'Failed to load likes',
        'Loading Error'
      );

    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Get likes for a specific post
   */
  getLikesForPost(postId: string): Like[] {
    return this._likes()[postId] || [];
  }

  /**
   * Get like count for a specific post
   */
  getLikeCount(postId: string): number {
    const likes = this.getLikesForPost(postId);
    return likes.length;
  }

  /**
   * Check if current user has liked a post
   */
  hasUserLikedPost(postId: string): boolean {
    return this._userLikes().has(postId);
  }

  /**
   * Convert blockchain transaction to Like object
   */
  private async convertTransaction(tx: any, postAuthorAddress: string): Promise<Like | null> {
    try {
      const authorAddress = tx.authorAddress;
      if (!authorAddress || authorAddress.trim() === '' || !this.isValidKaspaAddress(authorAddress)) {
        return null;
      }

      // Validate transaction integrity
      if (!tx.transactionId || !tx.payload?.parent_id) {
        return null;
      }

      const authorProfile = await this.getAuthorProfile(authorAddress, true);
      
      const like: Like = {
        id: tx.transactionId,
        postId: tx.payload?.parent_id || '',
        author: authorProfile,
        timestamp: tx.payload?.timestamp || tx.timestamp,
        blockTime: tx.blockTime,
        amount: tx.amount || 0
      };
      
      return like;
      
    } catch (error) {
      return null;
    }
  }

  /**
   * Get author profile (blockchain lookup, subscription, or fallback)
   */
  private async getAuthorProfile(authorAddress: string, forceRefresh: boolean = false): Promise<any> {
    try {
      const profile = await this.transactionService.getUserProfile(authorAddress, forceRefresh).toPromise();
      if (profile) {
        return {
          address: profile.address,
          nickname: profile.nickname,
          avatar: profile.avatar,
          bio: undefined
        };
      }
    } catch (error) {}
    
    const subscription = this.subscriptionService.getSubscription(authorAddress);
    if (subscription) {
      return {
        address: subscription.address,
        nickname: subscription.nickname,
        avatar: subscription.avatar,
        bio: subscription.bio
      };
    }
    
    return {
      address: authorAddress,
      nickname: this.extractNicknameFromAddress(authorAddress),
      avatar: undefined,
      bio: undefined
    };
  }

  /**
   * Extract nickname from address (placeholder implementation)
   */
  private extractNicknameFromAddress(address: string): string {
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
  }

  /**
   * Clear likes for a specific post
   */
  clearLikesForPost(postId: string): void {
    this._likes.update(likes => {
      const updated = { ...likes };
      delete updated[postId];
      return updated;
    });
  }

  /**
   * Clear all likes
   */
  clearAllLikes(): void {
    this._likes.set({});
    this._userLikes.set(new Set());
    this._isLoading.set(false);
  }
  
  /**
   * Clear all data (for wallet disconnect/change)
   */
  public clearAllData(): void {
    this.clearAllLikes();
  }
  
  /**
   * Force refresh likes for a post (clears cache and reloads)
   */
  public async forceRefreshLikes(postId: string, postAuthorAddress: string): Promise<void> {
    // Clear transaction service cache to force fresh data
    this.transactionService.clearAllCaches();
    
    // Clear likes for this specific post
    this.clearLikesForPost(postId);
    
    // Reload likes
    await this.loadLikesForPost(postId, postAuthorAddress);
  }

  /**
   * Refresh profile for a specific author (bypasses cache)
   */
  public async refreshAuthorProfile(authorAddress: string): Promise<any> {
    return await this.getAuthorProfile(authorAddress, true);
  }

  /**
   * Validate Kaspa address format
   */
  private isValidKaspaAddress(address: string): boolean {
    if (!address || typeof address !== 'string' || address.trim() === '') {
      return false;
    }

    // More flexible Kaspa address validation
    // Accept both prefixed and bare addresses
    // Mainnet: kaspa:[a-z0-9]{58,65} or bare [a-z0-9]{58,65}
    // Testnet: kaspatest:[a-z0-9]{58,65} or bare [a-z0-9]{58,65}
    const prefixedAddressRegex = /^kaspa(test)?:[a-z0-9]{58,65}$/;
    const bareAddressRegex = /^[a-z0-9]{58,65}$/;
    
    return prefixedAddressRegex.test(address) || bareAddressRegex.test(address);
  }
}