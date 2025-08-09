import { Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownComponent } from 'ngx-markdown';
import { StoryService } from '../../../services/story.service';
import { UserService } from '../../../services/user.service';
import { LikeService } from '../../../services/like.service';
import { CommentService } from '../../../services/comment.service';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { Story, UserProfile } from '../../../types/transaction';

@Component({
  selector: 'app-story-post',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, MarkdownComponent],
  template: `
    <article class="story-post">
      <!-- Story Header -->
      <header class="story-header">
        <!-- Author Info -->
        <div class="author-info">
          <div class="author-avatar">
            @if (story().author?.avatar) {
              <img 
                [src]="getUserAvatarUrl(story().author)" 
                [alt]="story().author?.nickname"
                class="avatar-img">
            } @else {
              <div class="avatar-placeholder">
                <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
              </div>
            }
          </div>
          
          <div class="author-details">
            <h3 class="author-name">
              {{ story().author?.nickname || 'Anonymous' }}
            </h3>
            <p class="story-metadata">
              <fa-icon [icon]="['fas', 'book-open']" class="story-icon"></fa-icon>
              <span class="story-label">Story</span>
              <span class="metadata-separator">•</span>
              <span class="timestamp">{{ formatTimestamp(story().timestamp) }}</span>
              <span class="segment-info">
                <span class="metadata-separator">•</span>
                {{ story().segments.length }}
                @if (story().totalSegments && story().totalSegments! > story().segments.length) {
                  of {{ story().totalSegments }}
                }
                segment{{ (story().totalSegments || story().segments.length) === 1 ? '' : 's' }}
              </span>
            </p>
          </div>
        </div>
      </header>

      <!-- Story Content -->
      <div class="story-content">
        <div class="content-wrapper">
          @if (isExpanded() || story().segments.length === 1) {
            <!-- Show full content when expanded or single segment -->
            <markdown [data]="story().fullContent" class="story-markdown"></markdown>
            
            @if (story().isComplete && story().segments.length > 1) {
              <div class="story-complete-indicator">
                <fa-icon [icon]="['fas', 'check-circle']" class="complete-icon"></fa-icon>
                <span>Story Complete</span>
              </div>
            }
          } @else {
            <!-- Show preview when collapsed -->
            <markdown [data]="getPreviewContent()" class="story-markdown preview"></markdown>
            
            @if (story().fullContent.length > getPreviewContent().length) {
              <div class="preview-fade"></div>
            }
          }
        </div>

        <!-- Story Action Buttons (moved below content) -->
        <div class="story-actions">
          <!-- Show Expand button only when collapsed and there's more content to show -->
          @if (!isExpanded() && story().fullContent.length > getPreviewContent().length) {
            <button 
              type="button"
              class="action-btn expand-story-btn"
              (click)="expandStory()">
              <fa-icon [icon]="['fas', 'chevron-down']" class="btn-icon"></fa-icon>
              <span>Expand</span>
            </button>
          }
          
          <!-- Show Load More button when there are more segments to load -->
          @if (canLoadMore()) {
            <button 
              type="button"
              class="action-btn load-more-btn"
              (click)="loadMoreSegments()"
              [disabled]="isLoading()">
              @if (isLoading()) {
                <fa-icon [icon]="['fas', 'spinner']" class="btn-icon loading-icon"></fa-icon>
                <span>Loading...</span>
              } @else {
                <fa-icon [icon]="['fas', 'chevron-down']" class="btn-icon"></fa-icon>
                <span>Load More</span>
              }
            </button>
          }
          
          <!-- Show Collapse button when expanded and there are multiple segments or long content -->
          @if (isExpanded() && (story().segments.length > 1 || story().fullContent.length > getPreviewContent().length)) {
            <button 
              type="button"
              class="action-btn collapse-btn"
              (click)="collapseStory()">
              <fa-icon [icon]="['fas', 'chevron-up']" class="btn-icon"></fa-icon>
              <span>Collapse</span>
            </button>
          }
        </div>
      </div>

      <!-- Loading Indicator -->
      @if (isLoading()) {
        <div class="loading-indicator">
          <fa-icon [icon]="['fas', 'spinner']" class="loading-icon"></fa-icon>
          <span>Loading next segment...</span>
        </div>
      }

      <!-- Error Message -->
      @if (errorMessage()) {
        <div class="error-message">
          <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
          <span>{{ errorMessage() }}</span>
        </div>
      }

      <!-- Separator -->
      <div class="post-separator"></div>

      <!-- Interaction bar -->
      <div class="interaction-bar">
        <!-- Comment button -->
        <button 
          class="interaction-btn comment-btn"
          (click)="onCommentClick()"
          [title]="commentTooltip()">
          <fa-icon [icon]="['fas', 'comment']" class="interaction-icon"></fa-icon>
          <span>Comment</span>
          @if (story().commentCount && story().commentCount! > 0) {
            <span class="interaction-count">
              ({{ story().commentCount }})
            </span>
          }
          @if (commentFee()) {
            <span class="fee-hint">
              {{ commentFee() }}
            </span>
          }
        </button>

        <!-- Like button -->
        <button 
          class="interaction-btn like-btn"
          [class.liked]="isLiked()"
          [class.loading]="isLiking()"
          (click)="onLikeClick()"
          [disabled]="isLiked() || isLiking()"
          [title]="isLiked() ? 'You liked this story' : likeTooltip()">
          <fa-icon 
            [icon]="isLiked() ? ['fas', 'heart'] : ['far', 'heart']" 
            class="interaction-icon like-icon">
          </fa-icon>
          <span class="like-text">
            {{ likeCount() > 0 ? likeCount() + ' Likes' : 'Like' }}
          </span>
          @if (likeFee() && !isLiked() && !isLiking()) {
            <span class="fee-hint">
              {{ likeFee() }}
            </span>
          }
          @if (isLiking()) {
            <span class="loading-text">
              Liking...
            </span>
          }
        </button>
      </div>
    </article>
  `,
  styles: [`
    .story-post {
      @apply bg-white dark:bg-black-800 border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small mb-6;
    }

    /* Story Header */
    .story-header {
      @apply p-6 pb-4;
    }

    .author-info {
      @apply flex space-x-3;
    }

    .author-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-12 h-12 rounded-full object-cover;
      @apply border border-white-300 dark:border-black-600;
    }

    .avatar-placeholder {
      @apply w-12 h-12 rounded-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border border-white-300 dark:border-black-600;
    }

    .placeholder-icon {
      @apply text-black-400 dark:text-white-400;
    }

    .author-details {
      @apply flex-1 min-w-0;
    }

    .author-name {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
      @apply truncate;
    }

    .story-metadata {
      @apply flex items-center text-sm text-black-500 dark:text-white-400;
      @apply mt-1 flex-wrap;
    }

    .story-icon {
      @apply text-purple-600 dark:text-purple-400;
      @apply mr-2;
    }

    .story-label {
      @apply text-purple-600 dark:text-purple-400 font-medium;
      @apply mr-2;
    }

    /* Cyberpunk theme overrides for story metadata */
    :host-context(.cyberpunk-theme) .story-icon {
      @apply text-neon-magenta;
      filter: drop-shadow(0 0 3px rgba(255, 0, 255, 0.6));
    }

    :host-context(.cyberpunk-theme) .story-label {
      @apply text-neon-magenta font-tech;
    }

    .metadata-separator {
      @apply text-black-300 dark:text-white-400;
      @apply mx-2;
    }

    .timestamp {
      @apply text-black-500 dark:text-white-400;
    }

    .segment-info {
      @apply text-black-400 dark:text-white-400;
    }

    /* Story Content */
    .story-content {
      @apply px-6 pb-4;
    }

    .content-wrapper {
      @apply relative;
    }

    .story-markdown {
      @apply text-base leading-relaxed max-w-none;
      @apply text-black-900 dark:text-white-100;
      @apply mb-4;
    }

    .story-markdown.preview {
      @apply max-h-40 overflow-hidden;
      @apply mb-2;
    }

    .preview-fade {
      @apply absolute bottom-0 left-0 right-0;
      @apply h-12 bg-gradient-to-t from-white dark:from-black-800 to-transparent;
      @apply pointer-events-none;
    }

    .story-complete-indicator {
      @apply flex items-center space-x-2 mt-4 pt-4;
      @apply border-t border-white-200 dark:border-black-700;
      @apply text-sm text-purple-600 dark:text-purple-400 font-medium;
    }

    .complete-icon {
      @apply text-purple-600 dark:text-purple-400;
    }

    /* Cyberpunk theme overrides for story complete indicator */
    :host-context(.cyberpunk-theme) .story-complete-indicator {
      @apply text-neon-magenta;
      border-top: 1px solid rgba(255, 0, 255, 0.3);
    }

    :host-context(.cyberpunk-theme) .complete-icon {
      @apply text-neon-magenta;
      filter: drop-shadow(0 0 5px rgba(255, 0, 255, 0.6));
    }

    /* Story Actions (moved below content) */
    .story-actions {
      @apply flex items-center gap-3 mt-4 pt-4;
      @apply border-t border-white-100 dark:border-black-700;
    }

    .action-btn {
      @apply flex items-center gap-2 px-4 py-2;
      @apply text-sm font-medium;
      @apply text-kaspa-600 dark:text-kaspa-400;
      @apply bg-kaspa-50 dark:bg-kaspa-900/10;
      @apply border border-kaspa-200 dark:border-kaspa-700;
      @apply rounded-lg;
      @apply hover:bg-kaspa-100 dark:hover:bg-kaspa-900/20;
      @apply hover:border-kaspa-300 dark:hover:border-kaspa-600;
      @apply transition-all duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      @apply disabled:hover:bg-kaspa-50 dark:disabled:hover:bg-kaspa-900/10;
      @apply disabled:hover:border-kaspa-200 dark:disabled:hover:border-kaspa-700;
    }

    .action-btn:hover {
      @apply shadow-sm;
    }

    /* Cyberpunk theme overrides for action buttons */
    :host-context(.cyberpunk-theme) .action-btn {
      @apply bg-cyber-dark-3 border border-neon-magenta/30;
      @apply text-neon-magenta;
      
      &:hover:not(:disabled) {
        @apply bg-cyber-dark-2 border-neon-magenta;
        box-shadow: 0 0 10px rgba(255, 0, 255, 0.3);
      }
    }

    .btn-icon {
      @apply text-sm;
    }

    .loading-icon {
      @apply animate-spin;
    }

    /* Loading Indicator */
    .loading-indicator {
      @apply flex items-center justify-center gap-2 py-4;
      @apply text-sm text-black-500 dark:text-white-400;
    }

    /* Cyberpunk theme overrides for loading indicator */
    :host-context(.cyberpunk-theme) .loading-indicator {
      @apply text-neon-cyan;
      
      .loading-icon {
        filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.8));
        animation: cyber-spin 1s linear infinite, cyber-pulse-small 1.5s ease-in-out infinite alternate;
      }
      
      span {
        @apply font-tech;
        text-shadow: 0 0 8px rgba(0, 255, 255, 0.6);
        animation: cyber-text-flicker-subtle 2s ease-in-out infinite;
      }
    }

    @keyframes cyber-pulse-small {
      0% { filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.8)); }
      100% { filter: drop-shadow(0 0 10px rgba(0, 255, 255, 1)); }
    }

    @keyframes cyber-text-flicker-subtle {
      0%, 100% { opacity: 1; text-shadow: 0 0 8px rgba(0, 255, 255, 0.6); }
      50% { opacity: 0.9; text-shadow: 0 0 12px rgba(0, 255, 255, 0.8); }
    }

    @keyframes cyber-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Error Message */
    .error-message {
      @apply flex items-center space-x-2 px-6 py-3;
      @apply text-sm text-red-600 dark:text-red-400;
      @apply bg-red-50 dark:bg-red-900/20;
      @apply border-t border-red-200 dark:border-red-700;
    }

    .error-icon {
      @apply text-red-600 dark:text-red-400;
    }


    /* Mobile responsive */
    @media (max-width: 640px) {
      .story-header {
        @apply p-4 pb-3;
      }

      .story-content {
        @apply px-4 pb-3;
      }


      .author-name {
        @apply text-base;
      }

      .story-actions {
        @apply flex-col gap-2;
      }

      .action-btn {
        @apply w-full justify-center;
      }

      .story-metadata {
        @apply text-xs;
      }
    }
    
    /* Separator (matching post card) */
    .post-separator {
      @apply border-t border-white-100 dark:border-black-700 mx-6;
    }
    
    /* Cyberpunk separator with neon line */
    :host-context(.cyberpunk-theme) .post-separator {
      @apply border-t border-neon-cyan/30;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: stat-line-glow 2s ease-in-out infinite alternate;
      }
    }

    @keyframes stat-line-glow {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    /* Interaction bar (matching post card) */
    .interaction-bar {
      @apply flex justify-between items-center px-6 py-4;
    }

    .interaction-btn {
      @apply flex items-center space-x-2 text-black-600 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200 text-sm font-medium;
    }
    
    /* Cyberpunk interaction button */
    :host-context(.cyberpunk-theme) .interaction-btn {
      @apply text-cyber-gray-5 hover:text-neon-cyan font-tech;
      transition: all 0.3s ease;
      
      &:hover {
        text-shadow: 0 0 5px rgba(0, 255, 255, 0.6);
      }
    }

    .interaction-icon {
      @apply text-base;
    }

    .interaction-count {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .like-btn.liked {
      @apply text-red-500 dark:text-red-400;
    }

    .like-btn.liked:hover {
      @apply text-red-600 dark:text-red-300;
    }

    .like-btn:disabled {
      @apply opacity-60 cursor-not-allowed;
    }

    .like-btn.loading {
      @apply animate-pulse;
    }

    .like-icon {
      @apply transition-colors duration-200;
    }

    .like-text {
      @apply transition-colors duration-200;
    }

    .loading-text {
      @apply text-xs text-black-400 dark:text-white-400 animate-pulse;
    }

    .fee-hint {
      @apply text-xs text-black-400 dark:text-white-400 ml-1;
      @apply bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded;
      @apply font-mono;
    }
  `]
})
export class StoryPostComponent implements OnInit {
  private storyService = inject(StoryService);
  private userService = inject(UserService);
  private likeService = inject(LikeService);
  private commentService = inject(CommentService);
  private feeCalculationService = inject(FeeCalculationService);

  // Inputs
  public story = input.required<Story>();

  // Outputs
  public storyUpdated = output<Story>();
  public storyError = output<string>();
  public commentClicked = output<string>(); // story ID (firstSegmentId)

  // State
  public isLoading = signal(false);
  public errorMessage = signal('');
  public isExpanded = signal(false);
  
  // Fee information
  public likeFee = signal<string>('');
  public commentFee = signal<string>('');
  public likeTooltip = signal<string>('Like this story');
  public commentTooltip = signal<string>('Add a comment');

  // Computed values
  public canLoadMore = computed(() => {
    const currentStory = this.story();
    return !currentStory.isComplete && 
           currentStory.segments.length < (currentStory.totalSegments || Infinity) &&
           !this.isLoading();
  });
  
  // Like state - using first segment ID for likes/comments
  public likeCount = computed(() => this.likeService.getLikeCount(this.story().firstSegmentId));
  public isLiked = computed(() => this.likeService.hasUserLikedPost(this.story().firstSegmentId));
  public isLiking = computed(() => this.likeService.isCreating());

  /**
   * Get preview content (first segment or truncated content)
   */
  getPreviewContent(): string {
    const story = this.story();
    
    if (story.segments.length === 1 && !story.isComplete) {
      // Show first segment content if it's the only one we have
      return story.segments[0].content;
    }
    
    // Show truncated version of full content
    const fullContent = story.fullContent;
    const maxPreviewLength = 300; // characters
    
    if (fullContent.length <= maxPreviewLength) {
      return fullContent;
    }
    
    // Find a good break point
    const truncated = fullContent.substring(0, maxPreviewLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const breakPoint = Math.max(lastSpace, lastNewline);
    if (breakPoint > maxPreviewLength * 0.8) {
      return fullContent.substring(0, breakPoint) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Load more segments of the story
   */
  async loadMoreSegments(): Promise<void> {
    if (!this.canLoadMore() || this.isLoading()) return;

    try {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const updatedStory = await this.storyService.loadNextSegment(this.story()).toPromise();
      
      if (updatedStory) {
        // Automatically expand the story to show the new content
        this.isExpanded.set(true);
        this.storyUpdated.emit(updatedStory);
      }

    } catch (error: any) {
      const errorMsg = error.message || 'Failed to load next segment';
      this.errorMessage.set(errorMsg);
      this.storyError.emit(errorMsg);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Expand story to show all loaded content
   */
  expandStory(): void {
    this.isExpanded.set(true);
  }

  /**
   * Collapse story to show preview
   */
  collapseStory(): void {
    this.isExpanded.set(false);
  }
  
  ngOnInit() {
    this.loadFeeInfo();
    this.loadLikesAndComments();
  }
  
  private loadLikesAndComments() {
    // Load likes and comments for the first segment of the story
    this.likeService.loadLikesForPost(this.story().firstSegmentId, this.story().authorAddress);
    this.commentService.loadCommentsForPost(this.story().firstSegmentId, this.story().authorAddress);
  }
  
  private loadFeeInfo() {
    // Load like payment amount
    this.feeCalculationService.calculateActionAmount('like').subscribe(kasAmount => {
      this.likeFee.set(this.feeCalculationService.formatKasAmount(kasAmount));
      this.likeTooltip.set(`Like this story (Send ${this.likeFee()} to author)`);
    });
    
    // Load comment payment amount
    this.feeCalculationService.calculateActionAmount('comment').subscribe(kasAmount => {
      this.commentFee.set(this.feeCalculationService.formatKasAmount(kasAmount));
      this.commentTooltip.set(`Add a comment (Send ${this.commentFee()} to author)`);
    });
  }

  /**
   * Handle like click
   */
  async onLikeClick(): Promise<void> {
    if (this.isLiked() || this.isLiking()) {
      return;
    }
    
    try {
      await this.likeService.createLike({
        postId: this.story().firstSegmentId, // Use first segment ID for likes
        postAuthorAddress: this.story().authorAddress
      });
    } catch (error) {
      console.error('Failed to like story:', error);
    }
  }

  /**
   * Handle comment click
   */
  onCommentClick(): void {
    // Emit comment clicked event with the first segment ID (used for comments)
    this.commentClicked.emit(this.story().firstSegmentId);
  }

  /**
   * Get user avatar URL
   */
  getUserAvatarUrl(profile: UserProfile | undefined): string {
    if (!profile?.avatar) return '';
    
    // Check if it's already a data URL
    if (profile.avatar.startsWith('data:')) {
      return profile.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${profile.avatar}`;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const minutes = Math.floor(diffInMs / (1000 * 60));
      return `${minutes}m ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours}h ago`;
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24);
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}