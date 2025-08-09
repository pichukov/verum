/**
 * Verum SDK
 * 
 * A comprehensive TypeScript SDK for building applications on the Verum social protocol.
 * Combines transaction creation (verum-protocol) and blockchain indexing (verum-index)
 * into a unified, high-level interface.
 */

// Export main SDK class
export { VerumSDK } from './verum-sdk';

// Export all types
export * from './types';

// Export wallet components
export {
  BaseWalletAdapter,
  KaswareWalletAdapter,
  MockWalletAdapter,
  WalletFactory,
  WalletManager
} from './wallet/wallet-adapter';

// Export operation classes for advanced usage
export { UserOperations } from './operations/user-operations';
export { ContentOperations } from './operations/content-operations';
export { StoryOperations } from './operations/story-operations';

// Export managers
export { FeedManager } from './managers/feed-manager';

// Export services
export { TransactionConfirmationService } from './services/transaction-confirmation';

// Re-export core protocol and index functionality
export * from '@verum/protocol';
export * from '@verum/index';

// Version info
export const SDK_VERSION = '0.1.0';