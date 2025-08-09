import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div 
      [class]="getToastClasses()"
      role="alert"
      aria-live="polite">
      
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <fa-icon [icon]="getIconName()" [class]="getIconClasses()"></fa-icon>
        </div>
        
        <div class="ml-3 flex-1">
          @if (title) {
            <h4 class="text-h6 font-medium text-black-900 dark:text-white-100">
              {{ title }}
            </h4>
          }
          <p class="text-body text-black-700 dark:text-white-300 mt-1">
            {{ message }}
          </p>
        </div>
        
        <div class="ml-4 flex-shrink-0 flex">
          @if (dismissible) {
            <button
              (click)="onDismiss()"
              class="inline-flex text-black-400 dark:text-white-500 hover:text-black-600 dark:hover:text-white-300 focus:outline-none focus:text-black-600 dark:focus:text-white-300 transition-colors duration-200">
              <span class="sr-only">Close</span>
              <fa-icon [icon]="['fas', 'times']"></fa-icon>
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toast {
      @apply max-w-sm w-full shadow-medium rounded-md pointer-events-auto overflow-hidden;
      @apply border-l-4;
    }

    .toast-success {
      @apply bg-white-900 dark:bg-black-800 border-l-kaspa-600;
    }

    .toast-error {
      @apply bg-white-900 dark:bg-black-800 border-l-red-800;
    }

    .toast-warning {
      @apply bg-white-900 dark:bg-black-800 border-l-yellow-800;
    }

    .toast-info {
      @apply bg-white-900 dark:bg-black-800 border-l-kaspa-500;
    }

    .toast-padding {
      @apply p-4;
    }

    .icon-success {
      @apply text-kaspa-600;
    }

    .icon-error {
      @apply text-red-800;
    }

    .icon-warning {
      @apply text-yellow-800;
    }

    .icon-info {
      @apply text-kaspa-500;
    }
  `]
})
export class ToastComponent {
  @Input() type: 'success' | 'error' | 'warning' | 'info' = 'info';
  @Input() title?: string;
  @Input() message: string = '';
  @Input() dismissible: boolean = true;
  @Input() autoClose: boolean = true;
  @Input() duration: number = 5000; // 5 seconds
  @Output() dismiss = new EventEmitter<void>();

  private timeoutId?: number;

  ngOnInit(): void {
    if (this.autoClose && this.dismissible) {
      this.timeoutId = window.setTimeout(() => {
        this.onDismiss();
      }, this.duration);
    }
  }

  ngOnDestroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  getToastClasses(): string {
    return [
      'toast',
      `toast-${this.type}`,
      'toast-padding'
    ].join(' ');
  }

  getIconClasses(): string {
    return [
      'text-xl',
      `icon-${this.type}`
    ].join(' ');
  }

  getIconName(): [string, string] {
    const icons = {
      success: ['fas', 'check'] as [string, string],
      error: ['fas', 'times'] as [string, string],
      warning: ['fas', 'exclamation-triangle'] as [string, string],
      info: ['fas', 'info-circle'] as [string, string]
    };
    return icons[this.type];
  }
}