/**
 * Verum Transaction Builder
 * 
 * Creates properly formatted transaction payloads for all Verum protocol operations
 */

import { 
  TransactionType, 
  VERUM_VERSION, 
  PROTOCOL_LIMITS 
} from '../constants';
import { 
  TransactionPayload, 
  ChainReferences, 
  UserProfile,
  StorySegmentPayload,
  VerumProtocolConfig 
} from '../types';
import { StoryChunker } from '../utils/story-chunker';

export class VerumTransactionBuilder {
  private readonly version: string;
  private readonly storyChunker: StoryChunker;

  constructor(config: VerumProtocolConfig = {}) {
    this.version = config.version || VERUM_VERSION;
    this.storyChunker = new StoryChunker({
      maxSegmentSize: PROTOCOL_LIMITS.MAX_SEGMENT_SIZE,
      minSegmentSize: PROTOCOL_LIMITS.MIN_SEGMENT_SIZE,
      maxSegments: config.maxStorySegments || PROTOCOL_LIMITS.MAX_STORY_SEGMENTS
    });
  }

  /**
   * Create a START transaction for user registration
   */
  createStartTransaction(profile: UserProfile): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.START,
      content: JSON.stringify({
        nickname: profile.nickname.trim(),
        avatar: profile.avatar
      }),
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Create a POST transaction
   */
  createPostTransaction(
    content: string,
    chainRefs: ChainReferences
  ): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.POST,
      content: content.trim(),
      timestamp: Math.floor(Date.now() / 1000),
      prev_tx_id: chainRefs.prevTxId,
      last_subscribe: chainRefs.lastSubscribeId
    };
  }

  /**
   * Create STORY transaction segments
   */
  createStorySegments(
    content: string,
    chainRefs: ChainReferences
  ): StorySegmentPayload[] {
    const chunks = this.storyChunker.splitIntoChunks(content);
    
    return chunks.map((chunk, index) => {
      const payload: StorySegmentPayload = {
        verum: this.version,
        type: TransactionType.STORY,
        content: chunk.content,
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          segment: chunk.segment,
          total: chunk.total,
          is_final: chunk.isFinal
        }
      };

      // Add chain references to first segment only
      if (index === 0) {
        payload.prev_tx_id = chainRefs.prevTxId;
        payload.last_subscribe = chainRefs.lastSubscribeId;
      } else {
        // Parent ID will be set by the SDK after previous segment is sent
        payload.parent_id = undefined;
      }

      return payload;
    });
  }

  /**
   * Create a SUBSCRIBE transaction
   */
  createSubscribeTransaction(
    targetAddress: string,
    chainRefs: ChainReferences
  ): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.SUBSCRIBE,
      content: targetAddress.trim(),
      timestamp: Math.floor(Date.now() / 1000),
      prev_tx_id: chainRefs.prevTxId,
      last_subscribe: undefined // This will become the new last_subscribe
    };
  }

  /**
   * Create an UNSUBSCRIBE transaction
   */
  createUnsubscribeTransaction(
    targetAddress: string,
    chainRefs: ChainReferences
  ): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.UNSUBSCRIBE,
      content: targetAddress.trim(),
      timestamp: Math.floor(Date.now() / 1000),
      prev_tx_id: chainRefs.prevTxId,
      last_subscribe: chainRefs.lastSubscribeId
    };
  }

  /**
   * Create a LIKE transaction
   */
  createLikeTransaction(
    postId: string,
    chainRefs: ChainReferences
  ): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.LIKE,
      content: null,
      parent_id: postId,
      timestamp: Math.floor(Date.now() / 1000),
      prev_tx_id: chainRefs.prevTxId,
      last_subscribe: chainRefs.lastSubscribeId
    };
  }

  /**
   * Create a COMMENT transaction
   */
  createCommentTransaction(
    postId: string,
    content: string,
    chainRefs: ChainReferences
  ): TransactionPayload {
    return {
      verum: this.version,
      type: TransactionType.COMMENT,
      content: content.trim(),
      parent_id: postId,
      timestamp: Math.floor(Date.now() / 1000),
      prev_tx_id: chainRefs.prevTxId,
      last_subscribe: chainRefs.lastSubscribeId
    };
  }

  /**
   * Calculate the size of a payload in bytes
   */
  calculatePayloadSize(payload: TransactionPayload): number {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  }

  /**
   * Get the current protocol version
   */
  getVersion(): string {
    return this.version;
  }
}