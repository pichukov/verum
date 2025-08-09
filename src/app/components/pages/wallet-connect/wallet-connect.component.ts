import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { WalletSelectorComponent } from '../../ui/wallet-selector/wallet-selector.component';
import { WalletManagerService, WalletType } from '../../../services/wallet-manager.service';
import { UserService } from '../../../services/user.service';
import { ButtonComponent } from '../../ui/button/button.component';

@Component({
  selector: 'app-wallet-connect',
  standalone: true,
  imports: [
    CommonModule,
    FontAwesomeModule,
    WalletSelectorComponent,
    ButtonComponent
  ],
  template: `
    <div class="wallet-connect-page">
      @if (showWalletSelector()) {
        <app-wallet-selector
          (walletConnected)="onWalletConnected($event)"
          (walletConnectionFailed)="onWalletConnectionFailed($event)">
        </app-wallet-selector>
      } @else {
        <!-- Connected State -->
        <div class="connected-container">
          <div class="connected-content">
            <!-- Header -->
            <div class="connected-header">
              <div class="icon-container">
                <fa-icon [icon]="['fas', 'check-circle']" class="success-icon"></fa-icon>
              </div>
              <h2 class="connected-title">Wallet Connected Successfully!</h2>
              <p class="connected-subtitle">
                Your {{ getWalletDisplayName() }} wallet is now connected to Verum
              </p>
            </div>

            <!-- Wallet Info -->
            <div class="wallet-info-card">
              <div class="wallet-info-item">
                <span class="info-label">Wallet:</span>
                <span class="info-value">{{ getWalletDisplayName() }}</span>
              </div>
              <div class="wallet-info-item">
                <span class="info-label">Address:</span>
                <code class="info-address">{{ getFormattedAddress() }}</code>
              </div>
              <div class="wallet-info-item">
                <span class="info-label">Network:</span>
                <span class="info-value">{{ walletManager.getNetworkDisplayName() }}</span>
              </div>
            </div>

            <!-- Next Steps -->
            <div class="next-steps">
              @if (needsAccountSetup()) {
                <div class="step-card">
                  <fa-icon [icon]="['fas', 'user-plus']" class="step-icon"></fa-icon>
                  <div class="step-content">
                    <h3 class="step-title">Create Your Profile</h3>
                    <p class="step-description">
                      Set up your Verum profile to start posting and interacting with the community
                    </p>
                  </div>
                </div>
                
                <app-button
                  type="button"
                  variant="primary"
                  size="lg"
                  (click)="goToAccountSetup()"
                  class="action-button">
                  <fa-icon [icon]="['fas', 'arrow-right']" class="button-icon"></fa-icon>
                  Create Profile
                </app-button>
              } @else {
                <div class="step-card">
                  <fa-icon [icon]="['fas', 'home']" class="step-icon"></fa-icon>
                  <div class="step-content">
                    <h3 class="step-title">Welcome Back!</h3>
                    <p class="step-description">
                      Your profile is already set up. You can now access your dashboard
                    </p>
                  </div>
                </div>
                
                <app-button
                  type="button"
                  variant="primary"
                  size="lg"
                  (click)="goToDashboard()"
                  class="action-button">
                  <fa-icon [icon]="['fas', 'arrow-right']" class="button-icon"></fa-icon>
                  Go to Dashboard
                </app-button>
              }
            </div>

            <!-- Secondary Actions -->
            <div class="secondary-actions">
              <app-button
                type="button"
                variant="ghost"
                size="sm"
                (click)="disconnectWallet()"
                class="disconnect-button">
                <fa-icon [icon]="['fas', 'sign-out-alt']" class="button-icon"></fa-icon>
                Disconnect Wallet
              </app-button>
            </div>
          </div>
        </div>
      }

      <!-- Loading Overlay -->
      @if (isLoading()) {
        <div class="loading-overlay">
          <div class="loading-content">
            <fa-icon [icon]="['fas', 'spinner']" class="loading-icon animate-spin"></fa-icon>
            <span class="loading-text">{{ loadingText() }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .wallet-connect-page {
      @apply min-h-screen relative;
    }
    
    .connected-container {
      @apply min-h-screen bg-gradient-to-br from-green-50 to-white-100;
      @apply dark:from-black-900 dark:to-black-800;
      @apply flex items-center justify-center p-6;
    }
    
    .connected-content {
      @apply w-full max-w-lg bg-white-900 dark:bg-black-800;
      @apply rounded-xl shadow-xl border border-white-200 dark:border-black-700;
      @apply p-8 space-y-8;
    }
    
    .connected-header {
      @apply text-center space-y-4;
    }
    
    .icon-container {
      @apply mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30;
      @apply rounded-full flex items-center justify-center;
    }
    
    .success-icon {
      @apply text-2xl text-green-600 dark:text-green-400;
    }
    
    .connected-title {
      @apply text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    .connected-subtitle {
      @apply text-black-600 dark:text-white-400;
    }
    
    .wallet-info-card {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20 p-4 rounded-lg space-y-3;
      @apply border border-kaspa-200 dark:border-kaspa-800;
    }
    
    .wallet-info-item {
      @apply flex justify-between items-center;
    }
    
    .info-label {
      @apply text-sm font-medium text-black-600 dark:text-white-400;
    }
    
    .info-value {
      @apply text-sm font-semibold text-black-800 dark:text-white-200;
    }
    
    .info-address {
      @apply text-sm font-mono text-kaspa-700 dark:text-kaspa-300;
      @apply bg-white-200 dark:bg-black-700 px-2 py-1 rounded;
    }
    
    .next-steps {
      @apply space-y-6;
    }
    
    .step-card {
      @apply flex items-start space-x-4 p-4 rounded-lg;
      @apply bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800;
    }
    
    .step-icon {
      @apply text-2xl text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1;
    }
    
    .step-content {
      @apply space-y-2;
    }
    
    .step-title {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }
    
    .step-description {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .action-button {
      @apply w-full;
    }
    
    .button-icon {
      @apply mr-2;
    }
    
    .secondary-actions {
      @apply pt-6 border-t border-white-200 dark:border-black-700 text-center;
    }
    
    .disconnect-button {
      @apply text-red-600 dark:text-red-400;
    }
    
    .loading-overlay {
      @apply fixed inset-0 bg-black-900/50 dark:bg-black-900/70;
      @apply flex items-center justify-center z-50;
    }
    
    .loading-content {
      @apply bg-white-900 dark:bg-black-800 p-6 rounded-lg;
      @apply flex flex-col items-center space-y-4;
      @apply border border-white-200 dark:border-black-700;
    }
    
    .loading-icon {
      @apply text-3xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    .loading-text {
      @apply text-black-800 dark:text-white-200 font-medium;
    }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .connected-content {
        @apply p-6;
      }
      
      .connected-title {
        @apply text-xl;
      }
    }
  `]
})
export class WalletConnectComponent {
  public walletManager = inject(WalletManagerService);
  private userService = inject(UserService);
  private router = inject(Router);
  
  // Component state
  public showWalletSelector = signal(true);
  public isLoading = signal(false);
  public loadingText = signal('');
  
  constructor() {
    // Check if already connected
    if (this.walletManager.isConnected()) {
      this.showWalletSelector.set(false);
    }
  }
  
  public onWalletConnected(event: {id: 'kasware', address: string}): void {
    this.showWalletSelector.set(false);
    
    // Check if user needs account setup
    this.checkUserAccountStatus();
  }
  
  public onWalletConnectionFailed(event: {id: 'kasware', error: string}): void {
    // Error handling is already done in the wallet selector component
  }
  
  private async checkUserAccountStatus(): Promise<void> {
    this.isLoading.set(true);
    this.loadingText.set('Checking account status...');
    
    try {
      const address = this.walletManager.address();
      console.log('[WalletConnect] checkUserAccountStatus with address:', address);
      // Check if user already has an account - use loadCurrentUser instead
      await this.userService.loadCurrentUser();
    } catch (error) {
      console.log('[WalletConnect] Error checking account status:', error);
      // User doesn't have an account, which is fine
    } finally {
      this.isLoading.set(false);
    }
  }
  
  public needsAccountSetup(): boolean {
    const hasAccount = this.userService.hasAccount();
    const currentUser = this.userService.currentUser();
    const isChecking = this.userService.isCheckingUser();
    
    console.log('[WalletConnect] 🔍 needsAccountSetup check:', {
      hasAccount,
      currentUser: currentUser ? `${currentUser.nickname} (${currentUser.address.substring(0, 10)}...)` : 'null',
      isChecking,
      result: !hasAccount
    });
    
    return !hasAccount;
  }
  
  public getWalletDisplayName(): string {
    const walletType = this.walletManager.connectedWallet();
    switch (walletType) {
      case 'kasware':
        return 'Kasware';
      default:
        return 'Wallet';
    }
  }
  
  public getFormattedAddress(): string {
    return this.walletManager.formatAddress(this.walletManager.address(), 6);
  }
  
  public async goToAccountSetup(): Promise<void> {
    await this.router.navigate(['/setup']);
  }
  
  public async goToDashboard(): Promise<void> {
    await this.router.navigate(['/dashboard']);
  }
  
  public async disconnectWallet(): Promise<void> {
    this.isLoading.set(true);
    this.loadingText.set('Disconnecting wallet...');
    
    try {
      await this.walletManager.disconnect();
      this.showWalletSelector.set(true);
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
}