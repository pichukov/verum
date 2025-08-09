/**
 * Verum SDK Type Definitions
 * 
 * High-level types for the complete Verum SDK
 */

// Re-export core types from dependencies
export * from '@verum/protocol';
export * from '@verum/index';

/**
 * Wallet interface for different wallet implementations
 */
export interface IWallet {
  /**
   * Get the current wallet address
   */
  getAddress(): Promise<string>;

  /**
   * Sign and broadcast a transaction
   */
  sendTransaction(payload: any): Promise<string>;

  /**
   * Check if wallet is connected
   */
  isConnected(): Promise<boolean>;

  /**
   * Connect to the wallet
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the wallet
   */
  disconnect(): Promise<void>;

  /**
   * Get wallet balance
   */
  getBalance(): Promise<number>;

  /**
   * Get wallet type identifier
   */
  getType(): WalletType;
}

/**
 * Supported wallet types
 */
export enum WalletType {
  KASWARE = 'kasware',
  KASTLE = 'kastle'
  // Additional wallet types can be added here in the future
}

/**
 * SDK Configuration
 */
export interface VerumSDKConfig {
  // Network configuration
  network: 'mainnet' | 'testnet';
  kaspaApiUrl: string;
  
  // Wallet configuration
  wallet: IWallet;
  
  // Optional configurations
  timeout?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  maxRetries?: number;
  batchSize?: number;
  
  // Feature flags
  enableTransactionConfirmation?: boolean;
  enableAutoRetry?: boolean;
  enableOfflineMode?: boolean;
  
  // Story creation retry configuration
  storyRetryConfig?: {
    maxRetries?: number;
    baseDelay?: number; // milliseconds
    maxDelay?: number; // milliseconds
    exponentialBackoff?: boolean;
    segmentDelay?: number; // delay between segments
  };
}

/**
 * Operation result with success/error handling
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  txId?: string;
  confirmations?: number;
}

/**
 * Transaction status tracking
 */
export interface TransactionStatus {
  txId: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  timestamp: number;
  error?: string;
  type?: string;
  blockHeight?: number;
}

/**
 * User registration data
 */
export interface UserRegistration {
  nickname: string;
  avatar?: string; // Base64 encoded image
}

/**
 * Post creation data
 */
export interface PostCreation {
  content: string;
}

/**
 * Story creation data
 */
export interface StoryCreation {
  content: string;
  title?: string;
}

/**
 * Comment creation data
 */
export interface CommentCreation {
  parentTxId: string;
  content: string;
}

/**
 * Subscription action data
 */
export interface SubscriptionAction {
  targetAddress: string;
}

/**
 * Like action data
 */
export interface LikeAction {
  targetTxId: string;
}

/**
 * Feed configuration options
 */
export interface SDKFeedOptions {
  userAddress?: string;
  limit?: number;
  offset?: number;
  includeReplies?: boolean;
  minTimestamp?: number;
  maxTimestamp?: number;
  authors?: string[];
  refreshCache?: boolean;
}

/**
 * User profile with SDK-specific enhancements
 */
export interface SDKUserProfile {
  address: string;
  nickname: string;
  avatar?: string;
  startTxId: string;
  lastTxId?: string;
  lastSubscribeTxId?: string;
  postCount: number;
  storyCount: number;
  followerCount: number;
  followingCount: number;
  totalEngagement: number;
  createdAt: number;
  updatedAt: number;
  isFollowedByCurrentUser?: boolean;
  isCurrentUser?: boolean;
}

/**
 * Enhanced story with SDK features
 */
export interface SDKStory {
  firstTxId: string;
  author: string;
  title?: string;
  content: string;
  segments: any[];
  timestamp: number;
  likeCount: number;
  commentCount: number;
  isComplete: boolean;
  isLikedByUser?: boolean;
  isOwnedByCurrentUser?: boolean;
  creationProgress?: StoryCreationProgress;
}

/**
 * Story creation progress tracking with retry support
 */
export interface StoryCreationProgress {
  totalSegments: number;
  completedSegments: number;
  currentSegment: number;
  status: 'creating' | 'completed' | 'failed' | 'retrying' | 'paused';
  errors: string[];
  completedTxIds: string[]; // Track successfully created segment transaction IDs
  failedSegments: number[]; // Track which segments failed
  retryCount: number;
  maxRetries: number;
  lastRetryAt?: number;
  canResume: boolean;
}

/**
 * Enhanced post with SDK features
 */
export interface SDKPost {
  txId: string;
  author: string;
  content: string;
  timestamp: number;
  likeCount: number;
  commentCount: number;
  isLikedByUser?: boolean;
  isOwnedByCurrentUser?: boolean;
  parentId?: string;
}

/**
 * Enhanced comment with SDK features
 */
export interface SDKComment {
  txId: string;
  author: string;
  parentTxId: string;
  parentType: 'post' | 'story';
  content: string;
  timestamp: number;
  likeCount: number;
  isLikedByUser?: boolean;
  isOwnedByCurrentUser?: boolean;
}

/**
 * SDK Feed item union type
 */
export type SDKFeedItem = SDKPost | SDKStory | SDKComment;

/**
 * Enhanced feed result
 */
export interface SDKFeedResult {
  items: SDKFeedItem[];
  hasMore: boolean;
  nextOffset?: number;
  totalCount?: number;
  lastUpdated: number;
  cacheHit: boolean;
}

/**
 * Subscription status with enhanced info
 */
export interface SDKSubscription {
  txId: string;
  subscriber: string;
  target: string;
  timestamp: number;
  isActive: boolean;
  mutualFollowing?: boolean;
}

/**
 * Enhanced user statistics
 */
export interface SDKUserStats {
  address: string;
  postCount: number;
  storyCount: number;
  commentCount: number;
  likeCount: number;
  followerCount: number;
  followingCount: number;
  totalEngagement: number;
  joinedAt: number;
  averageEngagementRate: number;
  mostActiveDay: string;
  recentActivity: {
    posts: number;
    stories: number;
    comments: number;
    likes: number;
  };
}

/**
 * Batch operation configuration
 */
export interface BatchOperationConfig {
  batchSize: number;
  delayBetweenBatches: number;
  maxConcurrent: number;
  retryFailedItems: boolean;
}

/**
 * Event emitter events for SDK
 */
export interface SDKEvents {
  // Transaction events
  'transaction:pending': (txId: string) => void;
  'transaction:found': (txId: string, confirmations: number) => void;
  'transaction:confirmed': (txId: string, confirmations: number) => void;
  'transaction:failed': (txId: string, error: string) => void;
  'transaction:timeout': (txId: string) => void;
  
  // Story creation events
  'story:segment:created': (segmentNumber: number, totalSegments: number) => void;
  'story:completed': (storyTxId: string) => void;
  'story:failed': (error: string, completedSegments: number) => void;
  'story:started': (progressId: string, progress: StoryCreationProgress) => void;
  'story:progress': (progressId: string, progress: StoryCreationProgress) => void;
  'story:retrying': (progressId: string, progress: StoryCreationProgress, segmentIndex: number, retryCount: number) => void;
  'story:resumed': (progressId: string, progress: StoryCreationProgress) => void;
  'story:cancelled': (progressId: string) => void;
  'story:segment:completed': (progressId: string, segmentIndex: number, totalSegments: number, txId: string) => void;
  
  // User events
  'user:profile:updated': (profile: SDKUserProfile) => void;
  'user:followed': (targetAddress: string) => void;
  'user:unfollowed': (targetAddress: string) => void;
  
  // Feed events
  'feed:updated': (feedType: string, itemCount: number) => void;
  'feed:error': (feedType: string, error: string) => void;
  
  // Wallet events
  'wallet:connected': (address: string, type: WalletType) => void;
  'wallet:disconnected': () => void;
  'wallet:error': (error: string) => void;
  
  // General events
  'error': (error: Error) => void;
  'offline': () => void;
  'online': () => void;
}

/**
 * Search configuration with SDK enhancements
 */
export interface SDKSearchOptions {
  query?: string;
  author?: string;
  type?: any[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'engagement' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  includeUserContext?: boolean;
  cacheResults?: boolean;
}

/**
 * Enhanced search result
 */
export interface SDKSearchResult {
  items: (SDKPost | SDKStory | SDKComment | SDKUserProfile)[];
  hasMore: boolean;
  nextOffset?: number;
  totalCount?: number;
  query: string;
  searchTime: number;
  suggestions?: string[];
}

/**
 * Real-time update subscription
 */
export interface RealtimeSubscription {
  id: string;
  type: 'user' | 'feed' | 'story' | 'global';
  filter: any;
  callback: (data: any) => void;
  isActive: boolean;
}

/**
 * SDK state snapshot for persistence
 */
export interface SDKState {
  currentUser?: SDKUserProfile;
  followingList: string[];
  cachedFeeds: Record<string, SDKFeedResult>;
  pendingTransactions: TransactionStatus[];
  walletInfo: {
    address: string;
    type: WalletType;
    balance: number;
  };
  lastSync: number;
}