import { Injectable, inject, signal } from '@angular/core';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { UserService } from './user.service';
import { ToastService } from './toast.service';
import { SubscriptionService } from './subscription.service';
import { CommentService } from './comment.service';
import { Post } from '../components/ui/post-card/post-card.component';
import { TransactionType, VERUM_VERSION } from '../types/transaction';
import { FeeCalculationService } from './fee-calculation.service';
import { ChainTraversalService } from './chain-traversal.service';
import { firstValueFrom } from 'rxjs';

export interface CreatePostData {
  content: string;
  media?: string; // Base64 encoded media (future feature)
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private transactionService = inject(KaspaTransactionService);
  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private subscriptionService = inject(SubscriptionService);
  private commentService = inject(CommentService);
  private feeCalculationService = inject(FeeCalculationService);
  private chainTraversalService = inject(ChainTraversalService);
  
  // Optional feed service reference (set manually to avoid circular dependency)
  private feedService?: any;

  // State
  public posts = signal<Post[]>([]);
  public isLoading = signal(false);
  public isCreating = signal(false);
  
  constructor() {
    this.setupWalletWatcher();
  }
  
  /**
   * Set feed service reference (to avoid circular dependency)
   */
  setFeedService(feedService: any): void {
    this.feedService = feedService;
  }
  
  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    let previousUser: string | null = null;
    let hasInitialized = false;
    
    setInterval(() => {
      const currentUser = this.userService.currentUser();
      const currentUserAddress = currentUser?.address || null;
      
      // If user changed (including logout)
      if (currentUserAddress !== previousUser) {
        
        // Only clear posts if this is not the initial load (previousUser was not null)
        // or if user actually switched to a different user
        if (hasInitialized && previousUser !== null) {
          this.clearPosts();
        } else if (currentUserAddress) {
          hasInitialized = true;
        }
        
        previousUser = currentUserAddress;
      }
    }, 500); // Check every 500ms
  }

  /**
   * Create a new post
   */
  async createPost(postData: CreatePostData): Promise<void> {
    try {
      this.isCreating.set(true);

      const user = this.userService.currentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate content length
      if (postData.content.trim().length === 0) {
        throw new Error('Post content cannot be empty');
      }

      // Get chain reference information
      console.log('Getting latest transaction info for chain building...');
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);
      
      // Create transaction payload with chain references
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: postData.content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId
      };

      // Validate payload size (max ~1000 bytes as defined in transaction service)
      const payloadSize = this.calculatePayloadSize(payload);
      if (payloadSize > 1000) {
        throw new Error(`Post too long. Payload is ${payloadSize} bytes (max 1000 bytes).`);
      }

      // Calculate post amount (sent to self)
      const postAmount = await firstValueFrom(this.feeCalculationService.calculateActionAmount('post'));
      
      // Create blockchain transaction with amount sent to self
      const txId = await this.transactionService.createTransaction(
        payload,
        user.address, // Send to self
        postAmount
      );
      

      // Add to local posts immediately for better UX
      const newPost: Post = {
        id: txId,
        author: {
          address: user.address,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: undefined // UserProfile doesn't have bio field yet
        },
        content: postData.content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
        blockTime: Math.floor(Date.now() / 1000), // Will be updated when confirmed
        likes: 0,
        comments: 0,
        isLiked: false
      };

      // Add to beginning of posts array
      this.posts.update(posts => [newPost, ...posts]);

      this.toastService.success(
        'Post created successfully!',
        'Post Published'
      );

    } catch (error: any) {
      
      this.toastService.error(
        error.message || 'Failed to create post',
        'Post Failed'
      );
      
      throw error;
    } finally {
      this.isCreating.set(false);
    }
  }

  /**
   * Load posts from blockchain (user's posts + subscription posts)
   */
  async loadPosts(): Promise<void> {
    try {
      this.isLoading.set(true);

      const user = this.userService.currentUser();
      if (!user) {
        this.posts.set([]);
        return;
      }
      

      // Get addresses to load posts from (user + subscriptions)
      const subscriptions = this.subscriptionService.activeSubscriptions();
      const addressesToLoad = [user.address, ...subscriptions.map(sub => sub.address)];
      

      // Load posts from all addresses
      const allTransactions: any[] =[];
      
      for (const address of addressesToLoad) {
        try {
          const posts$ = this.transactionService.getTransactionsByType(address, TransactionType.POST);
          const transactions = await posts$.toPromise();
          
          if (transactions) {
            // Add author address context to each transaction
            const transactionsWithAuthor = transactions.map((tx: any) => ({
              ...tx,
              authorAddress: address
            }));
            allTransactions.push(...transactionsWithAuthor);
          }
        } catch (error) {
          // Continue loading from other addresses even if one fails
        }
      }
      

      if (allTransactions.length > 0) {
        // Convert to our Post interface
        const convertedPosts: (Post | null)[] = await Promise.all(
          allTransactions.map(async (tx: any) => await this.convertTransaction(tx))
        );

        // Filter out any null posts and sort by timestamp (newest first)
        const validPosts = convertedPosts.filter(p => p !== null) as Post[];
        validPosts.sort((a, b) => b.timestamp - a.timestamp);

        // Limit to most recent 50 posts to avoid UI performance issues
        const limitedPosts = validPosts.slice(0, 50);

        this.posts.set(limitedPosts);
        
        // Load comment counts for all posts
        await this.loadCommentCounts(limitedPosts);
      } else {
        this.posts.set([]);
      }

    } catch (error: any) {
      
      this.toastService.error(
        'Failed to load posts',
        'Loading Error'
      );
      
      this.posts.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Like/unlike a post
   */
  async toggleLike(postId: string): Promise<void> {
    try {
      const user = this.userService.currentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Find the post to get author address
      const post = this.posts().find(p => p.id === postId);
      if (!post) {
        throw new Error('Post not found');
      }

      // Check if already liked (would need to track this properly)
      const wasLiked = post.isLiked || false;
      
      if (!wasLiked) {
        // Get calculated amount for like
        const likeAmount = await firstValueFrom(
          this.feeCalculationService.calculateActionAmount('like')
        );
        
        // Create LIKE transaction
        const payload = {
          verum: VERUM_VERSION,
          type: TransactionType.LIKE,
          content: null,
          parent_id: postId,
          timestamp: Math.floor(Date.now() / 1000)
        };

        // Send like transaction to post author with calculated amount
        await this.transactionService.createTransaction(
          payload,
          post.author?.address,
          likeAmount
        );
      }

      // Update local state for better UX
      this.posts.update(posts => 
        posts.map(p => {
          if (p.id === postId) {
            const currentLikes = p.likes || 0;
            
            return {
              ...p,
              isLiked: !wasLiked,
              likes: wasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
            };
          }
          return p;
        })
      );
      
      this.toastService.success(
        wasLiked ? 'Like removed!' : 'Post liked!',
        wasLiked ? 'Unlike' : 'Like Added'
      );

    } catch (error: any) {
      
      // Revert local state on error
      this.posts.update(posts => 
        posts.map(post => {
          if (post.id === postId) {
            const wasLiked = post.isLiked || false;
            const currentLikes = post.likes || 0;
            
            return {
              ...post,
              isLiked: !wasLiked,
              likes: wasLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1)
            };
          }
          return post;
        })
      );

      this.toastService.error(
        'Failed to like post',
        'Like Failed'
      );
    }
  }

  /**
   * Convert blockchain transaction to Post object
   */
  private async convertTransaction(tx: any): Promise<Post | null> {
    try {
      // Use the author address we added as context
      const authorAddress = tx.authorAddress;
      if (!authorAddress) {
        return null;
      }

      // Look up author profile
      const authorProfile = await this.getAuthorProfile(authorAddress);
      
      return {
        id: tx.transactionId,
        author: authorProfile,
        content: tx.payload?.content || '',
        timestamp: tx.payload?.timestamp || tx.timestamp,
        blockTime: tx.blockTime,
        likes: 0, // Would need to count LIKE transactions
        comments: 0, // Would need to count COMMENT transactions
        isLiked: false // Would need to check if current user liked
      };
      
    } catch (error) {
      return null;
    }
  }


  /**
   * Get author profile (current user or subscription)
   */
  private async getAuthorProfile(authorAddress: string): Promise<any> {
    const currentUser = this.userService.currentUser();
    
    // If it's the current user's post
    if (currentUser && currentUser.address === authorAddress) {
      return {
        address: currentUser.address,
        nickname: currentUser.nickname,
        avatar: currentUser.avatar,
        bio: undefined
      };
    }
    
    // If it's a subscription's post, look up their profile
    const subscription = this.subscriptionService.getSubscription(authorAddress);
    if (subscription) {
      return {
        address: subscription.address,
        nickname: subscription.nickname,
        avatar: subscription.avatar,
        bio: subscription.bio
      };
    }
    
    // Fallback: fetch profile from blockchain (this ensures fresh data after wallet switch)
    try {
      const profile = await this.userService.getUserProfile(authorAddress).toPromise();
      if (profile) {
        return {
          address: profile.address,
          nickname: profile.nickname,
          avatar: profile.avatar,
          bio: undefined
        };
      }
    } catch (error) {
    }
    
    // If all else fails, return minimal profile
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
    // This is a placeholder - in reality you'd look up the user's START transaction
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
  }

  /**
   * Clear posts
   */
  clearPosts(): void {
    this.posts.set([]);
    this.isLoading.set(false);
  }
  
  /**
   * Clear all data (for wallet disconnect/change)
   */
  public clearAllData(): void {
    this.clearPosts();
  }

  /**
   * Get post by ID
   */
  getPost(postId: string): Post | undefined {
    return this.posts().find(post => post.id === postId);
  }

  /**
   * Load comment counts for posts
   */
  private async loadCommentCounts(posts: Post[]): Promise<void> {
    try {
      // Load comments for each post and update the count
      const updatedPosts = [...posts];
      
      for (const post of updatedPosts) {
        // Load comments for this post
        await this.commentService.loadCommentsForPost(post.id, post.author.address);
        
        // Get the actual comment count
        const commentCount = this.commentService.getCommentCount(post.id);
        post.comments = commentCount;
      }
      
      // Update the posts signal with the new comment counts
      this.posts.set(updatedPosts);
      
    } catch (error) {
    }
  }

  /**
   * Update comment count for a specific post
   */
  updateCommentCount(postId: string): void {
    this.posts.update(posts => 
      posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: this.commentService.getCommentCount(postId)
          };
        }
        return post;
      })
    );
    
    // Also update the feed service if it exists
    if (this.feedService) {
      this.feedService.updatePostCommentCount(postId);
    }
  }

  /**
   * Calculate payload size in bytes
   */
  calculatePayloadSize(payload: any): number {
    const payloadJson = JSON.stringify(payload);
    return new TextEncoder().encode(payloadJson).length;
  }

  /**
   * Refresh posts
   */
  async refreshPosts(): Promise<void> {
    await this.loadPosts();
  }
}