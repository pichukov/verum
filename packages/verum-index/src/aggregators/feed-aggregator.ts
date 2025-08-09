/**
 * Feed Aggregator
 * 
 * Aggregates and filters blockchain data to create personalized feeds
 */

import { 
  FeedItem, 
  FeedOptions, 
  FeedResult,
  IndexedPost,
  IndexedStory,
  IndexedComment,
  VerumTransaction,
  ApiResponse 
} from '../types';
import { IBlockchainFetcher } from '../fetchers/blockchain-fetcher';
import { IUserFetcher } from '../fetchers/user-fetcher';
import { IStoryReconstructor } from '../utils/story-reconstructor';
import { EngagementService } from '../services/engagement-service';
import { TransactionType } from '@verum/protocol';

/**
 * Interface for feed aggregation operations
 */
export interface IFeedAggregator {
  /**
   * Get personalized feed for a user
   */
  getPersonalizedFeed(userAddress: string, options?: FeedOptions): Promise<ApiResponse<FeedResult>>;

  /**
   * Get global feed (all users)
   */
  getGlobalFeed(options?: FeedOptions): Promise<ApiResponse<FeedResult>>;

  /**
   * Get feed for a specific user
   */
  getUserFeed(targetAddress: string, options?: FeedOptions): Promise<ApiResponse<FeedResult>>;

  /**
   * Get trending content
   */
  getTrendingFeed(options?: FeedOptions): Promise<ApiResponse<FeedResult>>;

  /**
   * Get feed items by type
   */
  getFeedByType(type: TransactionType[], options?: FeedOptions): Promise<ApiResponse<FeedResult>>;
}

/**
 * Feed aggregator implementation
 */
export class FeedAggregator implements IFeedAggregator {
  private blockchainFetcher: IBlockchainFetcher;
  private userFetcher: IUserFetcher;
  private storyReconstructor: IStoryReconstructor;
  private engagementService: EngagementService;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 30000; // 30 seconds for feed data

  constructor(
    blockchainFetcher: IBlockchainFetcher,
    userFetcher: IUserFetcher,
    storyReconstructor: IStoryReconstructor,
    engagementService: EngagementService
  ) {
    this.blockchainFetcher = blockchainFetcher;
    this.userFetcher = userFetcher;
    this.storyReconstructor = storyReconstructor;
    this.engagementService = engagementService;
    this.cache = new Map();
  }

  /**
   * Get personalized feed for a user
   */
  async getPersonalizedFeed(
    userAddress: string, 
    options: FeedOptions = {}
  ): Promise<ApiResponse<FeedResult>> {
    const cacheKey = `feed:personalized:${userAddress}:${JSON.stringify(options)}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get users that this user follows
      const followingResult = await this.userFetcher.getFollowing(userAddress);
      if (!followingResult.success) {
        return { success: false, error: 'Failed to fetch following list' };
      }

      const followingAddresses = followingResult.data?.map(sub => sub.target) || [];
      
      // Include the user's own posts in their feed
      const feedAuthors = [...followingAddresses, userAddress];

      // Get feed from followed users
      const feedResult = await this.getFeedFromAuthors(feedAuthors, {
        ...options,
        userAddress // For personalization (like status, etc.)
      });

      if (feedResult.success && feedResult.data) {
        // Cache the result
        this.setCachedData(cacheKey, feedResult.data);
      }

      return feedResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get personalized feed'
      };
    }
  }

  /**
   * Get global feed (all users)
   */
  async getGlobalFeed(options: FeedOptions = {}): Promise<ApiResponse<FeedResult>> {
    const cacheKey = `feed:global:${JSON.stringify(options)}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get recent transactions from the blockchain
      const recentTxResult = await this.blockchainFetcher.getRecentTransactions(
        (options.limit || 50) * 3 // Get more to account for filtering
      );

      if (!recentTxResult.success || !recentTxResult.data) {
        return { success: false, error: 'Failed to fetch recent transactions' };
      }

      // Convert to feed items
      const feedItems = await this.convertTransactionsToFeedItems(
        recentTxResult.data,
        options
      );

      // Apply filtering and pagination
      const filteredItems = this.filterAndPaginateFeed(feedItems, options);

      const result: FeedResult = {
        items: filteredItems,
        hasMore: filteredItems.length === (options.limit || 50),
        nextOffset: (options.offset || 0) + filteredItems.length
      };

      // Cache the result
      this.setCachedData(cacheKey, result);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get global feed'
      };
    }
  }

  /**
   * Get feed for a specific user
   */
  async getUserFeed(
    targetAddress: string, 
    options: FeedOptions = {}
  ): Promise<ApiResponse<FeedResult>> {
    const cacheKey = `feed:user:${targetAddress}:${JSON.stringify(options)}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      return await this.getFeedFromAuthors([targetAddress], options);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user feed'
      };
    }
  }

  /**
   * Get trending content
   */
  async getTrendingFeed(options: FeedOptions = {}): Promise<ApiResponse<FeedResult>> {
    // For now, return recent content sorted by engagement
    // In a real implementation, this would use engagement metrics
    const globalFeed = await this.getGlobalFeed(options);
    
    if (globalFeed.success && globalFeed.data) {
      // TODO: Sort by engagement metrics when available
      globalFeed.data.items.sort((a, b) => {
        const aEngagement = this.getItemEngagement(a);
        const bEngagement = this.getItemEngagement(b);
        return bEngagement - aEngagement;
      });
    }

    return globalFeed;
  }

  /**
   * Get feed items by type
   */
  async getFeedByType(
    types: TransactionType[], 
    options: FeedOptions = {}
  ): Promise<ApiResponse<FeedResult>> {
    const globalFeed = await this.getGlobalFeed({
      ...options,
      limit: (options.limit || 50) * 2 // Get more to account for filtering
    });

    if (!globalFeed.success || !globalFeed.data) {
      return globalFeed;
    }

    // Filter by transaction types
    const filteredItems = globalFeed.data.items.filter(item => {
      if (this.isIndexedPost(item)) {
        return types.includes(TransactionType.POST);
      } else if (this.isIndexedStory(item)) {
        return types.includes(TransactionType.STORY);
      } else if (this.isIndexedComment(item)) {
        return types.includes(TransactionType.COMMENT);
      }
      return false;
    });

    // Apply original limit
    const limitedItems = filteredItems.slice(0, options.limit || 50);

    return {
      success: true,
      data: {
        items: limitedItems,
        hasMore: filteredItems.length > limitedItems.length,
        nextOffset: (options.offset || 0) + limitedItems.length
      }
    };
  }

  /**
   * Get feed from specific authors
   */
  private async getFeedFromAuthors(
    authorAddresses: string[], 
    options: FeedOptions
  ): Promise<ApiResponse<FeedResult>> {
    try {
      const allFeedItems: FeedItem[] = [];

      // Fetch transactions for each author
      for (const address of authorAddresses) {
        const txResult = await this.blockchainFetcher.getTransactionsByAddress(
          address, 
          100 // Get a reasonable batch
        );

        if (txResult.success && txResult.data) {
          const feedItems = await this.convertTransactionsToFeedItems(
            txResult.data,
            options
          );
          allFeedItems.push(...feedItems);
        }
      }

      // Sort by timestamp (most recent first)
      allFeedItems.sort((a, b) => b.timestamp - a.timestamp);

      // Apply filtering and pagination
      const filteredItems = this.filterAndPaginateFeed(allFeedItems, options);

      const result: FeedResult = {
        items: filteredItems,
        hasMore: filteredItems.length === (options.limit || 50),
        nextOffset: (options.offset || 0) + filteredItems.length
      };

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get feed from authors'
      };
    }
  }

  /**
   * Convert raw transactions to feed items
   */
  private async convertTransactionsToFeedItems(
    rawTransactions: any[],
    options: FeedOptions
  ): Promise<FeedItem[]> {
    const feedItems: FeedItem[] = [];
    const processedStories = new Set<string>(); // Track first segments to avoid duplicates

    for (const rawTx of rawTransactions) {
      const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
      if (!verumTx) continue;

      try {
        switch (verumTx.payload.type) {
          case TransactionType.POST:
            const post = await this.createIndexedPost(verumTx, options);
            if (post) feedItems.push(post);
            break;

          case TransactionType.STORY:
            // Only process first segments to avoid duplicates
            const segmentNumber = verumTx.payload.params?.segment;
            if (segmentNumber === 1 && !processedStories.has(verumTx.txId)) {
              const story = await this.createIndexedStory(verumTx, options);
              if (story) {
                feedItems.push(story);
                processedStories.add(verumTx.txId);
              }
            }
            break;

          case TransactionType.COMMENT:
            if (options.includeReplies !== false) {
              const comment = await this.createIndexedComment(verumTx, options);
              if (comment) feedItems.push(comment);
            }
            break;
        }
      } catch (error) {
        console.warn(`Failed to process transaction ${verumTx.txId}:`, error);
      }
    }

    return feedItems;
  }

  /**
   * Create IndexedPost from VerumTransaction
   */
  private async createIndexedPost(
    verumTx: VerumTransaction, 
    options: FeedOptions
  ): Promise<IndexedPost | null> {
    if (!verumTx.payload.content) return null;

    // Get real engagement metrics from blockchain data
    const engagementResult = await this.engagementService.getContentEngagement(
      verumTx.txId, 
      options.userAddress
    );

    let likeCount = 0;
    let commentCount = 0;
    let isLikedByUser = false;

    if (engagementResult.success && engagementResult.data) {
      likeCount = engagementResult.data.metrics.likeCount;
      commentCount = engagementResult.data.metrics.commentCount;
      isLikedByUser = engagementResult.data.userLikeStatus?.hasLiked || false;
    }

    return {
      txId: verumTx.txId,
      author: verumTx.senderAddress,
      content: verumTx.payload.content,
      timestamp: verumTx.blockTime,
      likeCount,
      commentCount,
      isLikedByUser,
      parentId: verumTx.payload.parent_id
    };
  }

  /**
   * Create IndexedStory from VerumTransaction
   */
  private async createIndexedStory(
    verumTx: VerumTransaction, 
    options: FeedOptions
  ): Promise<IndexedStory | null> {
    try {
      const storyResult = await this.storyReconstructor.reconstructStory(verumTx.txId);
      if (storyResult.success && storyResult.data) {
        // Get real engagement metrics for story
        const engagementResult = await this.engagementService.getContentEngagement(
          verumTx.txId, 
          options.userAddress
        );

        if (engagementResult.success && engagementResult.data) {
          storyResult.data.likeCount = engagementResult.data.metrics.likeCount;
          storyResult.data.commentCount = engagementResult.data.metrics.commentCount;
          storyResult.data.isLikedByUser = engagementResult.data.userLikeStatus?.hasLiked || false;
        }

        return storyResult.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create IndexedComment from VerumTransaction
   */
  private async createIndexedComment(
    verumTx: VerumTransaction, 
    options: FeedOptions
  ): Promise<IndexedComment | null> {
    if (!verumTx.payload.content || !verumTx.payload.parent_id) return null;

    // Determine parent type using engagement service
    const parentType = await this.engagementService.determineParentType(verumTx.payload.parent_id);

    // Get real engagement metrics for comment
    const engagementResult = await this.engagementService.getContentEngagement(
      verumTx.txId, 
      options.userAddress
    );

    let likeCount = 0;
    let isLikedByUser = false;

    if (engagementResult.success && engagementResult.data) {
      likeCount = engagementResult.data.metrics.likeCount;
      isLikedByUser = engagementResult.data.userLikeStatus?.hasLiked || false;
    }

    return {
      txId: verumTx.txId,
      author: verumTx.senderAddress,
      parentTxId: verumTx.payload.parent_id,
      parentType,
      content: verumTx.payload.content,
      timestamp: verumTx.blockTime,
      likeCount,
      isLikedByUser
    };
  }

  /**
   * Filter and paginate feed items
   */
  private filterAndPaginateFeed(items: FeedItem[], options: FeedOptions): FeedItem[] {
    let filtered = items;

    // Filter by timestamp range
    if (options.minTimestamp) {
      filtered = filtered.filter(item => item.timestamp >= options.minTimestamp!);
    }
    if (options.maxTimestamp) {
      filtered = filtered.filter(item => item.timestamp <= options.maxTimestamp!);
    }

    // Filter by authors
    if (options.authors && options.authors.length > 0) {
      filtered = filtered.filter(item => options.authors!.includes(item.author));
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    
    return filtered.slice(offset, offset + limit);
  }

  /**
   * Get engagement score for an item (for trending)
   */
  private getItemEngagement(item: FeedItem): number {
    if (this.isIndexedPost(item) || this.isIndexedStory(item)) {
      return (item.likeCount || 0) + (item.commentCount || 0);
    }
    if (this.isIndexedComment(item)) {
      return item.likeCount || 0;
    }
    return 0;
  }

  /**
   * Type guards
   */
  private isIndexedPost(item: FeedItem): item is IndexedPost {
    return !('segments' in item) && !('parentTxId' in item);
  }

  private isIndexedStory(item: FeedItem): item is IndexedStory {
    return 'segments' in item;
  }

  private isIndexedComment(item: FeedItem): item is IndexedComment {
    return 'parentTxId' in item;
  }

  /**
   * Get cached data if not expired
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
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
}