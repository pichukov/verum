/**
 * Unit tests for VerumSDK
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { VerumSDK } from '../src/verum-sdk';
import { MockWalletAdapter } from '../src/wallet/wallet-adapter';
import { VerumSDKConfig, WalletType } from '../src/types';

// Mock the dependencies
vi.mock('@verum/protocol', () => ({
  VerumTransactionBuilder: vi.fn().mockImplementation(() => ({
    createStartTransaction: vi.fn().mockReturnValue({ type: 'start', content: '{}' }),
    createPostTransaction: vi.fn().mockReturnValue({ type: 'post', content: 'test' }),
    createStorySegments: vi.fn().mockReturnValue([{ type: 'story', content: 'segment1' }]),
    createSubscribeTransaction: vi.fn().mockReturnValue({ type: 'subscribe', content: 'address' }),
    createLikeTransaction: vi.fn().mockReturnValue({ type: 'like', content: null }),
    createCommentTransaction: vi.fn().mockReturnValue({ type: 'comment', content: 'comment' })
  }))
}));

vi.mock('@verum/index', () => ({
  VerumIndexer: vi.fn().mockImplementation(() => ({
    getUserProfile: vi.fn().mockResolvedValue({ success: true, data: { address: 'test', nickname: 'Test User' } }),
    getPersonalizedFeed: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } }),
    getGlobalFeed: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } }),
    searchContent: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } }),
    updateConfig: vi.fn(),
    isFollowing: vi.fn().mockResolvedValue(false), // Not following by default
    getUserFeed: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } }),
    getTrendingFeed: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } }),
    getFeedByType: vi.fn().mockResolvedValue({ success: true, data: { items: [], hasMore: false } })
  }))
}));

describe('VerumSDK', () => {
  let sdk: VerumSDK;
  let mockWallet: MockWalletAdapter;
  let config: VerumSDKConfig;

  beforeEach(() => {
    mockWallet = new MockWalletAdapter();
    config = {
      network: 'testnet',
      kaspaApiUrl: 'https://api.kaspa.org',
      kasplexApiUrl: 'https://api.kasplex.org',
      wallet: mockWallet
    };
    
    sdk = new VerumSDK(config);
  });

  describe('constructor', () => {
    test('creates SDK with default config', () => {
      expect(sdk).toBeInstanceOf(VerumSDK);
      expect(sdk.isReady()).toBe(false);
    });

    test('creates SDK with custom config', () => {
      const customConfig: VerumSDKConfig = {
        ...config,
        enableCaching: false,
        cacheTTL: 30000,
        maxRetries: 5,
        enableTransactionConfirmation: false
      };

      const customSDK = new VerumSDK(customConfig);
      expect(customSDK).toBeInstanceOf(VerumSDK);
    });
  });

  describe('initialization', () => {
    test('initialize connects wallet and loads user', async () => {
      const result = await sdk.initialize();
      
      expect(result.success).toBe(true);
      expect(sdk.isReady()).toBe(true);
    });

    test('initialize handles connection failure', async () => {
      // Mock wallet connection failure
      vi.spyOn(mockWallet, 'connect').mockRejectedValue(new Error('Connection failed'));
      
      const result = await sdk.initialize();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('user operations', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    test('registerUser creates user profile', async () => {
      // Mock indexer to first return no user (not registered), then return user data after registration
      const mockIndexer = sdk['indexer'];
      vi.spyOn(mockIndexer, 'getUserProfile')
        .mockResolvedValueOnce({ success: false, error: 'User not found' }) // First call - user doesn't exist
        .mockResolvedValue({ success: true, data: { address: 'test', nickname: 'TestUser' } }); // After registration
      
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('tx123');
      
      const result = await sdk.registerUser({
        nickname: 'TestUser',
        avatar: 'base64avatar'
      });

      expect(result.success).toBe(true);
      expect(result.txId).toBe('tx123');
    });

    test('getUserProfile returns current user when no address provided', async () => {
      const result = await sdk.getUserProfile();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('followUser creates subscription', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('follow_tx123');
      
      const result = await sdk.followUser({
        targetAddress: 'kaspa:target123'
      });

      expect(result.success).toBe(true);
      expect(result.txId).toBe('follow_tx123');
    });
  });

  describe('content operations', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    test('createPost creates post transaction', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('post_tx123');
      
      const result = await sdk.createPost({
        content: 'This is a test post'
      });

      expect(result.success).toBe(true);
      expect(result.txId).toBe('post_tx123');
      expect(result.data?.content).toBe('This is a test post');
    });

    test('createComment creates comment transaction', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('comment_tx123');
      
      const result = await sdk.createComment({
        parentTxId: 'parent_tx123',
        content: 'This is a comment'
      });

      expect(result.success).toBe(true);
      expect(result.txId).toBe('comment_tx123');
    });

    test('likeContent creates like transaction', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('like_tx123');
      
      const result = await sdk.likeContent({
        targetTxId: 'target_tx123'
      });

      expect(result.success).toBe(true);
      expect(result.txId).toBe('like_tx123');
    });
  });

  describe('story operations', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    test('createStory handles single segment story', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('story_tx123');
      
      const result = await sdk.createStory({
        content: 'Short story content',
        title: 'Test Story'
      });

      expect(result.success).toBe(true);
      expect(result.data?.title).toBe('Test Story');
    });

    test('getActiveStoryCreations returns active creations', () => {
      const active = sdk.getActiveStoryCreations();
      expect(typeof active).toBe('object');
    });
  });

  describe('feed operations', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    test('getPersonalizedFeed returns user feed', async () => {
      const result = await sdk.getPersonalizedFeed({ limit: 10 });
      
      expect(result.success).toBe(true);
      expect(result.data?.items).toBeDefined();
    });

    test('getGlobalFeed returns global feed', async () => {
      const result = await sdk.getGlobalFeed({ limit: 20 });
      
      expect(result.success).toBe(true);
      expect(result.data?.items).toBeDefined();
    });

    test('searchContent performs content search', async () => {
      const result = await sdk.searchContent({
        query: 'test search',
        limit: 15
      });

      expect(result.success).toBe(true);
      expect(result.data?.query).toBe('test search');
    });

    test('refreshFeeds clears cache', async () => {
      const result = await sdk.refreshFeeds();
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('number');
    });
  });

  describe('wallet operations', () => {
    test('getWalletInfo returns wallet information', async () => {
      await mockWallet.connect();
      
      const result = await sdk.getWalletInfo();
      
      expect(result.success).toBe(true);
      expect(result.data?.address).toBeDefined();
      expect(result.data?.type).toBe(WalletType.KASWARE);
    });

    test('disconnectWallet disconnects and resets state', async () => {
      await sdk.initialize();
      
      await sdk.disconnectWallet();
      
      expect(sdk.isReady()).toBe(false);
      expect(sdk.getCurrentUser()).toBeNull();
    });
  });

  describe('transaction management', () => {
    beforeEach(async () => {
      await sdk.initialize();
    });

    test('tracks pending transactions', async () => {
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('tracked_tx123');
      
      await sdk.createPost({ content: 'Test post' });
      
      const pending = sdk.getPendingTransactions();
      expect(pending.length).toBeGreaterThan(0);
      
      const status = sdk.getTransactionStatus('tracked_tx123');
      expect(status).toBeDefined();
      expect(status?.status).toBe('pending');
    });

    test('clearCompletedTransactions removes completed', () => {
      const cleared = sdk.clearCompletedTransactions();
      expect(typeof cleared).toBe('number');
    });
  });

  describe('event management', () => {
    test('adds and removes event listeners', () => {
      const callback = vi.fn();
      
      sdk.on('wallet:connected', callback);
      sdk.off('wallet:connected', callback);
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('configuration', () => {
    test('getConfig returns current configuration', () => {
      const currentConfig = sdk.getConfig();
      
      expect(currentConfig.network).toBe('testnet');
      expect(currentConfig.kaspaApiUrl).toBe('https://api.kaspa.org');
    });

    test('updateConfig updates configuration', () => {
      const updates = {
        enableCaching: false,
        cacheTTL: 30000
      };

      sdk.updateConfig(updates);
      const updatedConfig = sdk.getConfig();
      
      expect(updatedConfig.enableCaching).toBe(false);
      expect(updatedConfig.cacheTTL).toBe(30000);
    });
  });

  describe('error handling', () => {
    test('handles wallet not connected errors', async () => {
      // Don't initialize SDK
      const result = await sdk.createPost({ content: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });

    test('handles transaction failures gracefully', async () => {
      await sdk.initialize();
      vi.spyOn(mockWallet, 'sendTransaction').mockRejectedValue(new Error('Transaction failed'));
      
      const result = await sdk.createPost({ content: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction failed');
    });
  });

  describe('integration', () => {
    test('full user workflow', async () => {
      // Initialize
      const initResult = await sdk.initialize();
      expect(initResult.success).toBe(true);

      // Register user - mock indexer to first return no user, then return user data
      const mockIndexer = sdk['indexer'];
      vi.spyOn(mockIndexer, 'getUserProfile')
        .mockResolvedValueOnce({ success: false, error: 'User not found' }) // First call - user doesn't exist
        .mockResolvedValue({ success: true, data: { address: 'test', nickname: 'IntegrationTestUser' } }); // After registration

      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('register_tx');
      const registerResult = await sdk.registerUser({
        nickname: 'IntegrationTestUser'
      });
      expect(registerResult.success).toBe(true);

      // Create post
      vi.spyOn(mockWallet, 'sendTransaction').mockResolvedValue('post_tx');
      const postResult = await sdk.createPost({
        content: 'Integration test post'
      });
      expect(postResult.success).toBe(true);

      // Get feed
      const feedResult = await sdk.getPersonalizedFeed();
      expect(feedResult.success).toBe(true);
    });
  });
});