/**
 * Unit tests for VerumTransactionBuilder
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { VerumTransactionBuilder } from '../src/builders/transaction-builder';
import { TransactionType, VERUM_VERSION } from '../src/constants';
import { UserProfile, ChainReferences } from '../src/types';

describe('VerumTransactionBuilder', () => {
  let builder: VerumTransactionBuilder;

  beforeEach(() => {
    builder = new VerumTransactionBuilder();
  });

  describe('createStartTransaction', () => {
    test('creates valid START transaction', () => {
      const profile: UserProfile = {
        nickname: 'testuser',
        avatar: 'base64avatar'
      };

      const tx = builder.createStartTransaction(profile);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.START);
      expect(tx.content).toBe(JSON.stringify({
        nickname: 'testuser',
        avatar: 'base64avatar'
      }));
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBeUndefined();
      expect(tx.last_subscribe).toBeUndefined();
      expect(tx.parent_id).toBeUndefined();
    });

    test('trims nickname whitespace', () => {
      const profile: UserProfile = {
        nickname: '  testuser  ',
        avatar: 'base64avatar'
      };

      const tx = builder.createStartTransaction(profile);
      const content = JSON.parse(tx.content!);
      
      expect(content.nickname).toBe('testuser');
    });

    test('handles profile without avatar', () => {
      const profile: UserProfile = {
        nickname: 'testuser'
      };

      const tx = builder.createStartTransaction(profile);
      const content = JSON.parse(tx.content!);
      
      expect(content.nickname).toBe('testuser');
      expect(content.avatar).toBeUndefined();
    });
  });

  describe('createPostTransaction', () => {
    test('creates valid POST transaction', () => {
      const content = 'This is a test post';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const tx = builder.createPostTransaction(content, chainRefs);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.POST);
      expect(tx.content).toBe('This is a test post');
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBe('prev123');
      expect(tx.last_subscribe).toBe('sub456');
    });

    test('trims content whitespace', () => {
      const content = '  This is a test post  ';
      const chainRefs: ChainReferences = {};

      const tx = builder.createPostTransaction(content, chainRefs);
      
      expect(tx.content).toBe('This is a test post');
    });

    test('handles empty chain references', () => {
      const content = 'Test post';
      const chainRefs: ChainReferences = {};

      const tx = builder.createPostTransaction(content, chainRefs);
      
      expect(tx.prev_tx_id).toBeUndefined();
      expect(tx.last_subscribe).toBeUndefined();
    });
  });

  describe('createStorySegments', () => {
    test('creates single segment for short content', () => {
      const content = 'Short story content';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const segments = builder.createStorySegments(content, chainRefs);

      expect(segments).toHaveLength(1);
      expect(segments[0].verum).toBe(VERUM_VERSION);
      expect(segments[0].type).toBe(TransactionType.STORY);
      expect(segments[0].content).toBe('Short story content');
      expect(segments[0].params.segment).toBe(1);
      expect(segments[0].params.total).toBe(1);
      expect(segments[0].params.is_final).toBe(true);
      expect(segments[0].prev_tx_id).toBe('prev123');
      expect(segments[0].last_subscribe).toBe('sub456');
    });

    test('creates multiple segments for long content', () => {
      // Create content that will require multiple segments
      const longContent = 'A'.repeat(800); // Should create 2 segments
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123'
      };

      const segments = builder.createStorySegments(longContent, chainRefs);

      expect(segments.length).toBeGreaterThan(1);
      
      // Check first segment
      expect(segments[0].params.segment).toBe(1);
      expect(segments[0].params.is_final).toBe(false);
      expect(segments[0].prev_tx_id).toBe('prev123');
      expect(segments[0].parent_id).toBeUndefined();
      
      // Check last segment
      const lastSegment = segments[segments.length - 1];
      expect(lastSegment.params.segment).toBe(segments.length);
      expect(lastSegment.params.is_final).toBe(true);
      expect(lastSegment.prev_tx_id).toBeUndefined();
      expect(lastSegment.parent_id).toBeUndefined(); // Will be set by SDK
      
      // All segments should have same total
      segments.forEach(segment => {
        expect(segment.params.total).toBe(segments.length);
      });
    });

    test('only first segment gets chain references', () => {
      const longContent = 'A'.repeat(800);
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const segments = builder.createStorySegments(longContent, chainRefs);

      // First segment should have chain references
      expect(segments[0].prev_tx_id).toBe('prev123');
      expect(segments[0].last_subscribe).toBe('sub456');
      
      // Other segments should not have chain references
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i].prev_tx_id).toBeUndefined();
        expect(segments[i].last_subscribe).toBeUndefined();
      }
    });
  });

  describe('createSubscribeTransaction', () => {
    test('creates valid SUBSCRIBE transaction', () => {
      const targetAddress = 'kaspa:qr123456789abcdef';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123'
      };

      const tx = builder.createSubscribeTransaction(targetAddress, chainRefs);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.SUBSCRIBE);
      expect(tx.content).toBe(targetAddress);
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBe('prev123');
      expect(tx.last_subscribe).toBeUndefined(); // This will become the new last_subscribe
    });

    test('trims target address whitespace', () => {
      const targetAddress = '  kaspa:qr123456789abcdef  ';
      const chainRefs: ChainReferences = {};

      const tx = builder.createSubscribeTransaction(targetAddress, chainRefs);
      
      expect(tx.content).toBe('kaspa:qr123456789abcdef');
    });
  });

  describe('createUnsubscribeTransaction', () => {
    test('creates valid UNSUBSCRIBE transaction', () => {
      const targetAddress = 'kaspa:qr123456789abcdef';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const tx = builder.createUnsubscribeTransaction(targetAddress, chainRefs);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.UNSUBSCRIBE);
      expect(tx.content).toBe(targetAddress);
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBe('prev123');
      expect(tx.last_subscribe).toBe('sub456');
    });
  });

  describe('createLikeTransaction', () => {
    test('creates valid LIKE transaction', () => {
      const postId = 'abc123def456';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const tx = builder.createLikeTransaction(postId, chainRefs);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.LIKE);
      expect(tx.content).toBeNull();
      expect(tx.parent_id).toBe(postId);
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBe('prev123');
      expect(tx.last_subscribe).toBe('sub456');
    });
  });

  describe('createCommentTransaction', () => {
    test('creates valid COMMENT transaction', () => {
      const postId = 'abc123def456';
      const content = 'This is a comment';
      const chainRefs: ChainReferences = {
        prevTxId: 'prev123',
        lastSubscribeId: 'sub456'
      };

      const tx = builder.createCommentTransaction(postId, content, chainRefs);

      expect(tx.verum).toBe(VERUM_VERSION);
      expect(tx.type).toBe(TransactionType.COMMENT);
      expect(tx.content).toBe('This is a comment');
      expect(tx.parent_id).toBe(postId);
      expect(tx.timestamp).toBeTypeOf('number');
      expect(tx.prev_tx_id).toBe('prev123');
      expect(tx.last_subscribe).toBe('sub456');
    });

    test('trims comment content whitespace', () => {
      const postId = 'abc123def456';
      const content = '  This is a comment  ';
      const chainRefs: ChainReferences = {};

      const tx = builder.createCommentTransaction(postId, content, chainRefs);
      
      expect(tx.content).toBe('This is a comment');
    });
  });

  describe('calculatePayloadSize', () => {
    test('calculates payload size correctly', () => {
      const payload = {
        verum: '0.1',
        type: TransactionType.POST,
        content: 'Test content',
        timestamp: 1234567890
      };

      const size = builder.calculatePayloadSize(payload);
      const expectedSize = new TextEncoder().encode(JSON.stringify(payload)).length;
      
      expect(size).toBe(expectedSize);
    });
  });

  describe('getVersion', () => {
    test('returns correct version', () => {
      expect(builder.getVersion()).toBe(VERUM_VERSION);
    });

    test('returns custom version when provided', () => {
      const customBuilder = new VerumTransactionBuilder({ version: '0.2' });
      expect(customBuilder.getVersion()).toBe('0.2');
    });
  });
});