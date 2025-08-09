import { Component, inject, signal, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ButtonComponent } from '../button/button.component';
import { CommentService, CreateCommentData } from '../../../services/comment.service';
import { UserService } from '../../../services/user.service';
import { TransactionType, VERUM_VERSION } from '../../../types/transaction';
import { FeeCalculationService } from '../../../services/fee-calculation.service';

@Component({
  selector: 'app-comment-input',
  standalone: true,
  imports: [CommonModule, FormsModule, FontAwesomeModule, ButtonComponent],
  template: `
    <div class="comment-input-container">
      <!-- User Avatar -->
      <div class="comment-avatar">
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

      <!-- Comment Input -->
      <div class="comment-input-wrapper">
        <textarea
          [(ngModel)]="commentText"
          [ngModelOptions]="{standalone: true}"
          placeholder="Share your thoughts here..."
          class="comment-input"
          [disabled]="commentService.isCreating()"
          rows="1"
          (input)="adjustTextareaHeight($event)"
          (keydown.enter)="onEnterKey($any($event))"
          #textarea>
        </textarea>
        
        <!-- Character Count and Fee -->
        <div class="input-footer">
          <div class="footer-left">
            <div class="character-count" [class.warning]="isNearSizeLimit()" [class.error]="isOverSizeLimit()">
              {{ getCurrentPayloadSize() }}/1000 bytes
            </div>
          </div>
          
          <!-- Submit Button -->
          <app-button
            variant="primary"
            [disabled]="!canSubmit() || commentService.isCreating()"
            [loading]="commentService.isCreating()"
            (click)="submitComment()"
            [title]="getSubmitButtonTooltip()">
            @if (!commentService.isCreating()) {
              <fa-icon 
                [icon]="['fas', 'paper-plane']" 
                class="button-icon">
              </fa-icon>
            }
            {{ commentService.isCreating() ? 'Posting...' : 'Comment' }}
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .comment-input-container {
      @apply flex items-start space-x-3 p-6;
      @apply bg-white dark:bg-black-800;
      @apply border-t border-white-200 dark:border-black-700;
    }
    
    /* Cyberpunk comment input container with neon separator */
    :host-context(.cyberpunk-theme) .comment-input-container {
      @apply bg-cyber-dark-2 border-t border-neon-cyan/30;
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

    /* Avatar */
    .comment-avatar {
      @apply flex-shrink-0;
    }

    .avatar-img {
      @apply w-12 h-12 rounded-full object-cover;
      @apply border-2 border-white dark:border-black-800;
    }

    .avatar-placeholder {
      @apply w-12 h-12 rounded-full;
      @apply bg-gradient-to-br from-gray-100 to-gray-200;
      @apply dark:from-black-700 dark:to-black-600;
      @apply flex items-center justify-center;
      @apply border-2 border-white dark:border-black-800;
    }

    .placeholder-icon {
      @apply text-lg text-gray-400 dark:text-white-400;
    }

    /* Input Wrapper */
    .comment-input-wrapper {
      @apply flex-1 space-y-3;
    }

    .comment-input {
      @apply w-full px-4 py-3 rounded-lg resize-none;
      @apply border border-gray-200 dark:border-black-600;
      @apply bg-white dark:bg-black-700;
      @apply text-black-900 dark:text-white-100;
      @apply placeholder-gray-500 dark:placeholder-white-400;
      @apply focus:ring-2 focus:ring-kaspa-500 focus:border-kaspa-500;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      @apply text-sm leading-relaxed;
      @apply transition-all duration-200;
      min-height: 44px;
      max-height: 120px;
    }
    
    /* Cyberpunk comment input */
    :host-context(.cyberpunk-theme) .comment-input {
      @apply border-neon-cyan/30 bg-cyber-dark-3 text-white-100;
      @apply rounded-none focus:ring-neon-cyan/20 focus:border-neon-cyan;
      
      &::placeholder {
        @apply text-cyber-gray-5;
        opacity: 0.5;
      }
    }

    .comment-input:focus {
      @apply outline-none;
    }

    /* Input Footer */
    .input-footer {
      @apply flex items-center justify-between;
    }

    .footer-left {
      @apply flex items-center gap-3;
    }

    .character-count {
      @apply text-xs text-gray-500 dark:text-white-400;
    }

    .character-count.warning {
      @apply text-yellow-600 dark:text-yellow-400;
    }

    .character-count.error {
      @apply text-red-600 dark:text-red-400;
    }

    .button-icon {
      @apply text-sm;
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .comment-input-container {
        @apply p-4 space-x-2;
      }

      .comment-avatar .avatar-img,
      .comment-avatar .avatar-placeholder {
        @apply w-10 h-10;
      }

      .placeholder-icon {
        @apply text-base;
      }

    }
  `]
})
export class CommentInputComponent implements OnInit {
  public commentService = inject(CommentService);
  public userService = inject(UserService);
  private feeCalculationService = inject(FeeCalculationService);

  // Inputs
  public postId = input.required<string>();
  public postAuthorAddress = input.required<string>();

  // Outputs
  public commentAdded = output<void>();

  // State
  public commentText = signal('');
  public commentFeeTooltip = signal<string>('Post comment');
  
  ngOnInit() {
    this.loadFeeTooltip();
  }
  
  private loadFeeTooltip() {
    this.feeCalculationService.calculateActionAmount('comment').subscribe(kasAmount => {
      const formatted = this.feeCalculationService.formatKasAmount(kasAmount);
      this.commentFeeTooltip.set(`Post comment (Payment: ${formatted} to author)`);
    });
  }
  
  /**
   * Get submit button tooltip
   */
  getSubmitButtonTooltip(): string {
    if (this.isOverSizeLimit()) {
      return 'Comment is too long';
    }
    if (!this.canSubmit()) {
      return 'Enter a comment to post';
    }
    return this.commentFeeTooltip();
  }

  /**
   * Calculate current payload size in bytes
   */
  getCurrentPayloadSize(): number {
    const payload = {
      verum: VERUM_VERSION,
      type: TransactionType.COMMENT,
      content: this.commentText().trim(),
      parent_id: this.postId(),
      timestamp: Math.floor(Date.now() / 1000),
      // Include chain references for accurate size calculation
      prev_tx_id: 'placeholder_64_char_transaction_id_for_size_calculation_12345',
      last_subscribe: 'placeholder_64_char_transaction_id_for_size_calculation_12345'
    };
    return this.commentService.calculatePayloadSize(payload);
  }

  /**
   * Check if near payload size limit (80% of max)
   */
  isNearSizeLimit(): boolean {
    return this.getCurrentPayloadSize() > 800; // 80% of 1000 bytes
  }

  /**
   * Check if over payload size limit
   */
  isOverSizeLimit(): boolean {
    return this.getCurrentPayloadSize() > 1000;
  }

  /**
   * Check if comment can be submitted
   */
  canSubmit(): boolean {
    const text = this.commentText().trim();
    return text.length > 0 && !this.isOverSizeLimit();
  }

  /**
   * Submit comment
   */
  async submitComment(): Promise<void> {
    if (!this.canSubmit()) return;

    try {
      const commentData: CreateCommentData = {
        postId: this.postId(),
        content: this.commentText().trim(),
        postAuthorAddress: this.postAuthorAddress()
      };

      await this.commentService.createComment(commentData);
      
      // Clear input and emit event
      this.commentText.set('');
      this.commentAdded.emit();
      
      // Reset textarea height
      const textarea = document.querySelector('.comment-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = '44px';
      }

    } catch (error) {
      console.error('Failed to submit comment:', error);
    }
  }

  /**
   * Handle Enter key press
   */
  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (this.canSubmit()) {
        this.submitComment();
      }
    }
  }

  /**
   * Adjust textarea height based on content
   */
  adjustTextareaHeight(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = '44px'; // Reset height
    const scrollHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
    textarea.style.height = scrollHeight + 'px';
  }

  /**
   * Get user avatar URL
   */
  getUserAvatarUrl(): string {
    const user = this.userService.currentUser();
    if (!user?.avatar) return '';
    
    if (user.avatar.startsWith('data:')) {
      return user.avatar;
    }
    
    return `data:image/png;base64,${user.avatar}`;
  }
}