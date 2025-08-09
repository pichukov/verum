import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserService } from '../../../services/user.service';
import { WalletManagerService } from '../../../services/wallet-manager.service';
import { ToastService } from '../../../services/toast.service';
import { ThemeService } from '../../../services/theme.service';
import { KaspaNetwork } from '../../../types/kasware';
import { VERUM_VERSION } from '../../../types/transaction';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  template: `
    <header class="header">
      <div class="header-container">
        <!-- Logo Section -->
        <div class="logo-section">
          <span class="brand-text">
            <span>V</span><span>E</span><span>R</span><span>U</span><span>M</span>
          </span>
          <span class="brand-subtitle">POWERED BY KASPA</span>
        </div>

        <!-- Controls Section -->
        <div class="controls-section">
          <!-- Theme Selector -->
          <div class="theme-selector">
            <button 
              class="theme-button"
              (click)="toggleThemeMenu()"
              [class.active]="showThemeMenu()">
              <fa-icon 
                [icon]="['fas', getCurrentThemeIcon()]" 
                class="theme-icon">
              </fa-icon>
              <span class="theme-label">{{ getCurrentThemeLabel() }}</span>
              <fa-icon [icon]="['fas', 'chevron-down']" class="dropdown-icon"></fa-icon>
            </button>

            <!-- Theme Dropdown -->
            @if (showThemeMenu()) {
              <div class="theme-dropdown">
              <div class="section-header">
                <fa-icon [icon]="['fas', 'cog']" class="section-icon"></fa-icon>
                <span class="section-title">Theme</span>
              </div>
              <div class="theme-list">
                @for (theme of availableThemes; track theme.style + theme.colorMode) {
                  <button 
                    class="theme-option"
                    [class.active]="isCurrentTheme(theme)"
                    (click)="switchToTheme(theme)">
                    <fa-icon [icon]="['fas', theme.icon]" class="theme-option-icon"></fa-icon>
                    <span class="theme-option-label">{{ theme.label }}</span>
                    @if (isCurrentTheme(theme)) {
                      <fa-icon 
                        [icon]="['fas', 'check']" 
                        class="check-icon">
                      </fa-icon>
                    }
                  </button>
                }
              </div>
              </div>
            }
          </div>

          <!-- Wallet & Network Widget -->
          <div class="wallet-network-widget">
            <button 
              class="wallet-button"
              (click)="toggleWalletMenu()"
              [class.active]="showWalletMenu()">
              <div class="wallet-info">
                <div class="network-indicator">
                  <span class="network-dot" [class]="getCurrentNetworkClass()"></span>
                  <span class="network-name">{{ getCurrentNetworkName() }}</span>
                </div>
                <div class="balance-info">
                  <fa-icon [icon]="['fas', 'wallet']" class="wallet-icon"></fa-icon>
                  <span class="balance-amount">{{ formatBalance() }} KAS</span>
                </div>
              </div>
              <fa-icon [icon]="['fas', 'chevron-down']" class="dropdown-icon"></fa-icon>
            </button>

            <!-- Wallet & Network Dropdown -->
            @if (showWalletMenu()) {
              <div class="wallet-dropdown">
              <!-- Wallet Info Section -->
              <div class="wallet-section">
                <div class="section-header">
                  <fa-icon [icon]="['fas', 'wallet']" class="section-icon"></fa-icon>
                  <span class="section-title">Wallet</span>
                </div>
                <div class="wallet-details">
                  <div class="address-row">
                    <span class="address-label">Address:</span>
                    <span class="address-value">{{ formatAddress() }}</span>
                    <button 
                      class="copy-button" 
                      (click)="copyAddress()"
                      title="Copy address">
                      <fa-icon [icon]="['fas', 'copy']" class="copy-icon"></fa-icon>
                    </button>
                  </div>
                  <div class="balance-row">
                    <span class="balance-label">Balance:</span>
                    <span class="balance-value">{{ formatBalance() }} KAS</span>
                  </div>
                </div>
              </div>

              <!-- Network Section -->
              <div class="network-section">
                <div class="section-header">
                  <fa-icon [icon]="['fas', 'globe']" class="section-icon"></fa-icon>
                  <span class="section-title">Network</span>
                </div>
                
                <!-- Test Mode Notice -->
                @if (isTestMode()) {
                  <div class="test-mode-notice">
                  <fa-icon [icon]="['fas', 'info-circle']" class="notice-icon"></fa-icon>
                  <span class="notice-text">Test mode - Only Testnet 10 is available</span>
                  </div>
                }
                
                <!-- Network List -->
                <div class="network-list">
                  @for (network of getAvailableNetworks(); track network.value) {
                    <button 
                      class="network-option"
                      [class.active]="network.value === getCurrentNetwork()"
                      [class.disabled-network]="isTestMode() && network.value !== KaspaNetwork.TESTNET_10"
                      [disabled]="switchingNetwork() || (isTestMode() && network.value !== KaspaNetwork.TESTNET_10)"
                      (click)="switchToNetwork(network.value)"
                      [title]="getNetworkTooltip(network)">
                      <span class="network-dot" [class]="network.class"></span>
                      <span class="network-label">{{ network.label }}</span>
                      @if (network.value === getCurrentNetwork()) {
                        <fa-icon 
                          [icon]="['fas', 'check']" 
                          class="check-icon">
                        </fa-icon>
                      }
                      @if (switchingNetwork() && network.value === switchingToNetwork()) {
                        <fa-icon 
                          [icon]="['fas', 'circle-notch']" 
                          class="loading-icon fa-spin">
                        </fa-icon>
                      }
                    </button>
                  }
                </div>
              </div>
              </div>
            }
          </div>

          <!-- User Menu -->
          @if (userService.currentUser()) {
            <div class="user-menu">
            <button 
              class="user-button"
              (click)="toggleUserMenu()"
              [class.active]="showUserMenu()">
              @if (userService.currentUser()?.avatar) {
                <img 
                  [src]="getUserAvatarUrl()" 
                  [alt]="userService.currentUser()?.nickname"
                  class="user-avatar">
              } @else {
                <div class="avatar-placeholder">
                <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
                </div>
              }
              <fa-icon [icon]="['fas', 'chevron-down']" class="dropdown-icon"></fa-icon>
            </button>

            <!-- User Dropdown Menu -->
            @if (showUserMenu()) {
              <div class="user-dropdown">
              <div class="dropdown-info">
                <fa-icon [icon]="['fas', 'code-branch']" class="item-icon"></fa-icon>
                <span class="info-label">Verum:</span>
                <span class="info-value">{{ verumVersion }}</span>
              </div>
              <div class="dropdown-divider"></div>
              <a routerLink="/profile" class="dropdown-item" (click)="closeUserMenu()">
                <fa-icon [icon]="['fas', 'user']" class="item-icon"></fa-icon>
                Profile
              </a>
              <button class="dropdown-item" (click)="onLogout()">
                <fa-icon [icon]="['fas', 'sign-out-alt']" class="item-icon"></fa-icon>
                Logout
              </button>
              </div>
            }
            </div>
          }
        </div>
      </div>
    </header>
  `,
  styles: [`
    .header {
      @apply w-full h-20 bg-white/90 dark:bg-black-800/90;
      @apply border-b border-gray-200 dark:border-black-700;
      @apply sticky top-0;
      backdrop-filter: blur(10px);
      z-index: 1000;
    }
    
    /* Cyberpunk header styles */
    :host-context(.cyberpunk-theme) .header {
      @apply bg-cyber-dark-2;
      @apply border-b-2 border-neon-cyan/20;
      background: rgba(17, 17, 17, 0.9);
      box-shadow: 0 4px 20px rgba(0, 255, 255, 0.1);
    }

    .header-container {
      @apply max-w-screen-xl mx-auto px-6;
      @apply flex items-center justify-between h-full;
    }

    /* Logo Section */
    .logo-section {
      @apply flex flex-col items-start;
      @apply cursor-pointer;
    }

    .brand-text {
      @apply text-2xl font-heading font-bold tracking-wide;
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .brand-subtitle {
      @apply text-xs font-body font-medium tracking-wide text-kaspa-500 dark:text-kaspa-500 uppercase;
      margin-top: -4px;
    }
    
    /* Cyberpunk brand styles with individual letter animations */
    :host-context(.cyberpunk-theme) .brand-text {
      @apply font-cyber font-normal tracking-wider;
      font-size: 1.5rem;
      color: #fee;
      text-shadow: 
        0 -40px 100px rgba(0, 255, 255, 0.3), 
        0 0 2px #00ffff, 
        0 0 1em #00ffff, 
        0 0 0.5em #00ffff, 
        0 0 0.1em #00ffff, 
        0 10px 3px #000;
      user-select: none;
    }
    
    /* Only the middle letter (R) blinks - every 10 seconds */
    :host-context(.cyberpunk-theme) .brand-text span:nth-of-type(3) {
      animation: neon-blink linear infinite 10s;
    }
    
    /* Neon blink animation */
    @keyframes neon-blink {
      78% {
        color: inherit;
        text-shadow: inherit;
      }
      79% {
        color: #333;
      }
      80% {
        text-shadow: none;
      }
      81% {
        color: inherit;
        text-shadow: inherit;
      }
      82% {
        color: #333;
        text-shadow: none;
      }
      83% {
        color: inherit;
        text-shadow: inherit;
      }
      92% {
        color: #333;
        text-shadow: none;
      }
      92.5% {
        color: inherit;
        text-shadow: inherit;
      }
    }
    
    :host-context(.cyberpunk-theme) .brand-subtitle {
      @apply font-tech text-neon-cyan/60 tracking-widest;
    }

    /* Controls Section */
    .controls-section {
      @apply flex items-center space-x-4;
    }

    /* Wallet & Network Widget */
    .wallet-network-widget {
      @apply relative;
    }

    .wallet-button {
      @apply flex items-center space-x-2 px-4 py-2;
      @apply bg-white dark:bg-black-700 border border-gray-200 dark:border-black-600;
      @apply hover:bg-gray-50 dark:hover:bg-black-600;
      @apply transition-all duration-300;
      @apply min-w-max h-10 rounded-lg;
    }

    .wallet-button.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20;
      @apply border-kaspa-200 dark:border-kaspa-700;
    }

    /* Cyberpunk wallet button styles */
    :host-context(.cyberpunk-theme) .wallet-button {
      @apply bg-cyber-dark-3 border-2 border-neon-cyan/30 rounded-none;
      @apply hover:border-neon-cyan hover:bg-neon-cyan/10;
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.2), transparent);
        transition: left 0.5s;
      }
      
      &:hover::before {
        left: 100%;
      }
    }

    :host-context(.cyberpunk-theme) .wallet-button.active {
      @apply border-neon-cyan bg-neon-cyan/20;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
    }

    .wallet-info {
      @apply flex flex-col justify-center;
    }

    .network-indicator {
      @apply flex items-center space-x-2;
    }

    .network-dot {
      @apply w-2 h-2 rounded-full;
    }

    .network-dot.mainnet {
      @apply bg-green-500;
    }

    .network-dot.testnet-11 {
      @apply bg-blue-500;
    }

    .network-dot.testnet-10 {
      @apply bg-yellow-500;
    }

    .network-dot.devnet {
      @apply bg-purple-500;
    }

    .network-name {
      @apply text-xs font-medium text-kaspa-600 dark:text-kaspa-400 uppercase tracking-wide;
      @apply leading-none;
    }

    .balance-info {
      @apply flex items-center space-x-1;
    }

    .wallet-icon {
      @apply text-kaspa-600 dark:text-kaspa-400 text-xs;
    }

    .balance-amount {
      @apply text-sm font-medium text-kaspa-700 dark:text-kaspa-300;
      @apply leading-none;
    }

    /* Cyberpunk wallet info styles */
    :host-context(.cyberpunk-theme) .network-name {
      @apply font-tech text-neon-cyan tracking-wider;
    }

    :host-context(.cyberpunk-theme) .wallet-icon {
      @apply text-neon-cyan;
    }

    :host-context(.cyberpunk-theme) .balance-amount {
      @apply font-tech text-neon-cyan;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }

    /* Wallet Dropdown */
    .wallet-dropdown {
      @apply absolute right-0 top-full mt-2 w-80;
      @apply bg-white dark:bg-black-800 rounded-lg shadow-xl;
      @apply border border-gray-200 dark:border-black-700;
      @apply py-4;
      z-index: 9999;
    }

    /* Cyberpunk wallet dropdown */
    :host-context(.cyberpunk-theme) .wallet-dropdown {
      @apply bg-cyber-dark-2 border-neon-cyan/30 rounded-none;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
    }

    .wallet-section,
    .network-section {
      @apply px-4;
    }

    .wallet-section {
      @apply pb-4 mb-4 border-b border-gray-200 dark:border-black-700;
    }

    /* Cyberpunk wallet section */
    :host-context(.cyberpunk-theme) .wallet-section {
      @apply border-neon-cyan/20;
    }

    .section-header {
      @apply flex items-center space-x-2 mb-3;
    }

    .section-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk section icon */
    :host-context(.cyberpunk-theme) .section-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .section-title {
      @apply font-semibold text-black-900 dark:text-white-100;
    }

    .wallet-details {
      @apply space-y-2;
    }

    .address-row,
    .balance-row {
      @apply flex items-center justify-between;
    }

    .address-label,
    .balance-label {
      @apply text-sm text-black-600 dark:text-white-400;
    }

    .address-value {
      @apply text-sm font-mono text-black-800 dark:text-white-200;
      @apply flex-1 mx-2 truncate;
    }

    .balance-value {
      @apply text-sm font-semibold text-kaspa-700 dark:text-kaspa-300;
    }

    .copy-button {
      @apply p-1 rounded hover:bg-gray-100 dark:hover:bg-black-600;
      @apply transition-colors duration-200;
    }

    .copy-icon {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .network-list {
      @apply space-y-1;
    }

    .network-option {
      @apply flex items-center justify-between w-full px-3 py-2;
      @apply text-sm text-black-700 dark:text-white-300;
      @apply hover:bg-gray-50 dark:hover:bg-black-700;
      @apply rounded-md transition-colors duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .network-option.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20;
      @apply text-kaspa-700 dark:text-kaspa-300;
    }
    
    .network-option.disabled-network {
      @apply opacity-40 cursor-not-allowed;
      @apply hover:bg-transparent dark:hover:bg-transparent;
    }

    .network-option .network-dot {
      @apply mr-2;
    }
    
    .test-mode-notice {
      @apply flex items-center space-x-2 p-2 mb-2;
      @apply bg-yellow-50 dark:bg-yellow-900/20 rounded-md;
      @apply text-xs text-yellow-700 dark:text-yellow-300;
    }
    
    .notice-icon {
      @apply text-yellow-600 dark:text-yellow-400;
    }

    .network-label {
      @apply flex-1 text-left;
    }

    .check-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk check icon */
    :host-context(.cyberpunk-theme) .check-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .loading-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk loading icon */
    :host-context(.cyberpunk-theme) .loading-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    /* Theme Selector */
    .theme-selector {
      @apply relative;
    }

    .theme-button {
      @apply flex items-center space-x-2 px-3 py-2 h-10;
      @apply bg-white dark:bg-black-700 rounded-lg;
      @apply border border-white-200 dark:border-black-600;
      @apply hover:bg-gray-50 dark:hover:bg-black-600;
      @apply transition-colors duration-200;
    }

    .theme-button.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20;
      @apply border-kaspa-200 dark:border-kaspa-700;
    }

    .theme-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk theme icon */
    :host-context(.cyberpunk-theme) .theme-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .theme-label {
      @apply text-sm font-medium text-black-700 dark:text-white-300;
      @apply hidden sm:block;
    }

    .theme-dropdown {
      @apply absolute right-0 top-full mt-2 w-56;
      @apply bg-white dark:bg-black-800 rounded-lg shadow-xl;
      @apply border border-white-200 dark:border-black-700;
      @apply py-4;
      z-index: 9999;
    }

    .theme-list {
      @apply px-4 space-y-1;
    }

    .theme-option {
      @apply flex items-center justify-between w-full px-3 py-2;
      @apply text-sm text-black-700 dark:text-white-300;
      @apply hover:bg-gray-50 dark:hover:bg-black-700;
      @apply rounded-md transition-colors duration-200;
    }

    .theme-option.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20;
      @apply text-kaspa-700 dark:text-kaspa-300;
    }

    .theme-option-icon {
      @apply mr-3 text-black-500 dark:text-white-400;
    }

    .theme-option.active .theme-option-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk active theme option icon */
    :host-context(.cyberpunk-theme) .theme-option.active .theme-option-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .theme-option-label {
      @apply flex-1 text-left;
    }

    /* User Menu */
    .user-menu {
      @apply relative;
    }

    .user-button {
      @apply flex items-center space-x-2 px-3 py-2 h-10;
      @apply bg-white dark:bg-black-700 rounded-lg;
      @apply border border-white-200 dark:border-black-600;
      @apply hover:bg-gray-50 dark:hover:bg-black-600;
      @apply transition-colors duration-200;
    }

    .user-button.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20;
      @apply border-kaspa-200 dark:border-kaspa-700;
    }

    .user-avatar {
      @apply w-6 h-6 rounded-full object-cover;
    }

    .avatar-placeholder {
      @apply w-6 h-6 rounded-full bg-white-200 dark:bg-black-600;
      @apply flex items-center justify-center;
    }

    .placeholder-icon {
      @apply text-xs text-black-400 dark:text-white-400;
    }

    .dropdown-icon {
      @apply text-xs text-black-500 dark:text-white-400;
      @apply transition-transform duration-200;
    }

    .user-button.active .dropdown-icon {
      @apply rotate-180;
    }

    /* User Dropdown */
    .user-dropdown {
      @apply absolute right-0 top-full mt-2 w-48;
      @apply bg-white dark:bg-black-800 rounded-lg shadow-xl;
      @apply border border-white-200 dark:border-black-700;
      @apply py-2;
      z-index: 9999;
    }

    .dropdown-item {
      @apply flex items-center space-x-3 w-full px-4 py-2;
      @apply text-sm text-black-700 dark:text-white-300;
      @apply hover:bg-gray-50 dark:hover:bg-black-700;
      @apply transition-colors duration-200;
    }

    .dropdown-divider {
      @apply border-t border-gray-200 dark:border-black-700 my-1;
    }

    .dropdown-info {
      @apply flex items-center space-x-2 px-4 py-2;
      @apply text-xs text-black-600 dark:text-white-400;
      @apply cursor-default;
    }

    .info-label {
      @apply font-medium;
    }

    .info-value {
      @apply font-mono text-kaspa-600 dark:text-kaspa-400;
      @apply bg-gray-100 dark:bg-black-600 px-2 py-1 rounded;
    }

    .item-icon {
      @apply text-black-500 dark:text-white-400;
    }

    /* Cyberpunk dropdown styles */
    :host-context(.cyberpunk-theme) .user-dropdown {
      @apply bg-cyber-dark-2 border-neon-cyan/30 rounded-none;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
    }

    :host-context(.cyberpunk-theme) .dropdown-divider {
      @apply border-neon-cyan/20;
    }

    :host-context(.cyberpunk-theme) .dropdown-info {
      @apply text-neon-cyan/70;
    }

    :host-context(.cyberpunk-theme) .info-value {
      @apply text-neon-cyan bg-cyber-dark-3 border border-neon-cyan/30;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }

    :host-context(.cyberpunk-theme) .dropdown-item:hover {
      @apply bg-neon-cyan/10;
    }

    /* Mobile Responsive */
    @media (max-width: 1024px) {
      .controls-section {
        @apply space-x-3;
      }

      .wallet-info {
        @apply hidden;
      }

      .network-text {
        @apply hidden;
      }
    }

    @media (max-width: 768px) {
      .header-container {
        @apply px-4;
      }

      .brand-text {
        @apply hidden;
      }

      .controls-section {
        @apply space-x-2;
      }
    }
  `]
})
export class HeaderComponent {
  public userService = inject(UserService);
  public walletService = inject(WalletManagerService);
  private themeService = inject(ThemeService);
  private toastService = inject(ToastService);

  // State
  public showUserMenu = signal(false);
  public showWalletMenu = signal(false);
  public showThemeMenu = signal(false);
  public switchingNetwork = signal(false);
  public switchingToNetwork = signal<string>('');

  // Available networks
  public availableNetworks = [
    {
      label: 'Mainnet',
      value: KaspaNetwork.MAINNET,
      class: 'mainnet'
    },
    {
      label: 'Testnet 11',
      value: KaspaNetwork.TESTNET_11,
      class: 'testnet-11'
    },
    {
      label: 'Testnet 10',
      value: KaspaNetwork.TESTNET_10,
      class: 'testnet-10'
    },
    {
      label: 'Devnet',
      value: KaspaNetwork.DEVNET,
      class: 'devnet'
    }
  ];
  
  // Expose KaspaNetwork enum to template
  public KaspaNetwork = KaspaNetwork;
  
  // Expose verum version to template
  public verumVersion = VERUM_VERSION;

  // Available themes
  public availableThemes = [
    {
      label: 'Default Light',
      style: 'default' as const,
      colorMode: 'light' as const,
      icon: 'sun'
    },
    {
      label: 'Default Dark',
      style: 'default' as const,
      colorMode: 'dark' as const,
      icon: 'moon'
    },
    {
      label: 'Cyberpunk',
      style: 'cyberpunk' as const,
      colorMode: 'dark' as const,
      icon: 'rocket'
    }
  ];

  /**
   * Toggle user menu dropdown
   */
  toggleUserMenu(): void {
    this.showUserMenu.update(show => !show);
    this.showWalletMenu.set(false); // Close wallet menu
    this.showThemeMenu.set(false); // Close theme menu
  }

  /**
   * Close user menu
   */
  closeUserMenu(): void {
    this.showUserMenu.set(false);
  }

  /**
   * Toggle wallet menu dropdown
   */
  toggleWalletMenu(): void {
    this.showWalletMenu.update(show => !show);
    this.showUserMenu.set(false); // Close user menu
    this.showThemeMenu.set(false); // Close theme menu
  }

  /**
   * Close wallet menu
   */
  closeWalletMenu(): void {
    this.showWalletMenu.set(false);
  }

  /**
   * Toggle theme menu dropdown
   */
  toggleThemeMenu(): void {
    this.showThemeMenu.update(show => !show);
    this.showUserMenu.set(false); // Close user menu
    this.showWalletMenu.set(false); // Close wallet menu
  }

  /**
   * Close theme menu
   */
  closeThemeMenu(): void {
    this.showThemeMenu.set(false);
  }

  /**
   * Toggle theme (legacy method for backward compatibility)
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  /**
   * Get current theme icon
   */
  getCurrentThemeIcon(): string {
    const currentTheme = this.themeService.getCurrentTheme();
    const theme = this.availableThemes.find(t => 
      t.style === currentTheme.style && t.colorMode === currentTheme.colorMode
    );
    return theme?.icon || 'cog';
  }

  /**
   * Get current theme label
   */
  getCurrentThemeLabel(): string {
    const currentTheme = this.themeService.getCurrentTheme();
    const theme = this.availableThemes.find(t => 
      t.style === currentTheme.style && t.colorMode === currentTheme.colorMode
    );
    return theme?.label || 'Theme';
  }

  /**
   * Check if a theme is currently active
   */
  isCurrentTheme(theme: typeof this.availableThemes[0]): boolean {
    const currentTheme = this.themeService.getCurrentTheme();
    return theme.style === currentTheme.style && theme.colorMode === currentTheme.colorMode;
  }

  /**
   * Switch to a different theme
   */
  switchToTheme(theme: typeof this.availableThemes[0]): void {
    this.themeService.setTheme({
      colorMode: theme.colorMode,
      style: theme.style
    });
    this.closeThemeMenu();
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): string {
    const walletNetwork = this.walletService.network();
    return walletNetwork || KaspaNetwork.MAINNET;
  }

  /**
   * Get current network display name
   */
  getCurrentNetworkName(): string {
    const currentNetwork = this.getCurrentNetwork();
    
    // Handle normalized network names from WalletManagerService
    let matchingNetwork;
    
    if (currentNetwork === 'testnet-10') {
      matchingNetwork = this.availableNetworks.find(n => n.value === KaspaNetwork.TESTNET_10);
    } else if (currentNetwork === 'testnet-11') {
      matchingNetwork = this.availableNetworks.find(n => n.value === KaspaNetwork.TESTNET_11);
    } else if (currentNetwork === 'mainnet') {
      matchingNetwork = this.availableNetworks.find(n => n.value === KaspaNetwork.MAINNET);
    } else if (currentNetwork === 'devnet') {
      matchingNetwork = this.availableNetworks.find(n => n.value === KaspaNetwork.DEVNET);
    } else {
      // Try exact match first
      matchingNetwork = this.availableNetworks.find(n => n.value === currentNetwork);
    }
    
    return matchingNetwork?.label || 'Unknown Network';
  }

  /**
   * Get current network CSS class
   */
  getCurrentNetworkClass(): string {
    const currentNetwork = this.getCurrentNetwork();
    
    // Handle normalized network names from WalletManagerService
    if (currentNetwork === 'testnet-10') {
      return 'testnet-10';
    } else if (currentNetwork === 'testnet-11') {
      return 'testnet-11';
    } else if (currentNetwork === 'mainnet') {
      return 'mainnet';
    } else if (currentNetwork === 'devnet') {
      return 'devnet';
    }
    
    // Try exact match as fallback
    const network = this.availableNetworks.find(n => n.value === currentNetwork);
    return network?.class || 'mainnet';
  }

  /**
   * Switch to a different network
   */
  async switchToNetwork(network: string): Promise<void> {
    if (network === this.getCurrentNetwork()) {
      return; // Already on this network
    }

    try {
      this.switchingNetwork.set(true);
      this.switchingToNetwork.set(network);

      await this.walletService.switchNetwork(network as 'mainnet' | 'testnet-10');

      this.toastService.success(
        `Switched to ${this.getNetworkName(network)}`,
        'Network Changed'
      );

      this.closeWalletMenu();
    } catch (error: any) {
      this.toastService.error(
        error.message || 'Failed to switch network',
        'Network Switch Failed'
      );
    } finally {
      this.switchingNetwork.set(false);
      this.switchingToNetwork.set('');
    }
  }

  /**
   * Get network display name by value
   */
  private getNetworkName(networkValue: string): string {
    const network = this.availableNetworks.find(n => n.value === networkValue);
    return network?.label || networkValue;
  }

  /**
   * Copy wallet address to clipboard
   */
  async copyAddress(): Promise<void> {
    try {
      const address = this.walletService.address();
      await navigator.clipboard.writeText(address);
      
      this.toastService.success(
        'Address copied to clipboard',
        'Copied'
      );
    } catch (error) {
      this.toastService.error(
        'Failed to copy address',
        'Copy Failed'
      );
    }
  }

  /**
   * Format wallet address
   */
  formatAddress(): string {
    return this.walletService.formatAddress(this.walletService.address(), 8);
  }

  /**
   * Format balance
   */
  formatBalance(): string {
    const balance = this.walletService.getWalletBalance();
    const connectedWallet = this.walletService.connectedWallet();
    
    
    if (!balance) return '0.00';
    
    // Use the total balance and convert from sompi to KAS (1 KAS = 100,000,000 sompi)
    const kas = balance.total / 100000000;
    
    // Format with appropriate decimals based on amount
    if (kas === 0) {
      return '0.00';
    } else if (kas < 0.01) {
      return kas.toFixed(8).replace(/\.?0+$/, '');
    } else if (kas < 1) {
      return kas.toFixed(6).replace(/\.?0+$/, '');
    } else if (kas < 1000) {
      return kas.toFixed(2);
    } else {
      return kas.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    }
  }

  /**
   * Handle logout/disconnect
   */
  async onLogout(): Promise<void> {
    try {
      this.closeUserMenu();
      this.closeWalletMenu();
      
      // Disconnect wallet and clear all user data
      await this.walletService.disconnect();
      this.userService.clearAllUserData();
      
      this.toastService.success(
        'Successfully logged out',
        'Logout'
      );
    } catch (error: any) {
      this.toastService.error(
        'Failed to logout properly',
        'Logout Error'
      );
    }
  }

  /**
   * Get user avatar URL
   */
  getUserAvatarUrl(): string {
    const user = this.userService.currentUser();
    if (!user?.avatar) return '';
    
    // Check if it's already a data URL
    if (user.avatar.startsWith('data:')) {
      return user.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${user.avatar}`;
  }
  
  /**
   * Check if in test mode
   */
  isTestMode(): boolean {
    return environment.networkMode === 'test';
  }
  
  /**
   * Get available networks based on mode
   */
  getAvailableNetworks() {
    if (this.isTestMode()) {
      // In test mode, show all networks but only Testnet 10 is enabled
      return this.availableNetworks;
    }
    return this.availableNetworks;
  }
  
  /**
   * Get network tooltip
   */
  getNetworkTooltip(network: any): string {
    if (this.isTestMode() && network.value !== KaspaNetwork.TESTNET_10) {
      return 'Network disabled in test mode';
    }
    return '';
  }
}