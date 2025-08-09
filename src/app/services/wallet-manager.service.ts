import { Injectable, signal, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { KaswareWalletService } from './kasware-wallet.service';
import { environment } from '../../environments/environment';

export type WalletType = 'kasware' | null;

export interface WalletManagerState {
  connectedWallet: WalletType;
  isConnected: boolean;
  address: string;
  publicKey: string;
  network: string;
  loading: boolean;
  error: string | null;
}

export interface WalletInfo {
  id: WalletType;
  name: string;
  description: string;
  isInstalled: boolean;
  isAvailable: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WalletManagerService {
  private platformId = inject(PLATFORM_ID);
  private kaswareService = inject(KaswareWalletService);
  
  // Reactive state
  private _state = signal<WalletManagerState>({
    connectedWallet: null,
    isConnected: false,
    address: '',
    publicKey: '',
    network: environment.networkMode === 'test' ? 'testnet-10' : 'mainnet',
    loading: false,
    error: null
  });
  
  // Public readonly signals
  public readonly state = this._state.asReadonly();
  public readonly connectedWallet = signal<WalletType>(null);
  public readonly isConnected = signal(false);
  public readonly address = signal('');
  public readonly publicKey = signal('');
  public readonly network = signal('mainnet');
  public readonly loading = signal(false);
  public readonly error = signal<string | null>(null);
  
  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeManager();
    }
  }
  
  private initializeManager(): void {
    // Set up reactive effects to update individual signals using effect
    effect(() => {
      const state = this._state();
      this.connectedWallet.set(state.connectedWallet);
      this.isConnected.set(state.isConnected);
      this.address.set(state.address);
      this.publicKey.set(state.publicKey);
      this.network.set(state.network);
      this.loading.set(state.loading);
      this.error.set(state.error);
    });
    
    // Watch for Kasware wallet state changes
    effect(() => {
      const kaswareState = this.kaswareService.walletState();
      if (kaswareState.isConnected && kaswareState.account) {
        console.log('[WalletManager] Kasware state changed:', {
          account: kaswareState.account.substring(0, 20) + '...',
          rawNetwork: kaswareState.network,
          normalizedNetwork: this.normalizeNetworkName(kaswareState.network)
        });
        const normalizedNetwork = this.normalizeNetworkName(kaswareState.network);
        this.updateState({
          connectedWallet: 'kasware',
          isConnected: true,
          address: kaswareState.account,
          publicKey: kaswareState.publicKey,
          network: normalizedNetwork,
          loading: false,
          error: null
        });
      }
    });
    
    
    // Check for existing connections
    this.checkExistingConnections();
  }
  
  private async checkExistingConnections(): Promise<void> {
    try {
      console.log('[WalletManager] Checking existing connections...');
      
      // Check Kasware connection
      const kaswareConnected = this.kaswareService.isConnected();
      console.log('[WalletManager] Kasware connection status:', kaswareConnected);
      
      if (kaswareConnected) {
        const address = this.kaswareService.account();
        const rawNetwork = this.kaswareService.network();
        const network = this.normalizeNetworkName(rawNetwork);
        console.log('[WalletManager] Kasware connection found:', {
          address: address.substring(0, 20) + '...',
          rawNetwork,
          normalizedNetwork: network
        });
        this.updateState({
          connectedWallet: 'kasware',
          isConnected: true,
          address: address,
          network: network
        });
        return;
      }
      
      
      console.log('[WalletManager] No existing connections found');
    } catch (error) {
      console.log('[WalletManager] Error checking existing connections:', error);
    }
  }
  
  private updateState(partialState: Partial<WalletManagerState>): void {
    this._state.update(current => ({ ...current, ...partialState }));
  }

  /**
   * Normalize network names from different wallet implementations
   */
  private normalizeNetworkName(network: string): string {
    switch (network) {
      case 'kaspa_mainnet':
      case 'mainnet':
        return 'mainnet';
      case 'kaspa_testnet_10':
      case 'testnet-10':
        return 'testnet-10';
      case 'kaspa_testnet_11':
      case 'testnet-11':
        return 'testnet-11';
      case 'kaspa_devnet':
      case 'devnet':
        return 'devnet';
      default:
        return network;
    }
  }
  
  /**
   * Get available wallets with their installation status
   */
  public getAvailableWallets(): WalletInfo[] {
    return [
      {
        id: 'kasware',
        name: 'Kasware',
        description: 'Official Kaspa wallet extension',
        isInstalled: this.kaswareService.isInstalled(),
        isAvailable: this.kaswareService.isInstalled()
      }
    ];
  }
  
  /**
   * Connect to a specific wallet
   */
  public async connectWallet(walletType: Exclude<WalletType, null>): Promise<string> {
    if (this._state().loading) {
      throw new Error('Connection already in progress');
    }
    
    this.updateState({ loading: true, error: null });
    
    try {
      let address: string;
      let publicKey = '';
      let network = 'mainnet';
      
      if (walletType === 'kasware') {
        const accounts = await this.kaswareService.connect();
        address = accounts[0] || '';
        publicKey = this.kaswareService.walletState().publicKey;
        network = this.normalizeNetworkName(this.kaswareService.network());
      } else {
        throw new Error('Unsupported wallet type');
      }
      
      // Verify we have required information
      if (!address) {
        throw new Error('No address received from wallet');
      }
      
      // Check network compatibility if in test mode
      console.log('[WalletManager] Network compatibility check:', {
        environmentNetworkMode: environment.networkMode,
        currentNetwork: network,
        expectedNetwork: 'testnet-10'
      });
      
      // Normalize network names for comparison
      const normalizedNetwork = this.normalizeNetworkName(network);
      console.log('[WalletManager] Normalized network:', normalizedNetwork);
      
      if (environment.networkMode === 'test' && normalizedNetwork !== 'testnet-10') {
        console.log('[WalletManager] Network mismatch, switching to testnet-10');
        await this.switchNetwork('testnet-10');
        network = 'testnet-10';
      }
      
      this.updateState({
        connectedWallet: walletType,
        isConnected: true,
        address,
        publicKey,
        network,
        loading: false,
        error: null
      });
      
      return address;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Disconnect current wallet
   */
  public async disconnect(): Promise<void> {
    const currentWallet = this._state().connectedWallet;
    
    if (!currentWallet) {
      return;
    }
    
    this.updateState({ loading: true, error: null });
    
    try {
      if (currentWallet === 'kasware') {
        await this.kaswareService.disconnect();
      }
      
      this.updateState({
        connectedWallet: null,
        isConnected: false,
        address: '',
        publicKey: '',
        network: environment.networkMode === 'test' ? 'testnet-10' : 'mainnet',
        loading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Disconnect failed';
      this.updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Sign a message with the connected wallet
   */
  public async signMessage(message: string): Promise<string> {
    const currentWallet = this._state().connectedWallet;
    
    if (!currentWallet || !this._state().isConnected) {
      throw new Error('No wallet connected');
    }
    
    try {
      if (currentWallet === 'kasware') {
        return await this.kaswareService.signMessage(message);
      } else {
        throw new Error('Unsupported wallet type');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Message signing failed';
      this.updateState({ error: errorMessage });
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Send a transaction with the connected wallet
   */
  public async sendTransaction(payload: any): Promise<string> {
    const currentWallet = this._state().connectedWallet;
    
    if (!currentWallet || !this._state().isConnected) {
      throw new Error('No wallet connected');
    }
    
    this.updateState({ loading: true, error: null });
    
    try {
      let txId: string;
      
      if (currentWallet === 'kasware') {
        // For Kasware, we need to adapt the payload to its expected format
        const amount = payload.amount || 1000; // Minimal amount in sompi
        const toAddress = payload.toAddress || this._state().address;
        
        // Extract the actual JSON payload string if it exists
        const payloadData = payload.payload || JSON.stringify(payload);
        
        txId = await this.kaswareService.sendKaspa(toAddress, amount / 100000000, {
          payload: payloadData
        });
      } else {
        throw new Error('Unsupported wallet type');
      }
      
      this.updateState({ loading: false });
      return txId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
      this.updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Switch network for the connected wallet
   */
  public async switchNetwork(network: 'mainnet' | 'testnet-10'): Promise<void> {
    const currentWallet = this._state().connectedWallet;
    
    if (!currentWallet || !this._state().isConnected) {
      throw new Error('No wallet connected');
    }
    
    this.updateState({ loading: true, error: null });
    
    try {
      if (currentWallet === 'kasware') {
        // Map to Kasware's network enum
        const kaswareNetwork = network === 'mainnet' ? 'mainnet' : 'testnet-10';
        await this.kaswareService.switchNetwork(kaswareNetwork as any);
      }
      
      this.updateState({
        network,
        loading: false
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network switch failed';
      this.updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Get current wallet balance (if supported)
   */
  public getWalletBalance(): any {
    const currentWallet = this._state().connectedWallet;
    
    if (currentWallet === 'kasware') {
      return this.kaswareService.balance();
    }
    
    return null;
  }
  
  /**
   * Format address for display
   */
  public formatAddress(address?: string, length: number = 8): string {
    const addr = address || this._state().address;
    if (!addr) return '';
    if (addr.length <= length * 2) return addr;
    return `${addr.slice(0, length)}...${addr.slice(-length)}`;
  }
  
  /**
   * Check if an address is valid Kaspa address
   */
  public isValidKaspaAddress(address: string): boolean {
    const kaspaAddressRegex = /^kaspa(test|dev)?:[a-z0-9]{61,63}$/;
    return kaspaAddressRegex.test(address);
  }
  
  /**
   * Get network display name
   */
  public getNetworkDisplayName(network?: string): string {
    const currentNetwork = network || this._state().network;
    switch (currentNetwork) {
      case 'mainnet':
        return 'Mainnet';
      case 'testnet-10':
        return 'Testnet-10';
      case 'testnet-11':
        return 'Testnet-11';
      default:
        return 'Unknown';
    }
  }
  
  /**
   * Clear any error state
   */
  public clearError(): void {
    this.updateState({ error: null });
  }
  
  /**
   * Get current state snapshot
   */
  public getCurrentState(): WalletManagerState {
    return this._state();
  }
}