/**
 * Wallet Adapter
 * 
 * Provides abstraction layer for different wallet implementations
 */

import { IWallet, WalletType, OperationResult } from '../types';

/**
 * Base wallet adapter providing common functionality
 */
export abstract class BaseWalletAdapter implements IWallet {
  protected connected: boolean = false;
  protected address: string | null = null;
  protected balance: number = 0;

  abstract getType(): WalletType;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendTransaction(payload: any): Promise<string>;

  async getAddress(): Promise<string> {
    if (!this.connected || !this.address) {
      throw new Error('Wallet not connected');
    }
    return this.address;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async getBalance(): Promise<number> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }
    return this.balance;
  }

  protected setConnected(connected: boolean, address?: string): void {
    this.connected = connected;
    if (address) {
      this.address = address;
    } else if (!connected) {
      this.address = null;
    }
  }

  protected setBalance(balance: number): void {
    this.balance = balance;
  }
}

/**
 * Kasware wallet adapter
 */
export class KaswareWalletAdapter extends BaseWalletAdapter {
  private kasware: any;

  constructor() {
    super();
    this.kasware = (globalThis as any).kasware;
  }

  getType(): WalletType {
    return WalletType.KASWARE;
  }

  async connect(): Promise<void> {
    if (!this.kasware) {
      throw new Error('Kasware wallet not found. Please install Kasware extension.');
    }

    try {
      const accounts = await this.kasware.requestAccounts();
      if (accounts && accounts.length > 0) {
        this.setConnected(true, accounts[0]);
        await this.updateBalance();
      } else {
        throw new Error('No accounts found');
      }
    } catch (error) {
      throw new Error(`Failed to connect to Kasware: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    this.setBalance(0);
  }

  async sendTransaction(payload: any): Promise<string> {
    if (!this.connected || !this.kasware) {
      throw new Error('Wallet not connected');
    }

    try {
      const txId = await this.kasware.sendKaspa({
        toAddress: await this.getAddress(), // Send to self for protocol data
        satoshis: 1000, // Minimal amount
        options: {
          changeAddress: await this.getAddress(),
          data: JSON.stringify(payload) // Protocol data in transaction
        }
      });

      return txId;
    } catch (error) {
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async updateBalance(): Promise<void> {
    if (!this.connected || !this.kasware) return;

    try {
      const balance = await this.kasware.getBalance();
      this.setBalance(balance.confirmed || 0);
    } catch (error) {
      console.warn('Failed to update balance:', error);
    }
  }

  /**
   * Check if Kasware is available
   */
  static isAvailable(): boolean {
    return typeof (globalThis as any).kasware !== 'undefined';
  }
}

/**
 * Kastle wallet adapter
 */
export class KastleWalletAdapter extends BaseWalletAdapter {
  private kastleApi: any;

  constructor() {
    super();
    // Initialize Kastle API - it uses postMessage communication
    this.kastleApi = this.createKastleAPI();
  }

  getType(): WalletType {
    return WalletType.KASTLE;
  }

  async connect(): Promise<void> {
    if (!this.kastleApi) {
      throw new Error('Kastle wallet not found. Please install Kastle extension.');
    }

    try {
      const connected = await this.kastleApi.connect();
      if (connected) {
        const account = await this.kastleApi.getAccount();
        if (account && account.address) {
          this.setConnected(true, account.address);
          // Kastle doesn't provide balance through the adapter pattern
          this.setBalance(0);
        } else {
          throw new Error('No accounts found');
        }
      } else {
        throw new Error('Connection failed');
      }
    } catch (error) {
      throw new Error(`Failed to connect to Kastle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.kastleApi) {
      await this.kastleApi.disconnect();
    }
    this.setConnected(false);
    this.setBalance(0);
  }

  async sendTransaction(payload: any): Promise<string> {
    if (!this.connected || !this.kastleApi) {
      throw new Error('Wallet not connected');
    }

    try {
      // Get current network
      const network = await this.kastleApi.getNetwork();
      const networkId = network === 'mainnet' ? 'mainnet' : 'testnet-10';
      
      // For Kastle, we need to prepare the transaction JSON
      const txJson = JSON.stringify(payload);
      
      const txId = await this.kastleApi.signAndBroadcastTx(networkId, txJson);
      return txId;
    } catch (error) {
      throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createKastleAPI() {
    // Simplified Kastle API for wallet adapter
    return {
      connect: async (): Promise<boolean> => {
        return new Promise((resolve, reject) => {
          const requestId = this.generateUuid();
          const iconElement = document.querySelector('link[rel="icon"]') || 
                             document.querySelector('link[rel="shortcut icon"]');
          
          let iconUrl: string | undefined;
          if (iconElement instanceof HTMLLinkElement) {
            iconUrl = iconElement.href;
          }

          const request = {
            action: 'connect',
            id: requestId,
            source: 'browser',
            target: 'background',
            payload: {
              name: document.title,
              icon: iconUrl,
            },
          };

          window.postMessage(request, '*');
          this.receiveMessageWithTimeout<boolean>(requestId, 180000).then(resolve).catch(reject);
        });
      },

      disconnect: async (): Promise<void> => {
        // Kastle disconnect implementation
      },

      getAccount: async () => {
        return new Promise((resolve, reject) => {
          const requestId = this.generateUuid();
          const request = {
            action: 'get_account',
            id: requestId,
            source: 'browser',
            target: 'background',
          };

          window.postMessage(request, '*');
          this.receiveMessageWithTimeout<string>(requestId, 180000).then(resolve).catch(reject);
        });
      },

      getNetwork: async (): Promise<string> => {
        return new Promise((resolve, reject) => {
          const requestId = this.generateUuid();
          const request = {
            action: 'get_network',
            id: requestId,
            source: 'browser',
            target: 'background',
          };

          window.postMessage(request, '*');
          this.receiveMessageWithTimeout<string>(requestId, 180000).then(resolve).catch(reject);
        });
      },

      signAndBroadcastTx: async (networkId: string, txJson: string, scripts?: any[]): Promise<string> => {
        return new Promise((resolve, reject) => {
          const requestId = this.generateUuid();
          const request = {
            action: 'sign_and_broadcast_tx',
            id: requestId,
            source: 'browser',
            target: 'background',
            payload: {
              networkId,
              txJson,
              scripts,
            },
          };

          window.postMessage(request, '*');
          this.receiveMessageWithTimeout<string>(requestId, 180000).then(resolve).catch(reject);
        });
      },
    };
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async receiveMessageWithTimeout<T>(id: string, timeout = 180000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        if (event.origin !== window.location.origin) {
          return;
        }

        const message = event.data;
        if (!message || typeof message !== 'object' || !('id' in message)) {
          return;
        }

        const parsedMessage = message as any;
        if (parsedMessage.id !== id) {
          return;
        }

        window.removeEventListener('message', onMessage);

        if (parsedMessage.error) {
          if (typeof parsedMessage.error === 'string') {
            reject(new Error(parsedMessage.error));
          } else {
            reject(parsedMessage.error);
          }
        } else {
          resolve(parsedMessage.response as T);
        }
      };

      window.addEventListener('message', onMessage);

      setTimeout(() => {
        window.removeEventListener('message', onMessage);
        reject(new Error('Timeout'));
      }, timeout);
    });
  }

  /**
   * Check if Kastle is available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.postMessage === 'function';
  }
}

/**
 * Mock wallet adapter for testing
 */
export class MockWalletAdapter extends BaseWalletAdapter {
  private mockAddress: string = 'kaspa:qrmockaddress1234567890abcdef1234567890abcdef1234567890abcdef';
  private mockBalance: number = 1000000;

  getType(): WalletType {
    return WalletType.KASWARE; // Mock as Kasware
  }

  async connect(): Promise<void> {
    this.setConnected(true, this.mockAddress);
    this.setBalance(this.mockBalance);
  }

  async disconnect(): Promise<void> {
    this.setConnected(false);
    this.setBalance(0);
  }

  async sendTransaction(_payload: any): Promise<string> {
    if (!this.connected) {
      throw new Error('Wallet not connected');
    }

    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock transaction ID
    const txId = 'mock_tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    return txId;
  }

  /**
   * Set mock address for testing
   */
  setMockAddress(address: string): void {
    this.mockAddress = address;
    if (this.connected) {
      this.address = address;
    }
  }

  /**
   * Set mock balance for testing
   */
  setMockBalance(balance: number): void {
    this.mockBalance = balance;
    if (this.connected) {
      this.balance = balance;
    }
  }
}

/**
 * Wallet factory for creating wallet adapters
 */
export class WalletFactory {
  /**
   * Create wallet adapter based on type
   */
  static createWallet(type: WalletType): IWallet {
    switch (type) {
      case WalletType.KASWARE:
        return new KaswareWalletAdapter();
      case WalletType.KASTLE:
        return new KastleWalletAdapter();
      default:
        throw new Error(`Unsupported wallet type: ${type}`);
    }
  }

  /**
   * Auto-detect available wallet
   */
  static detectWallet(): IWallet | null {
    if (KaswareWalletAdapter.isAvailable()) {
      return new KaswareWalletAdapter();
    }
    
    if (KastleWalletAdapter.isAvailable()) {
      return new KastleWalletAdapter();
    }

    return null;
  }

  /**
   * Get all available wallet types
   */
  static getAvailableWallets(): WalletType[] {
    const available: WalletType[] = [];

    if (KaswareWalletAdapter.isAvailable()) {
      available.push(WalletType.KASWARE);
    }

    if (KastleWalletAdapter.isAvailable()) {
      available.push(WalletType.KASTLE);
    }

    return available;
  }

  /**
   * Create mock wallet for testing
   */
  static createMockWallet(): MockWalletAdapter {
    return new MockWalletAdapter();
  }
}

/**
 * Wallet manager for handling wallet connections and state
 */
export class WalletManager {
  private wallet: IWallet | null = null;
  private listeners: Map<string, Function[]> = new Map();

  /**
   * Connect to a specific wallet type
   */
  async connectWallet(type: WalletType): Promise<OperationResult<string>> {
    try {
      const wallet = WalletFactory.createWallet(type);
      await wallet.connect();
      
      this.wallet = wallet;
      const address = await wallet.getAddress();
      
      this.emit('wallet:connected', address, type);
      
      return {
        success: true,
        data: address
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      this.emit('wallet:error', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Auto-connect to available wallet
   */
  async autoConnect(): Promise<OperationResult<string>> {
    const detectedWallet = WalletFactory.detectWallet();
    
    if (!detectedWallet) {
      return {
        success: false,
        error: 'No compatible wallet found'
      };
    }

    try {
      await detectedWallet.connect();
      this.wallet = detectedWallet;
      const address = await detectedWallet.getAddress();
      
      this.emit('wallet:connected', address, detectedWallet.getType());
      
      return {
        success: true,
        data: address
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to auto-connect wallet';
      this.emit('wallet:error', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Disconnect current wallet
   */
  async disconnect(): Promise<void> {
    if (this.wallet) {
      await this.wallet.disconnect();
      this.wallet = null;
      this.emit('wallet:disconnected');
    }
  }

  /**
   * Get current wallet
   */
  getWallet(): IWallet | null {
    return this.wallet;
  }

  /**
   * Check if wallet is connected
   */
  async isConnected(): Promise<boolean> {
    return this.wallet ? await this.wallet.isConnected() : false;
  }

  /**
   * Get current wallet address
   */
  async getAddress(): Promise<string | null> {
    if (!this.wallet) return null;
    
    try {
      return await this.wallet.getAddress();
    } catch {
      return null;
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error('Error in wallet event callback:', error);
        }
      });
    }
  }
}