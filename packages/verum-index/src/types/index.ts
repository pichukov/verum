/**
 * Verum Index Type Definitions
 * 
 * Types for blockchain data fetching and indexing operations
 */

import { TransactionType, TransactionPayload } from '@verum/protocol';

/**
 * Configuration for blockchain data sources
 */
export interface BlockchainConfig {
  kaspaApiUrl: string;
  kasplexApiUrl?: string; // Optional - for future integrations
  network: 'mainnet' | 'testnet';
  timeout?: number;
}

/**
 * Raw transaction data from blockchain
 */
export interface RawTransaction {
  transaction_id: string;
  block_time: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
}

/**
 * Transaction input data
 */
export interface TransactionInput {
  previous_outpoint: {
    transaction_id: string;
    index: number;
  };
  signature_script: string;
  sequence: number;
}

/**
 * Transaction output data
 */
export interface TransactionOutput {
  amount: number;
  script_public_key: {
    version: number;
    script: string;
  };
  address?: string;
}

/**
 * Parsed Verum transaction with protocol data
 */
export interface VerumTransaction {
  txId: string;
  blockTime: number;
  senderAddress: string;
  payload: TransactionPayload;
  rawTransaction: RawTransaction;
}

/**
 * User profile with blockchain metadata
 */
export interface IndexedUserProfile {
  address: string;
  nickname: string;
  avatar?: string;
  startTxId: string;
  lastTxId?: string;
  lastSubscribeTxId?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Post data with engagement metrics
 */
export interface IndexedPost {
  txId: string;
  author: string;
  content: string;
  timestamp: number;
  likeCount: number;
  commentCount: number;
  isLikedByUser?: boolean;
  parentId?: string; // For comments
}

/**
 * Story data reconstructed from segments
 */
export interface IndexedStory {
  firstTxId: string;
  author: string;
  title?: string;
  content: string;
  segments: StorySegment[];
  timestamp: number;
  likeCount: number;
  commentCount: number;
  isComplete: boolean;
  isLikedByUser?: boolean;
}

/**
 * Individual story segment
 */
export interface StorySegment {
  txId: string;
  segmentNumber: number;
  totalSegments: number;
  content: string;
  timestamp: number;
  isFinal: boolean;
}

/**
 * Subscription relationship
 */
export interface IndexedSubscription {
  txId: string;
  subscriber: string;
  target: string;
  timestamp: number;
  isActive: boolean; // false if unsubscribed
}

/**
 * Like interaction
 */
export interface IndexedLike {
  txId: string;
  liker: string;
  targetTxId: string;
  targetType: 'post' | 'story' | 'comment';
  timestamp: number;
}

/**
 * Comment data
 */
export interface IndexedComment {
  txId: string;
  author: string;
  parentTxId: string;
  parentType: 'post' | 'story';
  content: string;
  timestamp: number;
  likeCount: number;
  isLikedByUser?: boolean;
}

/**
 * Feed item union type
 */
export type FeedItem = IndexedPost | IndexedStory | IndexedComment;

/**
 * Feed configuration options
 */
export interface FeedOptions {
  userAddress?: string; // For personalized feeds
  limit?: number;
  offset?: number;
  includeReplies?: boolean;
  minTimestamp?: number;
  maxTimestamp?: number;
  authors?: string[]; // Filter by specific authors
}

/**
 * Search options for content discovery
 */
export interface SearchOptions {
  query?: string;
  author?: string;
  type?: TransactionType[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'engagement';
  sortOrder?: 'asc' | 'desc';
}

/**
 * User statistics
 */
export interface UserStats {
  address: string;
  postCount: number;
  storyCount: number;
  commentCount: number;
  likeCount: number;
  followerCount: number;
  followingCount: number;
  totalEngagement: number;
  joinedAt: number;
}

/**
 * Feed aggregation result
 */
export interface FeedResult {
  items: FeedItem[];
  hasMore: boolean;
  nextOffset?: number;
  totalCount?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  items: (VerumTransaction | IndexedPost | IndexedStory | IndexedComment)[];
  hasMore: boolean;
  nextOffset?: number;
  totalCount?: number;
}

/**
 * Indexing status for a user
 */
export interface IndexingStatus {
  address: string;
  lastIndexedTxId?: string;
  lastIndexedTimestamp?: number;
  isIndexing: boolean;
  error?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    offset: number;
    limit: number;
    total?: number;
    hasMore: boolean;
  };
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: { item: any; error: string }[];
  totalProcessed: number;
}

/**
 * Event emitter events for real-time updates
 */
export interface IndexerEvents {
  'transaction:new': (transaction: VerumTransaction) => void;
  'user:updated': (profile: IndexedUserProfile) => void;
  'post:new': (post: IndexedPost) => void;
  'story:updated': (story: IndexedStory) => void;
  'subscription:changed': (subscription: IndexedSubscription) => void;
  'like:added': (like: IndexedLike) => void;
  'comment:new': (comment: IndexedComment) => void;
  'indexing:status': (status: IndexingStatus) => void;
  'error': (error: Error) => void;
}