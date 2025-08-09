import { Component, inject, input, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CommentService } from '../../../services/comment.service';
import { PostService } from '../../../services/post.service';
import { ToastService } from '../../../services/toast.service';
import { CommentInputComponent } from '../comment-input/comment-input.component';
import { CommentListComponent } from '../comment-list/comment-list.component';
import { Post } from '../post-card/post-card.component';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-expanded-post',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, CommentInputComponent, CommentListComponent, MarkdownComponent],
  template: `
    <div class="expanded-post">
      <!-- Post Header -->
      <div class="post-header">
        <div class="author-info">
          <!-- Avatar -->
          <div class="author-avatar">
            @if (post().author.avatar) {
              <img 
                [src]="getAuthorAvatarUrl()" 
                [alt]="post().author.nickname"
                class="avatar-img">
            } @else {
              <div class="avatar-placeholder">
                <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
              </div>
            }
          </div>

          <!-- Author details -->
          <div class="author-details">
            <div class="author-name">{{ post().author.nickname }}</div>
            @if (post().author.bio) {
              <div class="author-bio">{{ post().author.bio }}</div>
            }
            <div class="author-address-row">
              <span class="author-address">{{ formatAddress(post().author.address) }}</span>
              <button 
                class="copy-address-btn"
                (click)="copyAddress(post().author.address)"
                title="Copy address">
                <fa-icon [icon]="['fas', 'copy']" class="copy-icon"></fa-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="post-actions">
          <div class="post-timestamp">{{ formatTimestamp(post().timestamp) }}</div>
          <button class="more-btn">
            <fa-icon [icon]="['fas', 'ellipsis-h']"></fa-icon>
          </button>
        </div>
      </div>

      <!-- Separator -->
      <div class="post-separator"></div>

      <!-- Post Content -->
      <div class="post-content">
        <markdown class="content-text" [data]="post().content"></markdown>
      </div>

      <!-- Interaction bar -->
      <div class="interaction-bar">
        <!-- Comment info -->
        <div class="comment-info">
          <fa-icon [icon]="['fas', 'comment']" class="comment-icon"></fa-icon>
          <span class="comment-text">
            {{ commentCount() }} {{ commentCount() === 1 ? 'Comment' : 'Comments' }}
          </span>
        </div>

        <!-- Like button -->
        <button 
          class="like-btn"
          [class.liked]="post().isLiked">
          <fa-icon 
            [icon]="post().isLiked ? ['fas', 'heart'] : ['far', 'heart']" 
            class="like-icon">
          </fa-icon>
          <span class="like-text">
            {{ post().likes && post().likes! > 0 ? post().likes + ' Likes' : 'Like' }}
          </span>
        </button>
      </div>

      <!-- Comments Section -->
      <div class="comments-section">
        <!-- Comment Input -->
        <app-comment-input 
          [postId]="post().id"
          [postAuthorAddress]="post().author.address"
          (commentAdded)="onCommentAdded()">
        </app-comment-input>

        <!-- Comment List -->
        <app-comment-list 
          [postId]="post().id"
          [postAuthorAddress]="post().author.address">
        </app-comment-list>
      </div>
    </div>
  `,
  styles: [`
    .expanded-post {
      @apply bg-white dark:bg-black-800 border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small;
    }

    /* Header */
    .post-header {
      @apply flex justify-between items-start p-6 pb-4;
    }

    .author-info {
      @apply flex space-x-4 flex-1;
    }

    .author-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-14 h-14 rounded-full object-cover;
      @apply border border-white-300 dark:border-black-600;
    }

    .avatar-placeholder {
      @apply w-14 h-14 rounded-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border border-white-300 dark:border-black-600;
    }

    .placeholder-icon {
      @apply text-xl text-black-400 dark:text-white-400;
    }

    .author-details {
      @apply flex-1 min-w-0;
    }

    .author-name {
      @apply text-sm font-medium text-black-900 dark:text-white-100;
      @apply truncate;
    }

    .author-bio {
      @apply text-xs text-black-600 dark:text-white-400;
      @apply truncate mt-1;
    }

    .author-address-row {
      @apply flex items-center space-x-2 mt-1;
    }

    .author-address {
      @apply text-xs text-black-500 dark:text-white-400 font-mono;
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

    .post-actions {
      @apply flex flex-col items-end space-y-1;
    }

    .post-timestamp {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .more-btn {
      @apply text-black-400 dark:text-white-400;
      @apply hover:text-black-600 dark:hover:text-white-300;
      @apply transition-colors duration-200 p-1;
    }

    /* Separator */
    .post-separator {
      @apply border-t border-white-100 dark:border-black-700 mx-6;
    }

    /* Content */
    .post-content {
      @apply px-6 py-4;
    }

    .content-text {
      @apply text-sm text-black-700 dark:text-white-300;
      @apply leading-relaxed;
    }

    /* Interaction bar */
    .interaction-bar {
      @apply flex justify-between items-center px-6 py-4;
      @apply border-b border-white-100 dark:border-black-700;
    }

    .comment-info {
      @apply flex items-center space-x-2 text-black-600 dark:text-white-400;
    }

    .comment-icon {
      @apply text-base;
    }

    .comment-text {
      @apply text-sm font-medium;
    }

    .like-btn {
      @apply flex items-center space-x-2 text-black-600 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200 text-sm font-medium;
    }

    .like-btn.liked {
      @apply text-red-500 dark:text-red-400;
    }

    .like-btn.liked:hover {
      @apply text-red-600 dark:text-red-300;
    }

    .like-icon {
      @apply text-base transition-colors duration-200;
    }

    .like-text {
      @apply transition-colors duration-200;
    }

    /* Comments Section */
    .comments-section {
      @apply space-y-0;
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .post-header {
        @apply p-4 pb-3;
      }

      .post-content {
        @apply px-4 py-3;
      }

      .interaction-bar {
        @apply px-4 py-3;
      }

      .post-separator {
        @apply mx-4;
      }

      .avatar-img,
      .avatar-placeholder {
        @apply w-12 h-12;
      }

      .placeholder-icon {
        @apply text-lg;
      }

      .author-name {
        @apply text-sm;
      }

      .author-bio,
      .author-address {
        @apply text-xs;
      }

      .post-timestamp {
        @apply text-xs;
      }
    }
  `]
})
export class ExpandedPostComponent implements OnInit {
  private commentService = inject(CommentService);
  private postService = inject(PostService);
  private toastService = inject(ToastService);

  // Inputs
  public post = input.required<Post>();

  // State
  public commentCount = signal(0);

  ngOnInit(): void {
    this.updateCommentCount();
  }

  /**
   * Handle comment added event
   */
  onCommentAdded(): void {
    this.updateCommentCount();
    // Also update the post's comment count in the post service
    this.postService.updateCommentCount(this.post().id);
  }

  /**
   * Update comment count
   */
  private updateCommentCount(): void {
    const count = this.commentService.getCommentCount(this.post().id);
    this.commentCount.set(count);
  }

  /**
   * Format timestamp to relative time
   */
  formatTimestamp(timestamp: number): string {
    const now = Math.floor(Date.now() / 1000);
    const diffSeconds = now - timestamp;
    
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  /**
   * Format wallet address
   */
  formatAddress(address: string): string {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  }

  /**
   * Copy address to clipboard
   */
  async copyAddress(address: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      this.toastService.success('Address copied to clipboard', 'Copied');
    } catch (error) {
      this.toastService.error('Failed to copy address', 'Copy Failed');
    }
  }

  /**
   * Get author avatar URL
   */
  getAuthorAvatarUrl(): string {
    const avatar = this.post().author.avatar;
    if (!avatar) return '';
    
    // Check if it's already a data URL
    if (avatar.startsWith('data:')) {
      return avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${avatar}`;
  }
}