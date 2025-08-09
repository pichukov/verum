import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../../ui/button/button.component';
import { SubscriptionService, Subscription, UserSearchResult } from '../../../services/subscription.service';
import { ToastService } from '../../../services/toast.service';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FontAwesomeModule, ButtonComponent],
  template: `
    <div class="subscriptions-page">
      <!-- Page Header -->
      <div class="page-header">
        <h1 class="page-title">Subscriptions</h1>
        <p class="page-subtitle">
          Manage your subscriptions and discover new users on Verum
        </p>
      </div>

      <!-- Search Section -->
      <div class="search-section">
        <div class="search-header">
          <fa-icon [icon]="['fas', 'search']" class="search-icon"></fa-icon>
          <h2 class="search-title">Find Users</h2>
        </div>
        <p class="search-description">
          Enter a Kaspa address to search for users who have created profiles on Verum. 
          You can subscribe to users to see their posts in your feed.
        </p>
        
        <div class="search-form">
          <div class="search-input-container">
            <input
              type="text"
              [(ngModel)]="searchAddress"
              [ngModelOptions]="{standalone: true}"
              placeholder="Enter Kaspa address (e.g., kaspa:qq...)"
              class="search-input"
              [disabled]="subscriptionService.isSearching()"
              (keyup.enter)="searchUser()"
            />
            <app-button 
              variant="primary"
              [disabled]="!searchAddress().trim() || subscriptionService.isSearching()"
              [loading]="subscriptionService.isSearching()"
              (click)="searchUser()">
              @if (!subscriptionService.isSearching()) {
                <fa-icon 
                  [icon]="['fas', 'search']" 
                  class="button-icon">
                </fa-icon>
              }
              {{ subscriptionService.isSearching() ? 'Searching...' : 'Search' }}
            </app-button>
          </div>
          
          <!-- Search Error -->
          @if (searchError()) {
            <div class="search-error">
            <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
            {{ searchError() }}
            </div>
          }
        </div>

        <!-- Search Result -->
        @if (searchResult()) {
          <div class="search-result">
          @if (searchResult()?.hasProfile) {
            <div class="user-profile-card">
            <div class="profile-header">
              <div class="profile-avatar">
                @if (searchResult()?.avatar) {
                  <img 
                    [src]="getAvatarUrl(searchResult()!.avatar!)" 
                    [alt]="searchResult()?.nickname"
                    class="avatar-img">
                } @else {
                  <div class="avatar-placeholder">
                  <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                  </div>
                }
              </div>
              <div class="profile-info">
                <h3 class="profile-name">{{ searchResult()?.nickname }}</h3>
                <p class="profile-address">{{ formatAddress(searchResult()!.address) }}</p>
                @if (searchResult()?.bio) {
                  <p class="profile-bio">{{ searchResult()?.bio }}</p>
                }
              </div>
            </div>
            
            <div class="profile-actions">
              @if (!isSubscribedTo(searchResult()!.address) && !isSelfProfile(searchResult()!.address)) {
                <app-button
                  variant="primary"
                  [disabled]="subscriptionService.isLoading()"
                  [loading]="subscriptionService.isLoading()"
                  (click)="subscribeToUser(searchResult()!)">
                  @if (!subscriptionService.isLoading()) {
                    <fa-icon 
                      [icon]="['fas', 'user-plus']" 
                      class="button-icon">
                    </fa-icon>
                  }
                  Subscribe
                </app-button>
              }
              
              <!-- Self Profile Message -->
              @if (isSelfProfile(searchResult()!.address)) {
                <div class="self-profile-message">
                <fa-icon [icon]="['fas', 'info-circle']" class="info-icon"></fa-icon>
                This is your own profile
                </div>
              }
              
              @if (isSubscribedTo(searchResult()!.address)) {
                <div class="already-subscribed">
                <fa-icon [icon]="['fas', 'check-circle']" class="check-icon"></fa-icon>
                Already subscribed
                </div>
              }
            </div>
            </div>
          }

          <!-- No Profile Found -->
          @if (!searchResult()?.hasProfile) {
            <div class="no-profile-card">
            <div class="no-profile-icon">
              <fa-icon [icon]="['fas', 'user-slash']" class="icon"></fa-icon>
            </div>
            <h3 class="no-profile-title">No Profile Found</h3>
            <p class="no-profile-description">
              The address <strong>{{ formatAddress(searchResult()!.address) }}</strong> 
              doesn't have a profile on Verum yet.
            </p>
            <p class="no-profile-hint">
              Users need to create a profile by executing a "start" transaction before they can be followed.
            </p>
            </div>
          }
          </div>
        }
      </div>

      <!-- Subscriptions List -->
      <div class="subscriptions-section">
        <div class="section-header">
          <fa-icon [icon]="['fas', 'users']" class="section-icon"></fa-icon>
          <h2 class="section-title">Your Subscriptions</h2>
          <span class="subscription-count">{{ activeSubscriptions().length }}</span>
          <button
            type="button"
            class="refresh-subscriptions-btn"
            (click)="refreshSubscriptions()"
            [disabled]="isRefreshing()">
            <fa-icon 
              [icon]="['fas', isRefreshing() ? 'circle-notch' : 'sync-alt']" 
              [class.fa-spin]="isRefreshing()"
              class="refresh-icon">
            </fa-icon>
            {{ isRefreshing() ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <!-- Empty State -->
        @if (activeSubscriptions().length === 0) {
          <div class="empty-subscriptions">
          <div class="empty-icon">
            <fa-icon [icon]="['fas', 'user-friends']" class="icon"></fa-icon>
          </div>
          <h3 class="empty-title">No Subscriptions Yet</h3>
          <p class="empty-description">
            Search for users above to start building your network on Verum
          </p>
          </div>
        }

        <!-- Subscriptions List -->
        @if (activeSubscriptions().length > 0) {
          <div class="subscriptions-list">
          @for (subscription of activeSubscriptions(); track trackByAddress($index, subscription)) {
            <div class="subscription-item">
            
            <div class="subscription-content">
              <!-- Profile Picture -->
              <div class="subscription-avatar">
                @if (subscription.avatar) {
                  <img 
                    [src]="getAvatarUrl(subscription.avatar)" 
                    [alt]="subscription.nickname"
                    class="avatar-img">
                } @else {
                  <div class="avatar-placeholder">
                  <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                  </div>
                }
              </div>
              
              <!-- User Info -->
              <div class="subscription-info">
                <div class="subscription-main-info">
                  <h3 class="subscription-name">{{ subscription.nickname }}</h3>
                  <p class="subscription-address">{{ formatAddress(subscription.address) }}</p>
                </div>
              </div>

              <!-- Actions -->
              <div class="subscription-actions">
                <button
                  class="unsubscribe-button"
                  [disabled]="subscriptionService.isLoading()"
                  (click)="unsubscribeFromUser(subscription)">
                  @if (!subscriptionService.isLoading()) {
                    <fa-icon 
                      [icon]="['fas', 'user-minus']" 
                      class="button-icon">
                    </fa-icon>
                  }
                  @if (subscriptionService.isLoading()) {
                    <fa-icon 
                      [icon]="['fas', 'circle-notch']" 
                      class="button-icon fa-spin">
                    </fa-icon>
                  }
                  Unsubscribe
                </button>
              </div>
            </div>
            </div>
          }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .subscriptions-page {
      @apply space-y-8;
    }

    /* Page Header */
    .page-header {
      @apply text-center space-y-2;
    }

    .page-title {
      @apply text-3xl font-bold text-black-900 dark:text-white-100;
    }

    .page-subtitle {
      @apply text-black-600 dark:text-white-400;
    }

    /* Search Section */
    .search-section {
      @apply bg-white dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply space-y-6;
    }

    .search-header {
      @apply flex items-center space-x-3;
    }

    .search-icon {
      @apply text-kaspa-600 dark:text-kaspa-400 text-xl;
    }

    .search-title {
      @apply text-xl font-semibold text-black-900 dark:text-white-100;
    }

    .search-description {
      @apply text-black-600 dark:text-white-400 leading-relaxed;
    }

    .search-form {
      @apply space-y-4;
    }

    .search-input-container {
      @apply flex space-x-3;
    }

    .search-input {
      @apply flex-1 px-4 py-3 rounded-lg border border-white-300 dark:border-black-600;
      @apply bg-white dark:bg-black-700 text-black-900 dark:text-white-100;
      @apply focus:ring-2 focus:ring-kaspa-500 focus:border-kaspa-500;
      @apply placeholder-black-400 dark:placeholder-white-400;
      @apply font-mono text-sm;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    /* Cyberpunk theme overrides */
    :host-context(.cyberpunk-theme) .search-input {
      background: linear-gradient(135deg, #001a1a, #000d0d);
      border: 2px solid #00ffff;
      color: #00ffff;
      box-shadow: 
        0 0 15px rgba(0, 255, 255, 0.3),
        inset 0 0 15px rgba(0, 255, 255, 0.1);
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }

    :host-context(.cyberpunk-theme) .search-input::placeholder {
      color: rgba(0, 255, 255, 0.6);
      text-shadow: 0 0 3px rgba(0, 255, 255, 0.3);
    }

    :host-context(.cyberpunk-theme) .search-input:focus {
      border-color: #ff00ff;
      box-shadow: 
        0 0 20px rgba(255, 0, 255, 0.4),
        0 0 30px rgba(0, 255, 255, 0.3),
        inset 0 0 20px rgba(0, 255, 255, 0.15);
      outline: none;
      animation: search-pulse 2s ease-in-out infinite alternate;
    }

    :host-context(.cyberpunk-theme) .search-input:disabled {
      background: linear-gradient(135deg, #001111, #000808);
      border-color: rgba(0, 255, 255, 0.3);
      color: rgba(0, 255, 255, 0.5);
      box-shadow: 
        0 0 10px rgba(0, 255, 255, 0.1),
        inset 0 0 10px rgba(0, 255, 255, 0.05);
    }

    @keyframes search-pulse {
      0% {
        box-shadow: 
          0 0 20px rgba(255, 0, 255, 0.4),
          0 0 30px rgba(0, 255, 255, 0.3),
          inset 0 0 20px rgba(0, 255, 255, 0.15);
      }
      100% {
        box-shadow: 
          0 0 30px rgba(255, 0, 255, 0.6),
          0 0 40px rgba(0, 255, 255, 0.5),
          inset 0 0 25px rgba(0, 255, 255, 0.2);
      }
    }


    .button-icon {
      @apply text-sm;
    }

    .search-error {
      @apply flex items-center space-x-2 text-red-600 dark:text-red-400;
      @apply bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-lg;
    }

    .error-icon {
      @apply text-sm;
    }

    /* Search Result */
    .search-result {
      @apply mt-6;
    }

    .user-profile-card {
      @apply bg-gray-50 dark:bg-black-700 rounded-lg p-6;
      @apply border border-white-200 dark:border-black-600;
      @apply space-y-4;
    }

    .profile-header {
      @apply flex items-start space-x-4;
    }

    .profile-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-16 h-16 rounded-full object-cover;
      @apply border-2 border-white dark:border-black-800;
    }

    .avatar-placeholder {
      @apply w-16 h-16 rounded-full bg-white-200 dark:bg-black-600;
      @apply flex items-center justify-center;
      @apply border-2 border-white dark:border-black-800;
    }

    .placeholder-icon {
      @apply text-2xl text-black-400 dark:text-white-400;
    }

    .profile-info {
      @apply flex-1 space-y-1;
    }

    .profile-name {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }

    .profile-address {
      @apply text-sm font-mono text-black-500 dark:text-white-400;
    }

    .profile-bio {
      @apply text-sm text-black-600 dark:text-white-300;
    }


    .profile-actions {
      @apply flex justify-end;
    }


    .self-profile-message {
      @apply flex items-center space-x-2 text-blue-600 dark:text-blue-400;
      @apply bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg;
    }

    .info-icon {
      @apply text-sm;
    }

    .already-subscribed {
      @apply flex items-center space-x-2 text-green-600 dark:text-green-400;
      @apply bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg;
    }

    .check-icon {
      @apply text-sm;
    }

    /* No Profile Card */
    .no-profile-card {
      @apply bg-gray-50 dark:bg-black-700 rounded-lg p-8;
      @apply border border-white-200 dark:border-black-600;
      @apply text-center space-y-4;
    }

    .no-profile-icon {
      @apply flex justify-center;
    }

    .no-profile-icon .icon {
      @apply text-4xl text-black-400 dark:text-white-400;
    }

    .no-profile-title {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }

    .no-profile-description {
      @apply text-black-600 dark:text-white-400;
    }

    .no-profile-hint {
      @apply text-sm text-black-500 dark:text-white-400 italic;
    }

    /* Subscriptions Section */
    .subscriptions-section {
      @apply bg-white dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply space-y-6;
    }

    .section-header {
      @apply flex items-center space-x-3;
    }

    .section-icon {
      @apply text-kaspa-600 dark:text-kaspa-400 text-xl;
    }

    .section-title {
      @apply text-xl font-semibold text-black-900 dark:text-white-100 flex-1;
    }

    .subscription-count {
      @apply bg-kaspa-100 dark:bg-kaspa-900/30 text-kaspa-700 dark:text-kaspa-300;
      @apply px-3 py-1 rounded-full text-sm font-medium;
    }

    .refresh-subscriptions-btn {
      @apply flex items-center gap-2 px-3 py-1;
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

    .refresh-icon {
      @apply text-xs;
    }

    /* Cyberpunk theme overrides for refresh button */
    :host-context(.cyberpunk-theme) .refresh-subscriptions-btn {
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

    /* Empty State */
    .empty-subscriptions {
      @apply text-center py-12 space-y-4;
    }

    .empty-icon .icon {
      @apply text-6xl text-black-300 dark:text-white-400;
    }

    .empty-title {
      @apply text-xl font-semibold text-black-900 dark:text-white-100;
    }

    .empty-description {
      @apply text-black-600 dark:text-white-400 max-w-md mx-auto;
    }

    /* Subscriptions List */
    .subscriptions-list {
      @apply space-y-4;
    }

    .subscription-item {
      @apply bg-gray-50 dark:bg-black-700 rounded-lg border border-white-200 dark:border-black-600;
      @apply hover:bg-gray-100 dark:hover:bg-black-600 transition-colors duration-200;
    }

    .subscription-content {
      @apply flex items-center p-4 space-x-4;
    }

    /* Profile Picture */
    .subscription-avatar {
      @apply flex-shrink-0;
    }

    .subscription-avatar .avatar-img {
      @apply w-12 h-12 rounded-full object-cover;
      @apply border-2 border-white dark:border-black-800;
    }

    .subscription-avatar .avatar-placeholder {
      @apply w-12 h-12 rounded-full;
      @apply bg-gradient-to-br from-kaspa-100 to-kaspa-200;
      @apply dark:from-kaspa-800 dark:to-kaspa-900;
      @apply flex items-center justify-center;
      @apply border-2 border-white dark:border-black-800;
    }

    .subscription-avatar .placeholder-icon {
      @apply text-2xl text-kaspa-600 dark:text-kaspa-400;
    }

    /* User Info */
    .subscription-info {
      @apply flex-1 min-w-0;
    }

    .subscription-main-info {
      @apply mb-2;
    }

    .subscription-name {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
      @apply truncate;
    }

    .subscription-address {
      @apply text-sm font-mono text-black-500 dark:text-white-400;
      @apply truncate;
    }

    .subscription-meta {
      @apply space-y-1;
    }

    .subscription-bio {
      @apply text-sm text-black-600 dark:text-white-300;
      @apply line-clamp-2;
    }

    .subscription-date {
      @apply flex items-center space-x-2 text-xs text-black-500 dark:text-white-400;
    }

    .date-icon {
      @apply text-xs;
    }

    /* Actions */
    .subscription-actions {
      @apply flex-shrink-0;
    }

    .unsubscribe-button {
      @apply flex items-center space-x-2 px-4 py-2;
      @apply bg-red-100 hover:bg-red-200 text-red-700;
      @apply dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400;
      @apply rounded-lg text-sm font-medium transition-colors duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      @apply shadow-sm hover:shadow-md;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .search-input-container {
        @apply flex-col space-x-0 space-y-3;
      }

      .profile-header {
        @apply flex-col space-x-0 space-y-4 text-center;
      }

      .subscription-content {
        @apply flex-col space-x-0 space-y-4 text-center p-4;
      }

      .subscription-info {
        @apply text-center;
      }

      .subscription-name {
        @apply text-base;
      }

      .subscription-actions {
        @apply w-full;
      }

      .unsubscribe-button {
        @apply w-full justify-center;
      }
    }
  `]
})
export class SubscriptionsComponent implements OnInit {
  public subscriptionService = inject(SubscriptionService);
  private toastService = inject(ToastService);
  private walletService = inject(KaswareWalletService);
  private userService = inject(UserService);

  // State
  public searchAddress = signal('');
  public searchResult = signal<UserSearchResult | null>(null);
  public searchError = signal('');
  public isRefreshing = signal(false);

  // Computed values
  public readonly activeSubscriptions = this.subscriptionService.activeSubscriptions;

  ngOnInit(): void {
    // Initialize the subscription service
    this.subscriptionService.initialize();
  }

  /**
   * Search for a user by address
   */
  async searchUser(): Promise<void> {
    const address = this.searchAddress().trim();
    if (!address) {
      this.searchError.set('Please enter an address');
      return;
    }

    try {
      this.searchError.set('');
      this.searchResult.set(null);

      const userProfile = await this.subscriptionService.searchUserProfile(address);
      this.searchResult.set(userProfile);
      
    } catch (error: any) {
      this.searchError.set(error.message || 'Failed to search user');
      this.searchResult.set(null);
    }
  }

  /**
   * Subscribe to a user
   */
  async subscribeToUser(userProfile: UserSearchResult): Promise<void> {
    try {
      await this.subscriptionService.subscribeToUser(userProfile);
      // Clear search result after successful subscription
      this.searchResult.set(null);
      this.searchAddress.set('');
    } catch (error: any) {
      this.toastService.error(
        error.message || 'Failed to subscribe',
        'Subscription Failed'
      );
    }
  }

  /**
   * Unsubscribe from a user
   */
  async unsubscribeFromUser(subscription: Subscription): Promise<void> {
    try {
      await this.subscriptionService.unsubscribeFromUser(subscription);
    } catch (error: any) {
      this.toastService.error(
        error.message || 'Failed to unsubscribe',
        'Unsubscribe Failed'
      );
    }
  }

  /**
   * Check if subscribed to address
   */
  isSubscribedTo(address: string): boolean {
    return this.subscriptionService.isSubscribedTo(address);
  }

  /**
   * Check if the address is the current user's own address
   */
  isSelfProfile(address: string): boolean {
    const currentUser = this.userService.currentUser();
    return currentUser?.address === address;
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    return this.walletService.formatAddress(address, 8);
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

  /**
   * Format date for display
   */
  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  /**
   * Track by function for subscription list
   */
  trackByAddress(index: number, subscription: Subscription): string {
    return subscription.address;
  }

  /**
   * Refresh subscriptions from blockchain
   */
  async refreshSubscriptions(): Promise<void> {
    try {
      this.isRefreshing.set(true);
      
      await this.subscriptionService.loadSubscriptions();
      
      this.toastService.success(
        `Found ${this.activeSubscriptions().length} active subscriptions`,
        'Subscriptions Refreshed'
      );
    } catch (error: any) {
      this.toastService.error(
        'Failed to refresh subscriptions',
        'Refresh Error'
      );
    } finally {
      this.isRefreshing.set(false);
    }
  }
}