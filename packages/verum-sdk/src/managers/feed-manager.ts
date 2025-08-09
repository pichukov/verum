/**
 * Feed Manager
 * 
 * High-level feed management with caching, personalization, and real-time updates
 */

import { VerumIndexer } from '@verum/index';
import { TransactionType } from '@verum/protocol';
import { 
  IWallet,
  OperationResult,
  SDKFeedOptions,
  SDKFeedResult,
  SDKFeedItem,
  SDKPost,
  SDKStory,
  SDKComment,
  SDKSearchOptions,
  SDKSearchResult
} from '../types';

/**
 * Feed manager with advanced caching and personalization
 */
export class FeedManager {
  private indexer: VerumIndexer;
  private wallet: IWallet;
  private feedCache: Map<string, { data: SDKFeedResult; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30000; // 30 seconds
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(indexer: VerumIndexer, wallet: IWallet) {
    this.indexer = indexer;
    this.wallet = wallet;
  }

  /**
   * Get personalized feed for current user
   */
  async getPersonalizedFeed(options: SDKFeedOptions = {}): Promise<OperationResult<SDKFeedResult>> {
    try {
      const userAddress = await this.wallet.getAddress();
      const cacheKey = `personalized:${userAddress}:${JSON.stringify(options)}`;
      
      // Check cache first unless refresh is requested
      if (!options.refreshCache) {
        const cached = this.getCachedFeed(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cacheHit: true }
          };
        }
      }

      // Get feed from indexer
      const feedResult = await this.indexer.getPersonalizedFeed(userAddress, {
        limit: options.limit,
        offset: options.offset,
        includeReplies: options.includeReplies,
        minTimestamp: options.minTimestamp,
        maxTimestamp: options.maxTimestamp,
        authors: options.authors
      });

      if (!feedResult.success || !feedResult.data) {
        return {
          success: false,
          error: feedResult.error || 'Failed to get personalized feed'
        };
      }

      // Enhance feed items
      const enhancedItems = await this.enhanceFeedItems(feedResult.data.items, userAddress);

      const sdkFeedResult: SDKFeedResult = {
        items: enhancedItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: feedResult.data.totalCount,
        lastUpdated: Date.now(),
        cacheHit: false
      };

      // Cache the result
      this.setCachedFeed(cacheKey, sdkFeedResult);
      
      this.emit('feed:updated', 'personalized', enhancedItems.length);

      return {
        success: true,
        data: sdkFeedResult
      };
    } catch (error) {
      this.emit('feed:error', 'personalized', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get personalized feed'
      };
    }
  }

  /**
   * Get global feed
   */
  async getGlobalFeed(options: SDKFeedOptions = {}): Promise<OperationResult<SDKFeedResult>> {
    try {
      const cacheKey = `global:${JSON.stringify(options)}`;
      
      // Check cache first unless refresh is requested
      if (!options.refreshCache) {
        const cached = this.getCachedFeed(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cacheHit: true }
          };
        }
      }

      // Get feed from indexer
      const feedResult = await this.indexer.getGlobalFeed({
        limit: options.limit,
        offset: options.offset,
        includeReplies: options.includeReplies,
        minTimestamp: options.minTimestamp,
        maxTimestamp: options.maxTimestamp,
        authors: options.authors
      });

      if (!feedResult.success || !feedResult.data) {
        return {
          success: false,
          error: feedResult.error || 'Failed to get global feed'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Enhance feed items
      const enhancedItems = await this.enhanceFeedItems(feedResult.data.items, currentUserAddress);

      const sdkFeedResult: SDKFeedResult = {
        items: enhancedItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: feedResult.data.totalCount,
        lastUpdated: Date.now(),
        cacheHit: false
      };

      // Cache the result
      this.setCachedFeed(cacheKey, sdkFeedResult);
      
      this.emit('feed:updated', 'global', enhancedItems.length);

      return {
        success: true,
        data: sdkFeedResult
      };
    } catch (error) {
      this.emit('feed:error', 'global', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get global feed'
      };
    }
  }

  /**
   * Get user feed
   */
  async getUserFeed(targetAddress: string, options: SDKFeedOptions = {}): Promise<OperationResult<SDKFeedResult>> {
    try {
      const cacheKey = `user:${targetAddress}:${JSON.stringify(options)}`;
      
      // Check cache first unless refresh is requested
      if (!options.refreshCache) {
        const cached = this.getCachedFeed(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cacheHit: true }
          };
        }
      }

      // Get feed from indexer
      const feedResult = await this.indexer.getUserFeed(targetAddress, {
        limit: options.limit,
        offset: options.offset,
        includeReplies: options.includeReplies,
        minTimestamp: options.minTimestamp,
        maxTimestamp: options.maxTimestamp
      });

      if (!feedResult.success || !feedResult.data) {
        return {
          success: false,
          error: feedResult.error || 'Failed to get user feed'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Enhance feed items
      const enhancedItems = await this.enhanceFeedItems(feedResult.data.items, currentUserAddress);

      const sdkFeedResult: SDKFeedResult = {
        items: enhancedItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: feedResult.data.totalCount,
        lastUpdated: Date.now(),
        cacheHit: false
      };

      // Cache the result
      this.setCachedFeed(cacheKey, sdkFeedResult);
      
      this.emit('feed:updated', 'user', enhancedItems.length);

      return {
        success: true,
        data: sdkFeedResult
      };
    } catch (error) {
      this.emit('feed:error', 'user', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user feed'
      };
    }
  }

  /**
   * Get trending feed
   */
  async getTrendingFeed(options: SDKFeedOptions = {}): Promise<OperationResult<SDKFeedResult>> {
    try {
      const cacheKey = `trending:${JSON.stringify(options)}`;
      
      // Check cache first unless refresh is requested
      if (!options.refreshCache) {
        const cached = this.getCachedFeed(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cacheHit: true }
          };
        }
      }

      // Get trending feed from indexer
      const feedResult = await this.indexer.getTrendingFeed({
        limit: options.limit,
        offset: options.offset,
        includeReplies: options.includeReplies,
        minTimestamp: options.minTimestamp,
        maxTimestamp: options.maxTimestamp,
        authors: options.authors
      });

      if (!feedResult.success || !feedResult.data) {
        return {
          success: false,
          error: feedResult.error || 'Failed to get trending feed'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Enhance feed items
      const enhancedItems = await this.enhanceFeedItems(feedResult.data.items, currentUserAddress);

      const sdkFeedResult: SDKFeedResult = {
        items: enhancedItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: feedResult.data.totalCount,
        lastUpdated: Date.now(),
        cacheHit: false
      };

      // Cache the result
      this.setCachedFeed(cacheKey, sdkFeedResult);
      
      this.emit('feed:updated', 'trending', enhancedItems.length);

      return {
        success: true,
        data: sdkFeedResult
      };
    } catch (error) {
      this.emit('feed:error', 'trending', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get trending feed'
      };
    }
  }

  /**
   * Get feed by content type
   */
  async getFeedByType(
    types: TransactionType[], 
    options: SDKFeedOptions = {}
  ): Promise<OperationResult<SDKFeedResult>> {
    try {
      const cacheKey = `type:${types.join(',')}:${JSON.stringify(options)}`;
      
      // Check cache first unless refresh is requested
      if (!options.refreshCache) {
        const cached = this.getCachedFeed(cacheKey);
        if (cached) {
          return {
            success: true,
            data: { ...cached, cacheHit: true }
          };
        }
      }

      // Get typed feed from indexer
      const feedResult = await this.indexer.getFeedByType(types, {
        limit: options.limit,
        offset: options.offset,
        includeReplies: options.includeReplies,
        minTimestamp: options.minTimestamp,
        maxTimestamp: options.maxTimestamp,
        authors: options.authors
      });

      if (!feedResult.success || !feedResult.data) {
        return {
          success: false,
          error: feedResult.error || 'Failed to get typed feed'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Enhance feed items
      const enhancedItems = await this.enhanceFeedItems(feedResult.data.items, currentUserAddress);

      const sdkFeedResult: SDKFeedResult = {
        items: enhancedItems,
        hasMore: feedResult.data.hasMore,
        nextOffset: feedResult.data.nextOffset,
        totalCount: feedResult.data.totalCount,
        lastUpdated: Date.now(),
        cacheHit: false
      };

      // Cache the result
      this.setCachedFeed(cacheKey, sdkFeedResult);
      
      this.emit('feed:updated', 'typed', enhancedItems.length);

      return {
        success: true,
        data: sdkFeedResult
      };
    } catch (error) {
      this.emit('feed:error', 'typed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get typed feed'
      };
    }
  }

  /**
   * Search content
   */
  async searchContent(options: SDKSearchOptions): Promise<OperationResult<SDKSearchResult>> {
    try {
      const startTime = Date.now();
      
      // Use indexer search (convert sortBy for indexer compatibility)
      const indexerSortBy = options.sortBy === 'relevance' ? 'engagement' : options.sortBy;
      
      const searchResult = await this.indexer.searchContent({
        query: options.query,
        author: options.author,
        type: options.type,
        limit: options.limit,
        offset: options.offset,
        sortBy: indexerSortBy,
        sortOrder: options.sortOrder
      });

      if (!searchResult.success || !searchResult.data) {
        return {
          success: false,
          error: searchResult.error || 'Search failed'
        };
      }

      const searchTime = Date.now() - startTime;

      // Get current user address for personalization
      const currentUserAddress = options.includeUserContext ? 
        await this.getCurrentUserAddress() : null;

      // Enhance search results
      const enhancedItems = await this.enhanceSearchResults(
        searchResult.data.items, 
        currentUserAddress
      );

      const sdkSearchResult: SDKSearchResult = {
        items: enhancedItems,
        hasMore: searchResult.data.hasMore,
        nextOffset: searchResult.data.nextOffset,
        totalCount: searchResult.data.totalCount,
        query: options.query || '',
        searchTime,
        suggestions: [] // TODO: Implement search suggestions
      };

      return {
        success: true,
        data: sdkSearchResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }

  /**
   * Refresh all cached feeds
   */
  async refreshAllFeeds(): Promise<OperationResult<number>> {
    try {
      const clearedCount = this.feedCache.size;
      this.feedCache.clear();
      
      this.emit('feed:cache:cleared', clearedCount);
      
      return {
        success: true,
        data: clearedCount
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh feeds'
      };
    }
  }

  /**
   * Get feed cache statistics
   */
  getFeedCacheStats(): {
    totalEntries: number;
    cacheHitRate: number;
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.feedCache.values());
    const now = Date.now();
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        cacheHitRate: 0,
        oldestEntry: 0,
        newestEntry: 0
      };
    }

    const timestamps = entries.map(entry => entry.timestamp);
    const hitCount = entries.filter(entry => entry.data.cacheHit).length;
    
    return {
      totalEntries: entries.length,
      cacheHitRate: hitCount / entries.length,
      oldestEntry: now - Math.min(...timestamps),
      newestEntry: now - Math.max(...timestamps)
    };
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Enhance feed items with SDK-specific features
   */
  private async enhanceFeedItems(items: any[], currentUserAddress: string | null): Promise<SDKFeedItem[]> {
    return Promise.all(items.map(async (item) => {
      // Add common enhancements
      const enhanced = {
        ...item,
        isOwnedByCurrentUser: currentUserAddress === item.author,
        isLikedByUser: false // TODO: Check if user liked this item
      };

      // Type-specific enhancements
      if ('segments' in item) {
        // It's a story
        return enhanced as SDKStory;
      } else if ('parentTxId' in item) {
        // It's a comment
        return enhanced as SDKComment;
      } else {
        // It's a post
        return enhanced as SDKPost;
      }
    }));
  }

  /**
   * Enhance search results
   */
  private async enhanceSearchResults(items: any[], currentUserAddress: string | null): Promise<any[]> {
    return items.map(item => ({
      ...item,
      isOwnedByCurrentUser: currentUserAddress === item.author,
      isLikedByUser: false // TODO: Check if user liked this item
    }));
  }

  /**
   * Get cached feed if not expired
   */
  private getCachedFeed(key: string): SDKFeedResult | null {
    const cached = this.feedCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached feed
   */
  private setCachedFeed(key: string, data: SDKFeedResult): void {
    this.feedCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get current user address safely
   */
  private async getCurrentUserAddress(): Promise<string | null> {
    try {
      const isConnected = await this.wallet.isConnected();
      return isConnected ? await this.wallet.getAddress() : null;
    } catch {
      return null;
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in feed event callback:', error);
        }
      });
    }
  }
}