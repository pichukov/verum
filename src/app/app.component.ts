import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { HeaderComponent } from './components/layout/header/header.component';
import { LeftSidebarComponent } from './components/layout/left-sidebar/left-sidebar.component';
import { RightSidebarComponent } from './components/layout/right-sidebar/right-sidebar.component';
import { AccountSetupComponent } from './components/user/account-setup/account-setup.component';
import { ToastContainerComponent } from './components/ui/toast-container/toast-container.component';
import { NetworkRestrictionComponent } from './components/ui/network-restriction/network-restriction.component';
import { WalletConnectComponent } from './components/pages/wallet-connect/wallet-connect.component';
import { WalletManagerService } from './services/wallet-manager.service';
import { UserService } from './services/user.service';
import { ToastService } from './services/toast.service';
import { SubscriptionService } from './services/subscription.service';
import { ThemeService } from './services/theme.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    FontAwesomeModule,
    HeaderComponent,
    LeftSidebarComponent,
    RightSidebarComponent,
    AccountSetupComponent,
    ToastContainerComponent,
    NetworkRestrictionComponent,
    WalletConnectComponent
  ],
  template: `
    <!-- Toast notifications -->
    <app-toast-container></app-toast-container>
    
    <!-- Main app content -->
    <div class="app-container">
      <!-- Loading screen while checking wallet/user status -->
      @if (isInitializing()) {
        <div class="loading-screen">
          <div class="loading-container">
            <div class="loading-content">
              <div class="loading-spinner">
                <div class="spinner"></div>
              </div>
              <h2 class="loading-title">Connecting to Verum</h2>
              <p class="loading-text">
                @if (walletManager.loading()) {
                  Connecting to wallet...
                } @else if (userService.isCheckingUser()) {
                  Loading your profile...
                } @else {
                  Please wait...
                }
              </p>
            </div>
          </div>
        </div>
      }
      
      <!-- Wallet connection screen for non-connected users -->
      @else if (!walletManager.isConnected()) {
        <app-wallet-connect></app-wallet-connect>
      }

      <!-- Connected App Layout -->
      @else if (walletManager.isConnected()) {
        <div class="connected-layout">
          <!-- Header (always show) -->
          <app-header></app-header>
          
          <!-- Network Restriction Screen (positioned after header) -->
          @if (shouldShowNetworkRestriction()) {
            <app-network-restriction></app-network-restriction>
          }
          
          <!-- Account setup for connected users without profile -->
          @if (!userService.accountExists() && !shouldShowNetworkRestriction()) {
            <app-account-setup class="account-setup-overlay"></app-account-setup>
          }
          
          <!-- Main Layout for users with accounts -->
          @if (userService.accountExists() && !shouldShowNetworkRestriction()) {
            <div class="main-layout">
              <div class="left-sidebar">
                <app-left-sidebar></app-left-sidebar>
              </div>
              
              <div class="main-content">
                <router-outlet></router-outlet>
              </div>
              
              <div class="right-sidebar">
                <app-right-sidebar></app-right-sidebar>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .app-container {
      @apply min-h-screen;
    }

    .loading-screen {
      @apply min-h-screen bg-gray-50 dark:bg-black-900;
      @apply flex items-center justify-center p-6;
    }
    
    .loading-container {
      @apply text-center space-y-6 max-w-md mx-auto;
    }
    
    .loading-content {
      @apply space-y-6;
    }
    
    .loading-spinner {
      @apply flex justify-center mb-6;
    }
    
    .spinner {
      @apply w-12 h-12 border-4 border-gray-200 dark:border-black-700 border-t-kaspa-600 dark:border-t-kaspa-400 rounded-full;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-title {
      @apply text-2xl font-heading font-semibold text-black-900 dark:text-white-100 mb-2;
    }
    
    .loading-text {
      @apply text-black-600 dark:text-white-400 font-body;
    }

    /* Connected Layout */
    .connected-layout {
      @apply min-h-screen;
    }

    .account-setup-overlay {
      @apply relative z-10;
    }

    /* Main Three-Column Layout */
    .main-layout {
      @apply max-w-screen-xl mx-auto px-6 py-6;
      @apply grid grid-cols-1 xl:grid-cols-[290px_1fr_320px] gap-8;
      @apply min-h-screen;
    }

    .left-sidebar {
      @apply hidden xl:block;
    }

    .main-content {
      @apply w-full max-w-none;
      @apply lg:max-w-2xl mx-auto xl:mx-0;
    }

    .right-sidebar {
      @apply hidden xl:block;
    }

    /* Responsive adjustments */
    @media (max-width: 1279px) {
      .main-layout {
        @apply grid-cols-1 max-w-2xl;
      }
    }

    @media (max-width: 1023px) {
      .main-layout {
        @apply px-4;
      }
    }
  `]
})
export class AppComponent {
  public walletManager = inject(WalletManagerService);
  public userService = inject(UserService);
  private toastService = inject(ToastService);
  private subscriptionService = inject(SubscriptionService);
  private themeService = inject(ThemeService);
  
  title = 'Verum - Kaspa Social';
  
  // Network restriction state
  private isNetworkRestricted = signal(false);
  
  // Computed property to check if we're in initial loading state
  isInitializing = computed(() => {
    // Show loading if:
    // 1. Wallet is trying to connect (loading state)
    // 2. Wallet is connected but we're checking for user profile
    // 3. During the initial startup period
    const walletLoading = this.walletManager.loading();
    const walletConnected = this.walletManager.isConnected();
    const checkingUser = this.userService.isCheckingUser();
    
    return walletLoading || (walletConnected && checkingUser);
  });

  constructor() {
    // Watch for wallet connection changes and load user profile
    this.setupWalletWatcher();
    
    // Watch for network changes
    this.setupNetworkWatcher();
  }

  private setupWalletWatcher(): void {
    // Use a more robust polling approach with better conditions
    let attempts = 0;
    const maxAttempts = 15; // 15 seconds max
    
    // Set initial checking state if wallet is already connected
    if (this.walletManager.isConnected() && !this.userService.currentUser()) {
      this.userService['_isCheckingUser'].set(true);
    }
    
    const checkConnection = () => {
      attempts++;
      
      if (this.walletManager.isConnected()) {
        const address = this.walletManager.address();
        if (address && !this.userService.currentUser()) {
          this.loadUserProfile();
          return; // Stop checking
        }
      }
      
      // Continue checking if not connected or no address yet
      if (attempts < maxAttempts) {
        setTimeout(checkConnection, 1000);
      }
    };

    // Start checking after a small delay
    setTimeout(checkConnection, 200);
  }

  private async loadUserProfile(): Promise<void> {
    try {
      await this.userService.loadCurrentUser();
      // Initialize subscriptions after user is loaded
      await this.subscriptionService.loadSubscriptions();
      
    } catch (error) {
    }
  }

  /**
   * Setup network watcher
   */
  private setupNetworkWatcher(): void {
    // Create an effect to watch network changes
    effect(() => {
      const network = this.walletManager.network();
      const isConnected = this.walletManager.isConnected();
      
      console.log('[AppComponent] Network watcher triggered:', {
        network,
        isConnected,
        environmentNetworkMode: environment.networkMode,
        isTestMode: environment.networkMode === 'test'
      });
      
      // Only check if in test mode and connected
      if (environment.networkMode === 'test' && isConnected) {
        const shouldRestrict = network !== 'testnet-10';
        console.log('[AppComponent] Network restriction check:', {
          currentNetwork: network,
          expectedNetwork: 'testnet-10',
          shouldRestrict
        });
        this.isNetworkRestricted.set(shouldRestrict);
      } else {
        this.isNetworkRestricted.set(false);
      }
    });
  }
  
  /**
   * Check if network restriction screen should be shown
   */
  shouldShowNetworkRestriction(): boolean {
    return this.isNetworkRestricted();
  }
}