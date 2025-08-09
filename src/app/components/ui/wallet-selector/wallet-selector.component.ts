import { Component, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../button/button.component';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';

export interface WalletOption {
  id: 'kasware';
  name: string;
  description: string;
  icon: string;
  isInstalled: boolean;
  isAvailable: boolean;
  installUrl?: string;
}

@Component({
  selector: 'app-wallet-selector',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, ButtonComponent],
  template: `
    <div class="wallet-selector">
      <div class="selector-container">
        <!-- Header -->
        <div class="selector-header">
          <div class="icon-container">
            <fa-icon [icon]="['fas', 'wallet']" class="header-icon"></fa-icon>
          </div>
          <h2 class="selector-title">Connect Your Wallet</h2>
          <p class="selector-subtitle">
            Choose a wallet to connect to Verum and interact with the Kaspa network
          </p>
        </div>

        <!-- Wallet Options -->
        <div class="wallet-options">
          @for (wallet of walletOptions(); track wallet.id) {
            <div class="wallet-option" 
                 [class.available]="wallet.isAvailable"
                 [class.unavailable]="!wallet.isAvailable">
              
              <!-- Wallet Info -->
              <div class="wallet-info">
                <div class="wallet-icon-container">
                  <fa-icon [icon]="getWalletIcon(wallet)" class="wallet-icon"></fa-icon>
                </div>
                <div class="wallet-details">
                  <h3 class="wallet-name">{{ wallet.name }}</h3>
                  <p class="wallet-description">{{ wallet.description }}</p>
                  
                  @if (!wallet.isInstalled) {
                    <div class="wallet-status">
                      <fa-icon [icon]="['fas', 'exclamation-triangle']" class="status-icon warning"></fa-icon>
                      <span class="status-text">Not installed</span>
                    </div>
                  } @else if (wallet.isAvailable) {
                    <div class="wallet-status">
                      <fa-icon [icon]="['fas', 'check-circle']" class="status-icon success"></fa-icon>
                      <span class="status-text">Available</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Action Button -->
              <div class="wallet-action">
                @if (!wallet.isInstalled) {
                  <app-button
                    type="button"
                    variant="secondary"
                    size="sm"
                    (click)="installWallet(wallet)"
                    class="install-button">
                    Install
                  </app-button>
                } @else if (wallet.isAvailable) {
                  <app-button
                    type="button"
                    variant="primary"
                    size="sm"
                    [loading]="isConnecting() && selectedWallet() === wallet.id"
                    [disabled]="isConnecting()"
                    (click)="connectWallet(wallet)"
                    class="connect-button">
                    @if (isConnecting() && selectedWallet() === wallet.id) {
                      Connecting...
                    } @else {
                      Connect
                    }
                  </app-button>
                } @else {
                  <app-button
                    type="button"
                    variant="ghost"
                    size="sm"
                    [disabled]="true"
                    class="unavailable-button">
                    Unavailable
                  </app-button>
                }
              </div>
            </div>
          }
        </div>

        <!-- Error Display -->
        @if (error()) {
          <div class="error-message">
            <fa-icon [icon]="['fas', 'times']" class="error-icon"></fa-icon>
            <span class="error-text">{{ error() }}</span>
          </div>
        }

        <!-- Help Section -->
        <div class="help-section">
          <div class="help-header">
            <fa-icon [icon]="['fas', 'question']" class="help-icon"></fa-icon>
            <span class="help-title">Need Help?</span>
          </div>
          <ul class="help-list">
            <li class="help-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Make sure you have a supported wallet installed
            </li>
            <li class="help-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Ensure your wallet is unlocked and ready to use
            </li>
            <li class="help-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Check that you're on the correct network (mainnet/testnet-10)
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wallet-selector {
      @apply min-h-screen bg-gradient-to-br from-kaspa-50 to-white-100;
      @apply dark:from-black-900 dark:to-black-800;
      @apply flex items-center justify-center p-6;
    }
    
    .selector-container {
      @apply w-full max-w-2xl bg-white-900 dark:bg-black-800;
      @apply rounded-xl shadow-xl border border-white-200 dark:border-black-700;
      @apply p-8 space-y-8;
    }
    
    .selector-header {
      @apply text-center space-y-4;
    }
    
    .icon-container {
      @apply mx-auto w-16 h-16 bg-kaspa-100 dark:bg-kaspa-900/30;
      @apply rounded-full flex items-center justify-center;
    }
    
    .header-icon {
      @apply text-2xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    .selector-title {
      @apply text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    .selector-subtitle {
      @apply text-black-600 dark:text-white-400;
    }
    
    .wallet-options {
      @apply space-y-4;
    }
    
    .wallet-option {
      @apply flex items-center justify-between p-4 rounded-lg border;
      @apply border-white-200 dark:border-black-700;
      @apply bg-white-100 dark:bg-black-700;
      @apply transition-all duration-200;
    }
    
    .wallet-option.available {
      @apply hover:border-kaspa-300 dark:hover:border-kaspa-600;
      @apply hover:bg-kaspa-50 dark:hover:bg-kaspa-900/20;
    }
    
    .wallet-option.unavailable {
      @apply opacity-60;
    }
    
    .wallet-info {
      @apply flex items-center space-x-4 flex-1;
    }
    
    .wallet-icon-container {
      @apply w-12 h-12 rounded-full bg-white-200 dark:bg-black-600;
      @apply flex items-center justify-center flex-shrink-0;
    }
    
    .wallet-icon {
      @apply text-xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    .wallet-details {
      @apply flex-1 space-y-1;
    }
    
    .wallet-name {
      @apply text-lg font-semibold text-black-900 dark:text-white-100;
    }
    
    .wallet-description {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .wallet-status {
      @apply flex items-center space-x-2 mt-2;
    }
    
    .status-icon {
      @apply text-xs;
    }
    
    .status-icon.success {
      @apply text-green-600 dark:text-green-400;
    }
    
    .status-icon.warning {
      @apply text-yellow-600 dark:text-yellow-400;
    }
    
    .status-text {
      @apply text-xs font-medium;
    }
    
    .wallet-action {
      @apply flex-shrink-0;
    }
    
    .error-message {
      @apply flex items-center space-x-3 p-4 rounded-lg;
      @apply bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800;
    }
    
    .error-icon {
      @apply text-red-600 dark:text-red-400 flex-shrink-0;
    }
    
    .error-text {
      @apply text-red-700 dark:text-red-300 text-sm;
    }
    
    .help-section {
      @apply bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg;
      @apply border border-blue-200 dark:border-blue-800;
    }
    
    .help-header {
      @apply flex items-center space-x-2 mb-4;
    }
    
    .help-icon {
      @apply text-blue-600 dark:text-blue-400;
    }
    
    .help-title {
      @apply font-semibold text-black-800 dark:text-white-200;
    }
    
    .help-list {
      @apply space-y-2;
    }
    
    .help-item {
      @apply flex items-start space-x-3 text-sm text-black-600 dark:text-white-400;
    }
    
    .check-icon {
      @apply text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0;
    }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .selector-container {
        @apply p-6;
      }
      
      .wallet-option {
        @apply flex-col space-y-4 items-start;
      }
      
      .wallet-action {
        @apply w-full;
      }
      
      .connect-button,
      .install-button,
      .unavailable-button {
        @apply w-full;
      }
    }
  `]
})
export class WalletSelectorComponent {
  private kaswareWalletService = inject(KaswareWalletService);
  
  // Output events
  public walletConnected = output<{id: 'kasware', address: string}>();
  public walletConnectionFailed = output<{id: 'kasware', error: string}>();
  
  // Component state
  public walletOptions = signal<WalletOption[]>([]);
  public isConnecting = signal(false);
  public selectedWallet = signal<'kasware' | null>(null);
  public error = signal<string | null>(null);
  
  constructor() {
    // Wait a bit for wallet extensions to load
    setTimeout(() => {
      this.initializeWalletOptions();
    }, 500);
  }
  
  private initializeWalletOptions(): void {
    // Check if Kasware is available by looking for the global kasware object
    const kaswareInstalled = typeof (window as any).kasware !== 'undefined';
    
    console.log('Wallet detection:', { 
      kasware: kaswareInstalled, 
      kaswareObject: (window as any).kasware
    });
    
    const options: WalletOption[] = [
      {
        id: 'kasware',
        name: 'Kasware',
        description: 'Kaspa wallet extension for web browsers',
        icon: 'wallet',
        isInstalled: kaswareInstalled,
        isAvailable: kaswareInstalled,
        installUrl: 'https://kasware.xyz'
      }
    ];
    
    this.walletOptions.set(options);
  }
  
  public getWalletIcon(wallet: WalletOption): [string, string] {
    return ['fas', wallet.icon] as [string, string];
  }
  
  public async connectWallet(wallet: WalletOption): Promise<void> {
    if (!wallet.isAvailable || this.isConnecting()) {
      return;
    }
    
    this.isConnecting.set(true);
    this.selectedWallet.set(wallet.id);
    this.error.set(null);
    
    try {
      let address: string;
      
      if (wallet.id === 'kasware') {
        const accounts = await this.kaswareWalletService.connect();
        address = accounts[0] || '';
      } else {
        throw new Error('Unsupported wallet type');
      }
      
      if (address) {
        this.walletConnected.emit({ id: wallet.id, address });
      } else {
        throw new Error('No address received from wallet');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      this.error.set(errorMessage);
      this.walletConnectionFailed.emit({ id: wallet.id, error: errorMessage });
    } finally {
      this.isConnecting.set(false);
      this.selectedWallet.set(null);
    }
  }
  
  public installWallet(wallet: WalletOption): void {
    if (wallet.installUrl) {
      window.open(wallet.installUrl, '_blank');
    }
  }
  
  public refreshWalletAvailability(): void {
    setTimeout(() => {
      this.initializeWalletOptions();
    }, 100); // Small delay to allow extensions to load
  }
}