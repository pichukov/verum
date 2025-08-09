/**
 * Verum Index
 * 
 * A TypeScript library for fetching and indexing Verum protocol data from the Kaspa blockchain.
 * This package provides read-only operations for blockchain data aggregation and feed generation.
 */

// Export types
export * from './types';

// Export fetchers
export { 
  IBlockchainFetcher, 
  KaspaBlockchainFetcher, 
  KaspaApiConfig 
} from './fetchers/blockchain-fetcher';

export { 
  IUserFetcher, 
  UserFetcher 
} from './fetchers/user-fetcher';

// Export aggregators
export { 
  IFeedAggregator, 
  FeedAggregator 
} from './aggregators/feed-aggregator';

// Export utilities
export { 
  IStoryReconstructor, 
  StoryReconstructor 
} from './utils/story-reconstructor';

// Export services
export { EngagementService } from './services/engagement-service';

// Export main class for easy usage
export { VerumIndexer } from './verum-indexer';