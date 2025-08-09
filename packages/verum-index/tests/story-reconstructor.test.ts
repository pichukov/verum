/**
 * Unit tests for StoryReconstructor
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { StoryReconstructor } from '../src/utils/story-reconstructor';
import { StorySegment } from '../src/types';

// Mock blockchain fetcher
const mockBlockchainFetcher = {
  getTransactionById: vi.fn(),
  getTransactionsByAddress: vi.fn(),
  parseVerumTransaction: vi.fn(),
  getRecentTransactions: vi.fn(),
  getTransactionCount: vi.fn(),
  transactionExists: vi.fn()
};

describe('StoryReconstructor', () => {
  let reconstructor: StoryReconstructor;

  beforeEach(() => {
    vi.clearAllMocks();
    reconstructor = new StoryReconstructor(mockBlockchainFetcher as any);
  });

  describe('isStoryComplete', () => {
    test('returns false for empty segments', () => {
      const result = reconstructor.isStoryComplete([]);
      expect(result).toBe(false);
    });

    test('returns true for single complete segment', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 1,
          content: 'Complete story',
          timestamp: Date.now(),
          isFinal: true
        }
      ];

      const result = reconstructor.isStoryComplete(segments);
      expect(result).toBe(true);
    });

    test('returns true for complete multi-segment story', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 3,
          content: 'Second segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx3',
          segmentNumber: 3,
          totalSegments: 3,
          content: 'Third segment',
          timestamp: Date.now(),
          isFinal: true
        }
      ];

      const result = reconstructor.isStoryComplete(segments);
      expect(result).toBe(true);
    });

    test('returns false for incomplete story (missing segments)', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx3',
          segmentNumber: 3,
          totalSegments: 3,
          content: 'Third segment',
          timestamp: Date.now(),
          isFinal: true
        }
        // Missing segment 2
      ];

      const result = reconstructor.isStoryComplete(segments);
      expect(result).toBe(false);
    });

    test('returns false when segment count does not match total', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 2,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        }
        // Missing segment 2, but totalSegments says there should be 2
      ];

      const result = reconstructor.isStoryComplete(segments);
      expect(result).toBe(false);
    });

    test('returns false when final segment is not marked as final', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 2,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 2,
          content: 'Second segment',
          timestamp: Date.now(),
          isFinal: false // Should be true for final segment
        }
      ];

      const result = reconstructor.isStoryComplete(segments);
      expect(result).toBe(false);
    });
  });

  describe('validateSegmentChain', () => {
    test('returns false for empty segments', () => {
      const result = reconstructor.validateSegmentChain([]);
      expect(result).toBe(false);
    });

    test('returns true for single segment', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 1,
          content: 'Single segment',
          timestamp: Date.now(),
          isFinal: true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(true);
    });

    test('returns true for valid segment chain', () => {
      const baseTime = Date.now();
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: baseTime,
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 3,
          content: 'Second segment',
          timestamp: baseTime + 1000,
          isFinal: false
        },
        {
          txId: 'tx3',
          segmentNumber: 3,
          totalSegments: 3,
          content: 'Third segment',
          timestamp: baseTime + 2000,
          isFinal: true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(true);
    });

    test('returns false for invalid segment sequence', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx3',
          segmentNumber: 3, // Should be 2
          totalSegments: 3,
          content: 'Third segment',
          timestamp: Date.now(),
          isFinal: true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(false);
    });

    test('returns false for inconsistent total segments', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 4, // Inconsistent with first segment
          content: 'Second segment',
          timestamp: Date.now(),
          isFinal: false
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(false);
    });

    test('returns false for timestamps too far out of order', () => {
      const baseTime = Date.now();
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 2,
          content: 'First segment',
          timestamp: baseTime,
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 2,
          content: 'Second segment',
          timestamp: baseTime - 120000, // 2 minutes earlier (too much)
          isFinal: true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(false);
    });

    test('allows slight timestamp variations', () => {
      const baseTime = Date.now();
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 2,
          content: 'First segment',
          timestamp: baseTime,
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 2,
          content: 'Second segment',
          timestamp: baseTime + 30000, // 30 seconds later (normal order)
          isFinal: true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(true);
    });

    test('returns false when final segment is not marked as final', () => {
      const segments: StorySegment[] = [
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 2,
          content: 'First segment',
          timestamp: Date.now(),
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 2,
          content: 'Second segment',
          timestamp: Date.now(),
          isFinal: false // Should be true
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(false);
    });

    test('handles unordered input by sorting', () => {
      const baseTime = Date.now();
      const segments: StorySegment[] = [
        {
          txId: 'tx3',
          segmentNumber: 3,
          totalSegments: 3,
          content: 'Third segment',
          timestamp: baseTime + 2000,
          isFinal: true
        },
        {
          txId: 'tx1',
          segmentNumber: 1,
          totalSegments: 3,
          content: 'First segment',
          timestamp: baseTime,
          isFinal: false
        },
        {
          txId: 'tx2',
          segmentNumber: 2,
          totalSegments: 3,
          content: 'Second segment',
          timestamp: baseTime + 1000,
          isFinal: false
        }
      ];

      const result = reconstructor.validateSegmentChain(segments);
      expect(result).toBe(true);
    });
  });

  describe('integration tests', () => {
    test('reconstructStory method exists', () => {
      expect(typeof reconstructor.reconstructStory).toBe('function');
    });

    test('getStorySegments method exists', () => {
      expect(typeof reconstructor.getStorySegments).toBe('function');
    });
  });
});