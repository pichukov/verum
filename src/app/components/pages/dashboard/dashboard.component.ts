import { Component, inject, computed, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserService } from '../../../services/user.service';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';
import { PostService } from '../../../services/post.service';
import { FeedService, FeedItem } from '../../../services/feed.service';
import { CommentService } from '../../../services/comment.service';
import { SubscriptionService } from '../../../services/subscription.service';
import { ToastService } from '../../../services/toast.service';
import { ScrollService } from '../../../services/scroll.service';
import { PostInputComponent } from '../../ui/post-input/post-input.component';
import { PostCardComponent, Post } from '../../ui/post-card/post-card.component';
import { StoryPostComponent } from '../../ui/story-post/story-post.component';
import { NoteCardComponent } from '../../ui/note-card/note-card.component';
import { ExpandedPostComponent } from '../../ui/expanded-post/expanded-post.component';
import { CommentInputComponent } from '../../ui/comment-input/comment-input.component';
import { CommentListComponent } from '../../ui/comment-list/comment-list.component';
import { VerumLoadingComponent } from '../../ui/verum-loading/verum-loading.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, PostInputComponent, PostCardComponent, StoryPostComponent, NoteCardComponent, ExpandedPostComponent, CommentInputComponent, CommentListComponent, VerumLoadingComponent],
  template: `
    <div class="dashboard">
      <!-- Post Input -->
      <div class="post-input-section">
        <app-post-input
          #postInput
          (postCreated)="onPostCreated($event)"
          (mediaRequested)="onMediaRequested()">
        </app-post-input>
      </div>

      <!-- Feed -->
      <div class="feed">
        <!-- Refresh Button (temporary for debugging) -->
        <div class="refresh-section">
          <button 
            type="button"
            class="refresh-btn"
            (click)="refreshFeed()"
            [disabled]="feedService.isLoading()">
            <fa-icon [icon]="['fas', 'sync-alt']" class="refresh-icon"></fa-icon>
            Refresh Feed
          </button>
        </div>
        
        <!-- Loading State -->
        @if (feedService.isLoading()) {
          <app-verum-loading
            [title]="'Loading Your Feed'"
            [message]="feedService.loadingMessage()"
            [showProgress]="true"
            [percentage]="feedService.loadingPercentage()">
          </app-verum-loading>
        }

        <!-- Feed Items List -->
        @if (!feedService.isLoading() && feedItems().length > 0) {
          <div class="feed-list">
          @for (item of feedItems(); track trackByFeedItemId($index, item)) {
            <div class="feed-item-wrapper">
            
            <!-- Regular Post -->
            @if (item.type === 'post' && item.post) {
              <!-- Collapsed Post Card -->
              @if (!isPostExpanded(item.id)) {
                <app-post-card
                  [post]="item.post"
                  (likeClicked)="onPostLiked($event)"
                  (commentClicked)="onPostCommented($event)"
                  (moreClicked)="onPostMore($event)">
                </app-post-card>
              }

              <!-- Expanded Post with Comments -->
              @if (isPostExpanded(item.id)) {
                <app-expanded-post
                  [post]="item.post">
                </app-expanded-post>
              }

              <!-- Collapse Button for Expanded Posts -->
              @if (isPostExpanded(item.id)) {
                <div class="collapse-section">
                <button 
                  class="collapse-button"
                  (click)="collapsePost(item.id)">
                  <fa-icon [icon]="['fas', 'chevron-up']" class="collapse-icon"></fa-icon>
                  <span class="button-text">Hide Comments</span>
                </button>
                </div>
              }
            }
            
            <!-- Story Post -->
            @if (item.type === 'story' && item.story) {
              <app-story-post
                [story]="item.story"
                (storyUpdated)="onStoryUpdated($event)"
                (storyError)="onStoryError($event)"
                (commentClicked)="onPostCommented($event)">
              </app-story-post>
            }
            <!-- Expanded Story with Comments -->
            @if (item.type === 'story' && item.story && isPostExpanded(item.story.firstSegmentId)) {
              <div class="expanded-story">
                <app-comment-input
                  [postId]="item.story.firstSegmentId"
                  [postAuthorAddress]="item.story.authorAddress">
                </app-comment-input>
                <app-comment-list
                  [postId]="item.story.firstSegmentId"
                  [postAuthorAddress]="item.story.authorAddress">
                </app-comment-list>
              </div>
            }
            <!-- Collapse Button for Expanded Stories -->
            @if (item.type === 'story' && item.story && isPostExpanded(item.story.firstSegmentId)) {
              <div class="collapse-section">
                <button 
                  type="button"
                  class="collapse-button"
                  (click)="collapsePost(item.story.firstSegmentId)">
                  <fa-icon [icon]="['fas', 'chevron-up']" class="collapse-icon"></fa-icon>
                  <span class="button-text">Hide Comments</span>
                </button>
              </div>
            }
            
            <!-- Note -->
            @if (item.type === 'note' && item.note) {
              <app-note-card
                [note]="item.note">
              </app-note-card>
            }
            
            </div>
          }
          </div>
        }

        <!-- Empty State -->
        @if (!feedService.isLoading() && feedItems().length === 0) {
          <div class="empty-feed">
          <div class="empty-icon">
            <fa-icon [icon]="['fas', 'comments']" class="feed-icon"></fa-icon>
          </div>
          <h3 class="empty-title">No content yet</h3>
          <p class="empty-description">
            Be the first to share something! Write a post or story above to get the conversation started.
          </p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      @apply space-y-6;
    }

    .post-input-section {
      @apply mb-8 pb-8;
      @apply border-b-2 border-white-300 dark:border-black-600;
    }
    
    /* Refresh Section */
    .refresh-section {
      @apply mb-4 flex justify-center;
    }
    
    .refresh-btn {
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

    .refresh-btn:hover:not(:disabled) {
      @apply shadow-sm;
    }
    
    .refresh-icon {
      @apply text-sm;
    }

    /* Cyberpunk theme overrides for refresh button */
    :host-context(.cyberpunk-theme) .refresh-btn {
      @apply bg-cyber-dark-3 border border-neon-cyan/30;
      @apply text-neon-cyan;
      
      &:hover:not(:disabled) {
        @apply bg-cyber-dark-2 border-neon-cyan;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
      }
    }

    :host-context(.cyberpunk-theme) .refresh-icon {
      filter: drop-shadow(0 0 3px rgba(0, 255, 255, 0.6));
    }

    .feed {
      @apply space-y-6;
    }


    /* Feed List */
    .feed-list {
      @apply space-y-6;
    }

    .feed-item-wrapper {
      @apply space-y-0;
    }

    /* Expanded Story */
    .expanded-story {
      @apply bg-white dark:bg-black-800;
      @apply border-l border-r border-white-200 dark:border-black-700;
      @apply px-6 py-4 space-y-4;
    }
    
    /* Cyberpunk expanded story */
    :host-context(.cyberpunk-theme) .expanded-story {
      @apply bg-cyber-dark-2 border-cyber-gray-2;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: story-line-glow 2s ease-in-out infinite alternate;
      }
    }
    
    @keyframes story-line-glow {
      0% { opacity: 0.3; }
      100% { opacity: 0.8; }
    }

    /* Collapse Section */
    .collapse-section {
      @apply bg-white dark:bg-black-800;
      @apply border-t border-white-200 dark:border-black-700;
      @apply border-l border-r border-b border-white-200 dark:border-black-700;
      @apply rounded-b-lg px-6 py-3;
      @apply flex justify-center;
    }
    
    /* Cyberpunk collapse section */
    :host-context(.cyberpunk-theme) .collapse-section {
      @apply bg-cyber-dark-2 border-cyber-gray-2;
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: collapse-line-scan 3s ease-in-out infinite;
      }
    }

    .collapse-button {
      @apply flex items-center gap-2 px-4 py-2;
      @apply text-gray-600 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200 text-sm font-medium;
      @apply rounded-lg hover:bg-gray-50 dark:hover:bg-black-700;
    }
    
    /* Cyberpunk collapse button */
    :host-context(.cyberpunk-theme) .collapse-button {
      @apply text-cyber-gray-5 hover:text-neon-cyan font-tech;
      @apply bg-cyber-dark-3 hover:bg-cyber-dark-4;
      @apply border border-cyber-gray-2 hover:border-neon-cyan/50;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.1), transparent);
        transition: left 0.5s ease;
      }
      
      &:hover::before {
        left: 100%;
      }
      
      &:hover {
        text-shadow: 0 0 8px rgba(0, 255, 255, 0.8);
        box-shadow: 0 0 15px rgba(0, 255, 255, 0.3), inset 0 0 10px rgba(0, 255, 255, 0.1);
      }
    }

    .collapse-icon {
      @apply text-sm;
    }
    
    /* Cyberpunk collapse icon animation */
    :host-context(.cyberpunk-theme) .collapse-button:hover .collapse-icon {
      animation: cyber-icon-pulse 0.5s ease-in-out;
    }
    
    @keyframes collapse-line-scan {
      0% { opacity: 0.3; }
      50% { opacity: 1; }
      100% { opacity: 0.3; }
    }
    
    @keyframes cyber-icon-pulse {
      0% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
      100% { transform: translateY(0); }
    }

    /* Empty Feed State */
    .empty-feed {
      @apply flex flex-col items-center justify-center text-center;
      @apply py-16 px-8;
      @apply bg-white dark:bg-black-800 rounded-lg;
      @apply border border-white-200 dark:border-black-700;
      @apply shadow-small;
    }

    .empty-icon {
      @apply mb-6;
    }

    .feed-icon {
      @apply text-6xl text-black-300 dark:text-white-400;
    }

    .empty-title {
      @apply text-xl font-semibold text-black-900 dark:text-white-100;
      @apply mb-3;
    }

    .empty-description {
      @apply text-black-600 dark:text-white-400;
      @apply max-w-md leading-relaxed;
    }
  `]
})
export class DashboardComponent implements OnInit {
  private userService = inject(UserService);
  private walletService = inject(KaswareWalletService);
  public postService = inject(PostService);
  public feedService = inject(FeedService);
  private commentService = inject(CommentService);
  private subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);
  private scrollService = inject(ScrollService);

  // ViewChild references
  @ViewChild('postInput') postInputComponent!: PostInputComponent;

  // State
  private expandedPosts = signal<Set<string>>(new Set());

  // Computed values
  public readonly currentUser = this.userService.currentUser;
  public readonly posts = this.postService.posts;
  public readonly feedItems = this.feedService.feedItems;

  ngOnInit(): void {
    // Wait for user to be loaded before loading feed
    this.waitForUserAndLoadFeed();
    
    // Setup user change watcher to reload data when wallet switches
    this.setupUserChangeWatcher();
  }
  
  /**
   * Setup user change watcher to reload data when wallet switches
   */
  private setupUserChangeWatcher(): void {
    let previousUserAddress: string | null = null;
    
    setInterval(() => {
      const currentUser = this.userService.currentUser();
      const currentUserAddress = currentUser?.address || null;
      
      // If user changed (including initial load)
      if (currentUserAddress !== previousUserAddress) {
        // Only reload if we had a previous user (not initial load)
        if (previousUserAddress !== null) {
          this.reloadAllData();
        }
        
        previousUserAddress = currentUserAddress;
      }
    }, 500); // Check every 500ms
  }
  
  /**
   * Reload all dashboard data for new user
   */
  private async reloadAllData(): Promise<void> {
    try {
      // Clear expanded posts state
      this.expandedPosts.set(new Set());
      
      // Wait for services to clear their caches (they have their own watchers)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reload subscriptions first, then feed
      await this.loadSubscriptions();
      await this.loadFeed();
    } catch (error) {
      // Error during data reload
    }
  }

  /**
   * Wait for user to be loaded before loading feed
   */
  private async waitForUserAndLoadFeed(): Promise<void> {
    // Check if user is already loaded
    if (this.userService.currentUser()) {
      // Initialize feed service which handles both posts and stories
      await this.feedService.initialize();
      return;
    }
    
    // Otherwise wait for user to load
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max
    
    const checkUser = setInterval(async () => {
      attempts++;
      
      if (this.userService.currentUser()) {
        clearInterval(checkUser);
        // Initialize feed service which handles both posts and stories
        await this.feedService.initialize();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkUser);
      }
    }, 100); // Check every 100ms
  }

  /**
   * Load subscriptions from blockchain
   */
  async loadSubscriptions(): Promise<void> {
    try {
      await this.subscriptionService.loadSubscriptions();
    } catch (error) {
      // Failed to load subscriptions
    }
  }

  /**
   * Load feed from blockchain
   */
  async loadFeed(): Promise<void> {
    try {
      await this.feedService.loadFeed();
    } catch (error) {
      // Failed to load feed
    }
  }

  /**
   * Handle post creation
   */
  async onPostCreated(content: string): Promise<void> {
    try {
      await this.postService.createPost({ content });
      // Clear the input after successful post creation
      this.postInputComponent.clearInput();
      // Refresh the feed to show the new post
      await this.feedService.refreshFeed();
    } catch (error) {
      // Error handling is done in the post service
    }
  }

  /**
   * Handle media request (placeholder for future feature)
   */
  onMediaRequested(): void {
    this.toastService.info(
      'Media uploads coming soon!',
      'Feature Coming Soon'
    );
  }

  /**
   * Handle post like
   */
  async onPostLiked(postId: string): Promise<void> {
    // Like is handled internally by the post-card component's like service
    // No additional action needed here since the like service manages everything
  }

  /**
   * Handle post comment - expand post to show comments
   */
  onPostCommented(postId: string): void {
    this.expandPost(postId);
  }

  /**
   * Check if post is expanded
   */
  isPostExpanded(postId: string): boolean {
    return this.expandedPosts().has(postId);
  }

  /**
   * Expand post to show comments
   */
  expandPost(postId: string): void {
    this.expandedPosts.update(expanded => {
      const newSet = new Set(expanded);
      newSet.add(postId);
      return newSet;
    });
  }

  /**
   * Collapse post to hide comments
   */
  collapsePost(postId: string): void {
    this.expandedPosts.update(expanded => {
      const newSet = new Set(expanded);
      newSet.delete(postId);
      return newSet;
    });
  }

  /**
   * Handle post more actions
   */
  onPostMore(postId: string): void {
    this.toastService.info(
      'More actions coming soon!',
      'Feature Coming Soon'
    );
  }

  /**
   * Track by function for feed item list performance
   */
  trackByFeedItemId(index: number, item: FeedItem): string {
    return item.id;
  }
  
  /**
   * Handle story updates
   */
  onStoryUpdated(updatedStory: any): void {
    this.feedService.updateStory(updatedStory);
  }
  
  /**
   * Handle story errors
   */
  onStoryError(error: string): void {
    this.toastService.error(error, 'Story Error');
  }
  
  /**
   * Refresh the feed manually
   */
  async refreshFeed(): Promise<void> {
    // Scroll to loading indicator when it appears
    this.scrollService.scrollToLoadingIndicator();
    
    try {
      // First reload subscriptions to ensure we have the latest subscription list
      await this.loadSubscriptions();
      
      // Then refresh the feed with the updated subscription list
      await this.feedService.refreshFeed();
    } catch (error) {
      console.error('Error during feed refresh:', error);
    }
  }

  /**
   * Get avatar data URL for display
   */
  public getAvatarUrl(): string {
    const user = this.currentUser();
    if (!user?.avatar) {
      return '';
    }
    
    // Check if it's already a data URL
    if (user.avatar.startsWith('data:')) {
      return user.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${user.avatar}`;
  }
}