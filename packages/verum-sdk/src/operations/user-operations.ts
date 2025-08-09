/**
 * User Operations
 * 
 * High-level user operations combining protocol creation and blockchain indexing
 */

import { VerumTransactionBuilder } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';
import { 
  IWallet, 
  OperationResult, 
  UserRegistration, 
  SubscriptionAction,
  SDKUserProfile,
  SDKSubscription,
  SDKUserStats 
} from '../types';

/**
 * User operations manager
 */
export class UserOperations {
  private transactionBuilder: VerumTransactionBuilder;
  private indexer: VerumIndexer;
  private wallet: IWallet;

  constructor(
    transactionBuilder: VerumTransactionBuilder,
    indexer: VerumIndexer,
    wallet: IWallet
  ) {
    this.transactionBuilder = transactionBuilder;
    this.indexer = indexer;
    this.wallet = wallet;
  }

  /**
   * Register a new user on the Verum protocol
   */
  async registerUser(registration: UserRegistration): Promise<OperationResult<SDKUserProfile>> {
    try {
      // Check if wallet is connected
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Check if user is already registered
      const existingProfile = await this.indexer.getUserProfile(userAddress);
      if (existingProfile.success) {
        return {
          success: false,
          error: 'User is already registered'
        };
      }

      // Create START transaction
      const startTransaction = this.transactionBuilder.createStartTransaction({
        nickname: registration.nickname,
        avatar: registration.avatar
      });

      // Send transaction through wallet
      const txId = await this.wallet.sendTransaction(startTransaction);

      // Wait a moment for transaction to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch the created profile
      const profileResult = await this.indexer.getUserProfile(userAddress);
      if (profileResult.success && profileResult.data) {
        const enhancedProfile = await this.enhanceUserProfile(profileResult.data, userAddress);
        
        return {
          success: true,
          data: enhancedProfile,
          txId
        };
      }

      // Return partial success if profile fetch fails
      return {
        success: true,
        data: {
          address: userAddress,
          nickname: registration.nickname,
          avatar: registration.avatar,
          startTxId: txId,
          postCount: 0,
          storyCount: 0,
          followerCount: 0,
          followingCount: 0,
          totalEngagement: 0,
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
          isCurrentUser: true
        },
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register user'
      };
    }
  }

  /**
   * Get user profile with SDK enhancements
   */
  async getUserProfile(address: string): Promise<OperationResult<SDKUserProfile>> {
    try {
      const profileResult = await this.indexer.getUserProfile(address);
      
      if (!profileResult.success || !profileResult.data) {
        return {
          success: false,
          error: profileResult.error || 'User profile not found'
        };
      }

      const currentUserAddress = await this.getCurrentUserAddress();
      const enhancedProfile = await this.enhanceUserProfile(profileResult.data, currentUserAddress);

      return {
        success: true,
        data: enhancedProfile
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user profile'
      };
    }
  }

  /**
   * Get current user's profile
   */
  async getCurrentUserProfile(): Promise<OperationResult<SDKUserProfile>> {
    try {
      const userAddress = await this.wallet.getAddress();
      return await this.getUserProfile(userAddress);
    } catch (error) {
      return {
        success: false,
        error: 'Wallet not connected or user not found'
      };
    }
  }

  /**
   * Follow another user
   */
  async followUser(action: SubscriptionAction): Promise<OperationResult<SDKSubscription>> {
    try {
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Check if already following
      const isFollowing = await this.indexer.isFollowing(userAddress, action.targetAddress);
      if (isFollowing) {
        return {
          success: false,
          error: 'Already following this user'
        };
      }

      // Get chain references for the transaction
      const chainRefs = await this.getChainReferences(userAddress);

      // Create SUBSCRIBE transaction
      const subscribeTransaction = this.transactionBuilder.createSubscribeTransaction(
        action.targetAddress,
        chainRefs
      );

      // Send transaction
      const txId = await this.wallet.sendTransaction(subscribeTransaction);

      // Create enhanced subscription result
      const subscription: SDKSubscription = {
        txId,
        subscriber: userAddress,
        target: action.targetAddress,
        timestamp: Math.floor(Date.now() / 1000),
        isActive: true,
        mutualFollowing: await this.indexer.isFollowing(action.targetAddress, userAddress)
      };

      return {
        success: true,
        data: subscription,
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to follow user'
      };
    }
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(action: SubscriptionAction): Promise<OperationResult<SDKSubscription>> {
    try {
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Check if currently following
      const isFollowing = await this.indexer.isFollowing(userAddress, action.targetAddress);
      if (!isFollowing) {
        return {
          success: false,
          error: 'Not currently following this user'
        };
      }

      // Get chain references for the transaction
      const chainRefs = await this.getChainReferences(userAddress);

      // Create UNSUBSCRIBE transaction
      const unsubscribeTransaction = this.transactionBuilder.createUnsubscribeTransaction(
        action.targetAddress,
        chainRefs
      );

      // Send transaction
      const txId = await this.wallet.sendTransaction(unsubscribeTransaction);

      // Create enhanced subscription result
      const subscription: SDKSubscription = {
        txId,
        subscriber: userAddress,
        target: action.targetAddress,
        timestamp: Math.floor(Date.now() / 1000),
        isActive: false,
        mutualFollowing: false
      };

      return {
        success: true,
        data: subscription,
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unfollow user'
      };
    }
  }

  /**
   * Get users that current user is following
   */
  async getFollowing(limit?: number, offset?: number): Promise<OperationResult<SDKSubscription[]>> {
    try {
      const userAddress = await this.wallet.getAddress();
      const result = await this.indexer.getFollowing(userAddress, limit, offset);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get following list'
        };
      }

      // Enhance subscriptions with mutual following info
      const enhancedSubscriptions = await Promise.all(
        result.data.map(async (sub) => {
          const mutualFollowing = await this.indexer.isFollowing(sub.target, userAddress);
          return {
            ...sub,
            mutualFollowing
          } as SDKSubscription;
        })
      );

      return {
        success: true,
        data: enhancedSubscriptions
      };
    } catch (error) {
      return {
        success: false,
        error: 'Wallet not connected'
      };
    }
  }

  /**
   * Get users that follow the current user
   */
  async getFollowers(limit?: number, offset?: number): Promise<OperationResult<SDKSubscription[]>> {
    try {
      const userAddress = await this.wallet.getAddress();
      const result = await this.indexer.getFollowers(userAddress, limit, offset);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get followers list'
        };
      }

      // Enhance subscriptions with mutual following info
      const enhancedSubscriptions = await Promise.all(
        result.data.map(async (sub) => {
          const mutualFollowing = await this.indexer.isFollowing(userAddress, sub.subscriber);
          return {
            ...sub,
            mutualFollowing
          } as SDKSubscription;
        })
      );

      return {
        success: true,
        data: enhancedSubscriptions
      };
    } catch (error) {
      return {
        success: false,
        error: 'Wallet not connected'
      };
    }
  }

  /**
   * Get enhanced user statistics
   */
  async getUserStats(address?: string): Promise<OperationResult<SDKUserStats>> {
    try {
      const targetAddress = address || await this.wallet.getAddress();
      const result = await this.indexer.getUserStats(targetAddress);
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to get user statistics'
        };
      }

      // Calculate enhanced metrics
      const enhancedStats: SDKUserStats = {
        ...result.data,
        averageEngagementRate: this.calculateEngagementRate(result.data),
        mostActiveDay: 'Monday', // TODO: Calculate from actual data
        recentActivity: {
          posts: Math.floor(result.data.postCount * 0.1), // TODO: Calculate actual recent activity
          stories: Math.floor(result.data.storyCount * 0.1),
          comments: Math.floor(result.data.commentCount * 0.1),
          likes: Math.floor(result.data.likeCount * 0.1)
        }
      };

      return {
        success: true,
        data: enhancedStats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user statistics'
      };
    }
  }

  /**
   * Batch follow multiple users
   */
  async batchFollow(targetAddresses: string[]): Promise<OperationResult<SDKSubscription[]>> {
    const results: SDKSubscription[] = [];
    const errors: string[] = [];

    for (const address of targetAddresses) {
      try {
        const result = await this.followUser({ targetAddress: address });
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`${address}: ${result.error}`);
        }
        
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push(`${address}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: results.length > 0,
      data: results,
      error: errors.length > 0 ? `Some operations failed: ${errors.join(', ')}` : undefined
    };
  }

  /**
   * Check if current user follows target user
   */
  async isFollowing(targetAddress: string): Promise<boolean> {
    try {
      const userAddress = await this.wallet.getAddress();
      return await this.indexer.isFollowing(userAddress, targetAddress);
    } catch {
      return false;
    }
  }

  /**
   * Get chain references for transactions
   */
  private async getChainReferences(userAddress: string): Promise<any> {
    try {
      const profile = await this.indexer.getUserProfile(userAddress);
      if (profile.success && profile.data) {
        return {
          prevTxId: profile.data.lastTxId,
          lastSubscribeId: profile.data.lastSubscribeTxId
        };
      }
      return {};
    } catch {
      return {};
    }
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
   * Enhance user profile with SDK-specific data
   */
  private async enhanceUserProfile(
    profile: any, 
    currentUserAddress: string | null
  ): Promise<SDKUserProfile> {
    const isCurrentUser = currentUserAddress === profile.address;
    let isFollowedByCurrentUser = false;

    if (currentUserAddress && !isCurrentUser) {
      isFollowedByCurrentUser = await this.indexer.isFollowing(currentUserAddress, profile.address);
    }

    return {
      ...profile,
      storyCount: 0, // TODO: Calculate from actual data
      totalEngagement: (profile.likeCount || 0) + (profile.commentCount || 0),
      isFollowedByCurrentUser,
      isCurrentUser
    };
  }

  /**
   * Calculate engagement rate
   */
  private calculateEngagementRate(stats: any): number {
    const totalContent = stats.postCount + stats.storyCount;
    if (totalContent === 0) return 0;
    
    const totalEngagement = stats.likeCount + stats.commentCount;
    return Math.round((totalEngagement / totalContent) * 100) / 100;
  }
}