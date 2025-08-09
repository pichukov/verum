/**
 * Verum SDK
 * 
 * Main SDK class providing a unified interface for all Verum protocol operations
 */

import { VerumTransactionBuilder } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';
import { 
  VerumSDKConfig,
  WalletType,
  OperationResult,
  UserRegistration,
  PostCreation,
  StoryCreation,
  CommentCreation,
  SubscriptionAction,
  LikeAction,
  SDKUserProfile,
  SDKPost,
  SDKStory,
  SDKComment,
  SDKFeedOptions,
  SDKFeedResult,
  SDKSearchOptions,
  SDKSearchResult,
  TransactionStatus,
  SDKEvents
} from './types';

import { WalletManager } from './wallet/wallet-adapter';
import { UserOperations } from './operations/user-operations';
import { ContentOperations } from './operations/content-operations';
import { StoryOperations } from './operations/story-operations';
import { FeedManager } from './managers/feed-manager';
import { TransactionConfirmationService } from './services/transaction-confirmation';

/**
 * Main Verum SDK class
 */
export class VerumSDK {
  // Core components
  private config: VerumSDKConfig;
  private transactionBuilder: VerumTransactionBuilder;
  private indexer: VerumIndexer;
  private walletManager: WalletManager;
  
  // Operation managers
  private userOps: UserOperations;
  private contentOps: ContentOperations;
  private storyOps: StoryOperations;
  private feedManager: FeedManager;
  
  // Services
  private confirmationService: TransactionConfirmationService;
  
  // State management
  private eventListeners: Map<keyof SDKEvents, Function[]> = new Map();
  private isInitialized: boolean = false;
  private currentUser: SDKUserProfile | null = null;

  constructor(config: VerumSDKConfig) {
    this.config = {
      timeout: 10000,
      enableCaching: true,
      cacheTTL: 60000,
      maxRetries: 3,
      batchSize: 100,
      enableTransactionConfirmation: true,
      enableAutoRetry: true,
      enableOfflineMode: false,
      ...config
    };

    // Initialize core components
    this.transactionBuilder = new VerumTransactionBuilder();
    this.indexer = new VerumIndexer({
      kaspaApiUrl: this.config.kaspaApiUrl,
      network: this.config.network,
      timeout: this.config.timeout,
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      maxRetries: this.config.maxRetries,
      batchSize: this.config.batchSize
    });
    
    this.walletManager = new WalletManager();
    
    // Initialize operation managers
    this.userOps = new UserOperations(this.transactionBuilder, this.indexer, this.config.wallet);
    this.contentOps = new ContentOperations(this.transactionBuilder, this.indexer, this.config.wallet);
    this.storyOps = new StoryOperations(this.transactionBuilder, this.indexer, this.config.wallet);
    this.feedManager = new FeedManager(this.indexer, this.config.wallet);
    
    // Initialize services
    this.confirmationService = new TransactionConfirmationService(this.indexer, {
      pollingInterval: 2000,
      maxRetries: 30,
      timeout: 60000,
      enableDetailedLogging: false
    });
    
    // Set up event forwarding
    this.setupEventForwarding();
  }

  // =================
  // Initialization
  // =================

  /**
   * Initialize the SDK
   */
  async initialize(): Promise<OperationResult<boolean>> {
    try {
      // Connect wallet if not already connected
      const isConnected = await this.config.wallet.isConnected();
      if (!isConnected) {
        await this.config.wallet.connect();
      }

      // Load current user profile
      await this.loadCurrentUser();
      
      this.isInitialized = true;
      // SDK initialization completed
      
      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize SDK'
      };
    }
  }

  /**
   * Check if SDK is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // =================
  // User Operations
  // =================

  /**
   * Register a new user
   */
  async registerUser(registration: UserRegistration): Promise<OperationResult<SDKUserProfile>> {
    const result = await this.userOps.registerUser(registration);
    if (result.success && result.data) {
      this.currentUser = result.data;
      this.emit('user:profile:updated', result.data);
    }
    return result;
  }

  /**
   * Get user profile
   */
  async getUserProfile(address?: string): Promise<OperationResult<SDKUserProfile>> {
    if (address) {
      return this.userOps.getUserProfile(address);
    } else {
      return this.userOps.getCurrentUserProfile();
    }
  }

  /**
   * Get current user profile
   */
  getCurrentUser(): SDKUserProfile | null {
    return this.currentUser;
  }

  /**
   * Follow a user
   */
  async followUser(action: SubscriptionAction): Promise<OperationResult<any>> {
    const result = await this.userOps.followUser(action);
    if (result.success) {
      this.emit('user:followed', action.targetAddress);
    }
    return result;
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(action: SubscriptionAction): Promise<OperationResult<any>> {
    const result = await this.userOps.unfollowUser(action);
    if (result.success) {
      this.emit('user:unfollowed', action.targetAddress);
    }
    return result;
  }

  /**
   * Get following list
   */
  async getFollowing(limit?: number, offset?: number): Promise<OperationResult<any[]>> {
    return this.userOps.getFollowing(limit, offset);
  }

  /**
   * Get followers list
   */
  async getFollowers(limit?: number, offset?: number): Promise<OperationResult<any[]>> {
    return this.userOps.getFollowers(limit, offset);
  }

  /**
   * Check if following a user
   */
  async isFollowing(targetAddress: string): Promise<boolean> {
    return this.userOps.isFollowing(targetAddress);
  }

  /**
   * Get user statistics
   */
  async getUserStats(address?: string): Promise<OperationResult<any>> {
    return this.userOps.getUserStats(address);
  }

  // =================
  // Content Operations
  // =================

  /**
   * Create a post
   */
  async createPost(post: PostCreation): Promise<OperationResult<SDKPost>> {
    const result = await this.contentOps.createPost(post);
    if (result.success && result.txId) {
      this.trackTransaction(result.txId, 'post');
    }
    return result;
  }

  /**
   * Create a comment
   */
  async createComment(comment: CommentCreation): Promise<OperationResult<SDKComment>> {
    const result = await this.contentOps.createComment(comment);
    if (result.success && result.txId) {
      this.trackTransaction(result.txId, 'comment');
    }
    return result;
  }

  /**
   * Like content
   */
  async likeContent(like: LikeAction): Promise<OperationResult<string>> {
    const result = await this.contentOps.likeContent(like);
    if (result.success && result.txId) {
      this.trackTransaction(result.txId, 'like');
    }
    return result;
  }

  /**
   * Get a post
   */
  async getPost(txId: string): Promise<OperationResult<SDKPost>> {
    return this.contentOps.getPost(txId);
  }

  // =================
  // Story Operations
  // =================

  /**
   * Create a story
   */
  async createStory(story: StoryCreation, existingProgressId?: string): Promise<OperationResult<SDKStory>> {
    // Set up story progress event forwarding
    this.storyOps.on('story:segment:completed', (_progressId: string, segment: number, total: number, txId: string) => {
      this.emit('story:segment:created', segment, total);
      this.trackTransaction(txId, 'story_segment');
    });

    this.storyOps.on('story:completed', (_progressId: string, story: SDKStory) => {
      this.emit('story:completed', story.firstTxId);
    });

    this.storyOps.on('story:failed', (_progressId: string, progress: any) => {
      this.emit('story:failed', progress.errors.join(', '), progress.completedSegments);
    });

    const result = await this.storyOps.createStory(story, existingProgressId);
    return result;
  }

  /**
   * Continue/retry story creation from where it left off
   */
  async continueStoryCreation(story: StoryCreation): Promise<OperationResult<SDKStory>> {
    console.log(`[VerumSDK] ==> CONTINUE STORY CREATION CALLED <==`);
    
    // Find any incomplete story creation
    const activeCreations = this.getActiveStoryCreations();
    console.log(`[VerumSDK] Active story creations found: ${Object.keys(activeCreations).length}`);
    
    for (const [progressId, progress] of Object.entries(activeCreations)) {
      console.log(`[VerumSDK] Checking progress ${progressId}: status=${progress.status}, canResume=${progress.canResume}, completed=${progress.completedSegments}`);
      if (progress.status === 'failed' && progress.canResume && progress.completedSegments > 0) {
        console.log(`[VerumSDK] ✓ Continuing story creation from progress ID: ${progressId}`);
        return this.createStory(story, progressId);
      }
    }

    // No incomplete story found, start new creation
    console.log(`[VerumSDK] No incomplete story found, starting new creation`);
    return this.createStory(story);
  }

  /**
   * Smart story creation that automatically continues incomplete stories
   * This is what the UI should call instead of createStory directly
   */
  async createOrContinueStory(story: StoryCreation): Promise<OperationResult<SDKStory>> {
    console.log(`[VerumSDK] ==> CREATE OR CONTINUE STORY CALLED <==`);
    
    // Check if there are incomplete stories first
    if (this.hasIncompleteStoryCreations()) {
      console.log(`[VerumSDK] Found incomplete stories, attempting to continue...`);
      return this.continueStoryCreation(story);
    } else {
      console.log(`[VerumSDK] No incomplete stories, starting new creation...`);
      return this.createStory(story);
    }
  }

  /**
   * Get a story
   */
  async getStory(firstTxId: string): Promise<OperationResult<SDKStory>> {
    return this.storyOps.getStory(firstTxId);
  }

  /**
   * Get story segments
   */
  async getStorySegments(firstTxId: string): Promise<OperationResult<any[]>> {
    return this.storyOps.getStorySegments(firstTxId);
  }

  /**
   * Check if story is complete
   */
  async isStoryComplete(firstTxId: string): Promise<OperationResult<boolean>> {
    return this.storyOps.isStoryComplete(firstTxId);
  }

  /**
   * Get active story creations
   */
  getActiveStoryCreations(): { [key: string]: any } {
    return this.storyOps.getActiveStoryCreations();
  }

  /**
   * Get story creation progress
   */
  getStoryCreationProgress(progressId: string): any | null {
    return this.storyOps.getStoryCreationProgress(progressId);
  }

  /**
   * Cancel an active story creation
   */
  async cancelStoryCreation(progressId: string): Promise<OperationResult<boolean>> {
    return this.storyOps.cancelStoryCreation(progressId);
  }

  /**
   * Retry a failed story creation
   */
  async retryStoryCreation(progressId: string): Promise<OperationResult<SDKStory>> {
    return this.storyOps.retryStoryCreation(progressId);
  }

  /**
   * Resume a paused story creation
   */
  async resumeStoryCreation(progressId: string): Promise<OperationResult<SDKStory>> {
    return this.storyOps.resumeStoryCreation(progressId);
  }

  /**
   * Get all incomplete story creations that can be resumed
   */
  getIncompleteStoryCreations(): { [key: string]: any } {
    const allActive = this.getActiveStoryCreations();
    const incomplete: { [key: string]: any } = {};
    
    for (const [progressId, progress] of Object.entries(allActive)) {
      if (progress.status === 'failed' && progress.canResume && progress.completedSegments > 0) {
        incomplete[progressId] = progress;
      }
    }
    
    return incomplete;
  }

  /**
   * Check if there are any incomplete story creations
   */
  hasIncompleteStoryCreations(): boolean {
    const incomplete = this.getIncompleteStoryCreations();
    return Object.keys(incomplete).length > 0;
  }

  // =================
  // Feed Operations
  // =================

  /**
   * Get personalized feed
   */
  async getPersonalizedFeed(options?: SDKFeedOptions): Promise<OperationResult<SDKFeedResult>> {
    return this.feedManager.getPersonalizedFeed(options);
  }

  /**
   * Get global feed
   */
  async getGlobalFeed(options?: SDKFeedOptions): Promise<OperationResult<SDKFeedResult>> {
    return this.feedManager.getGlobalFeed(options);
  }

  /**
   * Get user feed
   */
  async getUserFeed(targetAddress: string, options?: SDKFeedOptions): Promise<OperationResult<SDKFeedResult>> {
    return this.feedManager.getUserFeed(targetAddress, options);
  }

  /**
   * Get trending feed
   */
  async getTrendingFeed(options?: SDKFeedOptions): Promise<OperationResult<SDKFeedResult>> {
    return this.feedManager.getTrendingFeed(options);
  }

  /**
   * Search content
   */
  async searchContent(options: SDKSearchOptions): Promise<OperationResult<SDKSearchResult>> {
    return this.feedManager.searchContent(options);
  }

  /**
   * Refresh feeds cache
   */
  async refreshFeeds(): Promise<OperationResult<number>> {
    return this.feedManager.refreshAllFeeds();
  }

  // =================
  // Wallet Operations
  // =================

  /**
   * Get wallet information
   */
  async getWalletInfo(): Promise<OperationResult<any>> {
    try {
      const wallet = this.config.wallet;
      const isConnected = await wallet.isConnected();
      
      if (!isConnected) {
        return {
          success: false,
          error: 'Wallet not connected'
        };
      }

      const address = await wallet.getAddress();
      const balance = await wallet.getBalance();
      const type = wallet.getType();

      return {
        success: true,
        data: {
          address,
          balance,
          type,
          isConnected
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get wallet info'
      };
    }
  }

  /**
   * Connect wallet
   */
  async connectWallet(type?: WalletType): Promise<OperationResult<string>> {
    if (type) {
      return this.walletManager.connectWallet(type);
    } else {
      return this.walletManager.autoConnect();
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(): Promise<void> {
    await this.walletManager.disconnect();
    this.currentUser = null;
    this.isInitialized = false;
    this.emit('wallet:disconnected');
  }

  // =================
  // Transaction Management
  // =================

  /**
   * Get pending transactions
   */
  getPendingTransactions(): TransactionStatus[] {
    return this.confirmationService.getTrackedTransactions();
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(txId: string): TransactionStatus | null {
    return this.confirmationService.getTransactionStatus(txId);
  }

  /**
   * Clear completed transactions
   */
  clearCompletedTransactions(): number {
    return this.confirmationService.clearCompletedTransactions();
  }

  /**
   * Manually check transaction status
   */
  async checkTransactionStatus(txId: string): Promise<OperationResult<TransactionStatus>> {
    return this.confirmationService.checkTransactionStatus(txId);
  }

  // =================
  // Event Management
  // =================

  /**
   * Add event listener
   */
  on<K extends keyof SDKEvents>(event: K, callback: SDKEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback as Function);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SDKEvents>(event: K, callback: SDKEvents[K]): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback as Function);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Get SDK configuration
   */
  getConfig(): VerumSDKConfig {
    return { ...this.config };
  }

  /**
   * Update SDK configuration
   */
  updateConfig(updates: Partial<VerumSDKConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // Update indexer config if needed
    if (updates.cacheTTL || updates.enableCaching || updates.maxRetries) {
      this.indexer.updateConfig({
        cacheTTL: this.config.cacheTTL,
        enableCaching: this.config.enableCaching,
        maxRetries: this.config.maxRetries
      });
    }
  }

  /**
   * Clean up and destroy SDK resources
   */
  destroy(): void {
    // Clean up confirmation service
    this.confirmationService.destroy();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Reset state
    this.isInitialized = false;
    this.currentUser = null;
  }

  // =================
  // Debug Methods
  // =================

  /**
   * Debug method: Clear engagement cache and force refresh
   */
  debugClearEngagementCache(): void {
    this.indexer.clearEngagementCache();
  }

  /**
   * Debug method: Disable engagement caching
   */
  debugDisableEngagementCaching(): void {
    this.indexer.disableEngagementCaching();
  }

  /**
   * Debug method: Enable engagement caching
   */
  debugEnableEngagementCaching(): void {
    this.indexer.enableEngagementCaching();
  }

  /**
   * Debug method: Get fresh engagement data for content
   */
  async debugGetContentEngagement(txId: string, userAddress?: string) {
    // Temporarily disable caching
    this.indexer.disableEngagementCaching();
    
    // Get fresh data
    const result = await this.indexer.getContentEngagement(txId, userAddress);
    
    // Re-enable caching
    this.indexer.enableEngagementCaching();
    
    return result;
  }

  // =================
  // Private Methods
  // =================

  /**
   * Load current user profile
   */
  private async loadCurrentUser(): Promise<void> {
    try {
      const profileResult = await this.userOps.getCurrentUserProfile();
      if (profileResult.success && profileResult.data) {
        this.currentUser = profileResult.data;
      }
    } catch (error) {
      // User might not be registered yet, that's ok
    }
  }

  /**
   * Track transaction status
   */
  private trackTransaction(txId: string, type: string): void {
    this.emit('transaction:pending', txId);

    // Use real blockchain confirmation tracking
    if (this.config.enableTransactionConfirmation) {
      this.confirmationService.trackTransaction(txId, type);
    }
  }

  /**
   * Set up event forwarding from sub-components
   */
  private setupEventForwarding(): void {
    // Wallet events
    this.walletManager.on('wallet:connected', (address: string, type: WalletType) => {
      this.emit('wallet:connected', address, type);
    });

    this.walletManager.on('wallet:disconnected', () => {
      this.emit('wallet:disconnected');
    });

    this.walletManager.on('wallet:error', (error: string) => {
      this.emit('wallet:error', error);
    });

    // Feed events
    this.feedManager.on('feed:updated', (feedType: string, itemCount: number) => {
      this.emit('feed:updated', feedType, itemCount);
    });

    this.feedManager.on('feed:error', (feedType: string, error: string) => {
      this.emit('feed:error', feedType, error);
    });

    // Transaction confirmation events
    this.confirmationService.on('confirmation:pending', (txId: string) => {
      this.emit('transaction:pending', txId);
    });

    this.confirmationService.on('confirmation:found', (txId: string, confirmations: number) => {
      this.emit('transaction:found', txId, confirmations);
    });

    this.confirmationService.on('confirmation:confirmed', (txId: string, confirmations: number) => {
      this.emit('transaction:confirmed', txId, confirmations);
    });

    this.confirmationService.on('confirmation:failed', (txId: string, error: string) => {
      this.emit('transaction:failed', txId, error);
    });

    this.confirmationService.on('confirmation:timeout', (txId: string) => {
      this.emit('transaction:timeout', txId);
    });
  }

  /**
   * Emit event
   */
  private emit<K extends keyof SDKEvents>(event: K, ...args: Parameters<SDKEvents[K]>): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          (callback as any)(...args);
        } catch (error) {
          console.error(`Error in SDK event callback for ${event}:`, error);
        }
      });
    }
  }
}