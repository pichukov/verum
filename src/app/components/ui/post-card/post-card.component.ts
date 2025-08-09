import { Component, input, output, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../button/button.component';
import { MarkdownComponent } from 'ngx-markdown';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { LikeService } from '../../../services/like.service';
import { ToastService } from '../../../services/toast.service';

export interface Post {
  id: string;
  author: {
    address: string;
    nickname: string;
    avatar?: string;
    bio?: string;
  };
  content: string;
  timestamp: number;
  blockTime: number;
  likes?: number;
  comments?: number;
  isLiked?: boolean;
}

@Component({
  selector: 'app-post-card',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, MarkdownComponent],
  template: `
    <div class="post-card">
      <!-- Header -->
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
          <button class="more-btn" (click)="onMoreClick()">
            <fa-icon [icon]="['fas', 'ellipsis-h']"></fa-icon>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="post-content">
        <markdown class="content-text" [data]="post().content"></markdown>
      </div>

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
          @if (post().comments && post().comments! > 0) {
            <span class="interaction-count">
              ({{ post().comments }})
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
          [title]="isLiked() ? 'You liked this post' : likeTooltip()">
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
    </div>
  `,
  styles: [`
    .post-card {
      @apply bg-white dark:bg-black-800 border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small;
    }
    
    /* Cyberpunk post card */
    :host-context(.cyberpunk-theme) .post-card {
      @apply bg-cyber-dark-2 border border-white-200 dark:border-black-700;
    }

    /* Header */
    .post-header {
      @apply flex justify-between items-start p-6 pb-4;
    }

    .author-info {
      @apply flex space-x-3 flex-1;
    }

    .author-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-10 h-10 rounded-full object-cover;
      @apply border border-white-300 dark:border-black-600;
    }

    .avatar-placeholder {
      @apply w-10 h-10 rounded-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border border-white-300 dark:border-black-600;
    }

    .placeholder-icon {
      @apply text-base text-black-400 dark:text-white-400;
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

    /* Content */
    .post-content {
      @apply px-6 pb-4;
    }

    .content-text {
      @apply text-sm text-black-700 dark:text-white-300;
      @apply leading-relaxed;
    }

    /* Separator */
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

    /* Interaction bar */
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

    /* Mobile responsive */
    @media (max-width: 640px) {
      .post-header {
        @apply p-4 pb-3;
      }

      .post-content {
        @apply px-4 pb-3;
      }

      .interaction-bar {
        @apply px-4 py-3;
      }

      .avatar-img,
      .avatar-placeholder {
        @apply w-8 h-8;
      }

      .placeholder-icon {
        @apply text-sm;
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

      .interaction-btn {
        @apply text-xs;
      }

      .interaction-icon {
        @apply text-sm;
      }
    }
    
    .fee-hint {
      @apply text-xs text-black-400 dark:text-white-400 ml-1;
      @apply bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded;
      @apply font-mono;
    }
  `]
})
export class PostCardComponent implements OnInit {
  // Inputs
  public post = input.required<Post>();

  // Outputs  
  public likeClicked = output<string>(); // post ID
  public commentClicked = output<string>(); // post ID
  public moreClicked = output<string>(); // post ID
  
  // Services
  private feeCalculationService = inject(FeeCalculationService);
  private likeService = inject(LikeService);
  private toastService = inject(ToastService);
  
  // Fee information
  public likeFee = signal<string>('');
  public commentFee = signal<string>('');
  public likeTooltip = signal<string>('Like this post');
  public commentTooltip = signal<string>('Add a comment');
  
  // Like state
  public likeCount = computed(() => this.likeService.getLikeCount(this.post().id));
  public isLiked = computed(() => this.likeService.hasUserLikedPost(this.post().id));
  public isLiking = computed(() => this.likeService.isCreating());
  
  ngOnInit() {
    this.loadFeeInfo();
    this.loadLikes();
  }
  
  private loadLikes() {
    // Load likes for this post
    this.likeService.loadLikesForPost(this.post().id, this.post().author.address);
  }
  
  private loadFeeInfo() {
    // Load like payment amount
    this.feeCalculationService.calculateActionAmount('like').subscribe(kasAmount => {
      this.likeFee.set(this.feeCalculationService.formatKasAmount(kasAmount));
      this.likeTooltip.set(`Like this post (Send ${this.likeFee()} to author)`);
    });
    
    // Load comment payment amount
    this.feeCalculationService.calculateActionAmount('comment').subscribe(kasAmount => {
      this.commentFee.set(this.feeCalculationService.formatKasAmount(kasAmount));
      this.commentTooltip.set(`Add a comment (Send ${this.commentFee()} to author)`);
    });
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

  /**
   * Handle like click
   */
  async onLikeClick(): Promise<void> {
    if (this.isLiked() || this.isLiking()) {
      // Already liked or currently liking, do nothing
      return;
    }
    
    try {
      await this.likeService.createLike({
        postId: this.post().id,
        postAuthorAddress: this.post().author.address
      });
      
      // Also emit the event for parent components
      this.likeClicked.emit(this.post().id);
    } catch (error) {
      // Error handling is done in the service
      console.error('Failed to like post:', error);
    }
  }

  /**
   * Handle comment click
   */
  onCommentClick(): void {
    this.commentClicked.emit(this.post().id);
  }

  /**
   * Handle more actions click
   */
  onMoreClick(): void {
    this.moreClicked.emit(this.post().id);
  }
}