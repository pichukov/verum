import { Component, Input, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { TransactionType } from '../../../types/transaction';

@Component({
  selector: 'app-fee-display',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fee-display" [class.fee-display--inline]="inline">
      <span class="fee-display__label">{{ label }}</span>
      <span class="fee-display__amount" [class.fee-display__amount--loading]="loading()">
        @if (!loading()) {
          {{ formattedAmount() }}
        } @else {
          <span class="fee-display__loading">...</span>
        }
      </span>
      @if (showUsd && !loading()) {
        <span class="fee-display__usd">
          ($<span>{{ usdEquivalent() }}</span>)
        </span>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .fee-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background-color: var(--color-surface-secondary);
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }

    .fee-display--inline {
      display: inline-flex;
      padding: 0.25rem 0.5rem;
      background-color: transparent;
    }

    .fee-display__label {
      color: var(--color-text-secondary);
    }

    .fee-display__amount {
      font-weight: 600;
      color: var(--color-primary);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    }

    .fee-display__amount--loading {
      color: var(--color-text-secondary);
    }

    .fee-display__loading {
      animation: pulse 1.5s ease-in-out infinite;
    }

    .fee-display__usd {
      color: var(--color-text-secondary);
      font-size: 0.75rem;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `]
})
export class FeeDisplayComponent implements OnInit {
  @Input() action!: 'subscribe' | 'comment' | 'like' | 'post';
  @Input() label: string = 'Payment:';
  @Input() showUsd: boolean = true;
  @Input() inline: boolean = false;
  
  private feeCalculationService = inject(FeeCalculationService);
  
  formattedAmount = signal<string>('');
  usdEquivalent = signal<string>('0.00');
  loading = signal(true);
  
  ngOnInit() {
    this.loadAmountInfo();
  }
  
  private loadAmountInfo() {
    this.loading.set(true);
    
    this.feeCalculationService.calculateActionAmount(this.action).subscribe({
      next: (kasAmount) => {
        this.formattedAmount.set(this.feeCalculationService.formatKasAmount(kasAmount));
        
        // Get USD equivalent
        this.feeCalculationService.getCurrentPrice().subscribe(priceInfo => {
          const usd = kasAmount * priceInfo.kasPrice;
          this.usdEquivalent.set(usd.toFixed(4));
          this.loading.set(false);
        });
      },
      error: (error) => {
        console.error('Failed to load payment amount info:', error);
        this.formattedAmount.set('Error');
        this.loading.set(false);
      }
    });
  }
}