import { Component, EventEmitter, Input, Output, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';
import { FeeDisplayComponent } from '../fee-display/fee-display.component';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { TransactionType } from '../../../types/transaction';

export interface FeeConfirmationData {
  action: 'subscribe' | 'comment' | 'like';
  targetUser?: string;
  content?: string;
}

@Component({
  selector: 'app-fee-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, ButtonComponent, FeeDisplayComponent],
  template: `
    <div class="dialog-backdrop" (click)="onCancel()">
      <div class="dialog" (click)="$event.stopPropagation()">
        <div class="dialog__header">
          <h3 class="dialog__title">Confirm {{ getActionTitle() }}</h3>
          <button class="dialog__close" (click)="onCancel()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="dialog__content">
          <div class="dialog__info">
            <p class="dialog__description">{{ getDescription() }}</p>
            
            @if (data) {
              <div class="dialog__details">
                @if (data.targetUser) {
                  <div class="dialog__detail">
                    <span class="dialog__detail-label">To:</span>
                    <span class="dialog__detail-value">{{ data.targetUser }}</span>
                  </div>
                }
                
                @if (data.content) {
                  <div class="dialog__detail">
                    <span class="dialog__detail-label">Content:</span>
                    <div class="dialog__detail-value dialog__detail-value--content">
                      {{ data.content }}
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          
          <div class="dialog__fee-section">
            <app-fee-display 
              [action]="data.action"
              label="Payment Amount:"
              [showUsd]="true"
              [inline]="false">
            </app-fee-display>
            
            @if (economicReason()) {
              <div class="dialog__fee-explanation">
                <i class="fas fa-info-circle"></i>
                <span>{{ economicReason() }}</span>
              </div>
            }
            
            <div class="dialog__gas-note">
              <i class="fas fa-gas-pump"></i>
              <span>Plus minimal network gas fee</span>
            </div>
          </div>
        </div>
        
        <div class="dialog__actions">
          <app-button
            variant="secondary"
            (click)="onCancel()">
            Cancel
          </app-button>
          
          <app-button
            variant="primary"
            (click)="onConfirm()"
            [disabled]="loading()">
            @if (!loading()) {
              <i class="fas fa-check"></i>
            }
            @if (loading()) {
              <i class="fas fa-spinner fa-spin"></i>
            }
            Confirm & Pay
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }

    .dialog {
      background-color: var(--color-surface);
      border-radius: 1rem;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow: hidden;
      animation: slideIn 0.3s ease-out;
    }

    .dialog__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid var(--color-border);
    }

    .dialog__title {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .dialog__close {
      background: none;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      padding: 0.5rem;
      font-size: 1.25rem;
      border-radius: 0.5rem;
      transition: all 0.2s ease;
    }

    .dialog__close:hover {
      background-color: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }

    .dialog__content {
      padding: 1.5rem;
    }

    .dialog__info {
      margin-bottom: 1.5rem;
    }

    .dialog__description {
      margin: 0 0 1rem 0;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }

    .dialog__details {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .dialog__detail {
      display: flex;
      gap: 0.5rem;
    }

    .dialog__detail-label {
      color: var(--color-text-secondary);
      min-width: 80px;
    }

    .dialog__detail-value {
      color: var(--color-text-primary);
      flex: 1;
    }

    .dialog__detail-value--content {
      background-color: var(--color-surface-secondary);
      padding: 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      max-height: 100px;
      overflow-y: auto;
    }

    .dialog__fee-section {
      background-color: var(--color-surface-secondary);
      border-radius: 0.75rem;
      padding: 1rem;
    }

    .dialog__fee-explanation {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      margin-top: 0.75rem;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.4;
    }

    .dialog__fee-explanation i {
      flex-shrink: 0;
      margin-top: 0.125rem;
    }

    .dialog__gas-note {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
      opacity: 0.8;
    }

    .dialog__gas-note i {
      font-size: 0.625rem;
    }

    .dialog__actions {
      display: flex;
      gap: 1rem;
      padding: 1.5rem;
      border-top: 1px solid var(--color-border);
      justify-content: flex-end;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from {
        transform: translateY(-20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class FeeConfirmationDialogComponent implements OnInit {
  @Input() data!: FeeConfirmationData;
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  
  private feeCalculationService = inject(FeeCalculationService);
  
  loading = signal(false);
  economicReason = signal<string>('');
  
  ngOnInit() {
    this.loadEconomicReason();
  }
  
  private loadEconomicReason() {
    this.feeCalculationService.getEconomicExplanation().subscribe(explanations => {
      const explanation = explanations.find(e => e.action === this.data.action);
      if (explanation) {
        this.economicReason.set(explanation.reasoning);
      }
    });
  }
  
  getActionTitle(): string {
    switch (this.data.action) {
      case 'subscribe': return 'Subscription';
      case 'comment': return 'Comment';
      case 'like': return 'Like';
      default: return 'Action';
    }
  }
  
  getDescription(): string {
    switch (this.data.action) {
      case 'subscribe':
        return 'You are about to subscribe to this user. This action requires a one-time payment.';
      case 'comment':
        return 'You are about to post a comment. A payment will be sent to the post author.';
      case 'like':
        return 'You are about to like this post. A small payment will be sent to the author.';
      default:
        return 'Please confirm this action and the associated payment.';
    }
  }
  
  onConfirm() {
    this.loading.set(true);
    this.confirm.emit();
  }
  
  onCancel() {
    this.cancel.emit();
  }
}