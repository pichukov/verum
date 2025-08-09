import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../../ui/button/button.component';
import { AvatarUploaderComponent } from '../../ui/avatar-uploader/avatar-uploader.component';
import { UserService } from '../../../services/user.service';
import { WalletManagerService } from '../../../services/wallet-manager.service';

@Component({
  selector: 'app-account-setup',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    FontAwesomeModule, 
    ButtonComponent, 
    AvatarUploaderComponent
  ],
  template: `
    <div class="account-setup">
      <div class="setup-container">
        <!-- Header -->
        <div class="setup-header">
          <div class="icon-container">
            <fa-icon [icon]="['fas', 'user-plus']" class="setup-icon"></fa-icon>
          </div>
          <h1 class="setup-title">Welcome to Verum</h1>
          <p class="setup-subtitle">
            Create your decentralized profile on Kaspa
          </p>
        </div>
        
        <!-- Connected Address -->
        <div class="connected-address">
          <fa-icon [icon]="['fas', 'wallet']" class="wallet-icon"></fa-icon>
          <span class="address-label">Connected ({{ getWalletDisplayName() }}):</span>
          <code class="address-text">{{ formatAddress() }}</code>
        </div>
        
        <!-- Setup Form -->
        <div class="setup-form">
          <!-- Avatar Upload -->
          <div class="form-section">
            <label class="section-label">
              <fa-icon [icon]="['fas', 'image']" class="label-icon"></fa-icon>
              Profile Picture
            </label>
            <p class="section-description mb-6">
              Upload an avatar or we'll create one with your initials
            </p>
            <app-avatar-uploader
              [currentAvatar]="avatarPreview()"
              [size]="64"
              [maxSizeKB]="1"
              (avatarSelected)="onAvatarSelected($event)"
              (avatarRemoved)="onAvatarRemoved()"
              (error)="onAvatarError($event)"
              class="mt-6">
            </app-avatar-uploader>
          </div>
          
          <!-- Nickname Input -->
          <div class="form-section">
            <label for="nickname" class="section-label">
              <fa-icon [icon]="['fas', 'user']" class="label-icon"></fa-icon>
              Display Name
            </label>
            <p class="section-description">
              Choose a nickname that will be stored on the blockchain
            </p>
            <div class="input-container">
              <input
                type="text"
                id="nickname"
                [(ngModel)]="nickname"
                [ngModelOptions]="{standalone: true}"
                (input)="onNicknameInput($event)"
                [class.error]="nicknameError()"
                class="nickname-input"
                placeholder="Enter your display name"
                maxlength="50"
                required>
              <div class="character-count">
                {{ nickname.length }}/50
              </div>
            </div>
            @if (nicknameError()) {
              <div class="field-error">
              <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
              {{ nicknameError() }}
              </div>
            }
          </div>
          
          <!-- Cost Information -->
          <div class="cost-info">
            <div class="cost-header">
              <fa-icon [icon]="['fas', 'info-circle']" class="info-icon"></fa-icon>
              <span class="cost-title">Transaction Cost</span>
            </div>
            <div class="cost-details">
              <div class="cost-item">
                <span class="cost-label">Network Fee:</span>
                <span class="cost-value">~0.0001 KAS</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">USD Equivalent:</span>
                <span class="cost-value">~$0.00001</span>
              </div>
            </div>
            <p class="cost-note">
              Your profile data will be permanently stored on Kaspa
            </p>
          </div>
          
          <!-- Submit Button -->
          <div class="form-actions">
            <app-button
              type="button"
              variant="primary"
              size="lg"
              [disabled]="!canSubmit()"
              [loading]="userService.isCreatingAccount()"
              (click)="createAccount()"
              class="create-button">
              <fa-icon [icon]="['fas', 'rocket']" class="button-icon"></fa-icon>
              {{ userService.isCreatingAccount() ? 'Creating Account...' : 'Create Account' }}
            </app-button>
          </div>
        </div>
        
        <!-- Features List -->
        <div class="features-list">
          <h3 class="features-title">What you get:</h3>
          <ul class="features">
            <li class="feature-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Decentralized profile on Kaspa
            </li>
            <li class="feature-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Create and share posts with the community
            </li>
            <li class="feature-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Engage with others through likes and comments
            </li>
            <li class="feature-item">
              <fa-icon [icon]="['fas', 'check']" class="check-icon"></fa-icon>
              Support creators through KAS rewards
            </li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .account-setup {
      @apply min-h-screen bg-gradient-to-br from-kaspa-50 to-white-100;
      @apply dark:from-black-900 dark:to-black-800;
      @apply flex items-center justify-center p-6;
    }
    
    .setup-container {
      @apply w-full max-w-lg bg-white-900 dark:bg-black-800;
      @apply rounded-xl shadow-xl border border-white-200 dark:border-black-700;
      @apply p-8 space-y-8;
    }
    
    .setup-header {
      @apply text-center space-y-4;
    }
    
    .icon-container {
      @apply mx-auto w-16 h-16 bg-kaspa-100 dark:bg-kaspa-900/30;
      @apply rounded-full flex items-center justify-center;
    }
    
    .setup-icon {
      @apply text-2xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    .setup-title {
      @apply text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    .setup-subtitle {
      @apply text-black-600 dark:text-white-400;
    }
    
    .connected-address {
      @apply flex items-center justify-center space-x-2;
      @apply bg-kaspa-50 dark:bg-kaspa-900/20 p-3 rounded-md;
    }
    
    .wallet-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .address-label {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .address-text {
      @apply text-sm font-mono text-black-800 dark:text-white-200;
      @apply bg-white-200 dark:bg-black-700 px-2 py-1 rounded;
    }
    
    .setup-form {
      @apply space-y-6;
    }
    
    .form-section {
      @apply space-y-3;
    }
    
    .section-label {
      @apply flex items-center gap-2 text-sm font-semibold;
      @apply text-black-800 dark:text-white-200;
    }
    
    .label-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .section-description {
      @apply text-sm text-black-600 dark:text-white-400;
    }
    
    .input-container {
      @apply relative;
    }
    
    .nickname-input {
      @apply w-full px-4 py-3 rounded-md border;
      @apply border-white-300 dark:border-black-600;
      @apply bg-white-900 dark:bg-black-700;
      @apply text-black-900 dark:text-white-100;
      @apply placeholder-black-500 dark:placeholder-white-400;
      @apply focus:ring-2 focus:ring-kaspa-500 focus:border-kaspa-500;
      @apply transition-colors duration-200;
    }
    
    .nickname-input.error {
      @apply border-red-500 focus:ring-red-500 focus:border-red-500;
    }
    
    .character-count {
      @apply absolute right-3 top-1/2 transform -translate-y-1/2;
      @apply text-xs text-black-500 dark:text-white-400;
    }
    
    .field-error {
      @apply flex items-center space-x-2 text-sm text-red-600 dark:text-red-400;
    }
    
    .error-icon {
      @apply text-red-500;
    }
    
    .cost-info {
      @apply bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md;
      @apply border border-blue-200 dark:border-blue-800;
    }
    
    .cost-header {
      @apply flex items-center space-x-2 mb-3;
    }
    
    .info-icon {
      @apply text-blue-600 dark:text-blue-400;
    }
    
    .cost-title {
      @apply font-semibold text-black-800 dark:text-white-200;
    }
    
    .cost-details {
      @apply space-y-2 mb-3;
    }
    
    .cost-item {
      @apply flex justify-between text-sm;
    }
    
    .cost-label {
      @apply text-black-600 dark:text-white-400;
    }
    
    .cost-value {
      @apply font-medium text-black-800 dark:text-white-200;
    }
    
    .cost-note {
      @apply text-xs text-black-600 dark:text-white-400;
    }
    
    .form-actions {
      @apply pt-4;
    }
    
    .create-button {
      @apply w-full;
    }
    
    .button-icon {
      @apply mr-2;
    }
    
    .features-list {
      @apply pt-6 border-t border-white-200 dark:border-black-700;
    }
    
    .features-title {
      @apply text-lg font-semibold text-black-800 dark:text-white-200 mb-4;
    }
    
    .features {
      @apply space-y-3;
    }
    
    .feature-item {
      @apply flex items-start gap-3 text-sm;
    }
    
    .check-icon {
      @apply text-green-600 dark:text-green-400 mt-0.5;
    }
    
    /* Mobile responsive */
    @media (max-width: 640px) {
      .setup-container {
        @apply p-6;
      }
      
      .setup-title {
        @apply text-xl;
      }
    }
  `]
})
export class AccountSetupComponent {
  public userService = inject(UserService);
  private walletManager = inject(WalletManagerService);
  
  // Form state
  public nickname = '';
  public compressedAvatarBase64 = signal<string>('');
  public avatarPreview = signal<string>('');
  public nicknameError = signal<string>('');
  
  /**
   * Handle nickname input change
   */
  public onNicknameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.nickname = input.value;
    this.validateNickname();
  }
  
  /**
   * Validate nickname input
   */
  public validateNickname(): void {
    // Clear error first
    this.nicknameError.set('');
    
    // Validate with current nickname value
    const validation = this.userService.validateNickname(this.nickname);
    
    if (!validation.valid) {
      this.nicknameError.set(validation.error || '');
    }
  }
  
  /**
   * Handle avatar selection (now receives compressed base64)
   */
  public onAvatarSelected(compressedBase64: string): void {
    this.compressedAvatarBase64.set(compressedBase64);
    
    // Create preview data URL
    const dataUrl = `data:image/jpeg;base64,${compressedBase64}`;
    this.avatarPreview.set(dataUrl);
  }
  
  /**
   * Handle avatar removal
   */
  public onAvatarRemoved(): void {
    this.compressedAvatarBase64.set('');
    this.avatarPreview.set('');
  }
  
  /**
   * Handle avatar upload error
   */
  public onAvatarError(error: string): void {
    // Error is already displayed in the avatar uploader component
  }
  
  /**
   * Check if form can be submitted
   */
  public canSubmit(): boolean {
    const canSubmit = (
      this.nickname.trim().length >= 2 &&
      !this.nicknameError() &&
      !this.userService.isCreatingAccount() &&
      this.walletManager.isConnected()
    );
    
    return canSubmit;
  }
  
  /**
   * Create user account
   */
  public async createAccount(): Promise<void> {
    if (!this.canSubmit()) {
      return;
    }
    
    console.log('[AccountSetup] createAccount clicked - checking wallet state before creation...');
    console.log('[AccountSetup] WalletManager state:', {
      isConnected: this.walletManager.isConnected(),
      address: this.walletManager.address(),
      connectedWallet: this.walletManager.connectedWallet(),
      network: this.walletManager.network(),
      fullState: this.walletManager.getCurrentState()
    });
    
    try {
      await this.userService.createAccount(
        this.nickname.trim(),
        this.compressedAvatarBase64() || undefined
      );
      
      // Account created successfully, user service will handle state updates
      
    } catch (error) {
      console.error('[AccountSetup] Account creation failed:', error);
      // Error handling is done in the user service
    }
  }
  
  /**
   * Format wallet address for display
   */
  public formatAddress(): string {
    return this.walletManager.formatAddress(this.walletManager.address(), 6);
  }

  /**
   * Get wallet display name
   */
  public getWalletDisplayName(): string {
    const walletType = this.walletManager.connectedWallet();
    switch (walletType) {
      case 'kasware':
        return 'Kasware';
      default:
        return 'Wallet';
    }
  }
}