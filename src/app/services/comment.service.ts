import { Injectable, inject, signal } from '@angular/core';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { UserService } from './user.service';
import { SubscriptionService } from './subscription.service';
import { ToastService } from './toast.service';
import { TransactionType, VERUM_VERSION } from '../types/transaction';
import { FeeCalculationService } from './fee-calculation.service';
import { ChainTraversalService } from './chain-traversal.service';
import { firstValueFrom } from 'rxjs';

export interface Comment {
  id: string;
  postId: string;
  author: {
    address: string;
    nickname: string;
    avatar?: string;
    bio?: string;
  };
  content: string;
  timestamp: number;
  blockTime: number;
  isAuthor: boolean; // Is the comment author also the post author
}

export interface CreateCommentData {
  postId: string;
  content: string;
  postAuthorAddress: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private transactionService = inject(KaspaTransactionService);
  private userService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);
  private feeCalculationService = inject(FeeCalculationService);
  private chainTraversalService = inject(ChainTraversalService);

  // State
  private _comments = signal<{ [postId: string]: Comment[] }>({});
  private _isLoading = signal(false);
  
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
        
        // Clear comments and transaction service profile cache when user changes
        this.clearAllComments();
        this.transactionService.clearAllCaches();
        
        previousUser = currentUserAddress;
      }
    }, 500); // Check every 500ms
  }
  private _isCreating = signal(false);

  // Public readonly signals
  public readonly comments = this._comments.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly isCreating = this._isCreating.asReadonly();

  /**
   * Create a new comment
   */
  async createComment(commentData: CreateCommentData): Promise<void> {
    try {
      this._isCreating.set(true);

      const user = this.userService.currentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate content length
      if (commentData.content.trim().length === 0) {
        throw new Error('Comment content cannot be empty');
      }

      // Get chain reference information
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);

      // Create transaction payload
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.COMMENT,
        content: commentData.content.trim(),
        parent_id: commentData.postId,
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId
      };

      // Validate payload size (max ~1000 bytes as defined in transaction service)
      const payloadSize = this.calculatePayloadSize(payload);
      if (payloadSize > 1000) {
        throw new Error(`Comment too long. Payload is ${payloadSize} bytes (max 1000 bytes).`);
      }

      // Get calculated amount for comment
      const commentAmount = await firstValueFrom(
        this.feeCalculationService.calculateActionAmount('comment')
      );
      
      // Create blockchain transaction with calculated amount payment to post author
      const txId = await this.transactionService.createTransaction(
        payload,
        commentData.postAuthorAddress,
        commentAmount
      );
      

      // Add to local comments immediately for better UX
      const newComment: Comment = {
        id: txId,
        postId: commentData.postId,
        author: {
          address: user.address,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: undefined
        },
        content: commentData.content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
        blockTime: Math.floor(Date.now() / 1000), // Will be updated when confirmed
        isAuthor: false // Will be determined by post author
      };

      // Add to comments for this post (at the beginning since we sort newest first)
      this._comments.update(comments => ({
        ...comments,
        [commentData.postId]: [
          newComment,
          ...(comments[commentData.postId] || [])
        ]
      }));

      this.toastService.success(
        'Comment posted successfully!',
        'Comment Added'
      );

    } catch (error: any) {
      
      this.toastService.error(
        error.message || 'Failed to post comment',
        'Comment Failed'
      );
      
      throw error;
    } finally {
      this._isCreating.set(false);
    }
  }

  /**
   * Load comments for a specific post
   */
  async loadCommentsForPost(postId: string, postAuthorAddress: string): Promise<void> {
    try {
      this._isLoading.set(true);

      // For comments, we need to check the post author's received transactions
      // Comments are sent TO the post author, so we look at their transaction history
      const allCommentTransactions: any[] = [];
      
      try {
        // Load all transactions received by the post author
        const authorTransactions$ = this.transactionService.getAddressTransactions(postAuthorAddress, true, 200); // Force refresh and get more transactions
        const authorTransactions = await authorTransactions$.toPromise();
        
        if (authorTransactions) {
          // Filter for comment transactions targeting this specific post
          const postComments = authorTransactions.filter((tx: any) => {
            const isComment = tx.payload?.type === TransactionType.COMMENT;
            const isForThisPost = tx.payload?.parent_id === postId;
            
            return isComment && isForThisPost;
          });
          
          allCommentTransactions.push(...postComments);
        }
      } catch (error) {
        console.error('Failed to load comments from post author transactions:', error);
        // Continue with empty array
      }

      // Remove duplicates by keeping only the first occurrence of each transaction ID
      const seenIds = new Set<string>();
      const uniqueTransactions = allCommentTransactions.filter(tx => {
        if (seenIds.has(tx.transactionId)) {
          return false;
        }
        seenIds.add(tx.transactionId);
        return true;
      });
      allCommentTransactions.length = 0;
      allCommentTransactions.push(...uniqueTransactions);

      const convertedComments: (Comment | null)[] = await Promise.all(
        allCommentTransactions.map(async (tx: any) => {
          return await this.convertTransaction(tx, postAuthorAddress);
        })
      );

      const validComments = convertedComments.filter(c => c !== null) as Comment[];
      validComments.sort((a, b) => b.timestamp - a.timestamp);

      this._comments.update(comments => ({
        ...comments,
        [postId]: validComments
      }));

    } catch (error: any) {
      this.toastService.error(
        'Failed to load comments',
        'Loading Error'
      );

    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Get comments for a specific post
   */
  getCommentsForPost(postId: string): Comment[] {
    return this._comments()[postId] || [];
  }

  /**
   * Get comment count for a specific post
   */
  getCommentCount(postId: string): number {
    const comments = this.getCommentsForPost(postId);
    return comments.length;
  }

  /**
   * Convert blockchain transaction to Comment object
   */
  private async convertTransaction(tx: any, postAuthorAddress: string): Promise<Comment | null> {
    try {
      const authorAddress = tx.authorAddress;
      if (!authorAddress || authorAddress.trim() === '' || !this.isValidKaspaAddress(authorAddress)) {
        return null;
      }

      // Validate transaction integrity
      if (!tx.transactionId || !tx.payload?.content || !tx.payload?.parent_id) {
        return null;
      }

      const authorProfile = await this.getAuthorProfile(authorAddress, true);
      
      const comment = {
        id: tx.transactionId,
        postId: tx.payload?.parent_id || '',
        author: authorProfile,
        content: tx.payload?.content || '',
        timestamp: tx.payload?.timestamp || tx.timestamp,
        blockTime: tx.blockTime,
        isAuthor: authorAddress === postAuthorAddress
      };
      
      return comment;
      
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
   * Clear comments for a specific post
   */
  clearCommentsForPost(postId: string): void {
    this._comments.update(comments => {
      const updated = { ...comments };
      delete updated[postId];
      return updated;
    });
  }

  /**
   * Calculate payload size in bytes
   */
  calculatePayloadSize(payload: any): number {
    const payloadJson = JSON.stringify(payload);
    return new TextEncoder().encode(payloadJson).length;
  }

  /**
   * Clear all comments
   */
  clearAllComments(): void {
    this._comments.set({});
    this._isLoading.set(false);
  }
  
  /**
   * Clear all data (for wallet disconnect/change)
   */
  public clearAllData(): void {
    this.clearAllComments();
  }
  
  /**
   * Force refresh comments for a post (clears cache and reloads)
   */
  public async forceRefreshComments(postId: string, postAuthorAddress: string): Promise<void> {
    
    // Clear transaction service cache to force fresh data
    this.transactionService.clearAllCaches();
    
    // Clear comments for this specific post
    this.clearCommentsForPost(postId);
    
    // Reload comments
    await this.loadCommentsForPost(postId, postAuthorAddress);
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