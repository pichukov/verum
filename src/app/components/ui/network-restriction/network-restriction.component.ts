import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../button/button.component';
import { WalletManagerService } from '../../../services/wallet-manager.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-network-restriction',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, ButtonComponent],
  template: `
    <div class="network-restriction-overlay">
      <div class="restriction-container">
        <div class="restriction-content">
          <!-- Title -->
          <h1 class="restriction-title">Network Restriction</h1>
          
          <!-- Message -->
          <p class="restriction-message">
            This application is currently in test mode and only supports 
            <strong>Kaspa Testnet 10</strong>.
          </p>
          
          <p class="restriction-submessage">
            Please switch your wallet to Testnet 10 to continue using Verum.
          </p>
          
          <!-- Current Network Info -->
          <div class="current-network-info">
            <div class="network-item">
              <span class="network-label">Current Network:</span>
              <span class="network-value">{{ getCurrentNetworkName() }}</span>
            </div>
            <div class="network-item">
              <span class="network-label">Required Network:</span>
              <span class="network-value required">Testnet 10</span>
            </div>
          </div>
          
          <!-- Action Button -->
          <app-button
            variant="primary"
            size="lg"
            [loading]="isSwitching"
            (click)="switchToTestnet10()"
            class="switch-button">
            {{ isSwitching ? 'Switching Network...' : 'Switch to Testnet 10' }}
          </app-button>
          
          <!-- Additional Info -->
          <div class="additional-info">
            <p class="info-text">
              Once the network is switched in your wallet, this screen will automatically disappear.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .network-restriction-overlay {
      @apply fixed inset-0 bg-black-900/50 backdrop-blur-sm;
      @apply flex items-center justify-center p-6;
      z-index: 40; /* Below header (z-index: 1000) but above content */
    }
    
    .restriction-container {
      @apply w-full max-w-md bg-white dark:bg-black-800;
      @apply rounded-xl shadow-2xl border border-white-200 dark:border-black-700;
      @apply overflow-hidden;
    }
    
    /* Cyberpunk styles */
    :host-context(.cyberpunk-theme) .restriction-container {
      @apply bg-cyber-dark-2 border-2 border-neon-cyan/50 rounded-none;
      box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
    }
    
    .restriction-content {
      @apply p-8 space-y-6 text-center;
    }
    
    .restriction-title {
      @apply text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    :host-context(.cyberpunk-theme) .restriction-title {
      @apply font-cyber text-neon-cyan uppercase tracking-wider;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
    }
    
    .restriction-message {
      @apply text-black-700 dark:text-white-300 leading-relaxed;
    }
    
    .restriction-submessage {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    :host-context(.cyberpunk-theme) .restriction-message,
    :host-context(.cyberpunk-theme) .restriction-submessage {
      @apply font-tech text-cyber-gray-5;
    }
    
    .current-network-info {
      @apply bg-gray-50 dark:bg-black-700 rounded-lg p-4 space-y-2;
      margin-bottom: 2rem !important;
    }
    
    :host-context(.cyberpunk-theme) .current-network-info {
      @apply bg-cyber-dark-3/50 border border-neon-cyan/20 rounded-none;
    }
    
    .network-item {
      @apply flex items-center justify-between;
    }
    
    .network-label {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .network-value {
      @apply text-sm font-semibold text-black-900 dark:text-white-100;
    }
    
    .network-value.required {
      @apply text-green-600 dark:text-green-400;
    }
    
    :host-context(.cyberpunk-theme) .network-value.required {
      @apply text-neon-cyan;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.5);
    }
    
    .switch-button {
      @apply w-full;
    }
    
    .additional-info {
      @apply text-center;
      @apply bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg;
    }
    
    :host-context(.cyberpunk-theme) .additional-info {
      @apply bg-neon-cyan/5 border border-neon-cyan/20 rounded-none;
    }
    
    .info-text {
      @apply text-xs text-blue-700 dark:text-blue-300;
    }
    
    :host-context(.cyberpunk-theme) .info-text {
      @apply font-tech text-cyber-gray-5;
    }
  `]
})
export class NetworkRestrictionComponent {
  private walletManagerService = inject(WalletManagerService);
  
  public isSwitching = false;
  
  /**
   * Get current network display name
   */
  getCurrentNetworkName(): string {
    const network = this.walletManagerService.network();
    const state = this.walletManagerService.getCurrentState();
    const connectedWallet = this.walletManagerService.connectedWallet();
    
    console.log('[NetworkRestriction] Network debugging:', {
      networkSignal: network,
      fullState: state,
      connectedWallet,
      isConnected: this.walletManagerService.isConnected()
    });
    
    return this.walletManagerService.getNetworkDisplayName(network);
  }
  
  /**
   * Switch to Testnet 10
   */
  async switchToTestnet10(): Promise<void> {
    try {
      console.log('[NetworkRestriction] Starting network switch to testnet-10...');
      this.isSwitching = true;
      
      const currentWallet = this.walletManagerService.connectedWallet();
      console.log('[NetworkRestriction] Current wallet:', currentWallet);
      
      if (!currentWallet) {
        console.error('[NetworkRestriction] No wallet connected');
        throw new Error('No wallet connected');
      }
      
      await this.walletManagerService.switchNetwork('testnet-10');
      console.log('[NetworkRestriction] Network switch completed');
    } catch (error) {
      console.error('[NetworkRestriction] Failed to switch network:', error);
    } finally {
      this.isSwitching = false;
    }
  }
}