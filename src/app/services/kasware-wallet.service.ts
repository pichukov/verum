import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { 
  KaswareWallet, 
  WalletBalance, 
  KRC20Balance, 
  KaspaNetwork, 
  SendKaspaOptions,
  KaswareError 
} from '../types/kasware';
import { environment } from '../../environments/environment';

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  account: string;
  balance: WalletBalance | null;
  krc20Balances: KRC20Balance | null;
  network: KaspaNetwork | string;
  publicKey: string;
  loading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class KaswareWalletService {
  private platformId = inject(PLATFORM_ID);
  private kasware: KaswareWallet | null = null;
  
  // Reactive wallet state
  private _walletState = signal<WalletState>({
    isInstalled: false,
    isConnected: false,
    account: '',
    balance: null,
    krc20Balances: null,
    network: KaspaNetwork.MAINNET,
    publicKey: '',
    loading: false,
    error: null
  });

  // Public readonly signals
  public readonly walletState = this._walletState.asReadonly();
  public readonly isInstalled = signal(false);
  public readonly isConnected = signal(false);
  public readonly account = signal('');
  public readonly balance = signal<WalletBalance | null>(null);
  public readonly network = signal<string>('');
  public readonly loading = signal(false);
  public readonly error = signal<string | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeWallet();
      
      // Effect to update individual signals when wallet state changes
      effect(() => {
        const state = this._walletState();
        this.isInstalled.set(state.isInstalled);
        this.isConnected.set(state.isConnected);
        this.account.set(state.account);
        this.balance.set(state.balance);
        this.network.set(state.network);
        this.loading.set(state.loading);
        this.error.set(state.error);
      });
    }
  }

  private async initializeWallet(): Promise<void> {
    try {
      // Wait for Kasware to be available
      const walletAvailable = await this.waitForKasware();
      
      if (walletAvailable && this.kasware) {
        this.updateState({ isInstalled: true });
        this.setupEventListeners();
        
        // Check for existing connection
        await this.checkExistingConnection();
      } else {
        this.updateState({ 
          isInstalled: false,
          error: 'Kasware Wallet not found. Please install the extension.' 
        });
      }
    } catch (error) {
      this.handleError(error, 'Failed to initialize wallet');
    }
  }

  private async waitForKasware(maxRetries: number = 10): Promise<boolean> {
    for (let i = 1; i <= maxRetries; i++) {
      if ((window as any).kasware) {
        this.kasware = (window as any).kasware;
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100 * i));
    }
    return false;
  }

  private setupEventListeners(): void {
    if (!this.kasware) return;

    // Account changes
    this.kasware.on('accountsChanged', this.handleAccountsChanged.bind(this));
    
    // Network changes
    this.kasware.on('networkChanged', this.handleNetworkChanged.bind(this));
    
    // KRC20 batch transfer progress
    this.kasware.on('krc20BatchTransferChanged', this.handleBatchTransferChanged.bind(this));
  }

  private handleAccountsChanged(accounts: string[]): void {
    const isConnected = accounts.length > 0;
    const account = accounts[0] || '';
    
    this.updateState({
      isConnected,
      account,
      error: null,
      loading: false // Clear loading state when accounts change
    });

    if (isConnected) {
      this.refreshWalletData();
    } else {
      this.updateState({
        balance: null,
        krc20Balances: null,
        publicKey: '',
        loading: false // Ensure loading is cleared when disconnected
      });
    }
  }

  private handleNetworkChanged(network: string): void {
    this.updateState({ network });
    if (this._walletState().isConnected) {
      this.refreshWalletData();
    }
  }

  private handleBatchTransferChanged(results: any[]): void {
    // Could emit events or update UI state here
  }

  private async checkExistingConnection(): Promise<void> {
    try {
      if (!this.kasware) return;

      const accounts = await this.kasware.getAccounts();
      this.handleAccountsChanged(accounts);
    } catch (error) {
      // Not connected yet, this is normal
    }
  }

  private async refreshWalletData(): Promise<void> {
    try {
      if (!this.kasware || !this._walletState().isConnected) return;

      this.updateState({ loading: true, error: null });

      const [balance, krc20Balances, network, publicKey] = await Promise.all([
        this.kasware.getBalance().catch(() => null),
        this.kasware.getKRC20Balance().catch(() => null),
        this.kasware.getNetwork().catch(() => this._walletState().network),
        this.kasware.getPublicKey().catch(() => '')
      ]);

      // In test mode, check if network needs to be switched to Testnet 10
      if (environment.networkMode === 'test' && network !== KaspaNetwork.TESTNET_10) {
        // Try to switch to Testnet 10 automatically
        try {
          await this.kasware.switchNetwork(KaspaNetwork.TESTNET_10);
          // Re-fetch network after switching
          const newNetwork = await this.kasware.getNetwork();
          this.updateState({
            balance,
            krc20Balances,
            network: newNetwork,
            publicKey,
            loading: false
          });
          return;
        } catch (switchError) {
          // If auto-switch fails, still update state with current network
          // The network restriction screen will be shown
        }
      }

      this.updateState({
        balance,
        krc20Balances,
        network,
        publicKey,
        loading: false
      });
    } catch (error) {
      this.handleError(error, 'Failed to refresh wallet data');
    }
  }

  private updateState(partialState: Partial<WalletState>): void {
    this._walletState.update(current => ({ ...current, ...partialState }));
  }

  private handleError(error: any, fallbackMessage: string): void {
    let errorMessage = fallbackMessage;
    
    if (error && typeof error === 'object') {
      if (error.code) {
        switch (error.code) {
          case 4001:
            errorMessage = 'User rejected the request';
            break;
          case 4100:
            errorMessage = 'Unauthorized method';
            break;
          case 4200:
            errorMessage = 'Unsupported method';
            break;
          case -32603:
            errorMessage = 'Internal wallet error';
            break;
          default:
            errorMessage = error.message || fallbackMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
    }

    // Always clear loading state when handling errors
    this.updateState({ 
      error: errorMessage,
      loading: false 
    });
  }

  private clearError(): void {
    this.updateState({ error: null });
  }

  // Public API Methods

  public async connect(): Promise<string[]> {
    try {
      if (!this.kasware) {
        throw new Error('Kasware Wallet not installed');
      }

      this.clearError();
      this.updateState({ loading: true });

      const accounts = await this.kasware.requestAccounts();
      this.handleAccountsChanged(accounts);
      
      return accounts;
    } catch (error) {
      this.handleError(error, 'Failed to connect wallet');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (!this.kasware) return;

      this.clearError();
      this.updateState({ loading: true });

      await this.kasware.disconnect(window.location.origin);
      this.handleAccountsChanged([]);
      
      // Ensure loading state is cleared after successful disconnection
      this.updateState({ loading: false });
    } catch (error) {
      this.handleError(error, 'Failed to disconnect wallet');
      throw error;
    }
  }

  public async sendKaspa(
    toAddress: string, 
    amount: number, 
    options: SendKaspaOptions = {}
  ): Promise<string> {
    try {
      if (!this.kasware) {
        throw new Error('Kasware Wallet not available');
      }

      this.clearError();
      this.updateState({ loading: true });

      // Convert KAS to sompi (1 KAS = 100,000,000 sompi)
      const amountInSompi = Math.floor(amount * 100000000);

      const txId = await this.kasware.sendKaspa(toAddress, amountInSompi, {
        priorityFee: options.priorityFee || 10000,
        payload: options.payload || ''
      });

      // Refresh wallet data after transaction
      setTimeout(() => this.refreshWalletData(), 2000);

      this.updateState({ loading: false });
      return txId;
    } catch (error) {
      this.handleError(error, 'Transaction failed');
      throw error;
    }
  }

  public async signMessage(message: string): Promise<string> {
    try {
      if (!this.kasware) {
        throw new Error('Kasware Wallet not available');
      }

      this.clearError();
      const signature = await this.kasware.signMessage(message);
      return signature;
    } catch (error) {
      this.handleError(error, 'Message signing failed');
      throw error;
    }
  }

  public async verifyMessage(
    publicKey: string, 
    message: string, 
    signature: string
  ): Promise<boolean> {
    try {
      if (!this.kasware) {
        throw new Error('Kasware Wallet not available');
      }

      const isValid = await this.kasware.verifyMessage(publicKey, message, signature);
      return isValid;
    } catch (error) {
      this.handleError(error, 'Message verification failed');
      return false;
    }
  }

  public async switchNetwork(network: KaspaNetwork): Promise<string> {
    try {
      if (!this.kasware) {
        throw new Error('Kasware Wallet not available');
      }

      this.clearError();
      this.updateState({ loading: true });

      const newNetwork = await this.kasware.switchNetwork(network);
      this.updateState({ network: newNetwork, loading: false });
      
      return newNetwork;
    } catch (error) {
      this.handleError(error, 'Failed to switch network');
      throw error;
    }
  }

  public async refreshBalance(): Promise<void> {
    await this.refreshWalletData();
  }

  // Utility methods
  public formatBalance(balance: WalletBalance | null): string {
    if (!balance) return '0.00000000';
    return (balance.total / 100000000).toFixed(8);
  }

  public formatAddress(address: string, length: number = 8): string {
    if (!address) return '';
    if (address.length <= length * 2) return address;
    return `${address.slice(0, length)}...${address.slice(-length)}`;
  }

  public isValidKaspaAddress(address: string): boolean {
    // Basic Kaspa address validation
    const kaspaAddressRegex = /^kaspa(test|dev)?:[a-z0-9]{61,63}$/;
    return kaspaAddressRegex.test(address);
  }

  public getNetworkDisplayName(network?: string): string {
    const currentNetwork = network || this._walletState().network;
    switch (currentNetwork) {
      case KaspaNetwork.MAINNET:
        return 'Mainnet';
      case KaspaNetwork.TESTNET_11:
        return 'Testnet-11';
      case KaspaNetwork.TESTNET_10:
        return 'Testnet-10';
      case KaspaNetwork.DEVNET:
        return 'Devnet';
      default:
        return 'Unknown';
    }
  }

  // Getters for current state
  public getCurrentState(): WalletState {
    return this._walletState();
  }

  public getKasware(): KaswareWallet | null {
    return this.kasware;
  }
}