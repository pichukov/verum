import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ButtonComponent } from '../../ui/button/button.component';
import { ThemeToggleComponent } from '../../ui/theme-toggle/theme-toggle.component';
import { NetworkSwitcherComponent } from '../../ui/network-switcher/network-switcher.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';
import { UserService } from '../../../services/user.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, ButtonComponent, ThemeToggleComponent, NetworkSwitcherComponent, FontAwesomeModule],
  template: `
    <nav class="navbar">
      <div class="navbar-container">
        <!-- Logo/Brand -->
        <div class="navbar-brand">
          <h1 class="text-h4 font-bold text-kaspa-600">Verum</h1>
          <span class="text-label text-black-500 dark:text-white-500 ml-2">Social on Kaspa</span>
        </div>

        <!-- Navigation Links -->
        @if (userService.currentUser()) {
          <div class="navbar-links">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
              <fa-icon [icon]="['fas', 'home']" class="icon"></fa-icon>
              <span>Home</span>
            </a>
            <a routerLink="/profile" routerLinkActive="active" class="nav-link">
              <fa-icon [icon]="['fas', 'user']" class="icon"></fa-icon>
              <span>Profile</span>
            </a>
          </div>
        }

        <!-- Right Side Actions -->
        <div class="navbar-actions">
          <!-- Network Switcher -->
          @if (walletService.isInstalled()) {
            <app-network-switcher></app-network-switcher>
          }
          
          <!-- Theme Toggle -->
          <app-theme-toggle></app-theme-toggle>
          
          <!-- Connect Wallet Button / Wallet Info -->
          <div class="wallet-section">
            <!-- Not Installed State -->
            @if (!walletService.isInstalled()) {
              <div class="wallet-not-installed">
                <app-button 
                  variant="secondary" 
                  size="md"
                  (click)="installWallet()">
                  <fa-icon [icon]="['fas', 'download']" class="mr-2"></fa-icon>
                  Install Kasware
                </app-button>
              </div>
            }

            <!-- Installed but Not Connected -->
            @if (walletService.isInstalled() && !walletService.isConnected()) {
              <div class="wallet-disconnected">
                <app-button 
                  variant="primary" 
                  size="md"
                  [disabled]="walletService.loading()"
                  (click)="connectWallet()">
                  <fa-icon [icon]="['fas', 'wallet']" class="mr-2"></fa-icon>
                  {{ walletService.loading() ? 'Connecting...' : 'Connect Wallet' }}
                </app-button>
              </div>
            }

            <!-- Connected State -->
            @if (walletService.isConnected()) {
              <div class="wallet-connected">
                <!-- User Profile Info (if exists) -->
                @if (userService.currentUser()) {
                  <div class="user-profile-info">
                <div class="user-avatar">
                  @if (userService.currentUser()?.avatar) {
                    <img 
                      [src]="getUserAvatarUrl()" 
                      [alt]="userService.currentUser()?.nickname"
                      class="avatar-img">
                  } @else {
                    <div class="avatar-placeholder">
                      <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                    </div>
                  }
                </div>
                <div class="user-info">
                  <div class="user-nickname">
                    {{ userService.currentUser()?.nickname }}
                  </div>
                  <div class="wallet-balance-compact">
                    {{ formatBalance() }} KAS
                  </div>
                </div>
                  </div>
                }

                <!-- Wallet Only Info (if no user profile) -->
                @if (!userService.currentUser()) {
                  <div class="wallet-info">
                    <div class="wallet-balance-compact">
                      {{ formatBalance() }} KAS
                    </div>
                    <div class="wallet-address-compact">
                      {{ formatAddress() }}
                    </div>
                  </div>
                }

                <!-- Disconnect Button -->
                <button
                  (click)="disconnectWallet()"
                  [disabled]="walletService.loading()"
                  class="disconnect-btn-compact"
                  title="Disconnect Wallet">
                  <fa-icon [icon]="['fas', 'sign-out-alt']"></fa-icon>
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      @apply bg-white-900 dark:bg-black-900 border-b border-white-300 dark:border-black-800 sticky top-0 z-50;
      @apply shadow-small;
    }

    .navbar-container {
      @apply max-w-7xl mx-auto px-6 py-4;
      @apply flex items-center justify-between;
    }

    .navbar-brand {
      @apply flex items-center flex-shrink-0;
    }

    .navbar-links {
      @apply hidden md:flex items-center space-x-8 flex-1 justify-center;
    }

    .nav-link {
      @apply flex items-center space-x-2 px-3 py-2 rounded-md text-body;
      @apply text-black-600 dark:text-white-400 hover:text-black-900 dark:hover:text-white-100;
      @apply hover:bg-white-200 dark:hover:bg-black-800;
      @apply transition-colors duration-200;
    }

    .nav-link.active {
      @apply text-kaspa-600 dark:text-kaspa-400 bg-kaspa-50 dark:bg-kaspa-900/20;
    }

    .nav-link.disabled {
      @apply text-black-400 dark:text-white-400 cursor-not-allowed;
      @apply hover:text-black-400 dark:hover:text-white-400;
      @apply hover:bg-transparent dark:hover:bg-transparent;
    }

    .nav-link .icon {
      @apply text-base;
    }

    .navbar-actions {
      @apply flex items-center space-x-4;
    }

    .wallet-section {
      @apply flex items-center;
    }

    .wallet-connected {
      @apply flex items-center bg-white-200 dark:bg-black-800 rounded-md border border-white-300 dark:border-black-700;
      @apply h-10; /* Match nav-link height */
    }

    .wallet-info {
      @apply px-3 py-1 flex flex-col justify-center;
      @apply min-w-0; /* Allow text truncation */
    }

    /* User Profile Info */
    .user-profile-info {
      @apply px-3 py-1 flex items-center space-x-3;
      @apply min-w-0; /* Allow text truncation */
    }

    .user-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-8 h-8 rounded-full object-cover;
      @apply border border-kaspa-200 dark:border-kaspa-700;
    }

    .avatar-placeholder {
      @apply w-8 h-8 rounded-full bg-white-300 dark:bg-black-600;
      @apply flex items-center justify-center;
      @apply border border-white-400 dark:border-black-500;
    }

    .placeholder-icon {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .user-info {
      @apply flex flex-col justify-center min-w-0;
    }

    .user-nickname {
      @apply text-xs font-semibold text-black-900 dark:text-white-100 leading-tight;
      @apply truncate max-w-24; /* Limit width and add ellipsis */
    }

    .wallet-balance-compact {
      @apply text-xs font-semibold text-kaspa-600 dark:text-kaspa-400 leading-tight;
      @apply flex items-center;
    }


    .wallet-address-compact {
      @apply text-xs text-black-500 dark:text-white-400 font-mono leading-tight;
      @apply truncate max-w-20; /* Limit width and add ellipsis */
    }

    .disconnect-btn-compact {
      @apply px-2 h-full rounded-r-md text-black-500 dark:text-white-400;
      @apply hover:text-red-600 dark:hover:text-red-400 hover:bg-white-300 dark:hover:bg-black-700;
      @apply transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed;
      @apply border-l border-white-300 dark:border-black-700;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .navbar-container {
        @apply px-4 py-3;
      }
      
      .navbar-brand span {
        @apply hidden;
      }
      
      .nav-link span {
        @apply hidden;
      }
      
      .navbar-links {
        @apply flex space-x-4;
      }

      .wallet-info {
        @apply px-2; /* Reduce padding on mobile */
      }

      .wallet-address-compact {
        @apply max-w-16; /* Even more compact on mobile */
      }

      .disconnect-btn-compact {
        @apply px-1; /* Smaller disconnect button on mobile */
      }

    }
  `]
})
export class NavbarComponent {
  public walletService = inject(KaswareWalletService);
  public userService = inject(UserService);
  private toastService = inject(ToastService);

  async connectWallet(): Promise<void> {
    try {
      const accounts = await this.walletService.connect();
      
      this.toastService.success(
        `Connected to ${this.formatAddress()}`,
        'Wallet Connected'
      );
    } catch (error: any) {
      let errorMessage = 'Failed to connect wallet';
      if (error?.message) {
        errorMessage = error.message;
      }
      
      this.toastService.error(errorMessage, 'Connection Failed');
    }
  }

  async disconnectWallet(): Promise<void> {
    try {
      await this.walletService.disconnect();
      
      this.toastService.info('Wallet disconnected successfully', 'Disconnected');
    } catch (error: any) {
      this.toastService.error(
        error?.message || 'Failed to disconnect wallet',
        'Disconnection Failed'
      );
    }
  }

  installWallet(): void {
    window.open('https://kasware.xyz', '_blank');
    
    this.toastService.info(
      'Please install the Kasware browser extension and refresh this page',
      'Install Kasware Wallet'
    );
  }

  formatBalance(): string {
    const balance = this.walletService.balance();
    if (!balance) return '0.00';
    // Format with fewer decimals for compact display
    const kasAmount = balance.total / 100000000;
    return kasAmount < 1 ? kasAmount.toFixed(4) : kasAmount.toFixed(2);
  }

  formatAddress(): string {
    const address = this.walletService.account();
    return this.walletService.formatAddress(address, 4); // Shorter for compact widget
  }

  /**
   * Get user avatar URL for display in navbar
   */
  getUserAvatarUrl(): string {
    const user = this.userService.currentUser();
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