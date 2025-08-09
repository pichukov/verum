import { Component, inject, input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommentService, Comment } from '../../../services/comment.service';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';
import { ToastService } from '../../../services/toast.service';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-comment-list',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, MarkdownComponent],
  template: `
    <div class="comment-list">
      <!-- Loading State -->
      @if (commentService.isLoading()) {
        <div class="loading-state">
          <fa-icon [icon]="['fas', 'circle-notch']" class="loading-icon fa-spin"></fa-icon>
          <span class="loading-text">Loading comments...</span>
        </div>
      }

      <!-- Empty State -->
      @if (!commentService.isLoading() && comments.length === 0) {
        <div class="empty-state">
          <fa-icon [icon]="['fas', 'comment']" class="empty-icon"></fa-icon>
          <p class="empty-text">No comments yet. Be the first to share your thoughts!</p>
        </div>
      }

      <!-- Comments List -->
      @if (!commentService.isLoading() && comments.length > 0) {
        <div class="comments-container">
        @for (comment of comments; track trackByCommentId($index, comment)) {
          <div class="comment-item">
          
          <!-- Comment Header -->
          <div class="comment-header">
            <!-- Author Info -->
            <div class="comment-author">
              <!-- Avatar -->
              <div class="comment-avatar">
                @if (comment.author.avatar) {
                  <img 
                    [src]="getAvatarUrl(comment.author.avatar)" 
                    [alt]="comment.author.nickname"
                    class="avatar-img">
                } @else {
                  <div class="avatar-placeholder">
                    <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                  </div>
                }
              </div>
              
              <!-- Author Details -->
              <div class="author-info">
                <div class="author-name-row">
                  <h4 class="author-name">{{ comment.author.nickname }}</h4>
                  <!-- Author Badge -->
                  @if (comment.isAuthor) {
                    <div class="author-badge">
                      <fa-icon [icon]="['fas', 'user-check']" class="badge-icon"></fa-icon>
                      <span class="badge-text">Author</span>
                    </div>
                  }
                </div>
                @if (comment.author.bio) {
                  <p class="author-bio">{{ comment.author.bio }}</p>
                }
                <div class="author-address-row">
                  <span class="author-address">{{ formatAddress(comment.author.address) }}</span>
                  <button 
                    class="copy-address-btn"
                    (click)="copyAddress(comment.author.address)"
                    title="Copy address">
                    <fa-icon [icon]="['fas', 'copy']" class="copy-icon"></fa-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- Comment Date (Desktop only) -->
            <div class="comment-date hidden md:block">
              <span class="date-text">{{ formatDate(comment.timestamp) }}</span>
            </div>
          </div>

          <!-- Comment Content -->
          <div class="comment-content">
            <markdown class="comment-text" [data]="comment.content"></markdown>
          </div>

          <!-- Comment Actions -->
          <div class="comment-actions">
            <!-- Mobile: Show date here, Desktop: already shown in header -->
            <div class="mobile-date md:hidden">
              <span class="date-text">{{ formatDate(comment.timestamp) }}</span>
            </div>
          </div>
        </div>
        }
        </div>
      }
    </div>
  `,
  styles: [`
    .comment-list {
      @apply space-y-4 p-6;
    }

    /* Loading State */
    .loading-state {
      @apply flex items-center justify-center space-x-3 py-8;
      @apply text-gray-500 dark:text-white-400;
    }

    .loading-icon {
      @apply text-xl;
    }

    .loading-text {
      @apply text-sm;
    }

    /* Empty State */
    .empty-state {
      @apply text-center py-8 space-y-3;
    }

    .empty-icon {
      @apply text-4xl text-gray-300 dark:text-white-400 mb-3;
    }

    .empty-text {
      @apply text-gray-500 dark:text-white-400 text-sm;
    }

    /* Comments Container */
    .comments-container {
      @apply space-y-4;
    }

    .comment-item {
      @apply bg-gray-100 dark:bg-black-700 rounded-lg;
      @apply px-6 pt-4 pb-2 space-y-2;
    }

    /* Comment Header */
    .comment-header {
      @apply flex items-start justify-between;
    }

    .comment-author {
      @apply flex items-start space-x-3;
    }

    /* Avatar */
    .comment-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-10 h-10 rounded-full object-cover;
      @apply border-2 border-white dark:border-black-800;
    }

    .avatar-placeholder {
      @apply w-10 h-10 rounded-full;
      @apply bg-gradient-to-br from-gray-200 to-gray-300;
      @apply dark:from-black-600 dark:to-black-500;
      @apply flex items-center justify-center;
      @apply border-2 border-white dark:border-black-800;
    }

    .placeholder-icon {
      @apply text-base text-gray-400 dark:text-white-400;
    }

    /* Author Info */
    .author-info {
      @apply flex-1 min-w-0;
    }

    .author-name-row {
      @apply flex items-center space-x-2 mb-1;
    }

    .author-name {
      @apply text-sm font-medium text-black-900 dark:text-white-100;
      @apply truncate;
    }

    /* Author Badge */
    .author-badge {
      @apply flex items-center space-x-1 px-2 py-1;
      @apply bg-kaspa-600 text-white rounded-full;
      @apply text-xs font-medium;
    }

    .badge-icon {
      @apply text-xs;
    }

    .badge-text {
      @apply text-xs;
    }

    .author-bio {
      @apply text-xs text-gray-600 dark:text-white-300 mb-1;
      @apply truncate;
    }

    .author-address-row {
      @apply flex items-center space-x-2;
    }

    .author-address {
      @apply text-xs font-mono text-gray-500 dark:text-white-400;
      @apply truncate flex-1;
    }

    .copy-address-btn {
      @apply text-gray-400 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200 p-1 rounded;
      @apply hover:bg-gray-50 dark:hover:bg-gray-700;
      @apply flex-shrink-0;
    }

    .copy-icon {
      @apply text-xs;
    }

    /* Cyberpunk theme overrides for copy button */
    :host-context(.cyberpunk-theme) .copy-address-btn {
      @apply text-cyber-gray-5 hover:text-neon-cyan;
      transition: all 0.3s ease;
      
      &:hover {
        text-shadow: 0 0 5px rgba(0, 255, 255, 0.6);
        background: rgba(0, 255, 255, 0.1);
      }
    }

    :host-context(.cyberpunk-theme) .copy-icon {
      filter: drop-shadow(0 0 2px rgba(0, 255, 255, 0.3));
      
      &:hover {
        filter: drop-shadow(0 0 4px rgba(0, 255, 255, 0.8));
      }
    }

    /* Comment Date */
    .comment-date {
      @apply flex-shrink-0;
    }

    .date-text {
      @apply text-xs text-gray-500 dark:text-white-400;
    }

    /* Comment Content */
    .comment-content {
      @apply w-full; /* Full width content, no left margin */
    }

    .comment-text {
      @apply text-sm text-black-700 dark:text-white-100;
      @apply leading-7 whitespace-pre-wrap;
    }

    /* Comment Actions */
    .comment-actions {
      @apply flex justify-end w-full; /* Full width actions, right aligned */
    }


    /* Cyberpunk theme overrides */
    :host-context(.cyberpunk-theme) .author-badge {
      background: linear-gradient(45deg, #00ffff, #ff00ff);
      border: 1px solid #00ffff;
      color: #000;
      font-weight: 600;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
      box-shadow: 
        0 0 10px rgba(0, 255, 255, 0.3),
        inset 0 0 10px rgba(255, 0, 255, 0.2);
      animation: neon-pulse 2s ease-in-out infinite alternate;
    }

    :host-context(.cyberpunk-theme) .badge-icon {
      filter: drop-shadow(0 0 3px rgba(0, 255, 255, 0.8));
    }

    :host-context(.cyberpunk-theme) .badge-text {
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.8);
    }

    @keyframes neon-pulse {
      0% {
        box-shadow: 
          0 0 10px rgba(0, 255, 255, 0.3),
          inset 0 0 10px rgba(255, 0, 255, 0.2);
      }
      100% {
        box-shadow: 
          0 0 20px rgba(0, 255, 255, 0.6),
          inset 0 0 15px rgba(255, 0, 255, 0.4);
      }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .comment-list {
        @apply p-4;
      }

      .comment-item {
        @apply px-4 pt-3 pb-4;
      }

      .comment-author {
        @apply space-x-2;
      }

      .avatar-img,
      .avatar-placeholder {
        @apply w-8 h-8;
      }

      .placeholder-icon {
        @apply text-sm;
      }

      .author-name {
        @apply text-xs;
      }

      .author-bio,
      .author-address,
      .date-text {
        @apply text-xs;
      }

      /* Mobile layout shows date at bottom */
      .comment-actions {
        @apply flex-row justify-start items-center;
        @apply pt-4 border-t border-gray-200 dark:border-black-600;
      }
    }
  `]
})
export class CommentListComponent implements OnInit {
  public commentService = inject(CommentService);
  private walletService = inject(KaswareWalletService);
  private toastService = inject(ToastService);

  // Inputs
  public postId = input.required<string>();
  public postAuthorAddress = input.required<string>();

  // State
  public get comments(): Comment[] {
    return this.commentService.getCommentsForPost(this.postId());
  }

  ngOnInit(): void {
    // Load comments for this post
    this.loadComments();
  }

  /**
   * Load comments for the post
   */
  async loadComments(): Promise<void> {
    try {
      await this.commentService.loadCommentsForPost(this.postId(), this.postAuthorAddress());
    } catch (error) {
      // Failed to load comments
    }
  }

  /**
   * Track by function for comment list
   */
  trackByCommentId(index: number, comment: Comment): string {
    return comment.id;
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    return this.walletService.formatAddress(address, 6);
  }

  /**
   * Copy address to clipboard
   */
  async copyAddress(address: string): Promise<void> {
    console.log('Copy button clicked for address:', address);
    try {
      await navigator.clipboard.writeText(address);
      this.toastService.success('Address copied to clipboard', 'Copied');
      console.log('Address copied successfully');
    } catch (error) {
      console.error('Failed to copy address:', error);
      this.toastService.error('Failed to copy address', 'Copy Failed');
    }
  }

  /**
   * Format date for display
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffMinutes < 1440) { // 24 hours
      return `${Math.floor(diffMinutes / 60)}h ago`;
    } else if (diffMinutes < 10080) { // 7 days
      return `${Math.floor(diffMinutes / 1440)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Get avatar URL for display
   */
  getAvatarUrl(avatar: string): string {
    if (avatar.startsWith('data:')) {
      return avatar;
    }
    return `data:image/png;base64,${avatar}`;
  }
}