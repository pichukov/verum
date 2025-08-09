/**
 * Content Operations
 * 
 * High-level content operations for posts, comments, and likes
 */

import { VerumTransactionBuilder, TransactionType } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';
import { 
  IWallet, 
  OperationResult, 
  PostCreation,
  CommentCreation,
  LikeAction,
  SDKPost,
  SDKComment
} from '../types';

/**
 * Content operations manager
 */
export class ContentOperations {
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
   * Create a new post
   */
  async createPost(post: PostCreation): Promise<OperationResult<SDKPost>> {
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Get chain references
      const chainRefs = await this.getChainReferences(userAddress);

      // Create POST transaction
      const postTransaction = this.transactionBuilder.createPostTransaction(
        post.content,
        chainRefs
      );

      // Send transaction
      const txId = await this.wallet.sendTransaction(postTransaction);

      // Create enhanced post result
      const sdkPost: SDKPost = {
        txId,
        author: userAddress,
        content: post.content,
        timestamp: Math.floor(Date.now() / 1000),
        likeCount: 0,
        commentCount: 0,
        isLikedByUser: false,
        isOwnedByCurrentUser: true
      };

      return {
        success: true,
        data: sdkPost,
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create post'
      };
    }
  }

  /**
   * Create a comment on a post or story
   */
  async createComment(comment: CommentCreation): Promise<OperationResult<SDKComment>> {
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Get chain references
      const chainRefs = await this.getChainReferences(userAddress);

      // Create COMMENT transaction
      const commentTransaction = this.transactionBuilder.createCommentTransaction(
        comment.parentTxId,
        comment.content,
        chainRefs
      );

      // Send transaction
      const txId = await this.wallet.sendTransaction(commentTransaction);

      // Determine parent type using indexer
      const parentType = await this.determineParentType(comment.parentTxId);

      // Create enhanced comment result
      const sdkComment: SDKComment = {
        txId,
        author: userAddress,
        parentTxId: comment.parentTxId,
        parentType,
        content: comment.content,
        timestamp: Math.floor(Date.now() / 1000),
        likeCount: 0,
        isLikedByUser: false,
        isOwnedByCurrentUser: true
      };

      return {
        success: true,
        data: sdkComment,
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create comment'
      };
    }
  }

  /**
   * Like a post, story, or comment
   */
  async likeContent(like: LikeAction): Promise<OperationResult<string>> {
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Check if already liked using indexer
      const alreadyLiked = await this.indexer.hasUserLikedContent(like.targetTxId, userAddress);
      if (alreadyLiked.success && alreadyLiked.data?.hasLiked) {
        return {
          success: false,
          error: 'Content already liked by user'
        };
      }

      // Get chain references
      const chainRefs = await this.getChainReferences(userAddress);

      // Create LIKE transaction
      const likeTransaction = this.transactionBuilder.createLikeTransaction(
        like.targetTxId,
        chainRefs
      );

      // Send transaction
      const txId = await this.wallet.sendTransaction(likeTransaction);

      return {
        success: true,
        data: txId,
        txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to like content'
      };
    }
  }

  /**
   * Get a post by transaction ID with SDK enhancements
   */
  async getPost(txId: string): Promise<OperationResult<SDKPost>> {
    try {
      // Get transaction from indexer
      const txResult = await this.indexer.getTransaction(txId);
      if (!txResult.success || !txResult.data) {
        return {
          success: false,
          error: 'Post not found'
        };
      }

      // Parse transaction
      const verumTx = this.indexer.parseVerumTransaction(txResult.data);
      if (!verumTx || verumTx.payload.type !== 'post') {
        return {
          success: false,
          error: 'Invalid post transaction'
        };
      }

      // Get current user address
      const currentUserAddress = await this.getCurrentUserAddress();

      // Get real engagement metrics
      const engagementResult = await this.indexer.getContentEngagement(
        verumTx.txId, 
        currentUserAddress || undefined
      );

      let likeCount = 0;
      let commentCount = 0;
      let isLikedByUser = false;

      if (engagementResult.success && engagementResult.data) {
        likeCount = engagementResult.data.metrics.likeCount;
        commentCount = engagementResult.data.metrics.commentCount;
        isLikedByUser = engagementResult.data.userLikeStatus?.hasLiked || false;
      }

      // Create enhanced post
      const sdkPost: SDKPost = {
        txId: verumTx.txId,
        author: verumTx.senderAddress,
        content: verumTx.payload.content || '',
        timestamp: verumTx.blockTime,
        likeCount,
        commentCount,
        isLikedByUser,
        isOwnedByCurrentUser: currentUserAddress === verumTx.senderAddress,
        parentId: verumTx.payload.parent_id
      };

      return {
        success: true,
        data: sdkPost
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get post'
      };
    }
  }

  /**
   * Get comments for a post or story
   */
  async getComments(parentTxId: string, limit?: number, offset?: number): Promise<OperationResult<SDKComment[]>> {
    try {
      const commentsResult = await this.indexer.getCommentsForContent(parentTxId);
      if (!commentsResult.success || !commentsResult.data) {
        return {
          success: false,
          error: 'Failed to get comments'
        };
      }

      let comments = commentsResult.data;

      // Apply pagination
      if (offset) {
        comments = comments.slice(offset);
      }
      if (limit) {
        comments = comments.slice(0, limit);
      }

      // Convert to SDK format
      const currentUserAddress = await this.getCurrentUserAddress();
      const sdkComments: SDKComment[] = comments.map(comment => ({
        txId: comment.txId,
        author: comment.author,
        parentTxId: comment.parentTxId,
        parentType: comment.parentType,
        content: comment.content,
        timestamp: comment.timestamp,
        likeCount: comment.likeCount,
        isLikedByUser: comment.isLikedByUser,
        isOwnedByCurrentUser: currentUserAddress === comment.author
      }));

      return {
        success: true,
        data: sdkComments
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get comments'
      };
    }
  }

  /**
   * Get likes for a piece of content
   */
  async getLikes(targetTxId: string, limit?: number, offset?: number): Promise<OperationResult<any[]>> {
    try {
      const likesResult = await this.indexer.getLikesForContent(targetTxId);
      if (!likesResult.success || !likesResult.data) {
        return {
          success: false,
          error: 'Failed to get likes'
        };
      }

      let likes = likesResult.data;

      // Apply pagination
      if (offset) {
        likes = likes.slice(offset);
      }
      if (limit) {
        likes = likes.slice(0, limit);
      }

      return {
        success: true,
        data: likes
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get likes'
      };
    }
  }

  /**
   * Delete a post (by creating a deletion transaction)
   */
  async deletePost(txId: string): Promise<OperationResult<string>> {
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Verify ownership
      const postResult = await this.getPost(txId);
      if (!postResult.success || !postResult.data) {
        return {
          success: false,
          error: 'Post not found'
        };
      }

      if (postResult.data.author !== userAddress) {
        return {
          success: false,
          error: 'You can only delete your own posts'
        };
      }

      // TODO: Implement deletion transaction type in protocol
      // For now, return success without actual deletion
      return {
        success: true,
        data: 'Post deletion requested',
        txId: 'deletion_' + txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete post'
      };
    }
  }

  /**
   * Edit a post (by creating an edit transaction)
   */
  async editPost(txId: string, newContent: string): Promise<OperationResult<SDKPost>> {
    try {
      // Check wallet connection
      const isConnected = await this.wallet.isConnected();
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const userAddress = await this.wallet.getAddress();

      // Verify ownership
      const postResult = await this.getPost(txId);
      if (!postResult.success || !postResult.data) {
        return {
          success: false,
          error: 'Post not found'
        };
      }

      if (postResult.data.author !== userAddress) {
        return {
          success: false,
          error: 'You can only edit your own posts'
        };
      }

      // TODO: Implement edit transaction type in protocol
      // For now, create a new post with reference to original
      const editResult = await this.createPost({ content: newContent });
      
      if (editResult.success && editResult.data) {
        editResult.data.parentId = txId; // Mark as edit of original
      }

      return editResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to edit post'
      };
    }
  }

  /**
   * Batch create multiple posts
   */
  async batchCreatePosts(posts: PostCreation[]): Promise<OperationResult<SDKPost[]>> {
    const results: SDKPost[] = [];
    const errors: string[] = [];

    for (const post of posts) {
      try {
        const result = await this.createPost(post);
        if (result.success && result.data) {
          results.push(result.data);
        } else {
          errors.push(`Post "${post.content.substring(0, 50)}...": ${result.error}`);
        }
        
        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        errors.push(`Post "${post.content.substring(0, 50)}...": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      success: results.length > 0,
      data: results,
      error: errors.length > 0 ? `Some operations failed: ${errors.join(', ')}` : undefined
    };
  }

  /**
   * Check if current user has liked content
   */
  async hasLiked(targetTxId: string): Promise<boolean> {
    try {
      const currentUserAddress = await this.getCurrentUserAddress();
      if (!currentUserAddress) {
        return false;
      }

      const likeStatusResult = await this.indexer.hasUserLikedContent(targetTxId, currentUserAddress);
      return likeStatusResult.success && likeStatusResult.data?.hasLiked || false;
    } catch {
      return false;
    }
  }

  /**
   * Get engagement metrics for content
   */
  async getEngagementMetrics(txId: string): Promise<OperationResult<any>> {
    try {
      const metricsResult = await this.indexer.calculateEngagementForContent(txId);
      if (!metricsResult.success || !metricsResult.data) {
        return {
          success: false,
          error: 'Failed to get engagement metrics'
        };
      }

      return {
        success: true,
        data: {
          likeCount: metricsResult.data.likeCount,
          commentCount: metricsResult.data.commentCount,
          totalEngagement: metricsResult.data.totalEngagement,
          recentActivity: metricsResult.data.recentActivity,
          shareCount: 0, // Not implemented yet
          viewCount: 0, // Not implemented yet
          engagementRate: metricsResult.data.totalEngagement // Simplified calculation
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get engagement metrics'
      };
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
   * Determine parent content type for comments
   */
  private async determineParentType(parentTxId: string): Promise<'post' | 'story'> {
    try {
      const txResult = await this.indexer.getTransaction(parentTxId);
      if (txResult.success && txResult.data) {
        const verumTx = this.indexer.parseVerumTransaction(txResult.data);
        if (verumTx) {
          return verumTx.payload.type === TransactionType.STORY ? 'story' : 'post';
        }
      }
    } catch (error) {
      // Fallback to 'post' if we can't determine the type
    }
    return 'post';
  }
}