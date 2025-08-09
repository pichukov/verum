/**
 * User Data Fetcher
 * 
 * Handles fetching and indexing user profiles, subscriptions, and related data
 */

import { 
  IndexedUserProfile, 
  IndexedSubscription, 
  UserStats,
  ApiResponse,
  VerumTransaction 
} from '../types';
import { IBlockchainFetcher } from './blockchain-fetcher';
import { TransactionType } from '@verum/protocol';

/**
 * Interface for user data fetching operations
 */
export interface IUserFetcher {
  /**
   * Get user profile by address
   */
  getUserProfile(address: string): Promise<ApiResponse<IndexedUserProfile>>;

  /**
   * Get user statistics
   */
  getUserStats(address: string): Promise<ApiResponse<UserStats>>;

  /**
   * Get users that a specific user is following
   */
  getFollowing(address: string, limit?: number, offset?: number): Promise<ApiResponse<IndexedSubscription[]>>;

  /**
   * Get users that follow a specific user
   */
  getFollowers(address: string, limit?: number, offset?: number): Promise<ApiResponse<IndexedSubscription[]>>;

  /**
   * Check if user A follows user B
   */
  isFollowing(followerAddress: string, targetAddress: string): Promise<boolean>;

  /**
   * Get subscription status between two users
   */
  getSubscriptionStatus(followerAddress: string, targetAddress: string): Promise<IndexedSubscription | null>;

  /**
   * Batch fetch multiple user profiles
   */
  getUserProfiles(addresses: string[]): Promise<ApiResponse<IndexedUserProfile[]>>;
}

/**
 * User data fetcher implementation
 */
export class UserFetcher implements IUserFetcher {
  private blockchainFetcher: IBlockchainFetcher;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_TTL = 60000; // 1 minute for user data

  constructor(blockchainFetcher: IBlockchainFetcher) {
    this.blockchainFetcher = blockchainFetcher;
    this.cache = new Map();
  }

  /**
   * Get user profile by address
   */
  async getUserProfile(address: string): Promise<ApiResponse<IndexedUserProfile>> {
    const cacheKey = `profile:${address}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Fetch all transactions for the user
      const txResult = await this.blockchainFetcher.getTransactionsByAddress(address);
      
      if (!txResult.success || !txResult.data) {
        return { success: false, error: 'Failed to fetch user transactions' };
      }

      // Find START transaction (user registration)
      const startTx = await this.findStartTransaction(txResult.data, address);
      if (!startTx) {
        return { success: false, error: 'User not found - no START transaction' };
      }

      // Build user profile from transactions
      const profile = await this.buildUserProfile(address, startTx, txResult.data);
      
      // Cache the result
      this.setCachedData(cacheKey, profile);
      
      return { success: true, data: profile };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch user profile'
      };
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(address: string): Promise<ApiResponse<UserStats>> {
    const cacheKey = `stats:${address}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get user profile for basic info
      const profileResult = await this.getUserProfile(address);
      if (!profileResult.success || !profileResult.data) {
        return { success: false, error: 'Failed to fetch user profile' };
      }

      // Fetch all user transactions to calculate stats
      const txResult = await this.blockchainFetcher.getTransactionsByAddress(address);
      if (!txResult.success || !txResult.data) {
        return { success: false, error: 'Failed to fetch user transactions' };
      }

      const stats = await this.calculateUserStats(address, txResult.data, profileResult.data);
      
      // Cache the result
      this.setCachedData(cacheKey, stats);
      
      return { success: true, data: stats };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate user stats'
      };
    }
  }

  /**
   * Get users that a specific user is following
   */
  async getFollowing(
    address: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<ApiResponse<IndexedSubscription[]>> {
    const cacheKey = `following:${address}:${limit}:${offset}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      // Get all transactions for the user
      const txResult = await this.blockchainFetcher.getTransactionsByAddress(address);
      if (!txResult.success || !txResult.data) {
        return { success: false, error: 'Failed to fetch user transactions' };
      }

      // Extract subscription transactions
      const subscriptions = await this.extractSubscriptions(txResult.data, address);
      
      // Filter for active subscriptions and apply pagination
      const activeSubscriptions = subscriptions
        .filter(sub => sub.isActive)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(offset, offset + limit);
      
      // Cache the result
      this.setCachedData(cacheKey, activeSubscriptions);
      
      return {
        success: true,
        data: activeSubscriptions,
        pagination: {
          offset,
          limit,
          hasMore: (offset + limit) < subscriptions.filter(sub => sub.isActive).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch following list'
      };
    }
  }

  /**
   * Get users that follow a specific user
   */
  async getFollowers(
    _address: string, 
    _limit: number = 50, 
    _offset: number = 0
  ): Promise<ApiResponse<IndexedSubscription[]>> {
    // Note: This is complex in a blockchain context as we need to scan all addresses
    // In a real implementation, this would require an indexing service
    // For now, return empty array with a note
    return {
      success: true,
      data: [],
      error: 'Follower fetching requires blockchain indexing service'
    };
  }

  /**
   * Check if user A follows user B
   */
  async isFollowing(followerAddress: string, targetAddress: string): Promise<boolean> {
    const subscription = await this.getSubscriptionStatus(followerAddress, targetAddress);
    return subscription?.isActive || false;
  }

  /**
   * Get subscription status between two users
   */
  async getSubscriptionStatus(
    followerAddress: string, 
    targetAddress: string
  ): Promise<IndexedSubscription | null> {
    const cacheKey = `subscription:${followerAddress}:${targetAddress}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get follower's transactions
      const txResult = await this.blockchainFetcher.getTransactionsByAddress(followerAddress);
      if (!txResult.success || !txResult.data) {
        return null;
      }

      // Find subscription/unsubscription transactions for the target
      const subscriptions = await this.extractSubscriptions(txResult.data, followerAddress);
      const targetSubscriptions = subscriptions.filter(sub => sub.target === targetAddress);
      
      if (targetSubscriptions.length === 0) {
        return null;
      }

      // Return the most recent subscription status
      const latestSubscription = targetSubscriptions
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      
      // Cache the result
      this.setCachedData(cacheKey, latestSubscription);
      
      return latestSubscription;
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch fetch multiple user profiles
   */
  async getUserProfiles(addresses: string[]): Promise<ApiResponse<IndexedUserProfile[]>> {
    try {
      const profiles: IndexedUserProfile[] = [];
      const errors: string[] = [];

      // Fetch profiles in parallel (with reasonable batch size)
      const batchSize = 10;
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        const batchPromises = batch.map(async (address) => {
          const result = await this.getUserProfile(address);
          if (result.success && result.data) {
            profiles.push(result.data);
          } else {
            errors.push(`${address}: ${result.error}`);
          }
        });

        await Promise.all(batchPromises);
      }

      return {
        success: true,
        data: profiles,
        error: errors.length > 0 ? `Some profiles failed: ${errors.join(', ')}` : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch fetch profiles'
      };
    }
  }

  /**
   * Find START transaction for a user
   */
  private async findStartTransaction(
    rawTransactions: any[], 
    _address: string
  ): Promise<VerumTransaction | null> {
    for (const rawTx of rawTransactions) {
      const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
      if (verumTx && verumTx.payload.type === TransactionType.START) {
        return verumTx;
      }
    }
    return null;
  }

  /**
   * Build user profile from transactions
   */
  private async buildUserProfile(
    address: string,
    startTx: VerumTransaction,
    rawTransactions: any[]
  ): Promise<IndexedUserProfile> {
    // Parse profile data from START transaction
    const profileData = JSON.parse(startTx.payload.content || '{}');
    
    // Count different transaction types
    let postCount = 0;
    let followingCount = 0;
    let lastTxId = startTx.txId;
    let lastSubscribeTxId: string | undefined;
    let lastTimestamp = startTx.blockTime;

    for (const rawTx of rawTransactions) {
      const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
      if (!verumTx) continue;

      // Update last transaction info
      if (verumTx.blockTime > lastTimestamp) {
        lastTxId = verumTx.txId;
        lastTimestamp = verumTx.blockTime;
      }

      // Count posts and stories
      if (verumTx.payload.type === TransactionType.POST || 
          verumTx.payload.type === TransactionType.STORY) {
        postCount++;
      }

      // Track subscriptions
      if (verumTx.payload.type === TransactionType.SUBSCRIBE) {
        followingCount++;
        lastSubscribeTxId = verumTx.txId;
      } else if (verumTx.payload.type === TransactionType.UNSUBSCRIBE) {
        followingCount = Math.max(0, followingCount - 1);
      }
    }

    return {
      address,
      nickname: profileData.nickname || 'Unknown',
      avatar: profileData.avatar,
      startTxId: startTx.txId,
      lastTxId,
      lastSubscribeTxId,
      postCount,
      followerCount: 0, // Would need indexing service to calculate
      followingCount,
      createdAt: startTx.blockTime,
      updatedAt: lastTimestamp
    };
  }

  /**
   * Calculate user statistics
   */
  private async calculateUserStats(
    address: string,
    rawTransactions: any[],
    profile: IndexedUserProfile
  ): Promise<UserStats> {
    let postCount = 0;
    let storyCount = 0;
    let commentCount = 0;
    let likeCount = 0;

    for (const rawTx of rawTransactions) {
      const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
      if (!verumTx) continue;

      switch (verumTx.payload.type) {
        case TransactionType.POST:
          postCount++;
          break;
        case TransactionType.STORY:
          // Count only first segments of stories
          if (verumTx.payload.params?.segment === 1) {
            storyCount++;
          }
          break;
        case TransactionType.COMMENT:
          commentCount++;
          break;
        case TransactionType.LIKE:
          likeCount++;
          break;
      }
    }

    return {
      address,
      postCount,
      storyCount,
      commentCount,
      likeCount,
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      totalEngagement: likeCount + commentCount,
      joinedAt: profile.createdAt
    };
  }

  /**
   * Extract subscription data from transactions
   */
  private async extractSubscriptions(
    rawTransactions: any[],
    subscriberAddress: string
  ): Promise<IndexedSubscription[]> {
    const subscriptions: Map<string, IndexedSubscription> = new Map();

    for (const rawTx of rawTransactions) {
      const verumTx = this.blockchainFetcher.parseVerumTransaction(rawTx);
      if (!verumTx) continue;

      if (verumTx.payload.type === TransactionType.SUBSCRIBE || 
          verumTx.payload.type === TransactionType.UNSUBSCRIBE) {
        
        const targetAddress = verumTx.payload.content;
        if (!targetAddress || typeof targetAddress !== 'string') continue;

        const subscription: IndexedSubscription = {
          txId: verumTx.txId,
          subscriber: subscriberAddress,
          target: targetAddress,
          timestamp: verumTx.blockTime,
          isActive: verumTx.payload.type === TransactionType.SUBSCRIBE
        };

        // Keep the most recent subscription status for each target
        const existing = subscriptions.get(targetAddress);
        if (!existing || verumTx.blockTime > existing.timestamp) {
          subscriptions.set(targetAddress, subscription);
        }
      }
    }

    return Array.from(subscriptions.values());
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