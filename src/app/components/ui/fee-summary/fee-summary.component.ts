import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { FeeDisplayComponent } from '../fee-display/fee-display.component';

@Component({
  selector: 'app-fee-summary',
  standalone: true,
  imports: [CommonModule, FeeDisplayComponent],
  template: `
    <div class="fee-summary" [class.fee-summary--collapsed]="collapsed()">
      <div class="fee-summary__header" (click)="toggleCollapse()">
        <div class="fee-summary__title">
          <i class="fas fa-coins"></i>
          <span>Action Payments</span>
        </div>
        <button class="fee-summary__toggle">
          <i [class]="collapsed() ? 'fas fa-chevron-down' : 'fas fa-chevron-up'"></i>
        </button>
      </div>
      
      @if (!collapsed()) {
        <div class="fee-summary__content">
          <div class="fee-summary__price">
            <span class="fee-summary__label">KAS Price:</span>
            <span class="fee-summary__value">\${{ kasPrice() }}</span>
          </div>
          
          <div class="fee-summary__fees">
            <div class="fee-summary__item">
              <i class="fas fa-user-plus"></i>
              <span class="fee-summary__action">Subscribe</span>
              <app-fee-display 
                action="subscribe" 
                label=""
                [showUsd]="false"
                [inline]="true">
              </app-fee-display>
            </div>
            
            <div class="fee-summary__item">
              <i class="fas fa-comment"></i>
              <span class="fee-summary__action">Comment</span>
              <app-fee-display 
                action="comment" 
                label=""
                [showUsd]="false"
                [inline]="true">
              </app-fee-display>
            </div>
            
            <div class="fee-summary__item">
              <i class="fas fa-heart"></i>
              <span class="fee-summary__action">Like</span>
              <app-fee-display 
                action="like" 
                label=""
                [showUsd]="false"
                [inline]="true">
              </app-fee-display>
            </div>
            
            <div class="fee-summary__item">
              <i class="fas fa-plus"></i>
              <span class="fee-summary__action">Post</span>
              <app-fee-display 
                action="post" 
                label=""
                [showUsd]="false"
                [inline]="true">
              </app-fee-display>
            </div>
          </div>
          
          <div class="fee-summary__info">
            <i class="fas fa-info-circle"></i>
            <span>Payments are calculated based on current KAS price</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .fee-summary {
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .fee-summary--collapsed {
      background-color: var(--color-surface-secondary);
    }

    .fee-summary__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      cursor: pointer;
      user-select: none;
    }

    .fee-summary__header:hover {
      background-color: var(--color-surface-secondary);
    }

    .fee-summary__title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .fee-summary__title i {
      color: var(--color-primary);
    }

    .fee-summary__toggle {
      background: none;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      padding: 0.25rem;
      font-size: 0.875rem;
      transition: transform 0.3s ease;
    }

    .fee-summary__content {
      padding: 0 1rem 1rem;
      animation: slideDown 0.3s ease-out;
    }

    .fee-summary__price {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem;
      background-color: var(--color-surface-secondary);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    .fee-summary__label {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
    }

    .fee-summary__value {
      font-weight: 600;
      color: var(--color-primary);
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
    }

    .fee-summary__fees {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .fee-summary__item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background-color: var(--color-surface-secondary);
      border-radius: 0.5rem;
    }

    .fee-summary__item i {
      width: 1rem;
      text-align: center;
      color: var(--color-text-secondary);
    }

    .fee-summary__action {
      flex: 1;
      font-size: 0.875rem;
      color: var(--color-text-primary);
    }

    .fee-summary__info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--color-text-secondary);
      padding: 0.5rem;
      background-color: var(--color-surface-secondary);
      border-radius: 0.5rem;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `]
})
export class FeeSummaryComponent implements OnInit {
  private feeCalculationService = inject(FeeCalculationService);
  
  collapsed = signal(true);
  kasPrice = signal<string>('0.0000');
  
  ngOnInit() {
    this.loadKasPrice();
  }
  
  private loadKasPrice() {
    this.feeCalculationService.getCurrentPrice().subscribe(priceInfo => {
      this.kasPrice.set(priceInfo.kasPrice.toFixed(4));
    });
  }
  
  toggleCollapse() {
    this.collapsed.set(!this.collapsed());
  }
}