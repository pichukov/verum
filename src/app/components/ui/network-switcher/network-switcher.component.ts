import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';
import { KaspaApiService } from '../../../services/kaspa-api.service';
import { ToastService } from '../../../services/toast.service';
import { KaspaNetwork } from '../../../types/kasware';

interface NetworkOption {
  value: KaspaNetwork;
  label: string;
  color: string;
  description: string;
}

@Component({
  selector: 'app-network-switcher',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="network-switcher" [class.open]="isOpen">
      <!-- Current Network Display -->
      <button
        (click)="toggleDropdown()"
        [disabled]="walletService.loading()"
        class="network-button"
        [title]="getCurrentNetworkDescription()">
        
        <div class="network-indicator" [class]="getCurrentNetworkColor()"></div>
        <span class="network-label">{{ getCurrentNetworkLabel() }}</span>
        <fa-icon 
          [icon]="['fas', 'chevron-down']" 
          class="chevron-icon"
          [class.rotated]="isOpen">
        </fa-icon>
      </button>

      <!-- Dropdown Menu -->
      @if (isOpen) {
        <div class="network-dropdown">
        <div class="dropdown-header">
          <span class="text-xs font-semibold text-black-600 dark:text-white-400">
            Select Network
          </span>
        </div>
        
        <div class="network-options">
          @for (network of networkOptions; track network.value) {
            <button
              (click)="switchNetwork(network.value)"
              [disabled]="walletService.loading() || isCurrentNetwork(network.value)"
              class="network-option"
              [class.active]="isCurrentNetwork(network.value)"
              [class.disabled]="walletService.loading()">
              
              <div class="network-option-indicator" [class]="network.color"></div>
              <div class="network-option-content">
                <span class="network-option-label">{{ network.label }}</span>
                <span class="network-option-description">{{ network.description }}</span>
              </div>
              
              @if (isCurrentNetwork(network.value)) {
                <fa-icon 
                  [icon]="['fas', 'check']" 
                  class="check-icon">
                </fa-icon>
              }
            </button>
          }
        </div>
        
        <div class="dropdown-footer">
          <span>
            Network changes may take a few seconds
          </span>
        </div>
        </div>
      }
    </div>

    <!-- Backdrop -->
    @if (isOpen) {
      <div 
        class="network-backdrop" 
        (click)="closeDropdown()">
      </div>
    }
  `,
  styles: [`
    .network-switcher {
      @apply relative;
    }

    .network-button {
      @apply flex items-center space-x-2 px-3 py-2 rounded-md text-body;
      @apply bg-white-200 dark:bg-black-700 border border-white-300 dark:border-black-600;
      @apply hover:bg-white-300 dark:hover:bg-black-600 transition-colors duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      @apply h-10; /* Match nav button height */
    }

    .network-indicator {
      @apply w-2 h-2 rounded-full;
    }

    .network-indicator.mainnet {
      @apply bg-kaspa-600;
    }

    .network-indicator.testnet {
      @apply bg-yellow-600;
    }

    .network-indicator.devnet {
      @apply bg-purple-600;
    }

    .network-label {
      @apply text-xs font-medium text-black-800 dark:text-white-200;
      @apply min-w-0 truncate;
    }

    .chevron-icon {
      @apply text-xs text-black-500 dark:text-white-400 transition-transform duration-200;
    }

    .chevron-icon.rotated {
      @apply transform rotate-180;
    }

    .network-dropdown {
      @apply absolute top-full right-0 mt-1 w-64 z-50;
      @apply bg-white-900 dark:bg-black-800 border border-white-300 dark:border-black-600;
      @apply rounded-md shadow-medium overflow-hidden;
      animation: dropdownSlide 0.2s ease-out;
    }

    @keyframes dropdownSlide {
      from {
        @apply opacity-0 transform translate-y-2;
      }
      to {
        @apply opacity-100 transform translate-y-0;
      }
    }

    .dropdown-header {
      @apply px-4 py-3 border-b border-white-300 dark:border-black-600;
      @apply bg-white-100 dark:bg-black-700;
    }

    .network-options {
      @apply py-2;
    }

    .network-option {
      @apply w-full flex items-center space-x-3 px-4 py-3 text-left;
      @apply hover:bg-white-200 dark:hover:bg-black-700 transition-colors duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .network-option.active {
      @apply bg-kaspa-50 dark:bg-kaspa-900/20 border-r-2 border-kaspa-600;
    }

    .network-option-indicator {
      @apply w-3 h-3 rounded-full flex-shrink-0;
    }

    .network-option-indicator.mainnet {
      @apply bg-kaspa-600;
    }

    .network-option-indicator.testnet {
      @apply bg-yellow-600;
    }

    .network-option-indicator.devnet {
      @apply bg-purple-600;
    }

    .network-option-content {
      @apply flex-1 min-w-0;
    }

    .network-option-label {
      @apply block text-sm font-medium text-black-900 dark:text-white-100;
    }

    .network-option-description {
      @apply block text-xs text-black-500 dark:text-white-400 mt-1;
    }

    .check-icon {
      @apply text-kaspa-600 text-sm;
    }

    .dropdown-footer {
      @apply px-4 py-3 border-t border-white-300 dark:border-black-600;
      @apply bg-white-100 dark:bg-black-700;
    }

    .dropdown-footer span {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .network-backdrop {
      @apply fixed inset-0 z-40;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .network-dropdown {
        @apply w-56 right-0;
      }
      
      .network-label {
        @apply hidden; /* Hide label on mobile, show only indicator */
      }
      
      .network-button {
        @apply px-2; /* Reduce padding on mobile */
      }
    }
  `]
})
export class NetworkSwitcherComponent {
  public walletService = inject(KaswareWalletService);
  private apiService = inject(KaspaApiService);
  private toastService = inject(ToastService);

  public isOpen = false;

  public networkOptions: NetworkOption[] = [
    {
      value: KaspaNetwork.MAINNET,
      label: 'Mainnet',
      color: 'mainnet',
      description: 'Live Kaspa network with real KAS'
    },
    {
      value: KaspaNetwork.TESTNET_11,
      label: 'Testnet-11',
      color: 'testnet',
      description: 'Test network for development'
    },
    {
      value: KaspaNetwork.TESTNET_10,
      label: 'Testnet-10',
      color: 'testnet',
      description: 'Legacy test network'
    },
    {
      value: KaspaNetwork.DEVNET,
      label: 'Devnet',
      color: 'devnet',
      description: 'Development network'
    }
  ];

  toggleDropdown(): void {
    if (this.walletService.loading()) return;
    this.isOpen = !this.isOpen;
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  async switchNetwork(network: KaspaNetwork): Promise<void> {
    if (this.isCurrentNetwork(network) || this.walletService.loading()) {
      return;
    }

    try {
      this.closeDropdown();
      
      const networkOption = this.networkOptions.find(opt => opt.value === network);
      
      this.toastService.info(
        `Switching to ${networkOption?.label}...`,
        'Network Switch'
      );

      await this.walletService.switchNetwork(network);
      
      // Also update API service network
      const address = this.walletService.account();
      if (address) {
        this.apiService.setNetworkFromAddress(address);
      }
      
      this.toastService.success(
        `Successfully switched to ${networkOption?.label}`,
        'Network Changed'
      );
    } catch (error: any) {
      console.error('Failed to switch network:', error);
      
      this.toastService.error(
        error?.message || 'Failed to switch network',
        'Network Switch Failed'
      );
    }
  }

  getCurrentNetwork(): string {
    return this.walletService.network() || KaspaNetwork.MAINNET;
  }

  getCurrentNetworkOption(): NetworkOption {
    const currentNetwork = this.getCurrentNetwork();
    return this.networkOptions.find(opt => opt.value === currentNetwork) || this.networkOptions[0];
  }

  getCurrentNetworkLabel(): string {
    return this.getCurrentNetworkOption().label;
  }

  getCurrentNetworkColor(): string {
    return this.getCurrentNetworkOption().color;
  }

  getCurrentNetworkDescription(): string {
    const option = this.getCurrentNetworkOption();
    return `Current network: ${option.label} - ${option.description}`;
  }

  isCurrentNetwork(network: KaspaNetwork): boolean {
    return this.getCurrentNetwork() === network;
  }
}