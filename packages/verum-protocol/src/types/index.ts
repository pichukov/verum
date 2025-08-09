/**
 * Verum Protocol Type Definitions
 */

import { TransactionType } from '../constants';

/**
 * Core transaction payload structure for all Verum transactions
 */
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
}

/**
 * Chain references needed for creating linked transactions
 */
export interface ChainReferences {
  prevTxId?: string;
  lastSubscribeId?: string;
}

/**
 * User profile data for START transaction
 */
export interface UserProfile {
  nickname: string;
  avatar?: string; // Base64 encoded image
}

/**
 * Story chunk for multi-segment stories
 */
export interface StoryChunk {
  content: string;
  segment: number;
  total: number;
  isFinal: boolean;
}

/**
 * Story segment payload with specific parameters
 */
export interface StorySegmentPayload extends TransactionPayload {
  params: {
    segment: number;
    total: number;
    is_final: boolean;
  };
}

/**
 * Validation result for payload validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Configuration options for the protocol
 */
export interface VerumProtocolConfig {
  version?: string;
  maxPayloadSize?: number;
  maxStorySegments?: number;
}