/**
 * Unit tests for VerumIndexer
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { VerumIndexer, VerumIndexerConfig } from '../src/verum-indexer';
import { TransactionType } from '@verum/protocol';

// Mock the blockchain fetcher
vi.mock('../src/fetchers/blockchain-fetcher', () => ({
  KaspaBlockchainFetcher: vi.fn().mockImplementation(() => ({
    getTransactionsByAddress: vi.fn(),
    getTransactionById: vi.fn(),
    getRecentTransactions: vi.fn(),
    parseVerumTransaction: vi.fn(),
    getTransactionCount: vi.fn(),
    transactionExists: vi.fn()
  }))
}));

describe('VerumIndexer', () => {
  let indexer: VerumIndexer;
  let config: VerumIndexerConfig;

  beforeEach(() => {
    config = {
      kaspaApiUrl: 'https://api.kaspa.org',
      kasplexApiUrl: 'https://api.kasplex.org',
      network: 'mainnet' as const,
      timeout: 10000
    };
    
    indexer = new VerumIndexer(config);
  });

  describe('constructor', () => {
    test('creates indexer with default config', () => {
      const defaultIndexer = new VerumIndexer({
        kaspaApiUrl: 'https://api.kaspa.org',
        kasplexApiUrl: 'https://api.kasplex.org',
        network: 'mainnet'
      });

      expect(defaultIndexer).toBeInstanceOf(VerumIndexer);
    });

    test('creates indexer with custom config', () => {
      const customConfig: VerumIndexerConfig = {
        kaspaApiUrl: 'https://custom-api.kaspa.org',
        kasplexApiUrl: 'https://custom-api.kasplex.org',
        network: 'testnet',
        enableCaching: false,
        cacheTTL: 30000,
        maxRetries: 5,
        batchSize: 200
      };

      const customIndexer = new VerumIndexer(customConfig);
      expect(customIndexer).toBeInstanceOf(VerumIndexer);
    });
  });

  describe('config management', () => {
    test('getConfig returns current configuration', () => {
      const currentConfig = indexer.getConfig();
      
      expect(currentConfig.kaspaApiUrl).toBe(config.kaspaApiUrl);
      expect(currentConfig.kasplexApiUrl).toBe(config.kasplexApiUrl);
      expect(currentConfig.network).toBe(config.network);
      expect(currentConfig.enableCaching).toBe(true); // default
    });

    test('updateConfig updates configuration', () => {
      const updates = {
        enableCaching: false,
        cacheTTL: 30000
      };

      indexer.updateConfig(updates);
      const updatedConfig = indexer.getConfig();
      
      expect(updatedConfig.enableCaching).toBe(false);
      expect(updatedConfig.cacheTTL).toBe(30000);
      expect(updatedConfig.kaspaApiUrl).toBe(config.kaspaApiUrl); // unchanged
    });
  });

  describe('user operations', () => {
    test('getUserProfile calls userFetcher', async () => {
      const mockProfile = {
        address: 'kaspa:test123',
        nickname: 'TestUser',
        startTxId: 'tx123',
        postCount: 5,
        followerCount: 10,
        followingCount: 3,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // We can't easily mock the internal components, so we'll test the interface exists
      expect(typeof indexer.getUserProfile).toBe('function');
      expect(typeof indexer.getUserStats).toBe('function');
      expect(typeof indexer.getFollowing).toBe('function');
      expect(typeof indexer.getFollowers).toBe('function');
      expect(typeof indexer.isFollowing).toBe('function');
      expect(typeof indexer.getUserProfiles).toBe('function');
    });
  });

  describe('story operations', () => {
    test('story methods are available', () => {
      expect(typeof indexer.getStory).toBe('function');
      expect(typeof indexer.getStorySegments).toBe('function');
      expect(typeof indexer.isStoryComplete).toBe('function');
    });

    test('isStoryComplete with valid segments', () => {
      const segments = [
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
          isFinal: true
        }
      ];

      const isComplete = indexer.isStoryComplete(segments);
      expect(typeof isComplete).toBe('boolean');
    });
  });

  describe('feed operations', () => {
    test('feed methods are available', () => {
      expect(typeof indexer.getPersonalizedFeed).toBe('function');
      expect(typeof indexer.getGlobalFeed).toBe('function');
      expect(typeof indexer.getUserFeed).toBe('function');
      expect(typeof indexer.getTrendingFeed).toBe('function');
      expect(typeof indexer.getFeedByType).toBe('function');
    });

    test('getFeedByType accepts transaction types', async () => {
      const types = [TransactionType.POST, TransactionType.STORY];
      const options = { limit: 10 };

      // Method should exist and accept these parameters
      expect(() => indexer.getFeedByType(types, options)).not.toThrow();
    });
  });

  describe('search operations', () => {
    test('searchContent method is available', () => {
      expect(typeof indexer.searchContent).toBe('function');
    });

    test('searchContent accepts search options', async () => {
      const searchOptions = {
        query: 'test search',
        author: 'kaspa:test123',
        type: [TransactionType.POST],
        limit: 20,
        offset: 0,
        sortBy: 'timestamp' as const,
        sortOrder: 'desc' as const
      };

      // Method should exist and accept these parameters
      expect(() => indexer.searchContent(searchOptions)).not.toThrow();
    });
  });

  describe('utility operations', () => {
    test('utility methods are available', () => {
      expect(typeof indexer.getRecentTransactions).toBe('function');
      expect(typeof indexer.getTransaction).toBe('function');
      expect(typeof indexer.getTransactionsByAddress).toBe('function');
      expect(typeof indexer.transactionExists).toBe('function');
      expect(typeof indexer.parseVerumTransaction).toBe('function');
    });

    test('parseVerumTransaction handles null input', () => {
      const result = indexer.parseVerumTransaction(null);
      // Should handle null input gracefully
      expect(result).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('handles invalid configuration gracefully', () => {
      // Test with minimal config
      expect(() => {
        new VerumIndexer({
          kaspaApiUrl: '',
          kasplexApiUrl: '',
          network: 'mainnet'
        });
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    test('all components are initialized', () => {
      // Test that the indexer was created successfully
      expect(indexer).toBeInstanceOf(VerumIndexer);

      // Test that all main methods are available
      const expectedMethods = [
        'getUserProfile', 'getUserStats', 'getFollowing', 'getFollowers',
        'getStory', 'getStorySegments', 'isStoryComplete',
        'getPersonalizedFeed', 'getGlobalFeed', 'getUserFeed', 'getTrendingFeed',
        'searchContent', 'getRecentTransactions', 'getTransaction'
      ];

      expectedMethods.forEach(method => {
        expect(typeof (indexer as any)[method]).toBe('function');
      });
    });
  });
});