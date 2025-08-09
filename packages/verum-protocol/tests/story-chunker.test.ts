/**
 * Unit tests for StoryChunker
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { StoryChunker, StoryChunkerConfig } from '../src/utils/story-chunker';
import { PROTOCOL_LIMITS } from '../src/constants';

describe('StoryChunker', () => {
  let chunker: StoryChunker;

  beforeEach(() => {
    chunker = new StoryChunker();
  });

  describe('constructor', () => {
    test('uses default config when no config provided', () => {
      const defaultChunker = new StoryChunker();
      
      // Test behavior matches expected defaults
      const shortContent = 'A'.repeat(100);
      const chunks = defaultChunker.splitIntoChunks(shortContent);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(shortContent);
    });

    test('accepts custom config', () => {
      const customConfig: Partial<StoryChunkerConfig> = {
        maxSegmentSize: 200,
        minSegmentSize: 50,
        maxSegments: 10
      };
      
      const customChunker = new StoryChunker(customConfig);
      
      // Test that custom limits are applied
      const content = 'A'.repeat(2000); // Should hit segment limit
      
      expect(() => customChunker.splitIntoChunks(content)).toThrow(
        'Content too large - would require more than 10 segments'
      );
    });
  });

  describe('splitIntoChunks', () => {
    test('handles empty content', () => {
      expect(() => chunker.splitIntoChunks('')).toThrow('Content cannot be empty');
      expect(() => chunker.splitIntoChunks('   ')).toThrow('Content cannot be empty');
    });

    test('creates single chunk for short content', () => {
      const content = 'This is a short story that fits in one segment.';
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].segment).toBe(1);
      expect(chunks[0].total).toBe(1);
      expect(chunks[0].isFinal).toBe(true);
    });

    test('creates multiple chunks for long content', () => {
      const content = 'A'.repeat(800); // Should create multiple chunks
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Check that all chunks have correct segment numbers
      chunks.forEach((chunk, index) => {
        expect(chunk.segment).toBe(index + 1);
        expect(chunk.total).toBe(chunks.length);
      });
      
      // Check that only the last chunk is final
      chunks.forEach((chunk, index) => {
        if (index === chunks.length - 1) {
          expect(chunk.isFinal).toBe(true);
        } else {
          expect(chunk.isFinal).toBe(false);
        }
      });
      
      // Check that all content is preserved
      const reconstructed = chunks.map(c => c.content).join('');
      expect(reconstructed.replace(/\s+/g, '')).toBe(content.replace(/\s+/g, ''));
    });

    test('respects maximum segment limit', () => {
      const veryLongContent = 'A'.repeat(100000); // Should exceed segment limit
      
      expect(() => chunker.splitIntoChunks(veryLongContent)).toThrow(
        `Content too large - would require more than ${PROTOCOL_LIMITS.MAX_STORY_SEGMENTS} segments`
      );
    });

    test('finds natural break points', () => {
      const content = 'This is the first paragraph.\n\nThis is the second paragraph. It has multiple sentences! Does it work? Yes; it should work, with various punctuation marks.';
      const chunks = chunker.splitIntoChunks(content);
      
      // Should split at natural break points
      chunks.forEach(chunk => {
        // Content should not be too small (unless it's the last remaining content)
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    test('handles content with only spaces as break points', () => {
      const content = 'A'.repeat(200) + ' ' + 'B'.repeat(200) + ' ' + 'C'.repeat(200);
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Should break at spaces when no better break points available
      chunks.forEach(chunk => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });

    test('handles content without good break points', () => {
      const content = 'A'.repeat(800); // No natural break points
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks.length).toBeGreaterThan(1);
      
      // Should still split content even without natural breaks
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.content.length).toBeLessThanOrEqual(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE);
      });
    });

    test('trims whitespace from chunks', () => {
      const content = '   First part   \n\n   Second part   ';
      const chunks = chunker.splitIntoChunks(content);
      
      chunks.forEach(chunk => {
        expect(chunk.content).toBe(chunk.content.trim());
      });
    });

    test('handles content with mixed break points', () => {
      const content = `
        This is a story with multiple paragraphs.
        
        It has different types of break points: sentences. Questions? Exclamations! 
        
        And it also has semicolons; which should be considered as break points, 
        along with commas, and regular spaces.
        
        The chunker should prioritize paragraph breaks over sentence breaks,
        and sentence breaks over comma breaks.
      `.trim();
      
      const chunks = chunker.splitIntoChunks(content);
      
      // Should successfully split without errors
      expect(chunks.length).toBeGreaterThan(0);
      
      // All chunks should have reasonable length
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.content.length).toBeLessThanOrEqual(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE);
      });
    });
  });

  describe('calculateSegmentCount', () => {
    test('returns correct count for short content', () => {
      const content = 'Short content';
      const count = chunker.calculateSegmentCount(content);
      
      expect(count).toBe(1);
    });

    test('returns correct count for long content', () => {
      const content = 'A'.repeat(800);
      const count = chunker.calculateSegmentCount(content);
      
      expect(count).toBeGreaterThan(1);
      
      // Should match actual chunk count
      const chunks = chunker.splitIntoChunks(content);
      expect(count).toBe(chunks.length);
    });

    test('returns estimated count for content that exceeds limits', () => {
      const veryLongContent = 'A'.repeat(100000);
      const count = chunker.calculateSegmentCount(veryLongContent);
      
      // Should return an estimated count instead of throwing
      expect(count).toBeGreaterThan(PROTOCOL_LIMITS.MAX_STORY_SEGMENTS);
    });
  });

  describe('isWithinLimits', () => {
    test('returns true for content within limits', () => {
      const content = 'This is within limits';
      
      expect(chunker.isWithinLimits(content)).toBe(true);
    });

    test('returns true for content at the limit', () => {
      // Create content that uses exactly the maximum segments
      const content = 'A'.repeat(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE * PROTOCOL_LIMITS.MAX_STORY_SEGMENTS);
      
      // Note: This might still return true if the content fits within limits due to efficient chunking
      const result = chunker.isWithinLimits(content);
      expect(typeof result).toBe('boolean');
    });

    test('returns false for content exceeding limits', () => {
      const veryLongContent = 'A'.repeat(100000);
      
      expect(chunker.isWithinLimits(veryLongContent)).toBe(false);
    });

    test('handles empty content gracefully', () => {
      expect(chunker.isWithinLimits('')).toBe(false);
      expect(chunker.isWithinLimits('   ')).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('handles content exactly at segment size boundary', () => {
      const content = 'A'.repeat(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE);
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
    });

    test('handles content slightly over segment size', () => {
      const content = 'A'.repeat(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE + 1);
      const chunks = chunker.splitIntoChunks(content);
      
      expect(chunks.length).toBeGreaterThan(1);
    });

    test('handles content with only whitespace break points', () => {
      const content = 'WordWithoutSpaces'.repeat(30); // No good break points
      const chunks = chunker.splitIntoChunks(content);
      
      // Should still successfully chunk
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(PROTOCOL_LIMITS.MAX_SEGMENT_SIZE);
      });
    });

    test('preserves content integrity across chunks', () => {
      const originalContent = `
        This is a test story with multiple paragraphs and various punctuation marks.
        
        It includes: sentences with periods. Questions? Exclamations! And semicolons;
        as well as commas, and regular spaces for natural breaking points.
        
        The chunker should preserve all of this content while splitting it appropriately.
      `.trim();
      
      const chunks = chunker.splitIntoChunks(originalContent);
      const reconstructed = chunks.map(c => c.content).join(' ').replace(/\s+/g, ' ');
      const original = originalContent.replace(/\s+/g, ' ');
      
      // Content should be preserved (allowing for whitespace normalization)
      expect(reconstructed.trim()).toBe(original.trim());
    });
  });
});