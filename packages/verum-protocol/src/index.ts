/**
 * Verum Protocol
 * 
 * A TypeScript library for creating Verum protocol transactions on the Kaspa blockchain.
 * This package provides transaction builders, validators, and utilities for implementing
 * the Verum social protocol.
 */

// Export constants
export * from './constants';

// Export types
export * from './types';

// Export builders
export { VerumTransactionBuilder } from './builders/transaction-builder';

// Export validators
export { VerumPayloadValidator } from './validators/payload-validator';

// Export utilities
export { StoryChunker, StoryChunkerConfig } from './utils/story-chunker';

// Version info
import { VERUM_VERSION } from './constants';
export const version = VERUM_VERSION;