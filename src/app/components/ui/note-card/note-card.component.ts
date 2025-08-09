import { Component, input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownComponent } from 'ngx-markdown';
import { Note } from '../../../types/transaction';
import { EncryptionService } from '../../../services/encryption.service';
import { ToastService } from '../../../services/toast.service';
import { ButtonComponent } from '../button/button.component';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-note-card',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, MarkdownComponent, ButtonComponent, AvatarComponent],
  template: `
    <div class="note-card">
      <div class="note-header">
        <div class="author-info">
          <app-avatar
            [src]="getAuthorAvatarUrl()"
            [name]="note().author?.nickname || 'Anonymous'"
            size="sm"
            class="note-avatar">
          </app-avatar>
          <div class="author-details">
            <div class="author-name">{{ note().author?.nickname || 'Anonymous' }}</div>
            <div class="note-timestamp">{{ formatTimestamp(note().blockTime) }}</div>
          </div>
        </div>
        
        <div class="note-lock-indicator">
          <fa-icon [icon]="['fas', 'lock']" class="lock-icon" title="Private Encrypted Note"></fa-icon>
          <span class="lock-text">Private • Encrypted</span>
        </div>
      </div>

      <div class="note-content">
        @if (!isDecrypted() && !showPasswordInput()) {
          <!-- Encrypted state -->
          <div class="encrypted-content">
            <div class="encrypted-placeholder">
              <fa-icon [icon]="['fas', 'lock']" class="encrypted-icon"></fa-icon>
              <p class="encrypted-text">Your private note is encrypted. Enter the password to read it.</p>
            </div>
            <div class="decrypt-actions">
              <app-button
                variant="secondary"
                size="sm"
                (click)="showPasswordInput.set(true)"
                [disabled]="isDecrypting()">
                <fa-icon [icon]="['fas', 'key']" class="btn-icon"></fa-icon>
                Decrypt Note
              </app-button>
            </div>
          </div>
        }
        
        @if (showPasswordInput() && !isDecrypted()) {
          <!-- Password input state -->
          <div class="password-input-section">
            <div class="password-input-wrapper">
              <fa-icon [icon]="['fas', 'key']" class="password-icon"></fa-icon>
              <input
                type="password"
                [(ngModel)]="passwordInput"
                placeholder="Enter password to decrypt"
                class="password-input"
                [disabled]="isDecrypting()"
                (keydown.enter)="decryptNote()"
                #passwordField>
            </div>
            @if (passwordError()) {
              <div class="password-error">
                <fa-icon [icon]="['fas', 'exclamation-circle']" class="error-icon"></fa-icon>
                {{ passwordError() }}
              </div>
            }
            <div class="password-actions">
              <app-button
                variant="primary"
                size="sm"
                (click)="decryptNote()"
                [disabled]="!passwordInput().trim() || isDecrypting()"
                [loading]="isDecrypting()">
                Decrypt
              </app-button>
              <app-button
                variant="ghost"
                size="sm"
                (click)="cancelDecryption()"
                [disabled]="isDecrypting()">
                Cancel
              </app-button>
            </div>
          </div>
        }
        
        @if (isDecrypted()) {
          <!-- Decrypted content -->
          <div class="decrypted-content">
            <div class="content-header">
              <fa-icon [icon]="['fas', 'unlock']" class="unlocked-icon" title="Successfully Decrypted"></fa-icon>
              <span class="decrypted-label">Decrypted Note</span>
            </div>
            <div class="note-body">
              <markdown class="note-markdown" [data]="decryptedContent()"></markdown>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .note-card {
      @apply bg-white dark:bg-black-800;
      @apply border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small;
      @apply mb-4;
    }

    .note-header {
      @apply flex justify-between items-start;
      @apply p-4 pb-3;
      @apply border-b border-white-100 dark:border-black-700;
    }

    .author-info {
      @apply flex items-center space-x-3;
    }

    .note-avatar {
      @apply flex-shrink-0;
    }

    .author-details {
      @apply flex flex-col;
    }

    .author-name {
      @apply font-medium text-black-900 dark:text-white-100;
      @apply text-sm;
    }

    .note-timestamp {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .note-lock-indicator {
      @apply flex items-center space-x-2;
      @apply px-3 py-1;
      @apply bg-amber-50 dark:bg-amber-900/20;
      @apply border border-amber-200 dark:border-amber-800;
      @apply rounded-full;
    }

    .lock-icon {
      @apply text-amber-600 dark:text-amber-400;
      @apply text-sm;
    }

    .lock-text {
      @apply text-xs font-medium;
      @apply text-amber-700 dark:text-amber-300;
    }

    .note-content {
      @apply p-4;
    }

    .encrypted-content {
      @apply text-center py-8;
    }

    .encrypted-placeholder {
      @apply mb-4;
    }

    .encrypted-icon {
      @apply text-4xl text-amber-400 dark:text-amber-500;
      @apply mb-3;
    }

    .encrypted-text {
      @apply text-black-600 dark:text-white-400;
      @apply text-sm;
    }

    .decrypt-actions {
      @apply flex justify-center;
    }

    .password-input-section {
      @apply space-y-4;
    }

    .password-input-wrapper {
      @apply relative;
    }

    .password-icon {
      @apply absolute left-3 top-1/2 transform -translate-y-1/2;
      @apply text-amber-600 dark:text-amber-400;
      @apply text-sm;
    }

    .password-input {
      @apply w-full pl-10 pr-4 py-3;
      @apply border border-white-300 dark:border-black-600;
      @apply bg-white dark:bg-black-700;
      @apply text-black-900 dark:text-white-100;
      @apply text-sm rounded-md;
      @apply focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .password-error {
      @apply flex items-center space-x-2;
      @apply text-sm text-red-600 dark:text-red-400;
    }

    .error-icon {
      @apply text-sm;
    }

    .password-actions {
      @apply flex items-center space-x-3;
    }

    .decrypted-content {
      @apply space-y-4;
    }

    .content-header {
      @apply flex items-center space-x-2;
      @apply pb-2 border-b border-green-200 dark:border-green-800;
    }

    .unlocked-icon {
      @apply text-green-600 dark:text-green-400;
      @apply text-sm;
    }

    .decrypted-label {
      @apply text-sm font-medium;
      @apply text-green-700 dark:text-green-300;
    }

    .note-body {
      @apply pt-2;
    }

    .note-markdown {
      @apply text-sm leading-relaxed;
      @apply text-black-900 dark:text-white-100;
    }

    .btn-icon {
      @apply mr-2 text-xs;
    }

    /* Cyberpunk theme overrides */
    :host-context(.cyberpunk-theme) .note-card {
      @apply bg-cyber-dark-2 border-cyber-gray-2;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #FFFF00, transparent);
        animation: note-line-glow 3s ease-in-out infinite alternate;
      }
    }

    :host-context(.cyberpunk-theme) .note-header {
      @apply border-b border-cyber-gray-3;
    }

    :host-context(.cyberpunk-theme) .author-name {
      @apply text-white-100 font-tech;
    }

    :host-context(.cyberpunk-theme) .note-timestamp {
      @apply text-cyber-gray-5;
    }

    :host-context(.cyberpunk-theme) .note-lock-indicator {
      @apply bg-cyber-dark-3 border border-neon-yellow/30;
    }

    :host-context(.cyberpunk-theme) .lock-icon {
      @apply text-neon-yellow;
      filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.6));
    }

    :host-context(.cyberpunk-theme) .lock-text {
      @apply text-neon-yellow font-tech;
    }

    :host-context(.cyberpunk-theme) .encrypted-icon {
      @apply text-neon-yellow;
      filter: drop-shadow(0 0 10px rgba(255, 255, 0, 0.8));
    }

    :host-context(.cyberpunk-theme) .encrypted-text {
      @apply text-cyber-gray-5 font-tech;
    }

    :host-context(.cyberpunk-theme) .password-input {
      @apply bg-cyber-dark-3 border-cyber-gray-4;
      @apply focus:ring-neon-yellow focus:border-neon-yellow;
      @apply text-white-100;
    }

    :host-context(.cyberpunk-theme) .unlocked-icon {
      @apply text-neon-green;
      filter: drop-shadow(0 0 5px rgba(0, 255, 0, 0.6));
    }

    :host-context(.cyberpunk-theme) .decrypted-label {
      @apply text-neon-green font-tech;
    }

    :host-context(.cyberpunk-theme) .content-header {
      @apply border-b border-neon-green/30;
    }

    @keyframes note-line-glow {
      0% { opacity: 0.3; }
      100% { opacity: 1; }
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .note-header {
        @apply flex-col items-start space-y-3;
      }
      
      .password-actions {
        @apply flex-col space-y-2 space-x-0;
      }
      
      .password-actions > * {
        @apply w-full;
      }
    }
  `]
})
export class NoteCardComponent {
  public note = input.required<Note>();
  
  private encryptionService = inject(EncryptionService);
  private toastService = inject(ToastService);
  
  // State
  public passwordInput = signal('');
  public passwordError = signal('');
  public showPasswordInput = signal(false);
  public isDecrypting = signal(false);
  public isDecrypted = signal(false);
  public decryptedContent = signal<string>('');
  
  /**
   * Attempt to decrypt the note
   */
  async decryptNote(): Promise<void> {
    const password = this.passwordInput().trim();
    
    if (!password) {
      this.passwordError.set('Password is required');
      return;
    }
    
    this.isDecrypting.set(true);
    this.passwordError.set('');
    
    try {
      const encryptedContent = this.note().content;
      const decryptedText = await this.encryptionService.decryptText(encryptedContent, password);
      
      // Store the decrypted content in our signal
      this.decryptedContent.set(decryptedText);
      this.isDecrypted.set(true);
      this.showPasswordInput.set(false);
      this.passwordInput.set('');
      
      this.toastService.success('Note decrypted successfully!', 'Decryption Success');
      
    } catch (error: any) {
      this.passwordError.set('Invalid password or corrupted data');
      console.error('Decryption error:', error);
    } finally {
      this.isDecrypting.set(false);
    }
  }
  
  /**
   * Cancel decryption attempt
   */
  cancelDecryption(): void {
    this.showPasswordInput.set(false);
    this.passwordInput.set('');
    this.passwordError.set('');
  }
  
  /**
   * Get author avatar URL
   */
  getAuthorAvatarUrl(): string {
    const author = this.note().author;
    if (!author?.avatar) return '';
    
    // Check if it's already a data URL
    if (author.avatar.startsWith('data:')) {
      return author.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${author.avatar}`;
  }
  
  /**
   * Format timestamp for display
   */
  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    }
  }
}