/**
 * Verum Payload Validator
 * 
 * Validates transaction payloads according to protocol rules
 */

import { 
  TransactionType, 
  PROTOCOL_LIMITS, 
  VALIDATION_PATTERNS,
  VERUM_PROTOCOL_CREATION_DATE 
} from '../constants';
import { 
  TransactionPayload, 
  ValidationResult, 
  ValidationError,
  ChainReferences,
  UserProfile 
} from '../types';

export class VerumPayloadValidator {
  /**
   * Validate a complete transaction payload
   */
  validatePayload(payload: TransactionPayload): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate required fields
    if (!payload.verum) {
      errors.push({
        field: 'verum',
        message: 'Protocol version is required',
        code: 'MISSING_VERSION'
      });
    }

    if (!payload.type) {
      errors.push({
        field: 'type',
        message: 'Transaction type is required',
        code: 'MISSING_TYPE'
      });
    } else if (!Object.values(TransactionType).includes(payload.type)) {
      errors.push({
        field: 'type',
        message: `Invalid transaction type: ${payload.type}`,
        code: 'INVALID_TYPE'
      });
    }

    if (typeof payload.timestamp !== 'number') {
      errors.push({
        field: 'timestamp',
        message: 'Timestamp is required and must be a number',
        code: 'INVALID_TIMESTAMP'
      });
    } else {
      // Validate timestamp is reasonable (not too far in past or future)
      const now = Math.floor(Date.now() / 1000);
      const fiveMinutes = 5 * 60;
      
      if (payload.timestamp < VERUM_PROTOCOL_CREATION_DATE) {
        errors.push({
          field: 'timestamp',
          message: 'Timestamp cannot be before protocol creation date',
          code: 'TIMESTAMP_TOO_OLD'
        });
      } else if (payload.timestamp > now + fiveMinutes) {
        errors.push({
          field: 'timestamp',
          message: 'Timestamp cannot be more than 5 minutes in the future',
          code: 'TIMESTAMP_FUTURE'
        });
      }
    }

    // Validate payload size
    const payloadSize = this.calculatePayloadSize(payload);
    if (payloadSize > PROTOCOL_LIMITS.MAX_PAYLOAD_SIZE) {
      errors.push({
        field: 'payload',
        message: `Payload too large: ${payloadSize} bytes (max ${PROTOCOL_LIMITS.MAX_PAYLOAD_SIZE})`,
        code: 'PAYLOAD_TOO_LARGE'
      });
    }

    // Type-specific validation
    if (payload.type && !errors.some(e => e.field === 'type')) {
      const typeErrors = this.validateByType(payload);
      errors.push(...typeErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate payload based on transaction type
   */
  private validateByType(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (payload.type) {
      case TransactionType.START:
        errors.push(...this.validateStartTransaction(payload));
        break;
      
      case TransactionType.POST:
        errors.push(...this.validatePostTransaction(payload));
        break;
      
      case TransactionType.STORY:
        errors.push(...this.validateStoryTransaction(payload));
        break;
      
      case TransactionType.SUBSCRIBE:
      case TransactionType.UNSUBSCRIBE:
        errors.push(...this.validateSubscriptionTransaction(payload));
        break;
      
      case TransactionType.LIKE:
        errors.push(...this.validateLikeTransaction(payload));
        break;
      
      case TransactionType.COMMENT:
        errors.push(...this.validateCommentTransaction(payload));
        break;
    }

    return errors;
  }

  /**
   * Validate START transaction
   */
  private validateStartTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    // START transactions should not have chain references
    if (payload.prev_tx_id || payload.last_subscribe || payload.parent_id) {
      errors.push({
        field: 'chain_references',
        message: 'START transaction should not have chain references',
        code: 'INVALID_CHAIN_REFS'
      });
    }

    // Validate content is valid user profile
    if (!payload.content) {
      errors.push({
        field: 'content',
        message: 'User profile data is required',
        code: 'MISSING_PROFILE'
      });
    } else {
      try {
        const profile = JSON.parse(payload.content) as UserProfile;
        
        if (!profile.nickname || typeof profile.nickname !== 'string') {
          errors.push({
            field: 'content.nickname',
            message: 'Nickname is required',
            code: 'MISSING_NICKNAME'
          });
        } else if (profile.nickname.trim().length > PROTOCOL_LIMITS.MAX_NICKNAME_LENGTH) {
          errors.push({
            field: 'content.nickname',
            message: `Nickname too long (max ${PROTOCOL_LIMITS.MAX_NICKNAME_LENGTH} characters)`,
            code: 'NICKNAME_TOO_LONG'
          });
        }

        if (profile.avatar && typeof profile.avatar !== 'string') {
          errors.push({
            field: 'content.avatar',
            message: 'Avatar must be a base64 string',
            code: 'INVALID_AVATAR'
          });
        }
      } catch (e) {
        errors.push({
          field: 'content',
          message: 'Invalid JSON in user profile',
          code: 'INVALID_JSON'
        });
      }
    }

    return errors;
  }

  /**
   * Validate POST transaction
   */
  private validatePostTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!payload.content || typeof payload.content !== 'string') {
      errors.push({
        field: 'content',
        message: 'Post content is required',
        code: 'MISSING_CONTENT'
      });
    } else if (payload.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Post content cannot be empty',
        code: 'EMPTY_CONTENT'
      });
    } else if (payload.content.length > PROTOCOL_LIMITS.MAX_POST_LENGTH) {
      errors.push({
        field: 'content',
        message: `Post too long (max ${PROTOCOL_LIMITS.MAX_POST_LENGTH} characters)`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    return errors;
  }

  /**
   * Validate STORY transaction
   */
  private validateStoryTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!payload.content || typeof payload.content !== 'string') {
      errors.push({
        field: 'content',
        message: 'Story content is required',
        code: 'MISSING_CONTENT'
      });
    }

    if (!payload.params || typeof payload.params !== 'object') {
      errors.push({
        field: 'params',
        message: 'Story parameters are required',
        code: 'MISSING_PARAMS'
      });
    } else {
      const { segment, total, is_final } = payload.params;

      if (typeof segment !== 'number' || segment < 1) {
        errors.push({
          field: 'params.segment',
          message: 'Valid segment number is required',
          code: 'INVALID_SEGMENT'
        });
      }

      if (typeof total !== 'number' || total < 1) {
        errors.push({
          field: 'params.total',
          message: 'Valid total segments is required',
          code: 'INVALID_TOTAL'
        });
      }

      if (typeof is_final !== 'boolean') {
        errors.push({
          field: 'params.is_final',
          message: 'is_final flag is required',
          code: 'MISSING_FINAL_FLAG'
        });
      }

      if (segment && total && segment > total) {
        errors.push({
          field: 'params',
          message: 'Segment number cannot exceed total segments',
          code: 'INVALID_SEGMENT_RANGE'
        });
      }
    }

    // Validate parent_id for non-first segments
    if (payload.params?.segment > 1 && !payload.parent_id) {
      errors.push({
        field: 'parent_id',
        message: 'parent_id is required for non-first segments',
        code: 'MISSING_PARENT_ID'
      });
    }

    return errors;
  }

  /**
   * Validate SUBSCRIBE/UNSUBSCRIBE transaction
   */
  private validateSubscriptionTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!payload.content || typeof payload.content !== 'string') {
      errors.push({
        field: 'content',
        message: 'Target address is required',
        code: 'MISSING_ADDRESS'
      });
    } else if (!VALIDATION_PATTERNS.KASPA_ADDRESS.test(payload.content)) {
      errors.push({
        field: 'content',
        message: 'Invalid Kaspa address format',
        code: 'INVALID_ADDRESS'
      });
    }

    return errors;
  }

  /**
   * Validate LIKE transaction
   */
  private validateLikeTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    if (payload.content !== null) {
      errors.push({
        field: 'content',
        message: 'Like transaction should have null content',
        code: 'INVALID_CONTENT'
      });
    }

    if (!payload.parent_id) {
      errors.push({
        field: 'parent_id',
        message: 'parent_id (post ID) is required',
        code: 'MISSING_PARENT_ID'
      });
    } else if (!this.isValidTransactionId(payload.parent_id)) {
      errors.push({
        field: 'parent_id',
        message: 'Invalid transaction ID format',
        code: 'INVALID_PARENT_ID'
      });
    }

    return errors;
  }

  /**
   * Validate COMMENT transaction
   */
  private validateCommentTransaction(payload: TransactionPayload): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!payload.content || typeof payload.content !== 'string') {
      errors.push({
        field: 'content',
        message: 'Comment content is required',
        code: 'MISSING_CONTENT'
      });
    } else if (payload.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Comment content cannot be empty',
        code: 'EMPTY_CONTENT'
      });
    } else if (payload.content.length > PROTOCOL_LIMITS.MAX_COMMENT_LENGTH) {
      errors.push({
        field: 'content',
        message: `Comment too long (max ${PROTOCOL_LIMITS.MAX_COMMENT_LENGTH} characters)`,
        code: 'CONTENT_TOO_LONG'
      });
    }

    if (!payload.parent_id) {
      errors.push({
        field: 'parent_id',
        message: 'parent_id (post ID) is required',
        code: 'MISSING_PARENT_ID'
      });
    } else if (!this.isValidTransactionId(payload.parent_id)) {
      errors.push({
        field: 'parent_id',
        message: 'Invalid transaction ID format',
        code: 'INVALID_PARENT_ID'
      });
    }

    return errors;
  }

  /**
   * Validate chain references
   */
  validateChainReferences(refs: ChainReferences): ValidationResult {
    const errors: ValidationError[] = [];

    if (refs.prevTxId && !this.isValidTransactionId(refs.prevTxId)) {
      errors.push({
        field: 'prevTxId',
        message: 'Invalid previous transaction ID format',
        code: 'INVALID_PREV_TX_ID'
      });
    }

    if (refs.lastSubscribeId && !this.isValidTransactionId(refs.lastSubscribeId)) {
      errors.push({
        field: 'lastSubscribeId',
        message: 'Invalid last subscribe ID format',
        code: 'INVALID_SUBSCRIBE_ID'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a string is a valid transaction ID
   */
  private isValidTransactionId(txId: string): boolean {
    return VALIDATION_PATTERNS.TRANSACTION_ID.test(txId);
  }

  /**
   * Calculate payload size in bytes
   */
  private calculatePayloadSize(payload: TransactionPayload): number {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }
}