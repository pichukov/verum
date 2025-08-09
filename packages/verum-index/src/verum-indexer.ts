/**
 * Verum Indexer
 * 
 * Main class that provides a unified interface for all Verum blockchain indexing operations
 */

import { 
  BlockchainConfig,
  IndexedUserProfile,
  IndexedStory,
  FeedOptions,
  FeedResult,
  SearchOptions,
  SearchResult,
  UserStats,
  ApiResponse
} from './types';

import { KaspaBlockchainFetcher, IBlockchainFetcher } from './fetchers/blockchain-fetcher';
import { UserFetcher, IUserFetcher } from './fetchers/user-fetcher';
import { FeedAggregator, IFeedAggregator } from './aggregators/feed-aggregator';
import { StoryReconstructor, IStoryReconstructor } from './utils/story-reconstructor';
import { EngagementService } from './services/engagement-service';
import { TransactionType } from '@verum/protocol';

/**
 * Configuration options for VerumIndexer
 */
export interface VerumIndexerConfig extends BlockchainConfig {
  enableCaching?: boolean;
  cacheTTL?: number;
  maxRetries?: number;
  batchSize?: number;
}

/**
 * Main Verum indexer class providing unified access to all indexing operations
 */
export class VerumIndexer {
  private blockchainFetcher: IBlockchainFetcher;
  private userFetcher: IUserFetcher;
  private feedAggregator: IFeedAggregator;
  private storyReconstructor: IStoryReconstructor;
  private engagementService: EngagementService;
  private config: VerumIndexerConfig;

  constructor(config: VerumIndexerConfig) {
    this.config = {
      enableCaching: true,
      cacheTTL: 60000,
      maxRetries: 3,
      batchSize: 100,
      ...config
    };

    // Initialize components
    this.blockchainFetcher = new KaspaBlockchainFetcher({
      kaspaApiUrl: config.kaspaApiUrl,
      kasplexApiUrl: config.kasplexApiUrl,
      network: config.network,
      timeout: config.timeout,
      maxRetries: this.config.maxRetries,
      batchSize: this.config.batchSize
    });

    this.userFetcher = new UserFetcher(this.blockchainFetcher);
    this.storyReconstructor = new StoryReconstructor(this.blockchainFetcher);
    this.engagementService = new EngagementService(this.blockchainFetcher, {
      cacheEnabled: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL || 60000,
      batchSize: this.config.batchSize || 100,
      maxSearchDepth: 2000 // Increased search depth for better coverage
    });
    this.feedAggregator = new FeedAggregator(
      this.blockchainFetcher,
      this.userFetcher,
      this.storyReconstructor,
      this.engagementService
    );
  }

  // =================
  // User Operations
  // =================

  /**
   * Get user profile by address
   */
  async getUserProfile(address: string): Promise<ApiResponse<IndexedUserProfile>> {
    return this.userFetcher.getUserProfile(address);
  }

  /**
   * Get user statistics
   */
  async getUserStats(address: string): Promise<ApiResponse<UserStats>> {
    return this.userFetcher.getUserStats(address);
  }

  /**
   * Get users that a specific user is following
   */
  async getFollowing(address: string, limit?: number, offset?: number) {
    return this.userFetcher.getFollowing(address, limit, offset);
  }

  /**
   * Get users that follow a specific user
   */
  async getFollowers(address: string, limit?: number, offset?: number) {
    return this.userFetcher.getFollowers(address, limit, offset);
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerAddress: string, targetAddress: string): Promise<boolean> {
    return this.userFetcher.isFollowing(followerAddress, targetAddress);
  }

  /**
   * Batch fetch multiple user profiles
   */
  async getUserProfiles(addresses: string[]) {
    return this.userFetcher.getUserProfiles(addresses);
  }

  // =================
  // Story Operations
  // =================

  /**
   * Reconstruct a complete story from its first segment transaction ID
   */
  async getStory(firstTxId: string): Promise<ApiResponse<IndexedStory>> {
    return this.storyReconstructor.reconstructStory(firstTxId);
  }

  /**
   * Get all segments for a story
   */
  async getStorySegments(firstTxId: string) {
    return this.storyReconstructor.getStorySegments(firstTxId);
  }

  /**
   * Check if a story is complete
   */
  isStoryComplete(segments: any[]): boolean {
    return this.storyReconstructor.isStoryComplete(segments);
  }

  // =================
  // Feed Operations
  // =================

  /**
   * Get personalized feed for a user
   */
  async getPersonalizedFeed(userAddress: string, options?: FeedOptions): Promise<ApiResponse<FeedResult>> {
    return this.feedAggregator.getPersonalizedFeed(userAddress, options);
  }

  /**
   * Get global feed (all users)
   */
  async getGlobalFeed(options?: FeedOptions): Promise<ApiResponse<FeedResult>> {
    return this.feedAggregator.getGlobalFeed(options);
  }

  /**
   * Get feed for a specific user
   */
  async getUserFeed(targetAddress: string, options?: FeedOptions): Promise<ApiResponse<FeedResult>> {
    return this.feedAggregator.getUserFeed(targetAddress, options);
  }

  /**
   * Get trending content
   */
  async getTrendingFeed(options?: FeedOptions): Promise<ApiResponse<FeedResult>> {
    return this.feedAggregator.getTrendingFeed(options);
  }

  /**
   * Get feed items by type
   */
  async getFeedByType(types: TransactionType[], options?: FeedOptions): Promise<ApiResponse<FeedResult>> {
    return this.feedAggregator.getFeedByType(types, options);
  }

  // =================
  // Search Operations
  // =================

  /**
   * Search for content across the network
   */
  async searchContent(options: SearchOptions): Promise<ApiResponse<SearchResult>> {
    // For now, use feed operations to implement basic search
    // In a full implementation, this would have dedicated search indexing
    
    try {
      let feedOptions: FeedOptions = {
        limit: options.limit || 50,
        offset: options.offset || 0
      };

      // Filter by author if specified
      if (options.author) {
        feedOptions.authors = [options.author];
      }

      // Get appropriate feed based on search criteria
      let feedResult: ApiResponse<FeedResult>;
      
      if (options.type && options.type.length > 0) {
        feedResult = await this.getFeedByType(options.type, feedOptions);
      } else if (options.author) {
        feedResult = await this.getUserFeed(options.author, feedOptions);
      } else {
        feedResult = await this.getGlobalFeed(feedOptions);
      }

      if (!feedResult.success || !feedResult.data) {
        return { success: false, error: feedResult.error || 'Search failed' };
      }

      // Apply text filtering if query is provided
      let filteredItems = feedResult.data.items;
      if (options.query) {
        const query = options.query.toLowerCase();
        filteredItems = filteredItems.filter(item => {
          if ('content' in item && item.content) {
            return item.content.toLowerCase().includes(query);
          }
          return false;
        });
      }

      // Apply sorting
      if (options.sortBy === 'engagement') {
        filteredItems.sort((a, b) => {
          const aEngagement = this.getItemEngagement(a);
          const bEngagement = this.getItemEngagement(b);
          return options.sortOrder === 'asc' ? aEngagement - bEngagement : bEngagement - aEngagement;
        });
      } else {
        // Default sort by timestamp
        filteredItems.sort((a, b) => {
          return options.sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
        });
      }

      const searchResult: SearchResult = {
        items: filteredItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: filteredItems.length
      };

      return { success: true, data: searchResult };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  // =================
  // Utility Operations
  // =================

  /**
   * Get recent transactions from the blockchain
   */
  async getRecentTransactions(limit?: number) {
    return this.blockchainFetcher.getRecentTransactions(limit);
  }

  // =================
  // Engagement Operations
  // =================

  /**
   * Get engagement metrics for content
   */
  async getContentEngagement(txId: string, userAddress?: string) {
    return this.engagementService.getContentEngagement(txId, userAddress);
  }

  /**
   * Get likes for content
   */
  async getLikesForContent(targetTxId: string) {
    return this.engagementService.getLikesForContent(targetTxId);
  }

  /**
   * Get comments for content
   */
  async getCommentsForContent(parentTxId: string) {
    return this.engagementService.getCommentsForContent(parentTxId);
  }

  /**
   * Check if user has liked content
   */
  async hasUserLikedContent(targetTxId: string, userAddress: string) {
    return this.engagementService.hasUserLikedContent(targetTxId, userAddress);
  }

  /**
   * Calculate engagement metrics for content
   */
  async calculateEngagementForContent(txId: string) {
    return this.engagementService.calculateEngagementForContent(txId);
  }

  /**
   * Determine content type (for likes)
   */
  async determineContentType(txId: string) {
    return this.engagementService.determineContentType(txId);
  }

  /**
   * Determine parent type for comments
   */
  async determineParentType(txId: string) {
    return this.engagementService.determineParentType(txId);
  }

  // =================
  // Debug Operations
  // =================

  /**
   * Clear engagement cache for debugging
   */
  clearEngagementCache(): void {
    this.engagementService.clearCache();
  }

  /**
   * Disable engagement caching for debugging
   */
  disableEngagementCaching(): void {
    this.engagementService.disableCaching();
  }

  /**
   * Re-enable engagement caching
   */
  enableEngagementCaching(): void {
    this.engagementService.enableCaching();
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(txId: string) {
    return this.blockchainFetcher.getTransactionById(txId);
  }

  /**
   * Get transactions for an address
   */
  async getTransactionsByAddress(address: string, limit?: number, offset?: number) {
    return this.blockchainFetcher.getTransactionsByAddress(address, limit, offset);
  }

  /**
   * Check if a transaction exists
   */
  async transactionExists(txId: string): Promise<boolean> {
    return this.blockchainFetcher.transactionExists(txId);
  }

  /**
   * Parse a raw transaction to extract Verum protocol data
   */
  parseVerumTransaction(rawTx: any) {
    return this.blockchainFetcher.parseVerumTransaction(rawTx);
  }

  // =================
  // Private Helpers
  // =================

  /**
   * Get engagement score for sorting
   */
  private getItemEngagement(item: any): number {
    return (item.likeCount || 0) + (item.commentCount || 0);
  }

  /**
   * Get current configuration
   */
  getConfig(): VerumIndexerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<VerumIndexerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}