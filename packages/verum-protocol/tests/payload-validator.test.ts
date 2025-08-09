/**
 * Unit tests for VerumPayloadValidator
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { VerumPayloadValidator } from '../src/validators/payload-validator';
import { TransactionType, VERUM_VERSION, VERUM_PROTOCOL_CREATION_DATE } from '../src/constants';
import { TransactionPayload, ChainReferences } from '../src/types';

describe('VerumPayloadValidator', () => {
  let validator: VerumPayloadValidator;

  beforeEach(() => {
    validator = new VerumPayloadValidator();
  });

  describe('validatePayload', () => {
    test('validates valid START payload', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: JSON.stringify({ nickname: 'testuser', avatar: 'avatar123' }),
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects payload without version', () => {
      const payload = {
        type: TransactionType.POST,
        content: 'Test content',
        timestamp: Math.floor(Date.now() / 1000)
      } as TransactionPayload;

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'verum',
        message: 'Protocol version is required',
        code: 'MISSING_VERSION'
      });
    });

    test('rejects payload without type', () => {
      const payload = {
        verum: VERUM_VERSION,
        content: 'Test content',
        timestamp: Math.floor(Date.now() / 1000)
      } as TransactionPayload;

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'type',
        message: 'Transaction type is required',
        code: 'MISSING_TYPE'
      });
    });

    test('rejects invalid transaction type', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: 'invalid' as TransactionType,
        content: 'Test content',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'type',
        message: 'Invalid transaction type: invalid',
        code: 'INVALID_TYPE'
      });
    });

    test('rejects payload without timestamp', () => {
      const payload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: 'Test content'
      } as TransactionPayload;

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'timestamp',
        message: 'Timestamp is required and must be a number',
        code: 'INVALID_TIMESTAMP'
      });
    });

    test('rejects timestamp before protocol creation', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: 'Test content',
        timestamp: VERUM_PROTOCOL_CREATION_DATE - 1
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'timestamp',
        message: 'Timestamp cannot be before protocol creation date',
        code: 'TIMESTAMP_TOO_OLD'
      });
    });

    test('rejects timestamp too far in future', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + (10 * 60); // 10 minutes in future
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: 'Test content',
        timestamp: futureTimestamp
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'timestamp',
        message: 'Timestamp cannot be more than 5 minutes in the future',
        code: 'TIMESTAMP_FUTURE'
      });
    });

    test('rejects payload that is too large', () => {
      const largeContent = 'A'.repeat(2000); // Should exceed 1000 byte limit
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: largeContent,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'PAYLOAD_TOO_LARGE')).toBe(true);
    });
  });

  describe('START transaction validation', () => {
    test('validates valid START transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: JSON.stringify({ nickname: 'testuser', avatar: 'avatar123' }),
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects START with chain references', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: JSON.stringify({ nickname: 'testuser' }),
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: 'prev123'
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'chain_references',
        message: 'START transaction should not have chain references',
        code: 'INVALID_CHAIN_REFS'
      });
    });

    test('rejects START without content', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'User profile data is required',
        code: 'MISSING_PROFILE'
      });
    });

    test('rejects START with invalid JSON', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: 'invalid json',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Invalid JSON in user profile',
        code: 'INVALID_JSON'
      });
    });

    test('rejects START without nickname', () => {
      const payload: TransactionPayload = {
        verum: `${VERUM_VERSION}`,
        type: TransactionType.START,
        content: JSON.stringify({ avatar: 'avatar123' }),
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content.nickname',
        message: 'Nickname is required',
        code: 'MISSING_NICKNAME'
      });
    });

    test('rejects START with nickname too long', () => {
      const longNickname = 'A'.repeat(100);
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: JSON.stringify({ nickname: longNickname }),
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content.nickname',
        message: 'Nickname too long (max 50 characters)',
        code: 'NICKNAME_TOO_LONG'
      });
    });
  });

  describe('POST transaction validation', () => {
    test('validates valid POST transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: 'This is a test post',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects POST without content', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Post content is required',
        code: 'MISSING_CONTENT'
      });
    });

    test('rejects POST with empty content', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: '   ',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Post content cannot be empty',
        code: 'EMPTY_CONTENT'
      });
    });

    test('rejects POST with content too long', () => {
      const longContent = 'A'.repeat(600);
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.POST,
        content: longContent,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Post too long (max 500 characters)',
        code: 'CONTENT_TOO_LONG'
      });
    });
  });

  describe('STORY transaction validation', () => {
    test('validates valid STORY transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.STORY,
        content: 'This is a story segment',
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          segment: 1,
          total: 3,
          is_final: false
        }
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects STORY without params', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.STORY,
        content: 'Story content',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'params',
        message: 'Story parameters are required',
        code: 'MISSING_PARAMS'
      });
    });

    test('rejects STORY with invalid segment number', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.STORY,
        content: 'Story content',
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          segment: 0,
          total: 3,
          is_final: false
        }
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'params.segment',
        message: 'Valid segment number is required',
        code: 'INVALID_SEGMENT'
      });
    });

    test('rejects STORY with segment > total', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.STORY,
        content: 'Story content',
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          segment: 5,
          total: 3,
          is_final: false
        }
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'params',
        message: 'Segment number cannot exceed total segments',
        code: 'INVALID_SEGMENT_RANGE'
      });
    });

    test('rejects non-first STORY segment without parent_id', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.STORY,
        content: 'Story content',
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          segment: 2,
          total: 3,
          is_final: false
        }
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'parent_id',
        message: 'parent_id is required for non-first segments',
        code: 'MISSING_PARENT_ID'
      });
    });
  });

  describe('SUBSCRIBE transaction validation', () => {
    test('validates valid SUBSCRIBE transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.SUBSCRIBE,
        content: 'kaspa:qr123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects SUBSCRIBE without address', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.SUBSCRIBE,
        content: null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Target address is required',
        code: 'MISSING_ADDRESS'
      });
    });

    test('rejects SUBSCRIBE with invalid address format', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.SUBSCRIBE,
        content: 'invalid-address',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Invalid Kaspa address format',
        code: 'INVALID_ADDRESS'
      });
    });
  });

  describe('LIKE transaction validation', () => {
    test('validates valid LIKE transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.LIKE,
        content: null,
        parent_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects LIKE with non-null content', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.LIKE,
        content: 'should be null',
        parent_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Like transaction should have null content',
        code: 'INVALID_CONTENT'
      });
    });

    test('rejects LIKE without parent_id', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.LIKE,
        content: null,
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'parent_id',
        message: 'parent_id (post ID) is required',
        code: 'MISSING_PARENT_ID'
      });
    });
  });

  describe('COMMENT transaction validation', () => {
    test('validates valid COMMENT transaction', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.COMMENT,
        content: 'This is a comment',
        parent_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(true);
    });

    test('rejects COMMENT with empty content', () => {
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.COMMENT,
        content: '   ',
        parent_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Comment content cannot be empty',
        code: 'EMPTY_CONTENT'
      });
    });

    test('rejects COMMENT with content too long', () => {
      const longContent = 'A'.repeat(400);
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.COMMENT,
        content: longContent,
        parent_id: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        timestamp: Math.floor(Date.now() / 1000)
      };

      const result = validator.validatePayload(payload);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'content',
        message: 'Comment too long (max 300 characters)',
        code: 'CONTENT_TOO_LONG'
      });
    });
  });

  describe('validateChainReferences', () => {
    test('validates valid chain references', () => {
      const refs: ChainReferences = {
        prevTxId: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        lastSubscribeId: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      const result = validator.validateChainReferences(refs);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid prevTxId format', () => {
      const refs: ChainReferences = {
        prevTxId: 'invalid-tx-id'
      };

      const result = validator.validateChainReferences(refs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'prevTxId',
        message: 'Invalid previous transaction ID format',
        code: 'INVALID_PREV_TX_ID'
      });
    });

    test('rejects invalid lastSubscribeId format', () => {
      const refs: ChainReferences = {
        lastSubscribeId: 'invalid-subscribe-id'
      };

      const result = validator.validateChainReferences(refs);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'lastSubscribeId',
        message: 'Invalid last subscribe ID format',
        code: 'INVALID_SUBSCRIBE_ID'
      });
    });
  });
});