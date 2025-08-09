/**
 * Verum Protocol Constants
 */

// Protocol version
export const VERUM_VERSION = '0.1';

// Protocol creation date - Unix timestamp (fixed date when protocol v0.1 was deployed)
export const VERUM_PROTOCOL_CREATION_DATE = 1722470400; // August 1, 2025 00:00:00 UTC

// Transaction types
export enum TransactionType {
  START = 'start',
  POST = 'post',
  SUBSCRIBE = 'subscribe',
  LIKE = 'like',
  UNSUBSCRIBE = 'unsubscribe',
  COMMENT = 'comment',
  STORY = 'story'
}

// Protocol limits
export const PROTOCOL_LIMITS = {
  MAX_PAYLOAD_SIZE: 1000, // Maximum payload size in bytes
  MAX_POST_LENGTH: 500,   // Maximum characters in a post
  MAX_COMMENT_LENGTH: 300, // Maximum characters in a comment
  MAX_NICKNAME_LENGTH: 50, // Maximum characters in nickname
  MAX_STORY_SEGMENTS: 200, // Maximum segments in a story
  MAX_SEGMENT_SIZE: 400,   // Maximum characters per story segment
  MIN_SEGMENT_SIZE: 50,    // Minimum characters per story segment
} as const;

// Validation patterns
export const VALIDATION_PATTERNS = {
  TRANSACTION_ID: /^[a-f0-9]{64}$/i,
  KASPA_ADDRESS: /^kaspa(test|dev)?:[a-z0-9]{61,63}$/,
} as const;