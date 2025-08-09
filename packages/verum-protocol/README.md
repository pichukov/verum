# @verum/protocol

A TypeScript library for creating Verum protocol transactions on the Kaspa blockchain. This package provides transaction builders, validators, and utilities for implementing the Verum social protocol.

## Features

- 🔧 **Transaction Builder** - Create properly formatted transactions for all Verum operations
- ✅ **Payload Validation**
- 📝 **Story Chunking** - Content splitting for multi-segment stories

## Quick Start

```typescript
import { 
  VerumTransactionBuilder, 
  VerumPayloadValidator, 
  TransactionType 
} from '@verum/protocol';

// Create a transaction builder
const builder = new VerumTransactionBuilder();

// Create a post transaction
const postTx = builder.createPostTransaction(
  'Hello Verum!',
  { prevTxId: 'previous_tx_id' }
);

// Validate the transaction
const validator = new VerumPayloadValidator();
const validation = validator.validatePayload(postTx);

if (validation.isValid) {
  console.log('Transaction is valid!');
} else {
  console.log('Validation errors:', validation.errors);
}
```

## Transaction Types

The Verum protocol supports the following transaction types:

- **START** - User registration with profile information
- **POST** - Simple text posts
- **STORY** - Multi-segment long-form content
- **SUBSCRIBE** - Follow another user
- **UNSUBSCRIBE** - Unfollow a user
- **LIKE** - Like a post or story
- **COMMENT** - Comment on a post or story

## API Reference

### VerumTransactionBuilder

The main class for creating transaction payloads.

#### Constructor

```typescript
new VerumTransactionBuilder(config?: VerumProtocolConfig)
```

**Parameters:**
- `config` (optional) - Configuration options
  - `version?: string` - Protocol version (default: '0.1')
  - `maxStorySegments?: number` - Maximum story segments (default: 200)

#### Methods

##### createStartTransaction(profile)

Creates a START transaction for user registration.

```typescript
const profile = {
  nickname: 'johndoe',
  avatar: 'base64_encoded_image' // optional
};

const tx = builder.createStartTransaction(profile);
```

##### createPostTransaction(content, chainRefs)

Creates a POST transaction.

```typescript
const tx = builder.createPostTransaction(
  'Hello world!',
  {
    prevTxId: 'previous_transaction_id',
    lastSubscribeId: 'last_subscribe_transaction_id'
  }
);
```

##### createStorySegments(content, chainRefs)

Creates STORY transaction segments for long-form content.

```typescript
const segments = builder.createStorySegments(
  'This is a very long story that will be split into multiple segments...',
  {
    prevTxId: 'previous_transaction_id',
    lastSubscribeId: 'last_subscribe_transaction_id'
  }
);

// Returns array of StorySegmentPayload objects
segments.forEach((segment, index) => {
  console.log(`Segment ${segment.params.segment}/${segment.params.total}`);
  console.log(`Content: ${segment.content}`);
  console.log(`Is final: ${segment.params.is_final}`);
});
```

##### createSubscribeTransaction(targetAddress, chainRefs)

Creates a SUBSCRIBE transaction.

```typescript
const tx = builder.createSubscribeTransaction(
  'kaspa:qr123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
  { prevTxId: 'previous_transaction_id' }
);
```

##### createUnsubscribeTransaction(targetAddress, chainRefs)

Creates an UNSUBSCRIBE transaction.

```typescript
const tx = builder.createUnsubscribeTransaction(
  'kaspa:qr123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
  {
    prevTxId: 'previous_transaction_id',
    lastSubscribeId: 'last_subscribe_transaction_id'
  }
);
```

##### createLikeTransaction(postId, chainRefs)

Creates a LIKE transaction.

```typescript
const tx = builder.createLikeTransaction(
  'post_transaction_id',
  {
    prevTxId: 'previous_transaction_id',
    lastSubscribeId: 'last_subscribe_transaction_id'
  }
);
```

##### createCommentTransaction(postId, content, chainRefs)

Creates a COMMENT transaction.

```typescript
const tx = builder.createCommentTransaction(
  'post_transaction_id',
  'This is my comment',
  {
    prevTxId: 'previous_transaction_id',
    lastSubscribeId: 'last_subscribe_transaction_id'
  }
);
```

### VerumPayloadValidator

Validates transaction payloads according to protocol rules.

#### Methods

##### validatePayload(payload)

Validates a complete transaction payload.

```typescript
const validator = new VerumPayloadValidator();
const result = validator.validatePayload(transaction);

if (!result.isValid) {
  result.errors.forEach(error => {
    console.log(`${error.field}: ${error.message} (${error.code})`);
  });
}
```

**Returns:**
```typescript
{
  isValid: boolean;
  errors: ValidationError[];
}
```

##### validateChainReferences(refs)

Validates chain reference objects.

```typescript
const result = validator.validateChainReferences({
  prevTxId: 'transaction_id',
  lastSubscribeId: 'subscribe_transaction_id'
});
```

### StoryChunker

Utility for splitting long content into story segments.

#### Constructor

```typescript
new StoryChunker(config?: StoryChunkerConfig)
```

**Parameters:**
- `config` (optional) - Configuration options
  - `maxSegmentSize?: number` - Maximum characters per segment (default: 400)
  - `minSegmentSize?: number` - Minimum characters per segment (default: 50)
  - `maxSegments?: number` - Maximum number of segments (default: 200)

#### Methods

##### splitIntoChunks(content)

Splits content into chunks that fit within protocol limits.

```typescript
const chunker = new StoryChunker();
const chunks = chunker.splitIntoChunks('Very long story content...');

chunks.forEach(chunk => {
  console.log(`Segment ${chunk.segment}/${chunk.total}: ${chunk.content}`);
});
```

##### calculateSegmentCount(content)

Calculates how many segments would be needed for the given content.

```typescript
const count = chunker.calculateSegmentCount('Content to analyze...');
console.log(`Would need ${count} segments`);
```

##### isWithinLimits(content)

Checks if content would fit within segment limits.

```typescript
const withinLimits = chunker.isWithinLimits('Content to check...');
if (!withinLimits) {
  console.log('Content is too long for the protocol limits');
}
```

## Constants

### Protocol Limits

```typescript
import { PROTOCOL_LIMITS } from '@verum/protocol';

PROTOCOL_LIMITS.MAX_PAYLOAD_SIZE;     // 1000 bytes
PROTOCOL_LIMITS.MAX_POST_LENGTH;      // 500 characters
PROTOCOL_LIMITS.MAX_COMMENT_LENGTH;   // 300 characters
PROTOCOL_LIMITS.MAX_NICKNAME_LENGTH;  // 50 characters
PROTOCOL_LIMITS.MAX_STORY_SEGMENTS;   // 200 segments
PROTOCOL_LIMITS.MAX_SEGMENT_SIZE;     // 400 characters
PROTOCOL_LIMITS.MIN_SEGMENT_SIZE;     // 50 characters
```

### Transaction Types

```typescript
import { TransactionType } from '@verum/protocol';

TransactionType.START;        // 'start'
TransactionType.POST;         // 'post'
TransactionType.STORY;        // 'story'
TransactionType.SUBSCRIBE;    // 'subscribe'
TransactionType.UNSUBSCRIBE;  // 'unsubscribe'
TransactionType.LIKE;         // 'like'
TransactionType.COMMENT;      // 'comment'
```

## Types

### TransactionPayload

```typescript
interface TransactionPayload {
  verum: string;              // Protocol version
  type: TransactionType;      // Transaction type
  content: string | null;     // Transaction content
  timestamp: number;          // Unix timestamp
  parent_id?: string;         // Parent transaction ID (for comments/likes)
  params?: Record<string, any>; // Additional parameters
  prev_tx_id?: string;        // Previous transaction by this user
  last_subscribe?: string;    // Last subscription by this user
}
```

### ChainReferences

```typescript
interface ChainReferences {
  prevTxId?: string;          // Previous Verum transaction by this user
  lastSubscribeId?: string;   // Last subscription transaction by this user
}
```

### UserProfile

```typescript
interface UserProfile {
  nickname: string;           // User's display name
  avatar?: string;           // Base64 encoded avatar image
}
```

### ValidationResult

```typescript
interface ValidationResult {
  isValid: boolean;           // Whether validation passed
  errors: ValidationError[];  // Array of validation errors
}
```

### ValidationError

```typescript
interface ValidationError {
  field: string;              // Field that failed validation
  message: string;           // Human-readable error message
  code: string;              // Machine-readable error code
}
```

## Error Codes

The validator returns specific error codes for different validation failures:

- `MISSING_VERSION` - Protocol version is required
- `MISSING_TYPE` - Transaction type is required
- `INVALID_TYPE` - Invalid transaction type
- `INVALID_TIMESTAMP` - Invalid or missing timestamp
- `TIMESTAMP_TOO_OLD` - Timestamp before protocol creation
- `TIMESTAMP_FUTURE` - Timestamp too far in future
- `PAYLOAD_TOO_LARGE` - Payload exceeds size limit
- `MISSING_CONTENT` - Required content is missing
- `EMPTY_CONTENT` - Content cannot be empty
- `CONTENT_TOO_LONG` - Content exceeds length limit
- `INVALID_ADDRESS` - Invalid Kaspa address format
- `MISSING_PARENT_ID` - Required parent ID is missing
- `INVALID_PARENT_ID` - Invalid parent transaction ID format

## Examples

### Creating a Complete User Flow

```typescript
import { 
  VerumTransactionBuilder, 
  VerumPayloadValidator,
  UserProfile,
  ChainReferences 
} from '@verum/protocol';

const builder = new VerumTransactionBuilder();
const validator = new VerumPayloadValidator();

// 1. User registration
const profile: UserProfile = {
  nickname: 'Alice',
  avatar: 'base64_encoded_avatar'
};

const startTx = builder.createStartTransaction(profile);
console.log('START transaction:', startTx);

// 2. Create a post
const chainRefs: ChainReferences = {
  prevTxId: startTx.timestamp.toString() // In real app, this would be the actual TX ID
};

const postTx = builder.createPostTransaction('Hello Verum!', chainRefs);
console.log('POST transaction:', postTx);

// 3. Create a long story
const storyContent = 'This is a very long story...'.repeat(20);
const storySegments = builder.createStorySegments(storyContent, {
  prevTxId: postTx.timestamp.toString()
});

console.log(`Story has ${storySegments.length} segments`);
storySegments.forEach(segment => {
  const validation = validator.validatePayload(segment);
  console.log(`Segment ${segment.params.segment} valid:`, validation.isValid);
});
```

### Advanced Story Chunking

```typescript
import { StoryChunker } from '@verum/protocol';

const chunker = new StoryChunker({
  maxSegmentSize: 300,  // Smaller segments
  maxSegments: 50       // Fewer total segments
});

const longStory = `
  Chapter 1: The Beginning
  
  It was a dark and stormy night when our hero first discovered the mysterious 
  protocol that would change everything. The Verum protocol promised to 
  revolutionize social media on the blockchain.
  
  Chapter 2: The Discovery
  
  As Alice dove deeper into the code, she realized that this wasn't just 
  another social platform - it was a complete paradigm shift toward 
  decentralized communication.
`.trim();

if (chunker.isWithinLimits(longStory)) {
  const chunks = chunker.splitIntoChunks(longStory);
  console.log(`Story split into ${chunks.length} segments:`);
  
  chunks.forEach(chunk => {
    console.log(`\n--- Segment ${chunk.segment} ---`);
    console.log(chunk.content);
    console.log(`Final: ${chunk.isFinal}`);
  });
} else {
  console.log('Story is too long for the configured limits');
}
```

## License

MIT

## Contributing

Contributions are welcome! Please ensure all tests pass and add tests for new features.

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build
```