import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, BehaviorSubject, from, throwError } from 'rxjs';
import { map, switchMap, catchError, tap } from 'rxjs/operators';
import { WalletManagerService } from './wallet-manager.service';
import { KaspaTransactionService } from './kaspa-transaction.service';
import { KaspaApiService } from './kaspa-api.service';
import { ImageCompressionService } from './image-compression.service';
import { ToastService } from './toast.service';
import { UserContextService } from './user-context.service';
import { 
  TransactionType, 
  UserProfile, 
  TransactionPayload,
  VERUM_VERSION 
} from '../types/transaction';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private walletManager = inject(WalletManagerService);
  private transactionService = inject(KaspaTransactionService);
  private apiService = inject(KaspaApiService);
  private imageService = inject(ImageCompressionService);
  private toastService = inject(ToastService);
  private userContextService = inject(UserContextService);
  
  // Current user state
  private _currentUser = signal<UserProfile | null>(null);
  private _isCreatingAccount = signal(false);
  private _accountExists = signal(false);
  private _isCheckingUser = signal(false);
  
  // Computed values
  public readonly currentUser = this._currentUser.asReadonly();
  public readonly isCreatingAccount = this._isCreatingAccount.asReadonly();
  public readonly accountExists = this._accountExists.asReadonly();
  public readonly isCheckingUser = this._isCheckingUser.asReadonly();
  public readonly isLoggedIn = computed(() => {
    return this.walletManager.isConnected() && this._currentUser() !== null;
  });
  
  constructor() {
    // Watch for wallet account changes
    this.setupWalletWatcher();
  }
  
  /**
   * Setup wallet change listener
   */
  private setupWalletWatcher(): void {
    // Watch for wallet account changes
    let previousAccount = '';
    
    setInterval(() => {
      const currentAccount = this.walletManager.address();
      
      // If account changed (including disconnection)
      if (currentAccount !== previousAccount) {
        // Clear current user state
        this.clearUserState();
        
        // If connected to new account, load profile
        if (currentAccount && this.walletManager.isConnected()) {
          this._isCheckingUser.set(true); // Set checking state immediately
          this.loadCurrentUser();
        }
        
        previousAccount = currentAccount;
      }
    }, 500); // Check every 500ms
  }
  
  /**
   * Clear user state when wallet changes
   */
  private clearUserState(): void {
    this._currentUser.set(null);
    this._accountExists.set(false);
    this._isCheckingUser.set(false);
  }
  
  /**
   * Load user profile by address
   */
  public async loadUserProfile(address: string): Promise<UserProfile | null> {
    console.log('[UserService] loadUserProfile called with address:', address);
    try {
      // Set API network based on wallet address
      this.apiService.setNetworkFromAddress(address);
      
      const profile = await this.transactionService.getUserProfile(address, true).toPromise();
      return profile || null;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Load current user profile from blockchain
   */
  public async loadCurrentUser(): Promise<void> {
    console.log(`[UserService] 🔍 Starting loadCurrentUser...`);
    this._isCheckingUser.set(true);
    
    try {
      const address = this.walletManager.address();
      console.log(`[UserService] 📍 Wallet address: ${address}`);
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      // Set API network based on wallet address
      this.apiService.setNetworkFromAddress(address);
      console.log(`[UserService] 🌐 Network set for address type: ${address.split(':')[0]}`);
      
      console.log(`[UserService] 🔄 Fetching user profile from blockchain...`);
      const profile = await this.transactionService.getUserProfile(address, true).toPromise(); // Force bypass cache
      console.log(`[UserService] 📦 Profile response:`, profile);
      
      if (profile) {
        console.log(`[UserService] ✅ Profile found for ${address}: ${profile.nickname}`);
        this._currentUser.set(profile);
        this._accountExists.set(true);
        console.log(`[UserService] 🎯 Internal state updated - accountExists: true, currentUser set`);
        
        // Update user context for v0.2 protocol support
        this.userContextService.setCurrentUser(profile);
      } else {
        console.log(`[UserService] ❌ No profile found for ${address}`);
        this._currentUser.set(null);
        this._accountExists.set(false);
        console.log(`[UserService] 🎯 Internal state updated - accountExists: false, currentUser null`);
        
        // Clear user context
        this.userContextService.clearUserContext();
      }
    } catch (error) {
      console.error('[UserService] 💥 Error loading current user:', error);
      console.log('[UserService] 🎯 Setting accountExists to false due to error');
      this._currentUser.set(null);
      this._accountExists.set(false);
    } finally {
      this._isCheckingUser.set(false);
      console.log(`[UserService] ⏹️ loadCurrentUser completed`);
    }
  }
  
  /**
   * Create new user account with nickname and avatar
   */
  public async createAccount(
    nickname: string, 
    avatarBase64?: string
  ): Promise<UserProfile> {
    try {
      const isConnected = this.walletManager.isConnected();
      const address = this.walletManager.address();
      const connectedWallet = this.walletManager.connectedWallet();
      const fullState = this.walletManager.getCurrentState();
      
      console.log('[UserService] createAccount - detailed connection check:', {
        isConnected,
        address: address?.substring(0, 20) + '...',
        connectedWallet,
        fullState,
        // Also check individual signals
        walletManagerSignals: {
          isConnectedSignal: this.walletManager.isConnected(),
          addressSignal: this.walletManager.address(),
          connectedWalletSignal: this.walletManager.connectedWallet(),
          networkSignal: this.walletManager.network()
        }
      });
      
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      if (!address) {
        throw new Error('No wallet address available');
      }
      
      // Check if account already exists
      if (this._accountExists()) {
        throw new Error('Account already exists for this address');
      }
      
      this._isCreatingAccount.set(true);
      
      // Set API network based on wallet address
      this.apiService.setNetworkFromAddress(address);
      
      // Validate nickname
      if (!nickname.trim()) {
        throw new Error('Nickname is required');
      }
      
      if (nickname.length > 50) {
        throw new Error('Nickname must be 50 characters or less');
      }
      
      // Process avatar
      let avatarBase64String = '';
      
      if (avatarBase64) {
        // Use the already compressed base64 string
        avatarBase64String = avatarBase64;
      } else {
        // Create placeholder avatar with initials (pixel art style)
        const initials = this.generateInitials(nickname);
        avatarBase64String = this.imageService.createPlaceholderAvatar(initials, 32);
      }
      
      // Create start transaction payload
      const payload: TransactionPayload = {
        verum: VERUM_VERSION,
        type: TransactionType.START,
        content: `${nickname.trim()}|${avatarBase64String}`,
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      // Validate payload size (must fit in ~1000 bytes)
      const payloadJson = JSON.stringify(payload);
      const payloadSize = new TextEncoder().encode(payloadJson).length;
      
      if (payloadSize > 1000) {
        throw new Error(`Account data too large (${payloadSize} bytes). Please try a shorter nickname or the system will compress the avatar further.`);
      }
      
      // Create transaction with 1 KAS (part of our protocol for start transactions)
      let txId: string;
      try {
        txId = await this.transactionService.createTransaction(payload, undefined, 1);
      } catch (txError: any) {
        throw new Error(`Transaction failed: ${txError?.message || txError}`);
      }
      
      // Create user profile object
      const profile: UserProfile = {
        address,
        nickname: nickname.trim(),
        avatar: avatarBase64String,
        startTransactionId: txId,
        createdAt: payload.timestamp
      };
      
      // Update state
      this._currentUser.set(profile);
      this._accountExists.set(true);
      
      // Update user context for v0.2 protocol support
      this.userContextService.setCurrentUser(profile);
      
      this.toastService.success(
        `Account created successfully! Welcome, ${nickname}`,
        'Account Created'
      );
      
      return profile;
      
    } catch (error: any) {
      this.toastService.error(
        error.message || 'Failed to create account',
        'Account Creation Failed'
      );
      
      throw error;
    } finally {
      this._isCreatingAccount.set(false);
    }
  }
  
  
  /**
   * Get user profile by address
   */
  public getUserProfile(address: string): Observable<UserProfile | null> {
    return this.transactionService.getUserProfile(address);
  }
  
  /**
   * Check if address has an account
   */
  public checkAccountExists(address: string): Observable<boolean> {
    return this.getUserProfile(address).pipe(
      map(profile => profile !== null)
    );
  }
  
  /**
   * Generate initials from nickname
   */
  private generateInitials(nickname: string): string {
    const words = nickname.trim().split(/\s+/);
    
    if (words.length === 1) {
      return words[0].slice(0, 2);
    }
    
    return words
      .slice(0, 2)
      .map(word => word.charAt(0))
      .join('');
  }
  
  /**
   * Format user display name
   */
  public formatDisplayName(profile: UserProfile | null): string {
    if (!profile) return 'Anonymous';
    return profile.nickname || 'Anonymous';
  }
  
  /**
   * Get avatar data URL
   */
  public getAvatarDataUrl(profile: UserProfile | null): string {
    if (!profile?.avatar) {
      return '';
    }
    
    return `data:image/jpeg;base64,${profile.avatar}`;
  }
  
  /**
   * Validate nickname
   */
  public validateNickname(nickname: string): { valid: boolean; error?: string } {
    const trimmed = nickname.trim();
    
    if (!trimmed) {
      return { valid: false, error: 'Nickname is required' };
    }
    
    if (trimmed.length < 2) {
      return { valid: false, error: 'Nickname must be at least 2 characters' };
    }
    
    if (trimmed.length > 50) {
      return { valid: false, error: 'Nickname must be 50 characters or less' };
    }
    
    // Check for invalid characters
    const validPattern = /^[a-zA-Z0-9_\-\s]+$/;
    if (!validPattern.test(trimmed)) {
      return { valid: false, error: 'Nickname can only contain letters, numbers, spaces, underscores, and hyphens' };
    }
    
    return { valid: true };
  }
  
  /**
   * Get current user address
   */
  public getCurrentUserAddress(): string {
    return this.walletManager.address();
  }
  
  /**
   * Check if current user has an account
   */
  public hasAccount(): boolean {
    return this._accountExists();
  }
  
  /**
   * Check if address is current user
   */
  public isCurrentUser(address: string): boolean {
    return address === this.getCurrentUserAddress();
  }
  
  /**
   * Refresh current user data
   */
  public async refreshCurrentUser(): Promise<void> {
    await this.loadCurrentUser();
  }
  
  /**
   * Clear all user data (for wallet disconnect/change)
   */
  public clearAllUserData(): void {
    this.clearUserState();
    this.userContextService.clearUserContext();
  }
}