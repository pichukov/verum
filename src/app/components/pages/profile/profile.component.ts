import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../../ui/button/button.component';
import { PaymentPreferencesComponent } from '../../ui/payment-preferences/payment-preferences.component';
import { UserService } from '../../../services/user.service';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    ButtonComponent,
    PaymentPreferencesComponent
  ],
  template: `
    <div class="profile-page">
      <div class="profile-container">
        <!-- Header -->
        <div class="profile-header">
          <h1 class="profile-title">Profile</h1>
          <p class="profile-subtitle">
            Your profile information and payment preferences
          </p>
        </div>

        <!-- Current Profile Info -->
        @if (currentUser()) {
          <div class="current-profile">
          <div class="current-header">
            <fa-icon [icon]="['fas', 'user']" class="current-icon"></fa-icon>
            <h2 class="current-title">Profile Information</h2>
          </div>
          <div class="current-info">
            <div class="current-avatar">
              @if (currentUser()?.avatar) {
                <img 
                  [src]="getCurrentAvatarUrl()" 
                  [alt]="currentUser()?.nickname"
                  class="avatar-img">
              } @else {
                <div class="avatar-placeholder">
                <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                </div>
              }
            </div>
            <div class="current-details">
              <div class="current-nickname">{{ currentUser()?.nickname }}</div>
              <div class="current-address">{{ formatAddress() }}</div>
              <div class="current-joined">
                <fa-icon [icon]="['fas', 'calendar']" class="joined-icon"></fa-icon>
                Joined {{ formatJoinDate() }}
              </div>
            </div>
          </div>
          </div>
        }

        <!-- Payment Preferences -->
        <div class="preferences-section">
          <div class="section-header">
            <fa-icon [icon]="['fas', 'cog']" class="section-icon"></fa-icon>
            <h2 class="section-title">Payment Preferences</h2>
          </div>
          <div class="section-description">
            Configure your default payment amounts for transactions
          </div>
          <div class="payment-preferences-wrapper">
            <app-payment-preferences></app-payment-preferences>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <app-button
            variant="secondary"
            size="lg"
            (click)="goBack()"
            class="back-button">
            <fa-icon [icon]="['fas', 'arrow-left']" class="button-icon"></fa-icon>
            Back to Dashboard
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page {
      @apply space-y-6;
    }

    .profile-container {
      @apply space-y-6;
    }

    /* Header */
    .profile-header {
      @apply text-center space-y-4;
    }

    .profile-title {
      @apply text-3xl font-bold text-black-900 dark:text-white-100;
    }

    .profile-subtitle {
      @apply text-black-600 dark:text-white-400;
    }

    /* Current Profile */
    .current-profile {
      @apply bg-white dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
    }

    .current-header {
      @apply flex items-center space-x-3 mb-4;
    }

    .current-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }

    .current-title {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }

    .current-info {
      @apply flex items-center space-x-4;
    }

    .current-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-20 h-20 rounded-full object-cover;
      @apply border-2 border-kaspa-200 dark:border-kaspa-700;
    }

    .avatar-placeholder {
      @apply w-20 h-20 rounded-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border-2 border-white-300 dark:border-black-600;
    }

    .placeholder-icon {
      @apply text-3xl text-black-400 dark:text-white-400;
    }

    .current-details {
      @apply flex-1 space-y-1;
    }

    .current-nickname {
      @apply text-2xl font-semibold text-black-900 dark:text-white-100;
    }

    .current-address {
      @apply text-sm text-black-500 dark:text-white-400 font-mono;
    }

    .current-joined {
      @apply text-sm text-black-600 dark:text-white-400 flex items-center gap-1;
    }

    .joined-icon {
      @apply text-xs;
    }

    /* Preferences Section */
    .preferences-section {
      @apply bg-white dark:bg-black-800 rounded-xl p-6;
      @apply border border-white-200 dark:border-black-700;
      @apply space-y-4;
    }

    .section-header {
      @apply flex items-center space-x-3 mb-2;
    }

    .section-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }

    .section-title {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }

    .section-description {
      @apply text-sm text-black-600 dark:text-white-400 mb-6;
    }

    .payment-preferences-wrapper {
      @apply mt-4;
    }

    /* Actions */
    .actions {
      @apply flex justify-center pt-4;
    }

    .back-button {
      @apply min-w-48;
    }

    .button-icon {
      @apply mr-2;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .profile-container {
        @apply p-4;
      }

      .current-info {
        @apply flex-col space-x-0 space-y-4 text-center;
      }

      .current-details {
        @apply text-center;
      }

      .current-joined {
        @apply justify-center;
      }
    }
  `]
})
export class ProfileComponent {
  private userService = inject(UserService);
  private walletService = inject(KaswareWalletService);
  private router = inject(Router);

  // State
  public readonly currentUser = this.userService.currentUser;

  /**
   * Go back to dashboard
   */
  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  /**
   * Get current avatar URL
   */
  getCurrentAvatarUrl(): string {
    const user = this.currentUser();
    if (!user?.avatar) return '';
    
    // Check if it's already a data URL
    if (user.avatar.startsWith('data:')) {
      return user.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${user.avatar}`;
  }

  /**
   * Format wallet address
   */
  formatAddress(): string {
    return this.walletService.formatAddress(this.walletService.account(), 12);
  }

  /**
   * Format join date
   */
  formatJoinDate(): string {
    const user = this.currentUser();
    if (!user?.createdAt) return 'Unknown';
    
    const date = new Date(user.createdAt * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}