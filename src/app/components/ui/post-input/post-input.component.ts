import { Component, inject, output, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserService } from '../../../services/user.service';
import { PostService } from '../../../services/post.service';
import { StoryService } from '../../../services/story.service';
import { KaspaTransactionService } from '../../../services/kaspa-transaction.service';
import { ChainTraversalService } from '../../../services/chain-traversal.service';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { ToastService } from '../../../services/toast.service';
import { EncryptionService } from '../../../services/encryption.service';
import { ButtonComponent } from '../button/button.component';
import { TransactionType, StoryProgress, VERUM_VERSION } from '../../../types/transaction';
import { MarkdownComponent } from 'ngx-markdown';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-post-input',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, ButtonComponent, MarkdownComponent],
  template: `
    <div class="post-input-container">
      <!-- Tab Navigation -->
      <div class="tab-navigation">
        <button 
          type="button"
          class="tab-button"
          [class.active]="mode() === 'post'"
          (click)="switchMode('post')"
          [disabled]="isPosting()">
          <fa-icon [icon]="['fas', 'edit']" class="tab-icon"></fa-icon>
          Post
        </button>
        <button 
          type="button"
          class="tab-button"
          [class.active]="mode() === 'story'"
          (click)="switchMode('story')"
          [disabled]="isPosting()">
          <fa-icon [icon]="['fas', 'book-open']" class="tab-icon"></fa-icon>
          Story
        </button>
        <button 
          type="button"
          class="tab-button"
          [class.active]="mode() === 'note'"
          (click)="switchMode('note')"
          [disabled]="isPosting()">
          <fa-icon [icon]="['fas', 'lock']" class="tab-icon"></fa-icon>
          Note
        </button>
      </div>

      <!-- Mode Info -->
      @if (mode() === 'story') {
        <div class="story-info">
          <div class="info-content">
            <fa-icon [icon]="['fas', 'info-circle']" class="info-icon"></fa-icon>
            <span class="info-text">
              Story mode allows unlimited content by splitting it into multiple transactions.
              @if (estimatedSegments() > 0) {
                <strong>Estimated: {{ estimatedSegments() }} transaction{{ estimatedSegments() === 1 ? '' : 's' }}</strong>
              }
            </span>
          </div>
        </div>
      }
      
      @if (mode() === 'note') {
        <div class="note-info">
          <div class="info-content">
            <fa-icon [icon]="['fas', 'lock']" class="info-icon"></fa-icon>
            <span class="info-text">
              <strong>Private Notes:</strong> Only visible to you. Encrypted with your password and stored on the blockchain. 
              Other users cannot see your notes in their feed.
            </span>
          </div>
        </div>
      }

      <!-- Main input section -->
      <div class="post-input-section">
        <!-- User avatar -->
        <div class="user-avatar">
          @if (userService.currentUser()?.avatar) {
            <img 
              [src]="getUserAvatarUrl()" 
              [alt]="userService.currentUser()?.nickname"
              class="avatar-img">
          } @else {
            <div class="avatar-placeholder">
              <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
            </div>
          }
        </div>

        <!-- Text input area -->
        <div class="input-area">
          <textarea
            #textareaRef
            [(ngModel)]="postContent"
            [placeholder]="placeholder"
            (input)="onContentChange($event)"
            class="post-textarea"
            rows="3"
            [disabled]="isPosting()">
          </textarea>
        </div>
      </div>

      <!-- Password section for notes -->
      @if (mode() === 'note') {
        <div class="password-section">
          <div class="password-input-wrapper">
            <fa-icon [icon]="['fas', 'key']" class="password-icon"></fa-icon>
            <input
              type="password"
              [(ngModel)]="notePassword"
              placeholder="Enter password to encrypt note"
              class="password-input"
              [disabled]="isPosting()"
              (input)="onPasswordChange()">
          </div>
          @if (passwordError()) {
            <div class="password-error">
              <fa-icon [icon]="['fas', 'exclamation-circle']" class="error-icon"></fa-icon>
              {{ passwordError() }}
            </div>
          }
        </div>
      }

      <!-- Actions section -->
      <div class="actions-section">
        <!-- Payload size and post button -->
        <div class="post-actions">
          @if (mode() === 'post') {
            <span class="char-count" [class.warning]="isNearSizeLimit()" [class.error]="isOverSizeLimit()">
              {{ getCurrentPayloadSize() }}/{{ maxPayloadBytes }} bytes
            </span>
          } @else if (mode() === 'story') {
            <span class="char-count">
              Content length: {{ postContent().length }} characters
              @if (estimatedSegments() > 0) {
                ({{ estimatedSegments() }} segments)
              }
            </span>
          } @else if (mode() === 'note') {
            <span class="char-count">
              Content length: {{ postContent().length }} characters (will be encrypted)
            </span>
          }
          
          @if (storyProgress().currentSegment > 0 && !storyProgress().isComplete) {
            <!-- Progress indicator for story publishing -->
            <div class="story-progress">
              <span class="progress-text">
                Publishing segment {{ storyProgress().currentSegment }}/{{ storyProgress().totalSegments }}
              </span>
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="(storyProgress().currentSegment / storyProgress().totalSegments) * 100"></div>
              </div>
            </div>
          }
          
          <app-button
            variant="primary"
            size="sm"
            [disabled]="!canPost()"
            [loading]="isPosting()"
            (click)="onPost()"
            class="post-btn">
            {{ getPostButtonText() }}
          </app-button>
        </div>
      </div>

      <!-- Error message -->
      @if (errorMessage()) {
        <div class="error-message">
          <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
          {{ errorMessage() }}
        </div>
      }

      <!-- Story retry section -->
      @if (storyProgress().error && storyProgress().canRetry && mode() === 'story') {
        <div class="retry-section">
          <div class="retry-message">
            <fa-icon [icon]="['fas', 'refresh']" class="retry-icon"></fa-icon>
            <span>Story creation failed at segment {{ storyProgress().currentSegment + 1 }} of {{ storyProgress().totalSegments }}</span>
          </div>
          <div class="retry-actions">
            <app-button
              variant="secondary"
              size="sm"
              (click)="retryStory()"
              [disabled]="isPosting()"
              class="retry-btn">
              <fa-icon [icon]="['fas', 'redo']" class="btn-icon"></fa-icon>
              Retry from Failed Segment
            </app-button>
            <app-button
              variant="ghost"
              size="sm"
              (click)="cancelStory()"
              [disabled]="isPosting()"
              class="cancel-btn">
              <fa-icon [icon]="['fas', 'times']" class="btn-icon"></fa-icon>
              Cancel
            </app-button>
          </div>
        </div>
      }
    </div>

    <!-- Preview card (separate card below) -->
    @if (postContent().trim()) {
      <div class="preview-card">
        <div class="preview-header">
          <fa-icon [icon]="['fas', 'eye']" class="preview-icon"></fa-icon>
          <span class="preview-title">Preview</span>
        </div>
        <div class="preview-content">
          <markdown class="preview-markdown" [data]="postContent()"></markdown>
        </div>
      </div>
    }
  `,
  styles: [`
    .post-input-container {
      @apply bg-white dark:bg-black-800 border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small;
    }

    /* Tab Navigation */
    .tab-navigation {
      @apply flex border-b border-white-200 dark:border-black-700;
    }

    .tab-button {
      @apply flex items-center gap-2 px-4 py-3;
      @apply text-sm font-medium;
      @apply text-black-600 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply border-b-2 border-transparent;
      @apply transition-colors duration-200;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      
      &.active {
        @apply text-kaspa-600 dark:text-kaspa-400;
        @apply border-kaspa-600 dark:border-kaspa-400;
      }
    }

    .tab-icon {
      @apply text-sm;
    }

    /* Cyberpunk theme overrides for tab buttons */
    :host-context(.cyberpunk-theme) .tab-button {
      @apply text-cyber-gray-3;
      @apply hover:text-neon-cyan;
      
      &.active {
        @apply text-neon-cyan;
        border-bottom-color: #00FFFF;
        
        .tab-icon {
          filter: drop-shadow(0 0 3px rgba(0, 255, 255, 0.6));
        }
      }
    }

    :host-context(.cyberpunk-theme) .tab-navigation {
      border-bottom: 1px solid rgba(0, 255, 255, 0.3);
    }

    /* Story Mode Info */
    .story-info {
      @apply px-6 py-3 bg-purple-50 dark:bg-purple-900/20;
      @apply border-b border-white-200 dark:border-black-700;
    }

    .info-content {
      @apply flex items-start gap-2;
    }

    .info-icon {
      @apply text-purple-600 dark:text-purple-400 mt-0.5;
      @apply flex-shrink-0;
    }

    .info-text {
      @apply text-sm text-purple-700 dark:text-purple-300;
    }

    /* Note Mode Info */
    .note-info {
      @apply px-6 py-3 bg-amber-50 dark:bg-amber-900/20;
      @apply border-b border-white-200 dark:border-black-700;
    }

    .note-info .info-icon {
      @apply text-amber-600 dark:text-amber-400;
    }

    .note-info .info-text {
      @apply text-sm text-amber-700 dark:text-amber-300;
    }

    /* Cyberpunk theme overrides for story info */
    :host-context(.cyberpunk-theme) .story-info {
      @apply bg-cyber-dark-3;
      border-bottom: 1px solid rgba(255, 0, 255, 0.3);
    }

    :host-context(.cyberpunk-theme) .info-icon {
      @apply text-neon-magenta;
      filter: drop-shadow(0 0 5px rgba(255, 0, 255, 0.6));
    }

    :host-context(.cyberpunk-theme) .info-text {
      @apply text-neon-magenta font-tech;
    }

    /* Cyberpunk theme overrides for note info */
    :host-context(.cyberpunk-theme) .note-info {
      @apply bg-cyber-dark-3;
      border-bottom: 1px solid rgba(255, 255, 0, 0.3);
    }

    :host-context(.cyberpunk-theme) .note-info .info-icon {
      @apply text-neon-yellow;
      filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.6));
    }

    :host-context(.cyberpunk-theme) .note-info .info-text {
      @apply text-neon-yellow font-tech;
    }

    /* Story Progress */
    .story-progress {
      @apply flex flex-col space-y-1 mr-4;
    }

    .progress-text {
      @apply text-xs text-black-600 dark:text-white-400;
    }

    .progress-bar {
      @apply w-24 h-1 bg-white-200 dark:bg-black-600 rounded-full overflow-hidden;
    }

    .progress-fill {
      @apply h-full bg-kaspa-500 transition-all duration-300;
    }
    
    /* Cyberpunk post input container */
    :host-context(.cyberpunk-theme) .post-input-container {
      @apply bg-cyber-dark-2 border border-white-200 dark:border-black-700;
    }

    .post-input-section {
      @apply flex space-x-4 p-6 pb-4;
    }

    .user-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-10 h-10 rounded-full object-cover;
      @apply border border-white-300 dark:border-black-600;
    }

    .avatar-placeholder {
      @apply w-10 h-10 rounded-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
      @apply border border-white-300 dark:border-black-600;
    }

    .placeholder-icon {
      @apply text-black-400 dark:text-white-400;
    }


    .input-area {
      @apply flex-1;
    }


    .post-textarea {
      @apply w-full border-0 border-b border-white-200 dark:border-black-700;
      @apply bg-transparent text-black-900 dark:text-white-100;
      @apply text-sm leading-relaxed resize-none;
      @apply focus:outline-none focus:border-kaspa-500;
      @apply pb-3 transition-colors duration-200;
      min-height: 60px;
      max-height: 300px;
      overflow-y: hidden;
      
      &::placeholder {
        @apply text-black-300 dark:text-white-400;
        opacity: 0.5;
      }
    }
    
    /* Cyberpunk textarea styles */
    :host-context(.cyberpunk-theme) .post-textarea {
      @apply border-neon-cyan/30 focus:border-neon-cyan;
      @apply text-white-100;
      
      &::placeholder {
        @apply text-cyber-gray-5;
        opacity: 0.5;
      }
    }

    .post-textarea:disabled {
      @apply opacity-60 cursor-not-allowed;
    }

    /* Preview Card (separate card below input) */
    .preview-card {
      @apply bg-white dark:bg-black-800 border border-white-200 dark:border-black-700;
      @apply rounded-lg shadow-small mt-4;
    }

    .preview-header {
      @apply flex items-center space-x-2 px-4 py-3;
      @apply border-b border-white-100 dark:border-black-700;
      @apply bg-gray-50 dark:bg-black-700;
    }
    
    /* Cyberpunk preview header with neon separator */
    :host-context(.cyberpunk-theme) .preview-header {
      @apply border-b border-neon-cyan/30 bg-cyber-dark-3;
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: stat-line-glow 2s ease-in-out infinite alternate;
      }
    }

    .preview-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk preview icon */
    :host-context(.cyberpunk-theme) .preview-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .preview-title {
      @apply text-sm font-medium text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk preview title */
    :host-context(.cyberpunk-theme) .preview-title {
      @apply text-neon-cyan font-tech;
    }

    .preview-content {
      @apply p-4;
    }

    .preview-markdown {
      @apply text-sm leading-relaxed;
    }

    /* Password Section */
    .password-section {
      @apply px-6 py-4 border-b border-white-100 dark:border-black-700;
    }

    .password-input-wrapper {
      @apply relative flex items-center;
    }

    .password-icon {
      @apply absolute left-3 text-amber-600 dark:text-amber-400;
      @apply text-sm;
    }

    .password-input {
      @apply w-full pl-10 pr-4 py-2;
      @apply border border-white-300 dark:border-black-600;
      @apply bg-white dark:bg-black-800;
      @apply text-black-900 dark:text-white-100;
      @apply text-sm rounded-md;
      @apply focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .password-error {
      @apply flex items-center gap-2 mt-2;
      @apply text-sm text-red-600 dark:text-red-400;
    }

    .password-error .error-icon {
      @apply text-sm;
    }

    /* Cyberpunk theme overrides for password section */
    :host-context(.cyberpunk-theme) .password-section {
      @apply border-b border-neon-yellow/30;
    }

    :host-context(.cyberpunk-theme) .password-icon {
      @apply text-neon-yellow;
      filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.6));
    }

    :host-context(.cyberpunk-theme) .password-input {
      @apply bg-cyber-dark-2 border-cyber-gray-4;
      @apply focus:ring-neon-yellow focus:border-neon-yellow;
      @apply text-white-100;
    }

    .actions-section {
      @apply flex justify-end items-center px-6 py-4;
      @apply border-t border-white-100 dark:border-black-700;
    }
    
    /* Cyberpunk actions section with neon separator */
    :host-context(.cyberpunk-theme) .actions-section {
      @apply border-t border-neon-cyan/30;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: stat-line-glow 2s ease-in-out infinite alternate;
      }
    }

    @keyframes stat-line-glow {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    .add-media-btn {
      @apply flex items-center space-x-2 text-black-600 dark:text-white-400;
      @apply hover:text-kaspa-600 dark:hover:text-kaspa-400;
      @apply transition-colors duration-200 disabled:opacity-50;
    }

    .media-icon {
      @apply text-base;
    }

    .add-media-btn span {
      @apply text-sm font-medium;
    }

    .post-actions {
      @apply items-center space-x-4;
    }

    .char-count {
      @apply text-xs text-black-500 dark:text-white-400;
    }

    .char-count.warning {
      @apply text-yellow-600 dark:text-yellow-400;
    }

    .char-count.error {
      @apply text-red-600 dark:text-red-400;
    }

    .post-btn {
      @apply min-w-20;
    }

    .error-message {
      @apply flex items-center space-x-2 px-6 pb-4;
      @apply text-sm text-red-600 dark:text-red-400;
    }

    .error-icon {
      @apply text-sm;
    }

    /* Retry Section */
    .retry-section {
      @apply px-6 py-4 bg-yellow-50 dark:bg-yellow-900/20;
      @apply border-t border-yellow-200 dark:border-yellow-700;
    }

    .retry-message {
      @apply flex items-center space-x-2 mb-3;
      @apply text-sm text-yellow-800 dark:text-yellow-200;
    }

    .retry-icon {
      @apply text-yellow-600 dark:text-yellow-400;
    }

    .retry-actions {
      @apply flex items-center space-x-3;
    }

    .retry-btn, .cancel-btn {
      @apply min-w-32;
    }

    .btn-icon {
      @apply mr-2 text-xs;
    }

    /* Cyberpunk theme overrides for retry section */
    :host-context(.cyberpunk-theme) .retry-section {
      @apply bg-cyber-dark-3 border-neon-yellow/30;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #FFFF00, transparent);
        animation: retry-line-glow 2s ease-in-out infinite alternate;
      }
    }

    :host-context(.cyberpunk-theme) .retry-message {
      @apply text-neon-yellow font-tech;
    }

    :host-context(.cyberpunk-theme) .retry-icon {
      @apply text-neon-yellow;
      filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.6));
      animation: retry-icon-pulse 1.5s ease-in-out infinite alternate;
    }

    @keyframes retry-line-glow {
      0% { opacity: 0.3; }
      100% { opacity: 0.8; }
    }

    @keyframes retry-icon-pulse {
      0% { filter: drop-shadow(0 0 5px rgba(255, 255, 0, 0.6)); }
      100% { filter: drop-shadow(0 0 10px rgba(255, 255, 0, 1)); }
    }

    /* Mobile responsive */
    @media (max-width: 640px) {
      .post-input-section {
        @apply p-4 pb-3;
      }

      .actions-section {
        @apply px-4 py-3;
      }

      .post-actions {
        @apply space-x-3;
      }

      .char-count {
        @apply text-xs;
      }
    }
  `]
})
export class PostInputComponent {
  public userService = inject(UserService);
  public postService = inject(PostService);
  public storyService = inject(StoryService);
  public transactionService = inject(KaspaTransactionService);
  private chainTraversalService = inject(ChainTraversalService);
  private feeCalculationService = inject(FeeCalculationService);
  private toastService = inject(ToastService);
  public encryptionService = inject(EncryptionService);

  // Template references
  @ViewChild('textareaRef') textareaRef!: ElementRef<HTMLTextAreaElement>;

  // Outputs
  public postCreated = output<string>();
  public mediaRequested = output<void>();

  // State
  public postContent = signal('');
  public isPosting = signal(false);
  public errorMessage = signal('');
  
  // Story mode state
  public mode = signal<'post' | 'story' | 'note'>('post');
  public storyProgress = signal<StoryProgress>({ currentSegment: 0, totalSegments: 0, isComplete: false });
  public estimatedSegments = signal(0);
  public isOverTestingLimit = signal(false);
  
  // Note mode state
  public notePassword = signal('');
  public passwordError = signal('');
  
  // Store original content for retry
  private originalStoryContent = '';

  // Configuration
  public placeholder = 'What\'s on your mind? You can write posts with markdown support!';
  public maxPayloadBytes = 1000; // Maximum payload size in bytes

  /**
   * Calculate current payload size in bytes
   */
  getCurrentPayloadSize(): number {
    const payload = {
      verum: VERUM_VERSION,
      type: TransactionType.POST,
      content: this.postContent().trim(),
      timestamp: Math.floor(Date.now() / 1000),
      // Include chain references for accurate size calculation
      prev_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
      last_subscribe: 'placeholder_64_char_transaction_id_for_size_calculation_12345'
    };
    return this.postService.calculatePayloadSize(payload);
  }

  /**
   * Check if current content exceeds size limit
   */
  isOverSizeLimit(): boolean {
    return this.getCurrentPayloadSize() > this.maxPayloadBytes;
  }


  /**
   * Handle content change
   */
  onContentChange(event: Event): void {
    this.errorMessage.set('');
    this.autoResizeTextarea();
    this.updateEstimations();
  }

  /**
   * Update content estimations for story mode
   */
  private updateEstimations(): void {
    if (this.mode() === 'story' && this.postContent().trim()) {
      const content = this.postContent().trim();
      
      // Don't calculate for extremely long content in real-time to avoid performance issues
      if (content.length > 50000) {
        const roughEstimate = Math.ceil(content.length / 500);
        this.estimatedSegments.set(roughEstimate);
        const overLimit = roughEstimate > 20;
        this.isOverTestingLimit.set(overLimit);
        
        if (overLimit) {
          this.errorMessage.set(
            ` Content too large for testing: Would require ~${roughEstimate} transactions (limit: 20). ` +
            ` Please reduce content to approximately ${(20 * 500).toLocaleString()} characters.`
          );
        } else {
          this.errorMessage.set('');
        }
        return;
      }
      
      try {
        const segments = this.storyService.calculateTransactionCount(content);
        this.estimatedSegments.set(segments);
        const overLimit = segments > 20;
        this.isOverTestingLimit.set(overLimit);
        
        // Clear any previous error if within limit
        if (!overLimit) {
          this.errorMessage.set('');
        }
      } catch (error: any) {
        // Check if it's the testing limit error
        if (error.message.startsWith('TESTING_LIMIT_EXCEEDED:')) {
          const [, estimatedSegments, contentLength, maxPerSegment] = error.message.split(':');
          this.estimatedSegments.set(parseInt(estimatedSegments));
          this.isOverTestingLimit.set(true);
          this.errorMessage.set(
            ` Content too large for testing: Would require ${estimatedSegments} transactions (limit: 20). ` +
            ` Please reduce content from ${parseInt(contentLength).toLocaleString()} to approximately ${(20 * parseInt(maxPerSegment)).toLocaleString()} characters.`
          );
        } else {
          // Other calculation errors, show a rough estimate
          console.warn('Segment calculation error:', error.message);
          const roughEstimate = Math.ceil(content.length / 500);
          this.estimatedSegments.set(roughEstimate);
          this.isOverTestingLimit.set(roughEstimate > 20);
          this.errorMessage.set('Unable to calculate story segments. Content may be too complex.');
        }
      }
    } else {
      this.estimatedSegments.set(0);
      this.isOverTestingLimit.set(false);
    }
  }

  /**
   * Switch between post, story, and note modes
   */
  switchMode(newMode: 'post' | 'story' | 'note'): void {
    if (this.isPosting()) return;
    
    this.mode.set(newMode);
    this.errorMessage.set('');
    this.isOverTestingLimit.set(false);
    this.updateEstimations();
    
    // Update placeholder based on mode
    if (newMode === 'story') {
      this.placeholder = 'Tell your story... No length limits in story mode! Content will be split into multiple transactions.';
    } else if (newMode === 'note') {
      this.placeholder = 'Write your private encrypted note... Only you will see this in your feed.';
    } else {
      this.placeholder = 'What\'s on your mind? You can write posts with markdown support!';
    }
  }

  /**
   * Auto-resize textarea based on content
   */
  private autoResizeTextarea(): void {
    if (!this.textareaRef) return;
    
    const textarea = this.textareaRef.nativeElement;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height, capped at 300px
    const maxHeight = 300;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    
    // Set the new height
    textarea.style.height = `${newHeight}px`;
    
    // Handle overflow for content exceeding max height
    if (textarea.scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  }

  /**
   * Handle add media click
   */
  onAddMedia(): void {
    this.mediaRequested.emit();
  }

  /**
   * Handle post submission
   */
  async onPost(): Promise<void> {
    if (!this.canPost()) return;

    const content = this.postContent().trim();
    
    try {
      this.isPosting.set(true);
      this.errorMessage.set('');
      
      if (this.mode() === 'story') {
        // Handle story creation
        await this.createStory(content);
      } else if (this.mode() === 'note') {
        // Handle note creation
        await this.createNote(content);
      } else {
        // Handle regular post
        this.postCreated.emit(content);
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to publish content');
    } finally {
      this.isPosting.set(false);
    }
  }

  /**
   * Create a story with progress tracking
   */
  private async createStory(content: string): Promise<void> {
    // Store original content for potential retry
    this.originalStoryContent = content;
    
    // Subscribe to progress updates
    const progressSub = this.storyService.progress$.subscribe(progress => {
      this.storyProgress.set(progress);
    });

    try {
      const story = await this.storyService.createStory(content);
      
      // For stories, don't emit postCreated as they have their own segments
      // The story segments are automatically handled by the feed service
      
      // Clear content on success
      this.clearInput();
      this.originalStoryContent = '';
      
    } catch (error: any) {
      // Don't clear the original content on error, we need it for retry
      this.errorMessage.set(error.message || 'Failed to create story');
    } finally {
      progressSub.unsubscribe();
      // Don't reset progress here if there's an error with retry option
      if (this.storyProgress().isComplete || !this.storyProgress().canRetry) {
        this.storyService.resetProgress();
      }
    }
  }

  /**
   * Retry failed story creation
   */
  async retryStory(): Promise<void> {
    if (!this.originalStoryContent || !this.storyProgress().canRetry) {
      return;
    }

    this.isPosting.set(true);
    this.errorMessage.set('');

    // Subscribe to progress updates
    const progressSub = this.storyService.progress$.subscribe(progress => {
      this.storyProgress.set(progress);
    });

    try {
      const failedAtSegment = this.storyProgress().currentSegment + 1;
      const story = await this.storyService.retryFailedStory(this.originalStoryContent, failedAtSegment);
      
      // Clear content on success
      this.clearInput();
      this.originalStoryContent = '';
      
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to retry story creation');
    } finally {
      this.isPosting.set(false);
      progressSub.unsubscribe();
      // Reset progress if completed or can't retry again
      if (this.storyProgress().isComplete || !this.storyProgress().canRetry) {
        this.storyService.resetProgress();
      }
    }
  }

  /**
   * Cancel failed story creation
   */
  cancelStory(): void {
    this.originalStoryContent = '';
    this.errorMessage.set('');
    this.storyService.resetProgress();
    this.storyProgress.set({ currentSegment: 0, totalSegments: 0, isComplete: false });
  }

  /**
   * Get text for post button based on mode and state
   */
  getPostButtonText(): string {
    if (this.isPosting()) {
      if (this.mode() === 'story') {
        const progress = this.storyProgress();
        if (progress.currentSegment > 0) {
          return `Publishing ${progress.currentSegment}/${progress.totalSegments}...`;
        }
        return 'Creating Story...';
      }
      return 'Posting...';
    }
    
    if (this.mode() === 'story') return 'Publish Story';
    if (this.mode() === 'note') return 'Create Note';
    return 'Post';
  }

  /**
   * Check if user can post
   */
  canPost(): boolean {
    const hasContent = this.postContent().trim().length > 0;
    const notPosting = !this.isPosting();
    
    if (this.mode() === 'story') {
      // In story mode, check content, posting state, and testing limit
      const withinTestingLimit = !this.isOverTestingLimit();
      return hasContent && notPosting && withinTestingLimit;
    } else if (this.mode() === 'note') {
      // In note mode, also check for password
      const hasPassword = this.notePassword().trim().length > 0;
      const noPasswordError = !this.passwordError();
      return hasContent && hasPassword && noPasswordError && notPosting;
    } else {
      // In post mode, also check size limit
      const withinLimit = !this.isOverSizeLimit();
      return hasContent && withinLimit && notPosting;
    }
  }

  /**
   * Check if near payload size limit (80% of max)
   */
  isNearSizeLimit(): boolean {
    return this.getCurrentPayloadSize() > this.maxPayloadBytes * 0.8;
  }

  /**
   * Set posting state
   */
  setPosting(posting: boolean): void {
    this.isPosting.set(posting);
  }

  /**
   * Clear the input
   */
  clearInput(): void {
    this.postContent.set('');
    this.errorMessage.set('');
    // Reset textarea height after clearing
    setTimeout(() => this.autoResizeTextarea(), 0);
  }

  /**
   * Set error message
   */
  setError(error: string): void {
    this.errorMessage.set(error);
  }

  /**
   * Handle password change for notes
   */
  onPasswordChange(): void {
    this.passwordError.set('');
    
    const password = this.notePassword().trim();
    if (password.length > 0 && password.length < 4) {
      this.passwordError.set('Password must be at least 4 characters long');
    }
  }
  
  /**
   * Create an encrypted note
   */
  private async createNote(content: string): Promise<void> {
    const password = this.notePassword().trim();
    
    if (!password) {
      this.errorMessage.set('Password is required for encrypted notes');
      return;
    }
    
    if (password.length < 4) {
      this.passwordError.set('Password must be at least 4 characters long');
      return;
    }
    
    const user = this.userService.currentUser();
    if (!user) {
      this.errorMessage.set('User not found');
      return;
    }
    
    try {
      // Encrypt the content
      const encryptedContent = await this.encryptionService.encryptText(content, password);
      
      // Get chain info for transaction references
      const chainInfo = await this.chainTraversalService.getLatestTransactionInfo(user.address);
      
      // Create note payload with same parameters as posts
      const notePayload = {
        verum: VERUM_VERSION,
        type: TransactionType.NOTE,
        content: encryptedContent,
        timestamp: Math.floor(Date.now() / 1000),
        prev_tx_id: chainInfo.lastTxId,
        last_subscribe: chainInfo.lastSubscribeId
      };
      
      // Calculate note amount (same as posts)
      const noteAmount = await firstValueFrom(this.feeCalculationService.calculateActionAmount('note'));
      
      // Submit note transaction - send to self like posts do
      await this.transactionService.createTransaction(
        notePayload,
        user.address, // Send to self
        noteAmount
      );
      
      // Show success message
      this.toastService.success(
        'Private encrypted note created successfully! Only visible to you.',
        'Private Note Published'
      );
      
      // Clear inputs on success
      this.clearInput();
      this.notePassword.set('');
      this.passwordError.set('');
      
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Failed to create encrypted note');
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
}