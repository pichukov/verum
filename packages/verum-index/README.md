# @verum/index

A TypeScript library for fetching and indexing Verum protocol data from the Kaspa blockchain. This package provides read-only operations for blockchain data aggregation, feed generation, and content discovery.

## Features

- 🔍 **Blockchain Data Fetching** - Retrieve transactions and protocol data from Kaspa blockchain
- 👤 **User Profile Management** - Index and retrieve user profiles, followers, and following
- 📖 **Story Reconstruction** - Rebuild complete stories from blockchain segments
- 📰 **Feed Aggregation** - Generate personalized, global, and trending feeds
- 🔎 **Content Search** - Search and filter blockchain content
- ⚡ **Caching Support** - Built-in caching for improved performance
- 🎯 **Type Safety** - Full TypeScript support with strict typing
- 🧪 **Well Tested** - Comprehensive test suite

## Quick Start

```typescript
import { VerumIndexer } from '@verum/index';

// Initialize the indexer
const indexer = new VerumIndexer({
  kaspaApiUrl: 'https://api.kaspa.org',
  kasplexApiUrl: 'https://api.kasplex.org',
  network: 'mainnet'
});

// Get a user's profile
const profile = await indexer.getUserProfile('kaspa:qr123...');
if (profile.success) {
  console.log(`User: ${profile.data.nickname}`);
  console.log(`Posts: ${profile.data.postCount}`);
}

// Get personalized feed
const feed = await indexer.getPersonalizedFeed('kaspa:qr123...', {
  limit: 20
});
if (feed.success) {
  feed.data.items.forEach(item => {
    console.log(`${item.author}: ${item.content?.substring(0, 100)}...`);
  });
}
```

## Core Concepts

### Read-Only Operations

This package focuses exclusively on **reading** data from the blockchain. For creating transactions, use `@verum/protocol`. This separation allows for:

- Clean architecture with single responsibility
- Independent scaling and optimization  
- Flexible deployment (index services can run separately)
- Better caching strategies for read operations

### Data Indexing

The package processes raw blockchain transactions and creates indexed views:
- **Raw transactions** → **Parsed protocol data** → **Indexed content**
- Reconstructs multi-segment stories into complete narratives
- Calculates engagement metrics and user statistics
- Maintains relationship graphs (followers/following)

## API Reference

### VerumIndexer

The main class providing unified access to all indexing operations.

#### Constructor

```typescript
new VerumIndexer(config: VerumIndexerConfig)
```

**Configuration:**
```typescript
interface VerumIndexerConfig {
  kaspaApiUrl: string;        // Kaspa blockchain API endpoint
  kasplexApiUrl: string;      // Kasplex API endpoint  
  network: 'mainnet' | 'testnet';
  timeout?: number;           // Request timeout (default: 10s)
  enableCaching?: boolean;    // Enable caching (default: true)
  cacheTTL?: number;         // Cache TTL in ms (default: 60s)
  maxRetries?: number;       // Max retries (default: 3)
  batchSize?: number;        // Batch size (default: 100)
}
```

### User Operations

#### getUserProfile(address)

Retrieve a user's complete profile.

```typescript
const result = await indexer.getUserProfile('kaspa:qr123...');
if (result.success) {
  const profile = result.data;
  console.log({
    nickname: profile.nickname,
    postCount: profile.postCount,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    createdAt: new Date(profile.createdAt * 1000)
  });
}
```

#### getUserStats(address)

Get detailed user statistics.

```typescript
const result = await indexer.getUserStats('kaspa:qr123...');
if (result.success) {
  const stats = result.data;
  console.log({
    totalPosts: stats.postCount,
    totalStories: stats.storyCount,
    totalComments: stats.commentCount,
    totalLikes: stats.likeCount,
    totalEngagement: stats.totalEngagement
  });
}
```

#### getFollowing(address, limit?, offset?)

Get users that a specific user follows.

```typescript
const result = await indexer.getFollowing('kaspa:qr123...', 50, 0);
if (result.success) {
  result.data.forEach(subscription => {
    console.log(`Following: ${subscription.target}`);
    console.log(`Since: ${new Date(subscription.timestamp * 1000)}`);
  });
}
```

#### isFollowing(followerAddress, targetAddress)

Check if one user follows another.

```typescript
const isFollowing = await indexer.isFollowing(
  'kaspa:qr123...', // follower
  'kaspa:qr456...'  // target
);
console.log(`Following: ${isFollowing}`);
```

### Story Operations

#### getStory(firstTxId)

Reconstruct a complete story from its first segment.

```typescript
const result = await indexer.getStory('first_segment_tx_id');
if (result.success) {
  const story = result.data;
  console.log({
    title: story.title,
    author: story.author,
    content: story.content,
    isComplete: story.isComplete,
    segmentCount: story.segments.length
  });
}
```

#### getStorySegments(firstTxId)

Get all segments for a story.

```typescript
const result = await indexer.getStorySegments('first_segment_tx_id');
if (result.success) {
  result.data.forEach(segment => {
    console.log(`Segment ${segment.segmentNumber}/${segment.totalSegments}`);
    console.log(`Content: ${segment.content}`);
  });
}
```

### Feed Operations

#### getPersonalizedFeed(userAddress, options?)

Get a personalized feed based on who the user follows.

```typescript
const result = await indexer.getPersonalizedFeed('kaspa:qr123...', {
  limit: 20,
  includeReplies: true,
  minTimestamp: Math.floor(Date.now() / 1000) - 86400 // Last 24 hours
});

if (result.success) {
  result.data.items.forEach(item => {
    console.log(`${item.author}: ${item.content?.substring(0, 100)}...`);
  });
}
```

#### getGlobalFeed(options?)

Get the global feed from all users.

```typescript
const result = await indexer.getGlobalFeed({
  limit: 50,
  offset: 0
});
```

#### getUserFeed(targetAddress, options?)

Get posts from a specific user.

```typescript
const result = await indexer.getUserFeed('kaspa:qr123...', {
  limit: 30
});
```

#### getTrendingFeed(options?)

Get trending content sorted by engagement.

```typescript
const result = await indexer.getTrendingFeed({
  limit: 20
});
```

#### getFeedByType(types, options?)

Filter feed by transaction types.

```typescript
import { TransactionType } from '@verum/protocol';

const result = await indexer.getFeedByType(
  [TransactionType.STORY, TransactionType.POST],
  { limit: 25 }
);
```

### Search Operations

#### searchContent(options)

Search for content across the network.

```typescript
const result = await indexer.searchContent({
  query: 'blockchain technology',
  author: 'kaspa:qr123...', // optional
  type: [TransactionType.POST, TransactionType.STORY],
  limit: 30,
  sortBy: 'engagement',
  sortOrder: 'desc'
});

if (result.success) {
  result.data.items.forEach(item => {
    console.log(`Found: ${item.content?.substring(0, 100)}...`);
  });
}
```

### Utility Operations

#### getTransaction(txId)

Get a specific transaction by ID.

```typescript
const result = await indexer.getTransaction('transaction_id');
if (result.success) {
  const verumTx = indexer.parseVerumTransaction(result.data);
  if (verumTx) {
    console.log(`Type: ${verumTx.payload.type}`);
    console.log(`Content: ${verumTx.payload.content}`);
  }
}
```

#### getRecentTransactions(limit?)

Get recent transactions from the blockchain.

```typescript
const result = await indexer.getRecentTransactions(100);
if (result.success) {
  console.log(`Found ${result.data.length} recent transactions`);
}
```

## Types

### Core Data Types

```typescript
// User profile with blockchain metadata
interface IndexedUserProfile {
  address: string;
  nickname: string;
  avatar?: string;
  startTxId: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
  updatedAt: number;
}

// Complete reconstructed story
interface IndexedStory {
  firstTxId: string;
  author: string;
  title?: string;
  content: string;
  segments: StorySegment[];
  timestamp: number;
  likeCount: number;
  commentCount: number;
  isComplete: boolean;
}

// Individual post
interface IndexedPost {
  txId: string;
  author: string;
  content: string;
  timestamp: number;
  likeCount: number;
  commentCount: number;
  parentId?: string;
}

// Feed item union
type FeedItem = IndexedPost | IndexedStory | IndexedComment;
```

### Configuration Types

```typescript
// Feed options
interface FeedOptions {
  userAddress?: string;     // For personalization
  limit?: number;          // Results per page
  offset?: number;         // Pagination offset
  includeReplies?: boolean; // Include comments
  minTimestamp?: number;   // Filter by time
  maxTimestamp?: number;
  authors?: string[];      // Filter by authors
}

// Search options
interface SearchOptions {
  query?: string;          // Text search
  author?: string;         // Author filter
  type?: TransactionType[]; // Content type filter
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'engagement';
  sortOrder?: 'asc' | 'desc';
}
```

## Advanced Usage

### Custom Blockchain Fetcher

You can implement custom blockchain data sources:

```typescript
import { IBlockchainFetcher } from '@verum/index';

class CustomBlockchainFetcher implements IBlockchainFetcher {
  async getTransactionsByAddress(address: string) {
    // Custom implementation
  }
  
  // ... implement other methods
}

// Use with individual components
import { UserFetcher, FeedAggregator } from '@verum/index';

const customFetcher = new CustomBlockchainFetcher();
const userFetcher = new UserFetcher(customFetcher);
```

### Caching Strategies

```typescript
// Configure caching behavior
const indexer = new VerumIndexer({
  kaspaApiUrl: 'https://api.kaspa.org',
  kasplexApiUrl: 'https://api.kasplex.org',
  network: 'mainnet',
  enableCaching: true,
  cacheTTL: 30000,  // 30 seconds
  batchSize: 200    // Larger batches for better performance
});

// Update cache settings
indexer.updateConfig({
  cacheTTL: 60000  // 1 minute
});
```

### Error Handling

```typescript
const result = await indexer.getUserProfile('invalid-address');
if (!result.success) {
  console.error('Error:', result.error);
  
  // Handle specific error cases
  if (result.error?.includes('not found')) {
    console.log('User has not registered on Verum protocol');
  }
}
```

### Batch Operations

```typescript
// Fetch multiple user profiles efficiently
const addresses = ['kaspa:qr123...', 'kaspa:qr456...', 'kaspa:qr789...'];
const result = await indexer.getUserProfiles(addresses);

if (result.success) {
  result.data.forEach(profile => {
    console.log(`${profile.nickname}: ${profile.postCount} posts`);
  });
  
  if (result.error) {
    console.warn('Some profiles failed to load:', result.error);
  }
}
```

## Performance Considerations

### Caching

- User profiles: 1 minute TTL
- Feed data: 30 seconds TTL  
- Story reconstructions: 2 minutes TTL
- Transaction data: 30 seconds TTL

### Batch Sizes

- Default batch size: 100 transactions
- Increase for better throughput: `batchSize: 200`
- Decrease for lower memory usage: `batchSize: 50`

### Feed Optimization

```typescript
// Efficient feed loading
const feed = await indexer.getPersonalizedFeed(userAddress, {
  limit: 20,           // Reasonable page size
  includeReplies: false, // Skip comments for main feed
  minTimestamp: recentTimestamp // Avoid loading old content
});
```

## Error Codes

Common error patterns:

- `"User not found - no START transaction"` - User hasn't registered
- `"Failed to fetch user transactions"` - Network/API error
- `"Invalid story transaction"` - Malformed story data
- `"Story reconstruction failed"` - Missing segments or chain breaks
- `"Search failed"` - Invalid search parameters

## Integration with Protocol Package

```typescript
import { VerumTransactionBuilder } from '@verum/protocol';
import { VerumIndexer } from '@verum/index';

// Create transaction with protocol package
const builder = new VerumTransactionBuilder();
const postTx = builder.createPostTransaction('Hello world!', chainRefs);

// Later, read the data with index package
const indexer = new VerumIndexer(config);
const feed = await indexer.getGlobalFeed({ limit: 10 });
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass and add tests for new features.

```bash
# Install dependencies  
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:run

# Build
npm run build
```