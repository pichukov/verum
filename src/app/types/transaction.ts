// Verum version constant
export const VERUM_VERSION = '0.3';

// Supported protocol versions (for backward compatibility)
export const SUPPORTED_PROTOCOL_VERSIONS = ['0.1', '0.2', '0.3'];

// Protocol version parsing utilities
export interface ProtocolVersion {
  major: number;
  minor: number;
  original: string;
}

export function parseProtocolVersion(version: string): ProtocolVersion {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0]) || 0,
    minor: parseInt(parts[1]) || 0,
    original: version
  };
}

export function isCompatibleVersion(version: string): boolean {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version);
}

export function isMajorVersionCompatible(version: string, currentVersion: string = VERUM_VERSION): boolean {
  const v1 = parseProtocolVersion(version);
  const v2 = parseProtocolVersion(currentVersion);
  return v1.major === v2.major;
}

// Protocol creation date - Unix timestamp (fixed date when protocol v0.1 was deployed)
// This is the earliest possible date for protocol 0.1 transactions
// Set to August 1, 2024 00:00:00 UTC (corrected date)
export const VERUM_PROTOCOL_CREATION_DATE = 1722470400; // August 1, 2024 00:00:00 UTC

export enum TransactionType {
  START = 'start',
  POST = 'post', 
  SUBSCRIBE = 'subscribe',
  LIKE = 'like',
  UNSUBSCRIBE = 'unsubscribe',
  COMMENT = 'comment',
  STORY = 'story',
  NOTE = 'note'
}

export interface TransactionPayload {
  verum: string;
  type: TransactionType;
  content: string | null;
  timestamp: number;
  parent_id?: string;
  params?: Record<string, any>;
  
  // Chain reference fields for linked list traversal
  prev_tx_id?: string;      // Previous Verum transaction ID by this user
  last_subscribe?: string;  // Last subscription transaction ID by this user
  
  // Protocol v0.2+ fields
  start_tx_id?: string;     // Reference to user's START transaction (v0.2+)
}

export interface KaspaTransaction {
  transaction_id: string;
  block_time: number;
  is_accepted: boolean;
  inputs: Array<{
    previous_outpoint_hash: string;
    previous_outpoint_index: string;
    signature_script: string;
    sequence: string;
    sig_op_count: number;
    verbose_data?: {
      script_public_key_address: string;
      script_public_key_type: string;
    };
  }>;
  outputs: Array<{
    amount: string;
    script_public_key: string;
    script_public_key_address: string;
    script_public_key_type: string;
    verbose_data?: any;
  }>;
  mass: string;
  subnetwork_id: string;
  gas: string;
  payload?: string;
}

export interface KaspaTransactionResponse {
  transactions: KaspaTransaction[];
  last_transaction_id?: string;
}

export interface ParsedTransaction {
  transactionId: string;
  authorAddress: string;
  recipientAddress?: string;
  amount: number; // Total amount sent (includes payment + gas fee)
  blockTime: number;
  isAccepted: boolean;
  payload?: TransactionPayload | null;
  rawPayload?: string;
  gasFee?: number; // Gas fee paid for this transaction (if available)
}

export interface UserProfile {
  address: string;
  nickname: string;
  avatar: string; // Base64 encoded image
  startTransactionId: string;
  createdAt: number;
}

export interface Post {
  transactionId: string;
  authorAddress: string;
  content: string;
  timestamp: number;
  blockTime: number;
  
  // Derived data (populated by service)
  author?: UserProfile;
  likeCount?: number;
  commentCount?: number;
  comments?: Comment[];
  isLikedByUser?: boolean;
}

export interface Comment {
  transactionId: string;
  authorAddress: string;
  postId: string;
  content: string;
  timestamp: number;
  blockTime: number;
  
  // Derived data
  author?: UserProfile;
}

export interface Note {
  transactionId: string;
  authorAddress: string;
  content: string; // Encrypted content
  timestamp: number;
  blockTime: number;
  isEncrypted: boolean;
  
  // Derived data
  author?: UserProfile;
  decryptedContent?: string; // Only populated after decryption
}

export interface Like {
  transactionId: string;
  authorAddress: string;
  postId: string;
  amount: number;
  timestamp: number;
  blockTime: number;
}

export interface Subscription {
  transactionId: string;
  subscriberAddress: string;
  targetAddress: string;
  amount: number;
  timestamp: number;
  blockTime: number;
  isActive: boolean; // false if later unsubscribed
}

// API Response types
export interface KaspaRestApiError {
  error: string;
  message: string;
  status: number;
}

export interface FeeEstimate {
  normal_priority: number;
  low_priority: number;
  high_priority: number;
}

// Raw API response format
export interface KaspaFeeEstimateResponse {
  priorityBucket?: {
    feerate: number;
    estimated_seconds: number;
  };
  normalBuckets?: Array<{
    feerate: number;
    estimated_seconds: number;
  }>;
  lowBuckets?: Array<{
    feerate: number;
    estimated_seconds: number;
  }>;
}

// Payment amount calculation types (not gas fees)
export interface TransactionAmountInfo {
  action: TransactionType;
  kasAmount: number; // Amount to be sent as payment
  usdEquivalent: number;
  formattedAmount: string;
  kasPrice: number;
}

// Story-specific interfaces
export interface StorySegment {
  transactionId: string;
  authorAddress: string;
  content: string;
  timestamp: number;
  blockTime: number;
  segment: number;
  total?: number;
  isFinal: boolean;
  parentId?: string;
}

export interface Story {
  firstSegmentId: string;
  authorAddress: string;
  segments: StorySegment[];
  totalSegments?: number;
  isComplete: boolean;
  lastLoadedSegment: number;
  fullContent: string; // Combined content from all loaded segments
  timestamp: number; // Timestamp of first segment
  blockTime: number; // Block time of first segment
  
  // Derived data (populated by service)
  author?: UserProfile;
  likeCount?: number;
  commentCount?: number;
  comments?: Comment[];
  isLikedByUser?: boolean;
}

export interface StoryChunk {
  content: string;
  segment: number;
  total: number;
  isFinal: boolean;
}

export interface StoryProgress {
  currentSegment: number;
  totalSegments: number;
  isComplete: boolean;
  error?: string;
  canRetry?: boolean;
  retryAttempt?: number;
  maxRetries?: number;
}