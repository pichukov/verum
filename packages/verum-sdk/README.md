# @verum/sdk

A comprehensive TypeScript SDK for building applications on the Verum social protocol. Combines transaction creation and blockchain indexing into a unified, high-level interface for seamless Web3 social app development.

## Features

- 🚀 **Complete Social Protocol** - User registration, posts, stories, comments, likes, follows
- 🔗 **Multi-Wallet Support** - Kasware wallet with extensible architecture for future wallets
- 📱 **Real-time Updates** - Event-driven architecture with live feed updates
- 💾 **Smart Caching** - Intelligent caching for optimal performance
- 📖 **Story Management** - Advanced multi-segment story creation with progress tracking
- 🔍 **Content Discovery** - Powerful search and feed personalization
- 🎯 **Type Safety** - Full TypeScript support with comprehensive types
- ⚡ **High Performance** - Optimized for both browser and Node.js environments
- 🧪 **Well Tested** - Comprehensive test suite with mock wallet support

## Quick Start

```typescript
import { VerumSDK, WalletFactory, WalletType } from '@verum/sdk';

// Auto-detect and create wallet
const wallet = WalletFactory.detectWallet() || WalletFactory.createMockWallet();

// Initialize SDK
const sdk = new VerumSDK({
  network: 'mainnet',
  kaspaApiUrl: 'https://api.kaspa.org',
  wallet
});

// Initialize and connect
await sdk.initialize();

// Register user
const registration = await sdk.registerUser({
  nickname: 'Web3Developer',
  avatar: 'base64_encoded_image' // optional
});

// Create a post
const post = await sdk.createPost({
  content: 'Hello Verum! Building the future of decentralized social media 🚀'
});

// Get personalized feed
const feed = await sdk.getPersonalizedFeed({ limit: 20 });
console.log(`Loaded ${feed.data.items.length} feed items`);
```

## Core Concepts

### Unified Architecture

The Verum SDK combines three layers:

1. **@verum/protocol** - Transaction creation and validation (write operations)
2. **@verum/index** - Blockchain data fetching and indexing (read operations)  
3. **@verum/sdk** - High-level orchestration and application logic

This separation provides:
- **Clean separation of concerns** - Write and read operations are independent
- **Flexible deployment** - Index services can scale separately
- **Optimal performance** - Specialized caching strategies for each layer
- **Easy testing** - Mock individual components for unit tests

### Wallet Abstraction

The SDK provides a unified interface for multiple wallet types:

```typescript
// Auto-detect available wallet
const wallet = WalletFactory.detectWallet();

// Or create specific wallet type
const kaswareWallet = WalletFactory.createWallet(WalletType.KASWARE);
// Additional wallet types can be added in the future

// For testing
const mockWallet = WalletFactory.createMockWallet();
```

## API Reference

### VerumSDK

The main SDK class providing unified access to all operations.

#### Constructor

```typescript
new VerumSDK(config: VerumSDKConfig)
```

**Configuration:**
```typescript
interface VerumSDKConfig {
  // Network settings
  network: 'mainnet' | 'testnet';
  kaspaApiUrl: string;
  wallet: IWallet;
  
  // Performance settings
  timeout?: number;                    // Request timeout (default: 10s)
  enableCaching?: boolean;             // Enable caching (default: true)
  cacheTTL?: number;                   // Cache TTL (default: 60s)
  maxRetries?: number;                 // Max retries (default: 3)
  batchSize?: number;                  // Batch size (default: 100)
  
  // Feature flags
  enableTransactionConfirmation?: boolean;  // Track tx confirmations
  enableAutoRetry?: boolean;               // Auto-retry failed operations
  enableOfflineMode?: boolean;             // Offline capability
}
```

### User Operations

#### registerUser(registration)

Register a new user on the Verum protocol.

```typescript
const result = await sdk.registerUser({
  nickname: 'Alice',
  avatar: 'base64_encoded_image' // optional
});

if (result.success) {
  console.log('User registered:', result.data.nickname);
  console.log('Transaction ID:', result.txId);
}
```

#### getUserProfile(address?)

Get user profile (current user if no address provided).

```typescript
// Get current user
const currentUser = await sdk.getUserProfile();

// Get specific user
const user = await sdk.getUserProfile('kaspa:qr123...');

if (user.success) {
  console.log({
    nickname: user.data.nickname,
    posts: user.data.postCount,
    followers: user.data.followerCount,
    following: user.data.followingCount
  });
}
```

#### followUser(action) / unfollowUser(action)

Follow or unfollow users.

```typescript
// Follow user
const followResult = await sdk.followUser({
  targetAddress: 'kaspa:qr456...'
});

// Unfollow user  
const unfollowResult = await sdk.unfollowUser({
  targetAddress: 'kaspa:qr456...'
});

// Check following status
const isFollowing = await sdk.isFollowing('kaspa:qr456...');
```

#### getFollowing() / getFollowers()

Get following/followers lists.

```typescript
// Get users you follow
const following = await sdk.getFollowing(50, 0); // limit, offset

// Get your followers
const followers = await sdk.getFollowers(50, 0);

following.data.forEach(subscription => {
  console.log(`Following: ${subscription.target}`);
  console.log(`Mutual: ${subscription.mutualFollowing}`);
});
```

### Content Operations

#### createPost(post)

Create a new post.

```typescript
const post = await sdk.createPost({
  content: 'Just discovered an amazing new blockchain protocol! 🔗'
});

if (post.success) {
  console.log('Post created:', post.txId);
  console.log('Content:', post.data.content);
}
```

#### createComment(comment)

Comment on posts or stories.

```typescript
const comment = await sdk.createComment({
  parentTxId: 'post_transaction_id',
  content: 'Great point! Thanks for sharing.'
});
```

#### likeContent(like)

Like posts, stories, or comments.

```typescript
const like = await sdk.likeContent({
  targetTxId: 'content_transaction_id'
});

if (like.success) {
  console.log('Content liked:', like.txId);
}
```

### Story Operations

#### createStory(story)

Create multi-segment stories with progress tracking.

```typescript
// Listen for progress updates
sdk.on('story:segment:created', (segment, total) => {
  console.log(`Created segment ${segment}/${total}`);
});

sdk.on('story:completed', (storyTxId) => {
  console.log('Story completed:', storyTxId);
});

sdk.on('story:failed', (error, completedSegments) => {
  console.log(`Story failed after ${completedSegments} segments:`, error);
});

// Create story
const story = await sdk.createStory({
  title: 'The Future of Web3',
  content: `
    This is a long-form story about the evolution of Web3 technology.
    
    Chapter 1: The Beginning
    It all started with Bitcoin...
    
    Chapter 2: Smart Contracts
    Ethereum introduced programmable money...
    
    [... continue with long content that will be split into segments ...]
  `
});

if (story.success) {
  console.log('Story creation started');
  console.log(`Will create ${story.data.segments.length} segments`);
}
```

#### getStory(firstTxId)

Retrieve complete stories.

```typescript
const story = await sdk.getStory('first_segment_tx_id');

if (story.success) {
  console.log({
    title: story.data.title,
    author: story.data.author,
    segments: story.data.segments.length,
    isComplete: story.data.isComplete,
    content: story.data.content
  });
}
```

#### getActiveStoryCreations()

Monitor active story creation progress.

```typescript
const activeStories = sdk.getActiveStoryCreations();

Object.entries(activeStories).forEach(([progressId, progress]) => {
  console.log(`Story ${progressId}: ${progress.completedSegments}/${progress.totalSegments}`);
  console.log(`Status: ${progress.status}`);
  if (progress.errors.length > 0) {
    console.log('Errors:', progress.errors);
  }
});
```

### Feed Operations

#### getPersonalizedFeed(options?)

Get personalized feed based on who you follow.

```typescript
const feed = await sdk.getPersonalizedFeed({
  limit: 20,
  includeReplies: true,
  minTimestamp: Date.now() - 86400000 // Last 24 hours
});

if (feed.success) {
  console.log(`Loaded ${feed.data.items.length} items`);
  console.log(`Cache hit: ${feed.data.cacheHit}`);
  
  feed.data.items.forEach(item => {
    if ('segments' in item) {
      console.log(`📖 Story: ${item.title} by ${item.author}`);
    } else if ('parentTxId' in item) {
      console.log(`💬 Comment: ${item.content} by ${item.author}`);
    } else {
      console.log(`📝 Post: ${item.content} by ${item.author}`);
    }
  });
}
```

#### getGlobalFeed(options?)

Get global feed from all users.

```typescript
const globalFeed = await sdk.getGlobalFeed({
  limit: 30,
  refreshCache: true // Force refresh
});
```

#### getUserFeed(targetAddress, options?)

Get posts from a specific user.

```typescript
const userFeed = await sdk.getUserFeed('kaspa:qr123...', {
  limit: 50
});
```

#### getTrendingFeed(options?)

Get trending content sorted by engagement.

```typescript
const trending = await sdk.getTrendingFeed({
  limit: 25
});
```

#### searchContent(options)

Search across all content.

```typescript
const searchResults = await sdk.searchContent({
  query: 'blockchain development',
  type: [TransactionType.POST, TransactionType.STORY],
  sortBy: 'engagement',
  sortOrder: 'desc',
  limit: 30
});

if (searchResults.success) {
  console.log(`Found ${searchResults.data.items.length} results`);
  console.log(`Search took ${searchResults.data.searchTime}ms`);
  
  searchResults.data.items.forEach(item => {
    console.log(`Result: ${item.content?.substring(0, 100)}...`);
  });
}
```

### Event System

The SDK provides a comprehensive event system for real-time updates.

```typescript
// Transaction events
sdk.on('transaction:pending', (txId) => {
  console.log('Transaction pending:', txId);
});

sdk.on('transaction:confirmed', (txId, confirmations) => {
  console.log(`Transaction confirmed: ${txId} (${confirmations} confirmations)`);
});

// Story events
sdk.on('story:segment:created', (segment, total) => {
  updateProgressBar(segment / total);
});

sdk.on('story:completed', (storyTxId) => {
  showSuccessMessage('Story published successfully!');
});

// User events
sdk.on('user:followed', (targetAddress) => {
  refreshFollowingList();
});

// Feed events
sdk.on('feed:updated', (feedType, itemCount) => {
  console.log(`${feedType} feed updated with ${itemCount} items`);
});

// Wallet events
sdk.on('wallet:connected', (address, type) => {
  console.log(`Connected to ${type} wallet: ${address}`);
});

sdk.on('wallet:disconnected', () => {
  console.log('Wallet disconnected');
});

// Error handling
sdk.on('error', (error) => {
  console.error('SDK Error:', error);
});
```

### Transaction Management

Track and manage transaction states.

```typescript
// Get pending transactions
const pending = sdk.getPendingTransactions();
pending.forEach(tx => {
  console.log(`${tx.txId}: ${tx.status} (${tx.confirmations} confirmations)`);
});

// Get specific transaction status
const status = sdk.getTransactionStatus('transaction_id');
if (status) {
  console.log(`Status: ${status.status}`);
  console.log(`Confirmations: ${status.confirmations}`);
}

// Clear completed transactions
const cleared = sdk.clearCompletedTransactions();
console.log(`Cleared ${cleared} completed transactions`);
```

### Advanced Configuration

#### Dynamic Configuration Updates

```typescript
// Get current config
const config = sdk.getConfig();
console.log('Current cache TTL:', config.cacheTTL);

// Update configuration
sdk.updateConfig({
  cacheTTL: 30000, // 30 seconds
  enableCaching: false,
  maxRetries: 5
});
```

#### Feed Cache Management

```typescript
// Manually refresh all cached feeds
const refreshResult = await sdk.refreshFeeds();
console.log(`Cleared ${refreshResult.data} cached feeds`);

// Get cache statistics (via FeedManager)
const stats = sdk.feedManager.getFeedCacheStats();
console.log({
  totalEntries: stats.totalEntries,
  cacheHitRate: stats.cacheHitRate,
  oldestEntry: stats.oldestEntry,
  newestEntry: stats.newestEntry
});
```

## Wallet Integration

### Kasware Wallet

```typescript
import { KaswareWalletAdapter } from '@verum/sdk';

// Check if available
if (KaswareWalletAdapter.isAvailable()) {
  const wallet = new KaswareWalletAdapter();
  await wallet.connect();
  
  const sdk = new VerumSDK({
    network: 'mainnet',
    kaspaApiUrl: 'https://api.kaspa.org',
    wallet
  });
}
```

### Adding Additional Wallet Types

The SDK is designed to be extensible for future wallet integrations. Currently supports Kasware wallet with the architecture ready for additional wallet types.

### Custom Wallet Implementation

```typescript
import { BaseWalletAdapter, WalletType } from '@verum/sdk';

class CustomWalletAdapter extends BaseWalletAdapter {
  getType(): WalletType {
    return WalletType.KASWARE; // or custom type
  }

  async connect(): Promise<void> {
    // Implement connection logic
    this.setConnected(true, 'wallet_address');
  }

  async sendTransaction(payload: any): Promise<string> {
    // Implement transaction sending
    return 'transaction_id';
  }

  // ... implement other required methods
}
```

## Error Handling

The SDK provides comprehensive error handling with specific error types and recovery suggestions.

```typescript
// Operation-level error handling
const result = await sdk.createPost({ content: 'Test post' });
if (!result.success) {
  switch (result.error) {
    case 'Wallet not connected':
      // Prompt user to connect wallet
      await sdk.connectWallet();
      break;
    case 'Insufficient balance':
      // Show balance warning
      showBalanceWarning();
      break;
    default:
      // Generic error handling
      showErrorMessage(result.error);
  }
}

// Global error handling
sdk.on('error', (error) => {
  logError(error);
  showUserFriendlyError(error.message);
});

sdk.on('wallet:error', (error) => {
  showWalletError(error);
});

// Network error handling
sdk.on('offline', () => {
  showOfflineBanner();
});

sdk.on('online', () => {
  hideOfflineBanner();
  refreshData();
});
```

## Testing

The SDK includes comprehensive testing utilities.

```typescript
import { VerumSDK, MockWalletAdapter } from '@verum/sdk';

describe('My App', () => {
  let sdk: VerumSDK;
  let mockWallet: MockWalletAdapter;

  beforeEach(() => {
    mockWallet = new MockWalletAdapter();
    mockWallet.setMockAddress('kaspa:test123...');
    mockWallet.setMockBalance(1000000);

    sdk = new VerumSDK({
      network: 'testnet',
      kaspaApiUrl: 'https://api.kaspa.org',
      wallet: mockWallet
    });
  });

  test('user can create post', async () => {
    await sdk.initialize();
    
    const result = await sdk.createPost({
      content: 'Test post content'
    });

    expect(result.success).toBe(true);
    expect(result.data.content).toBe('Test post content');
  });
});
```

## Performance Optimization

### Caching Strategy

```typescript
// Configure caching for optimal performance
const sdk = new VerumSDK({
  // ... other config
  enableCaching: true,
  cacheTTL: 60000, // 1 minute for most content
});

// Use cache-aware feed loading
const feed = await sdk.getPersonalizedFeed({
  limit: 20,
  refreshCache: false // Use cache if available
});

// Force refresh when needed
const freshFeed = await sdk.getPersonalizedFeed({
  refreshCache: true
});
```

### Batch Operations

```typescript
// Batch follow multiple users
const addresses = ['kaspa:user1...', 'kaspa:user2...', 'kaspa:user3...'];
const batchResult = await sdk.userOps.batchFollow(addresses);

console.log(`Successfully followed ${batchResult.data.length} users`);
if (batchResult.error) {
  console.log('Some operations failed:', batchResult.error);
}
```

### Progressive Loading

```typescript
let offset = 0;
const limit = 20;

while (true) {
  const feed = await sdk.getPersonalizedFeed({ limit, offset });
  
  if (!feed.success || feed.data.items.length === 0) break;
  
  // Process batch
  displayFeedItems(feed.data.items);
  
  if (!feed.data.hasMore) break;
  offset += limit;
}
```

## Migration Guide

### From Individual Packages

If you're currently using `@verum/protocol` and `@verum/index` separately:

```typescript
// Before (separate packages)
import { VerumTransactionBuilder } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';

const builder = new VerumTransactionBuilder();
const indexer = new VerumIndexer(config);

// Manual transaction creation and indexing
const postTx = builder.createPostTransaction(content, chainRefs);
const txId = await wallet.sendTransaction(postTx);
const feed = await indexer.getPersonalizedFeed(userAddress);

// After (unified SDK)
import { VerumSDK } from '@verum/sdk';

const sdk = new VerumSDK(config);
await sdk.initialize();

// Simplified high-level operations
const result = await sdk.createPost({ content });
const feed = await sdk.getPersonalizedFeed();
```

### Breaking Changes

- Transaction builders are now internal to the SDK
- Direct indexer access is abstracted behind high-level methods
- Wallet management is now handled by the SDK
- Event system has been restructured for better organization

## Best Practices

### 1. Initialize Once

```typescript
// Create SDK instance once and reuse
const sdk = new VerumSDK(config);
await sdk.initialize();

// Export for use throughout your app
export { sdk };
```

### 2. Handle Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);

const createPost = async (content: string) => {
  setIsLoading(true);
  try {
    const result = await sdk.createPost({ content });
    if (result.success) {
      // Update UI
      refreshFeed();
    } else {
      showError(result.error);
    }
  } finally {
    setIsLoading(false);
  }
};
```

### 3. Use Event Listeners for Real-time Updates

```typescript
useEffect(() => {
  const handleFeedUpdate = (feedType: string, itemCount: number) => {
    if (feedType === 'personalized') {
      refreshPersonalizedFeed();
    }
  };

  sdk.on('feed:updated', handleFeedUpdate);
  
  return () => {
    sdk.off('feed:updated', handleFeedUpdate);
  };
}, []);
```

### 4. Implement Proper Error Boundaries

```typescript
const handleSDKError = (error: Error) => {
  // Log error for debugging
  console.error('SDK Error:', error);
  
  // Show user-friendly message
  toast.error('Something went wrong. Please try again.');
  
  // Optionally report to error tracking service
  errorTracker.captureException(error);
};

sdk.on('error', handleSDKError);
```

## Browser Support

- **Modern Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Node.js**: 16.0.0+
- **Mobile**: iOS Safari 13+, Chrome Mobile 80+

## TypeScript Support

The SDK is built with TypeScript and provides complete type definitions:

```typescript
import type { 
  VerumSDK,
  SDKUserProfile,
  SDKPost,
  SDKStory,
  SDKFeedResult,
  OperationResult 
} from '@verum/sdk';

// Full IntelliSense and type checking
const handleUser = (user: SDKUserProfile) => {
  console.log(user.nickname); // ✅ Type-safe
  console.log(user.invalidProp); // ❌ TypeScript error
};
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📚 [Documentation](https://docs.verum.dev)
- 💬 [Discord Community](https://discord.gg/verum)
- 🐛 [Issue Tracker](https://github.com/verum-protocol/sdk/issues)
- 📧 [Email Support](mailto:support@verum.dev)