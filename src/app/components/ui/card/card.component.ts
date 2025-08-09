import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getCardClasses()">
      @if (hasHeader) {
        <div class="card-header">
          <ng-content select="[slot=header]"></ng-content>
        </div>
      }
      
      <div class="card-body">
        <ng-content></ng-content>
      </div>
      
      @if (hasFooter) {
        <div class="card-footer">
          <ng-content select="[slot=footer]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: [`
    .card {
      @apply bg-white-900 dark:bg-black-800 rounded-md overflow-hidden;
    }

    .card-elevated {
      @apply shadow-medium border border-white-300 dark:border-black-800;
    }

    .card-outlined {
      @apply border border-white-400 dark:border-black-700;
    }

    .card-flat {
      @apply border border-white-300 dark:border-black-800;
    }

    .card-header {
      @apply px-6 py-4 border-b border-white-300 dark:border-black-700 bg-white-100 dark:bg-black-700;
    }

    .card-body {
      @apply px-6 py-4;
    }

    .card-footer {
      @apply px-6 py-4 border-t border-white-300 dark:border-black-700 bg-white-100 dark:bg-black-700;
    }

    .card-sm .card-header,
    .card-sm .card-body,
    .card-sm .card-footer {
      @apply px-4 py-3;
    }

    .card-lg .card-header,
    .card-lg .card-body,
    .card-lg .card-footer {
      @apply px-8 py-6;
    }

    .card-interactive {
      @apply cursor-pointer transition-all duration-200;
    }

    .card-interactive:hover {
      @apply shadow-medium transform -translate-y-0.5;
    }

    .card-interactive.card-flat:hover,
    .card-interactive.card-outlined:hover {
      @apply shadow-small;
    }
  `]
})
export class CardComponent {
  @Input() variant: 'elevated' | 'outlined' | 'flat' = 'elevated';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() interactive: boolean = false;
  @Input() hasHeader: boolean = false;
  @Input() hasFooter: boolean = false;

  getCardClasses(): string {
    return [
      'card',
      `card-${this.variant}`,
      `card-${this.size}`,
      this.interactive ? 'card-interactive' : ''
    ].filter(Boolean).join(' ');
  }
}