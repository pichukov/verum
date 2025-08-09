import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, combineLatest, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { UserService } from './user.service';
import { SubscriptionService } from './subscription.service';
import { StoryService } from './story.service';
import { ToastService } from './toast.service';
import { ChainTraversalService } from './chain-traversal.service';
import { CommentService } from './comment.service';
import { PostService } from './post.service';
import { LikeService } from './like.service';
import { 
  Post as TransactionPost, 
  Story, 
  Note,
  TransactionType, 
  ParsedTransaction, 
  UserProfile 
} from '../types/transaction';
import { Post as PostCardPost } from '../components/ui/post-card/post-card.component';

export interface FeedItem {
  id: string; // Transaction ID
  type: 'post' | 'story' | 'note';
  timestamp: number;
  blockTime: number;
  authorAddress: string;
  author?: UserProfile;
  post?: PostCardPost;
  story?: Story;
  note?: Note;
}

@Injectable({
  providedIn: 'root'
})
export class FeedService {
  private transactionService = inject(KaspaTransactionService);
  private userService = inject(UserService);
  private subscriptionService = inject(SubscriptionService);
  private storyService = inject(StoryService);
  private toastService = inject(ToastService);
  private chainTraversalService = inject(ChainTraversalService);
  private commentService = inject(CommentService);
  private postService = inject(PostService);
  private likeService = inject(LikeService);

  // State
  private _feedItems = signal<FeedItem[]>([]);
  private _isLoading = signal(false);
  private _hasMore = signal(true);
  private _loadingProgress = signal<{
    phase: 'idle' | 'subscriptions' | 'transactions' | 'profiles' | 'complete';
    addressesLoaded: number;
    totalAddresses: number;
    currentAddress?: string;
  }>({ phase: 'idle', addressesLoaded: 0, totalAddresses: 0 });

  // Public readonly signals
  public readonly feedItems = this._feedItems.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly hasMore = this._hasMore.asReadonly();
  public readonly loadingProgress = this._loadingProgress.asReadonly();

  // Computed values
  public readonly posts = computed(() => 
    this._feedItems().filter(item => item.type === 'post')
  );

  public readonly stories = computed(() => 
    this._feedItems().filter(item => item.type === 'story')
  );

  public readonly loadingMessage = computed(() => {
    const progress = this._loadingProgress();
    switch (progress.phase) {
      case 'subscriptions':
        return 'Loading subscriptions...';
      case 'transactions':
        if (progress.totalAddresses === 0) return 'Finding addresses...';
        if (progress.currentAddress) {
          return `Loading posts from ${progress.currentAddress} (${progress.addressesLoaded + 1}/${progress.totalAddresses})`;
        }
        return `Loading posts (${progress.addressesLoaded}/${progress.totalAddresses})`;
      case 'profiles':
        return 'Loading author profiles...';
      case 'complete':
        return 'Complete!';
      default:
        return '';
    }
  });

  public readonly loadingPercentage = computed(() => {
    const progress = this._loadingProgress();
    if (progress.totalAddresses === 0) return 0;
    
    switch (progress.phase) {
      case 'subscriptions':
        return 10;
      case 'transactions':
        return 10 + Math.round((progress.addressesLoaded / progress.totalAddresses) * 70);
      case 'profiles':
        return 85;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  });

  constructor() {
    this.setupWalletWatcher();
    
    // Set reference in post service to allow bidirectional updates
    this.postService.setFeedService(this);
  }

  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    let previousUser: string | null = null;
    
    setInterval(() => {
      const currentUser = this.userService.currentUser();
      const currentUserAddress = currentUser?.address || null;
      
      if (currentUserAddress !== previousUser) {
        this.clearFeed();
        
        if (currentUserAddress) {
          this.loadFeed();
        }
        
        previousUser = currentUserAddress;
      }
    }, 500);
  }

  /**
   * Load the main feed with posts and stories
   */
  public async loadFeed(): Promise<void> {
    try {
      this._isLoading.set(true);
      this._loadingProgress.set({ phase: 'subscriptions', addressesLoaded: 0, totalAddresses: 0 });

      const currentUser = this.userService.currentUser();
      if (!currentUser) {
        this._feedItems.set([]);
        this._loadingProgress.set({ phase: 'idle', addressesLoaded: 0, totalAddresses: 0 });
        return;
      }

      // Force clear transaction cache to ensure fresh data
      this.transactionService.clearAllCaches();
      
      // Ensure subscriptions are loaded fresh from blockchain
      await this.subscriptionService.loadSubscriptions(true);

      // Get addresses to load from (user + subscriptions)
      const addresses = await this.getFeedAddresses();
      
      this._loadingProgress.set({ 
        phase: 'transactions', 
        addressesLoaded: 0, 
        totalAddresses: addresses.length 
      });
      
      // PHASE 1: Load all transaction data from all addresses
      const allTransactionData = new Map<string, ParsedTransaction[]>();
      
      // Calculate time limit (last 24 hours for initial load)
      const timeLimit = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // 24 hours ago

      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        
        // Update progress
        this._loadingProgress.set({ 
          phase: 'transactions', 
          addressesLoaded: i, 
          totalAddresses: addresses.length,
          currentAddress: address.substring(0, 20) + '...' 
        });
        
        try {
          console.log(`[FeedService] Loading transactions for address: ${address}`);
          // Use chain traversal to get recent user activity
          const chainResult = await this.chainTraversalService.traverseUserChain(
            address, 
            50, // Max 50 transactions per user
            timeLimit // Last 24 hours
          );
          
          console.log(`[FeedService] Chain traversal result for ${address}: ${chainResult.transactions.length} transactions`);
          allTransactionData.set(address, chainResult.transactions);
          
        } catch (error) {
          console.error(`[FeedService] Error loading transactions for ${address}:`, error);
          allTransactionData.set(address, []);
        }
      }

      // PHASE 2: Reconstruct the complete feed from all loaded data
      console.log('[FeedService] Starting feed reconstruction with data from', allTransactionData.size, 'addresses');
      const allFeedItems: FeedItem[] = await this.reconstructFeedFromTransactions(allTransactionData);
      console.log('[FeedService] Reconstructed', allFeedItems.length, 'feed items');

      // Remove duplicates by transaction ID (keep the first occurrence)
      const uniqueFeedItems = allFeedItems.filter((item, index, array) => 
        array.findIndex(otherItem => otherItem.id === item.id) === index
      );

      // Sort by timestamp (newest first)
      uniqueFeedItems.sort((a, b) => b.timestamp - a.timestamp);

      // Limit to latest 100 items for better content visibility
      const limitedItems = uniqueFeedItems.slice(0, 100);

      // Update progress for profile loading
      this._loadingProgress.set({ 
        phase: 'profiles', 
        addressesLoaded: addresses.length, 
        totalAddresses: addresses.length 
      });

      // Enrich posts with author profiles
      await this.enrichFeedItemsWithProfiles(limitedItems);
      
      // Load like and comment counts for posts and stories
      await this.loadLikeAndCommentCountsForFeedItems(limitedItems);

      this._feedItems.set(limitedItems);
      this._hasMore.set(uniqueFeedItems.length > 100);

      // Mark as complete
      this._loadingProgress.set({ 
        phase: 'complete', 
        addressesLoaded: addresses.length, 
        totalAddresses: addresses.length 
      });

    } catch (error) {
      console.error('Error loading feed:', error);
      this.toastService.error('Failed to load feed', 'Feed Error');
      this._loadingProgress.set({ phase: 'idle', addressesLoaded: 0, totalAddresses: 0 });
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Get addresses to include in feed (user + subscriptions)
   */
  private async getFeedAddresses(): Promise<string[]> {
    const currentUser = this.userService.currentUser();
    if (!currentUser) return [];

    const addresses = [currentUser.address];

    // Add subscription addresses
    const subscriptions = this.subscriptionService.activeSubscriptions();
    subscriptions.forEach(sub => {
      if (!addresses.includes(sub.address)) {
        addresses.push(sub.address);
      }
    });

    // Debug logging for feed address selection
    console.log('Feed addresses selected:', {
      currentUser: currentUser.address.substring(0, 20) + '...',
      totalAddresses: addresses.length,
      subscriptionAddresses: subscriptions.map(s => ({
        address: s.address.substring(0, 20) + '...',
        nickname: s.nickname
      }))
    });

    return addresses;
  }

  /**
   * Load story segments (first segments only) for an address
   */
  private async loadStorySegments(address: string): Promise<ParsedTransaction[]> {
    try {
      // Force refresh transactions to get latest data including newly created stories
      const allTransactions = await this.transactionService.getAddressTransactions(
        address,
        true, // Force refresh to bypass cache
        100 // Get more transactions to find stories
      ).toPromise();
      
      // Filter for STORY type transactions
      const storyTransactions = allTransactions?.filter(tx => 
        tx.payload?.type === TransactionType.STORY
      ) || [];

      if (!storyTransactions || storyTransactions.length === 0) return [];

      // Filter to get only first segments (no parent_id)
      const firstSegments = storyTransactions.filter(tx => 
        !tx.payload?.parent_id
      );

      return firstSegments;

    } catch (error) {
      console.error('Error loading story segments:', error);
      return [];
    }
  }

  /**
   * Enrich feed items with author profiles
   */
  private async enrichFeedItemsWithProfiles(feedItems: FeedItem[]): Promise<void> {
    // Get unique author addresses
    const authorAddresses = [...new Set(feedItems.map(item => item.authorAddress))];
    
    // Load all author profiles in parallel
    const profilePromises = authorAddresses.map(async (address) => {
      try {
        const profile = await this.transactionService.getUserProfile(address, false, true).toPromise();
        return { address, profile };
      } catch (error) {
        console.error(`Failed to load profile for ${address}:`, error);
        return { address, profile: null };
      }
    });
    
    const profileResults = await Promise.all(profilePromises);
    
    // Create a map of address to profile
    const profileMap = new Map<string, any>();
    profileResults.forEach(({ address, profile }) => {
      if (profile) {
        profileMap.set(address, profile);
      }
    });
    
    // Enrich feed items with profiles
    feedItems.forEach(item => {
      const authorProfile = profileMap.get(item.authorAddress);
      
      if (authorProfile) {
        // Update the feed item's author
        item.author = authorProfile;
        
        // If it's a post, also update the post's author
        if (item.type === 'post' && item.post) {
          item.post.author = {
            address: authorProfile.address,
            nickname: authorProfile.nickname,
            avatar: authorProfile.avatar,
            bio: undefined // Stories don't have bio field
          };
        }
        
        // If it's a note, update the note's author
        if (item.type === 'note' && item.note) {
          item.note.author = authorProfile;
        }
        
        // If it's a story, the author is already set in convertSegmentToStory
      } else {
        console.warn(`No profile found for author: ${item.authorAddress}`);
      }
    });
  }

  /**
   * Load like and comment counts for feed items (posts and stories)
   */
  private async loadLikeAndCommentCountsForFeedItems(feedItems: FeedItem[]): Promise<void> {
    // Filter posts and stories
    const postItems = feedItems.filter(item => item.type === 'post' && item.post);
    const storyItems = feedItems.filter(item => item.type === 'story' && item.story);
    
    // Load likes and comments for each post
    const postPromises = postItems.map(async (item) => {
      if (!item.post) return;
      
      try {
        // Load likes and comments for this post
        await this.likeService.loadLikesForPost(item.post.id, item.post.author.address);
        await this.commentService.loadCommentsForPost(item.post.id, item.post.author.address);
        
        // Get the actual counts
        const likeCount = this.likeService.getLikeCount(item.post.id);
        const commentCount = this.commentService.getCommentCount(item.post.id);
        
        // Update the post's counts
        item.post.likes = likeCount;
        item.post.comments = commentCount;
      } catch (error) {
        console.error(`Failed to load likes/comments for post ${item.post.id}:`, error);
        // Keep the default counts of 0
      }
    });
    
    // Load likes and comments for each story (using first segment ID)
    const storyPromises = storyItems.map(async (item) => {
      if (!item.story) return;
      
      try {
        // Load likes and comments for the first segment of the story
        // Use item.authorAddress (from feed item) as this is the story author who receives likes/comments
        await this.likeService.loadLikesForPost(item.story.firstSegmentId, item.authorAddress);
        await this.commentService.loadCommentsForPost(item.story.firstSegmentId, item.authorAddress);
        
        // Get the actual counts
        const likeCount = this.likeService.getLikeCount(item.story.firstSegmentId);
        const commentCount = this.commentService.getCommentCount(item.story.firstSegmentId);
        
        // Update the story's counts
        item.story.likeCount = likeCount;
        item.story.commentCount = commentCount;
        
        console.log(`[FeedService] Loaded story ${item.story.firstSegmentId}: ${likeCount} likes, ${commentCount} comments`);
      } catch (error) {
        console.error(`Failed to load likes/comments for story ${item.story.firstSegmentId}:`, error);
        // Keep the default counts of 0
      }
    });
    
    // Wait for all like and comment counts to load
    await Promise.all([...postPromises, ...storyPromises]);
  }

  /**
   * Reconstruct the complete feed from all loaded transaction data
   */
  private async reconstructFeedFromTransactions(allTransactionData: Map<string, ParsedTransaction[]>): Promise<FeedItem[]> {
    const allFeedItems: FeedItem[] = [];
    
    // Collect all transactions from all addresses
    const allTransactions: ParsedTransaction[] = [];
    for (const [address, transactions] of allTransactionData) {
      console.log(`[FeedService] Address ${address}: found ${transactions.length} transactions`);
      allTransactions.push(...transactions);
    }
    
    console.log(`[FeedService] Total transactions to process: ${allTransactions.length}`);
    
    // Process posts
    const posts = allTransactions.filter(tx => tx.payload?.type === TransactionType.POST);
    console.log(`[FeedService] Found ${posts.length} post transactions`);
    
    const postItems: FeedItem[] = posts.map((tx: ParsedTransaction) => {
      const cardPost = {
        id: tx.transactionId,
        author: {
          address: tx.authorAddress,
          nickname: 'Anonymous', // Will be populated later
          avatar: undefined,
          bio: undefined
        },
        content: tx.payload?.content || '',
        timestamp: tx.payload?.timestamp || tx.blockTime,
        blockTime: tx.blockTime,
        likes: 0, // Will be populated later
        comments: 0, // Will be populated later
        isLiked: false // Will be populated later
      };
      
      return {
        id: tx.transactionId,
        type: 'post' as const,
        timestamp: tx.payload?.timestamp || tx.blockTime,
        blockTime: tx.blockTime,
        authorAddress: tx.authorAddress,
        author: undefined, // Will be populated later
        post: cardPost
      };
    });
    
    allFeedItems.push(...postItems);
    
    // Process notes - only show current user's notes (private)
    const currentUser = this.userService.currentUser();
    const notes = allTransactions.filter(tx => 
      tx.payload?.type === TransactionType.NOTE && 
      tx.authorAddress === currentUser?.address // Only show user's own notes
    );
    console.log(`[FeedService] Found ${notes.length} note transactions from current user`);
    
    const noteItems: FeedItem[] = notes.map((tx: ParsedTransaction) => {
      const note: Note = {
        transactionId: tx.transactionId,
        authorAddress: tx.authorAddress,
        content: tx.payload?.content || '', // This will be encrypted content
        timestamp: tx.payload?.timestamp || tx.blockTime,
        blockTime: tx.blockTime,
        isEncrypted: true,
        author: undefined, // Will be populated later
        decryptedContent: undefined // Will be populated when user decrypts
      };
      
      return {
        id: tx.transactionId,
        type: 'note' as const,
        timestamp: tx.payload?.timestamp || tx.blockTime,
        blockTime: tx.blockTime,
        authorAddress: tx.authorAddress,
        author: undefined, // Will be populated later
        note
      };
    });
    
    allFeedItems.push(...noteItems);
    
    // Process stories - find all unique first segments
    const allStories = allTransactions.filter(tx => tx.payload?.type === TransactionType.STORY);
    
    const firstSegments = await this.findAllFirstStorySegments(allStories, allTransactions);
    
    const storyItems: FeedItem[] = (await Promise.all(
      firstSegments.map(async (tx: ParsedTransaction) => {
        const story = await this.convertSegmentToStory(tx, allTransactions);
        if (!story) {
          return null; // Filter out incomplete stories
        }
        return {
          id: tx.transactionId,
          type: 'story' as const,
          timestamp: tx.payload?.timestamp || tx.blockTime,
          blockTime: tx.blockTime,
          authorAddress: tx.authorAddress,
          author: story.author,
          story
        };
      })
    )).filter(item => item !== null) as FeedItem[];
    
    allFeedItems.push(...storyItems);
    
    return allFeedItems;
  }

  /**
   * Find all unique first story segments from story transactions
   */
  private async findAllFirstStorySegments(
    storyTransactions: ParsedTransaction[], 
    allTransactions: ParsedTransaction[]
  ): Promise<ParsedTransaction[]> {
    const firstSegments: ParsedTransaction[] = [];
    const processedFirstSegments = new Set<string>();
    
    for (const story of storyTransactions) {
      if (!story.payload?.parent_id) {
        // This is already a first segment
        if (!processedFirstSegments.has(story.transactionId)) {
          firstSegments.push(story);
          processedFirstSegments.add(story.transactionId);
        }
      } else {
        // This is a continuation segment, find the first segment
        const firstSegment = this.findFirstSegmentInLoadedData(story.payload.parent_id, allTransactions);
        if (firstSegment && !processedFirstSegments.has(firstSegment.transactionId)) {
          firstSegments.push(firstSegment);
          processedFirstSegments.add(firstSegment.transactionId);
        } else {
          // Fallback: Try to fetch the parent transaction via API
          const firstSegment = await this.findFirstStorySegment(story.payload.parent_id);
          if (firstSegment && !processedFirstSegments.has(firstSegment.transactionId)) {
            firstSegments.push(firstSegment);
            processedFirstSegments.add(firstSegment.transactionId);
          } else {
            console.log('Failed to fetch parent via API, cannot show this story segment');
            // Don't add continuation segments as standalone - this causes wrong content display
            // We need the actual first segment to show the story properly
          }
        }
      }
    }
    
    return firstSegments;
  }

  /**
   * Find first segment using already loaded transaction data (no API calls)
   */
  private findFirstSegmentInLoadedData(parentId: string, allTransactions: ParsedTransaction[]): ParsedTransaction | null {
    const parentTx = allTransactions.find(tx => tx.transactionId === parentId);
    if (!parentTx || !parentTx.payload || parentTx.payload.type !== TransactionType.STORY) {
      return null;
    }
    
    // If this parent has no parent_id, it's the first segment
    if (!parentTx.payload.parent_id) {
      return parentTx;
    }
    
    // Otherwise, continue tracing back
    return this.findFirstSegmentInLoadedData(parentTx.payload.parent_id, allTransactions);
  }

  /**
   * Find the first segment of a story by tracing back through parent_id chain
   */
  private async findFirstStorySegment(parentId: string): Promise<ParsedTransaction | null> {
    try {
      // Try to get the parent transaction
      const parentTx = await this.transactionService.getTransactionById(parentId).toPromise();
      if (!parentTx || !parentTx.payload) {
        return null;
      }
      
      // Check if this parent is a story transaction
      if (parentTx.payload.type !== TransactionType.STORY) {
        return null;
      }
      
      // If this parent has no parent_id, it's the first segment
      if (!parentTx.payload.parent_id) {
        return parentTx;
      }
      
      // Otherwise, continue tracing back
      return this.findFirstStorySegment(parentTx.payload.parent_id);
      
    } catch (error) {
      console.error('Error finding first story segment:', error);
      return null;
    }
  }

  /**
   * Convert a story segment transaction to a Story object
   * Only returns stories that are complete (have all segments)
   */
  private async convertSegmentToStory(segment: ParsedTransaction, allTransactions: ParsedTransaction[]): Promise<Story | null> {
    const params = segment.payload?.params;
    const totalSegments = params?.['total'];
    
    // If it's a single segment story, it's complete by definition
    if (totalSegments === 1 || params?.['is_final']) {
      const story: Story = {
        firstSegmentId: segment.transactionId,
        authorAddress: segment.authorAddress,
        segments: [{
          transactionId: segment.transactionId,
          authorAddress: segment.authorAddress,
          content: segment.payload?.content || '',
          timestamp: segment.payload?.timestamp || segment.blockTime,
          blockTime: segment.blockTime,
          segment: params?.['segment'] || 1,
          total: totalSegments,
          isFinal: true,
          parentId: segment.payload?.parent_id
        }],
        totalSegments: totalSegments,
        isComplete: true,
        lastLoadedSegment: 1,
        fullContent: segment.payload?.content || '',
        timestamp: segment.payload?.timestamp || segment.blockTime,
        blockTime: segment.blockTime
      };

      // Load author profile
      try {
        const author = await this.transactionService.getUserProfile(segment.authorAddress, false, true).toPromise();
        if (author) {
          story.author = author;
        }
      } catch (error) {
        // Continue without author profile
      }

      return story;
    }

    // For multi-segment stories, verify all segments exist
    if (totalSegments > 1) {
      const storySegments = this.findAllStorySegments(segment.transactionId, allTransactions);
      
      // Check if we have all segments
      if (storySegments.length !== totalSegments) {
        console.log(`[FeedService] Incomplete story ${segment.transactionId}: found ${storySegments.length}/${totalSegments} segments - hiding from feed`);
        return null; // Don't show incomplete stories
      }

      // Verify the last segment is marked as final
      const lastSegment = storySegments[storySegments.length - 1];
      if (!lastSegment.payload?.params?.['is_final']) {
        console.log(`[FeedService] Story ${segment.transactionId}: last segment not marked as final - hiding from feed`);
        return null; // Don't show stories without proper final segment
      }

      // Build complete story
      const allSegments = storySegments.map(tx => ({
        transactionId: tx.transactionId,
        authorAddress: tx.authorAddress,
        content: tx.payload?.content || '',
        timestamp: tx.payload?.timestamp || tx.blockTime,
        blockTime: tx.blockTime,
        segment: tx.payload?.params?.['segment'] || 1,
        total: totalSegments,
        isFinal: tx.payload?.params?.['is_final'] || false,
        parentId: tx.payload?.parent_id
      }));

      const fullContent = allSegments.map(seg => seg.content).join('');

      const story: Story = {
        firstSegmentId: segment.transactionId,
        authorAddress: segment.authorAddress,
        segments: allSegments,
        totalSegments: totalSegments,
        isComplete: true,
        lastLoadedSegment: totalSegments,
        fullContent: fullContent,
        timestamp: segment.payload?.timestamp || segment.blockTime,
        blockTime: segment.blockTime
      };

      // Load author profile
      try {
        const author = await this.transactionService.getUserProfile(segment.authorAddress, false, true).toPromise();
        if (author) {
          story.author = author;
        }
      } catch (error) {
        // Continue without author profile
      }

      return story;
    }

    return null; // Invalid story structure
  }

  /**
   * Find all segments of a story by following the parent_id chain
   */
  private findAllStorySegments(firstSegmentId: string, allTransactions: ParsedTransaction[]): ParsedTransaction[] {
    const segments: ParsedTransaction[] = [];
    const segmentMap = new Map<string, ParsedTransaction>();
    
    // Build a map of all story transactions by their transaction ID
    allTransactions
      .filter(tx => tx.payload?.type === TransactionType.STORY)
      .forEach(tx => segmentMap.set(tx.transactionId, tx));
    
    // Start with the first segment
    const firstSegment = segmentMap.get(firstSegmentId);
    if (!firstSegment) {
      return [];
    }
    
    segments.push(firstSegment);
    
    // Follow the chain of segments
    let currentId = firstSegmentId;
    const maxSegments = 50; // Safety limit to prevent infinite loops
    
    while (segments.length < maxSegments) {
      // Find the next segment that has currentId as parent_id
      let foundNext = false;
      
      for (const [txId, tx] of segmentMap) {
        if (tx.payload?.parent_id === currentId && !segments.find(seg => seg.transactionId === txId)) {
          segments.push(tx);
          currentId = txId;
          foundNext = true;
          break;
        }
      }
      
      if (!foundNext) {
        break; // No more segments found
      }
    }
    
    // Sort segments by segment number to ensure proper order
    segments.sort((a, b) => {
      const segmentA = a.payload?.params?.['segment'] || 1;
      const segmentB = b.payload?.params?.['segment'] || 1;
      return segmentA - segmentB;
    });
    
    return segments;
  }

  /**
   * Cache a story for later retrieval
   */
  private cacheStory(story: Story): void {
    // Use the story service cache
    const storyCache = (this.storyService as any).storyCache;
    if (storyCache && typeof storyCache.set === 'function') {
      storyCache.set(story.firstSegmentId, story);
    }
  }

  /**
   * Update a story in the feed
   */
  public updateStory(updatedStory: Story): void {
    this._feedItems.update(items => 
      items.map(item => 
        item.type === 'story' && item.id === updatedStory.firstSegmentId
          ? { ...item, story: updatedStory }
          : item
      )
    );
  }
  
  /**
   * Update comment count for a post in the feed
   */
  public updatePostCommentCount(postId: string): void {
    this._feedItems.update(items => 
      items.map(item => {
        if (item.type === 'post' && item.post && item.post.id === postId) {
          // Get the current comment count from comment service
          const commentCount = this.commentService.getCommentCount(postId);
          return {
            ...item,
            post: {
              ...item.post,
              comments: commentCount
            }
          };
        }
        return item;
      })
    );
  }

  /**
   * Add a new post or story to the feed
   */
  public addFeedItem(item: FeedItem): void {
    this._feedItems.update(items => [item, ...items]);
  }

  /**
   * Remove an item from the feed
   */
  public removeFeedItem(itemId: string): void {
    this._feedItems.update(items => 
      items.filter(item => item.id !== itemId)
    );
  }

  /**
   * Clear the feed
   */
  public clearFeed(): void {
    this._feedItems.set([]);
    this._hasMore.set(true);
    this._loadingProgress.set({ phase: 'idle', addressesLoaded: 0, totalAddresses: 0 });
  }

  /**
   * Refresh the feed
   */
  public async refreshFeed(): Promise<void> {
    // Clear transaction cache to ensure fresh data
    this.transactionService.clearAllCaches();
    this.clearFeed();
    await this.loadFeed();
  }

  /**
   * Get a specific feed item by ID
   */
  public getFeedItem(itemId: string): FeedItem | undefined {
    return this._feedItems().find(item => item.id === itemId);
  }

  /**
   * Check if an item exists in the feed
   */
  public hasFeedItem(itemId: string): boolean {
    return this._feedItems().some(item => item.id === itemId);
  }

  /**
   * Initialize the feed service
   */
  public async initialize(): Promise<void> {
    const currentUser = this.userService.currentUser();
    if (currentUser) {
      await this.loadFeed();
    }
  }
}