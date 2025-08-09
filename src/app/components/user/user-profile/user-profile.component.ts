import { Component, input, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../../ui/button/button.component';
import { UserService } from '../../../services/user.service';
import { KaspaTransactionService } from '../../../services/kaspa-transaction.service';
import { UserProfile, Post } from '../../../types/transaction';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, ButtonComponent],
  template: `
    <div class="user-profile">
      <!-- Loading State -->
      @if (isLoading()) {
        <div class="loading-container">
          <div class="spinner"></div>
          <p class="loading-text">Loading profile...</p>
        </div>
      }
      
      <!-- Profile Content -->
      @if (!isLoading() && profile()) {
        <div class="profile-content">
        <!-- Profile Header -->
        <div class="profile-header">
          <!-- Avatar -->
          <div class="avatar-container">
            @if (avatarUrl()) {
              <img 
                [src]="avatarUrl()" 
                [alt]="profile()!.nickname"
                class="profile-avatar">
            } @else {
              <div class="avatar-placeholder">
                <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
              </div>
            }
          </div>
          
          <!-- Profile Info -->
          <div class="profile-info">
            <div class="profile-title">
              <h1 class="profile-name">{{ profile()!.nickname }}</h1>
              @if (isCurrentUser()) {
                <div class="current-user-badge">
                  <fa-icon [icon]="['fas', 'check-circle']" class="verified-icon"></fa-icon>
                  <span>You</span>
                </div>
              }
            </div>
            
            <!-- Address -->
            <div class="profile-address">
              <fa-icon [icon]="['fas', 'wallet']" class="address-icon"></fa-icon>
              <code class="address-text">{{ formatAddress() }}</code>
              <button 
                (click)="copyAddress()"
                class="copy-button"
                title="Copy address">
                <fa-icon [icon]="['fas', 'copy']"></fa-icon>
              </button>
            </div>
            
            <!-- Join Date -->
            <div class="profile-meta">
              <fa-icon [icon]="['fas', 'calendar-alt']" class="meta-icon"></fa-icon>
              <span>Joined {{ formatJoinDate() }}</span>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="profile-actions">
            @if (isCurrentUser()) {
              <app-button
                variant="secondary"
                size="md"
                (click)="editProfile()">
                <fa-icon [icon]="['fas', 'edit']" class="button-icon"></fa-icon>
                Edit Profile
              </app-button>
            }
            
            @if (!isCurrentUser()) {
              <app-button
                variant="primary"
                size="md"
              (click)="subscribe()"
              [disabled]="isSubscribing()"
              [loading]="isSubscribing()">
              <fa-icon [icon]="['fas', 'plus']" class="button-icon"></fa-icon>
              {{ isSubscribing() ? 'Following...' : 'Follow' }}
            </app-button>
          </div>
        </div>
        
        <!-- Stats -->
        <div class="profile-stats">
          <div class="stat-item">
            <span class="stat-value">{{ postCount() }}</span>
            <span class="stat-label">{{ postCount() === 1 ? 'Post' : 'Posts' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ totalLikes() }}</span>
            <span class="stat-label">{{ totalLikes() === 1 ? 'Like' : 'Likes' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ followerCount() }}</span>
            <span class="stat-label">{{ followerCount() === 1 ? 'Follower' : 'Followers' }}</span>
          </div>
        </div>
        
        <!-- Recent Posts -->
        <div class="recent-posts">
          <h2 class="section-title">
            <fa-icon [icon]="['fas', 'list']" class="section-icon"></fa-icon>
            Recent Posts
          </h2>
          
          @if (recentPosts().length === 0) {
            <div class="no-posts">
              <fa-icon [icon]="['fas', 'comment-alt']" class="no-posts-icon"></fa-icon>
              <p class="no-posts-text">
                {{ isCurrentUser() ? 'You haven\\'t posted anything yet' : 'No posts yet' }}
              </p>
              @if (isCurrentUser()) {
                <app-button
                  variant="primary"
                  size="sm"
                  (click)="createFirstPost()">
                  <fa-icon [icon]="['fas', 'plus']" class="button-icon"></fa-icon>
                  Create Your First Post
                </app-button>
              }
            </div>
          }
          
          @if (recentPosts().length > 0) {
            <div class="posts-list">
              @for (post of recentPosts(); track post.id) {
                <div class="post-preview">
                  <div class="post-content">
                    <p class="post-text">{{ post.content }}</p>
                    <div class="post-meta">
                      <span class="post-date">{{ formatPostDate(post.blockTime) }}</span>
                      <div class="post-stats">
                        <span class="post-stat">
                          <fa-icon [icon]="['fas', 'heart']" class="stat-icon"></fa-icon>
                          {{ post.likeCount || 0 }}
                        </span>
                        <span class="post-stat">
                          <fa-icon [icon]="['fas', 'comment']" class="stat-icon"></fa-icon>
                          {{ post.commentCount || 0 }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
      
      <!-- Error State -->
      @if (!isLoading() && !profile()) {
        <div class="error-container">
          <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
          <h2 class="error-title">Profile Not Found</h2>
          <p class="error-message">
            This user hasn't created a profile yet or the address is invalid.
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    .user-profile {
      @apply max-w-4xl mx-auto p-6 space-y-6;
    }
    
    .loading-container {
      @apply flex flex-col items-center justify-center py-12 space-y-4;
    }
    
    .spinner {
      @apply w-8 h-8 border-2 border-kaspa-500 border-t-transparent rounded-full animate-spin;
    }
    
    .loading-text {
      @apply text-black-600 dark:text-white-400;
    }
    
    .profile-content {
      @apply space-y-6;
    }
    
    .profile-header {
      @apply bg-white-900 dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-6;
    }
    
    .avatar-container {
      @apply flex-shrink-0;
    }
    
    .profile-avatar {
      @apply w-24 h-24 md:w-32 md:h-32 rounded-full object-cover;
      @apply border-4 border-white-200 dark:border-black-600;
    }
    
    .avatar-placeholder {
      @apply w-24 h-24 md:w-32 md:h-32 rounded-full;
      @apply bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border-4 border-white-200 dark:border-black-600;
    }
    
    .placeholder-icon {
      @apply text-3xl md:text-4xl text-black-400 dark:text-white-400;
    }
    
    .profile-info {
      @apply flex-1 space-y-3;
    }
    
    .profile-title {
      @apply flex items-center space-x-3;
    }
    
    .profile-name {
      @apply text-2xl md:text-3xl font-bold text-black-900 dark:text-white-100;
    }
    
    .current-user-badge {
      @apply flex items-center space-x-1 px-2 py-1 rounded-full;
      @apply bg-kaspa-100 dark:bg-kaspa-900/30 text-kaspa-700 dark:text-kaspa-300;
      @apply text-sm font-medium;
    }
    
    .verified-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .profile-address {
      @apply flex items-center space-x-2;
    }
    
    .address-icon {
      @apply text-black-500 dark:text-white-500;
    }
    
    .address-text {
      @apply text-sm font-mono text-black-700 dark:text-white-300;
      @apply bg-white-200 dark:bg-black-700 px-2 py-1 rounded;
    }
    
    .copy-button {
      @apply p-1 text-black-500 dark:text-white-500;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200;
    }
    
    .profile-meta {
      @apply flex items-center space-x-2 text-black-600 dark:text-white-400;
    }
    
    .meta-icon {
      @apply text-black-500 dark:text-white-500;
    }
    
    .profile-actions {
      @apply flex-shrink-0;
    }
    
    .button-icon {
      @apply mr-2;
    }
    
    .profile-stats {
      @apply bg-white-900 dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply flex justify-around;
    }
    
    .stat-item {
      @apply text-center;
    }
    
    .stat-value {
      @apply block text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    .stat-label {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .recent-posts {
      @apply bg-white-900 dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply space-y-4;
    }
    
    .section-title {
      @apply flex items-center space-x-2 text-xl font-bold;
      @apply text-black-900 dark:text-white-100;
    }
    
    .section-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .no-posts {
      @apply text-center py-8 space-y-4;
    }
    
    .no-posts-icon {
      @apply text-4xl text-black-400 dark:text-white-400;
    }
    
    .no-posts-text {
      @apply text-black-600 dark:text-white-400;
    }
    
    .posts-list {
      @apply space-y-4;
    }
    
    .post-preview {
      @apply p-4 rounded-lg border border-white-200 dark:border-black-700;
      @apply hover:bg-white-100 dark:hover:bg-black-700;
      @apply transition-colors duration-200;
    }
    
    .post-content {
      @apply space-y-2;
    }
    
    .post-text {
      @apply text-black-800 dark:text-white-200;
    }
    
    .post-meta {
      @apply flex justify-between items-center text-sm;
    }
    
    .post-date {
      @apply text-black-500 dark:text-white-500;
    }
    
    .post-stats {
      @apply flex space-x-4;
    }
    
    .post-stat {
      @apply flex items-center space-x-1 text-black-500 dark:text-white-500;
    }
    
    .stat-icon {
      @apply text-xs;
    }
    
    .error-container {
      @apply text-center py-12 space-y-4;
    }
    
    .error-icon {
      @apply text-4xl text-red-500;
    }
    
    .error-title {
      @apply text-xl font-bold text-black-900 dark:text-white-100;
    }
    
    .error-message {
      @apply text-black-600 dark:text-white-400;
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      .user-profile {
        @apply p-4;
      }
      
      .profile-header {
        @apply p-4;
      }
      
      .profile-name {
        @apply text-xl;
      }
      
      .profile-stats {
        @apply p-4;
      }
      
      .recent-posts {
        @apply p-4;
      }
    }
  `]
})
export class UserProfileComponent implements OnInit {
  private userService = inject(UserService);
  private transactionService = inject(KaspaTransactionService);
  
  // Inputs
  public address = input.required<string>();
  
  // State
  public profile = signal<UserProfile | null>(null);
  public recentPosts = signal<Post[]>([]);
  public isLoading = signal<boolean>(true);
  public isSubscribing = signal<boolean>(false);
  
  // Computed values
  public avatarUrl = computed(() => {
    const profileData = this.profile();
    return profileData ? this.userService.getAvatarDataUrl(profileData) : '';
  });
  
  public isCurrentUser = computed(() => {
    return this.userService.isCurrentUser(this.address());
  });
  
  public postCount = computed(() => this.recentPosts().length);
  public totalLikes = computed(() => {
    return this.recentPosts().reduce((sum, post) => sum + (post.likeCount || 0), 0);
  });
  public followerCount = computed(() => 0); // TODO: Implement follower count
  
  async ngOnInit() {
    await this.loadProfile();
  }
  
  /**
   * Load user profile and posts
   */
  private async loadProfile(): Promise<void> {
    try {
      this.isLoading.set(true);
      
      // Load profile and posts in parallel
      const [profileData, postsData] = await Promise.all([
        this.userService.getUserProfile(this.address()).toPromise(),
        this.transactionService.getPosts(this.address(), 10).toPromise()
      ]);
      
      this.profile.set(profileData || null);
      this.recentPosts.set(postsData || []);
      
    } catch (error) {
      // Failed to load profile
    } finally {
      this.isLoading.set(false);
    }
  }
  
  /**
   * Format wallet address for display
   */
  public formatAddress(): string {
    return this.formatUserAddress(this.address(), 8);
  }
  
  /**
   * Format join date
   */
  public formatJoinDate(): string {
    const profileData = this.profile();
    if (!profileData) return '';
    
    const date = new Date(profileData.createdAt * 1000);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
  }
  
  /**
   * Format post date
   */
  public formatPostDate(blockTime: number): string {
    const date = new Date(blockTime * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
  
  /**
   * Copy address to clipboard
   */
  public async copyAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.address());
      // Show success feedback (could use toast service)
    } catch (error) {
      // Failed to copy address
    }
  }
  
  /**
   * Edit profile (current user only)
   */
  public editProfile(): void {
    // TODO: Open profile edit modal/page
  }
  
  /**
   * Subscribe to user
   */
  public async subscribe(): Promise<void> {
    try {
      this.isSubscribing.set(true);
      
      // TODO: Implement subscription logic
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      // Failed to subscribe
    } finally {
      this.isSubscribing.set(false);
    }
  }
  
  /**
   * Create first post (current user only)
   */
  public createFirstPost(): void {
    // TODO: Open post composer
  }
  
  /**
   * Format address for display
   */
  private formatUserAddress(address: string, length: number = 8): string {
    if (!address) return '';
    if (address.length <= length * 2) return address;
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  }
}