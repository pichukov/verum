import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastComponent } from '../toast/toast.component';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule, ToastComponent],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <app-toast
          [type]="toast.type"
          [title]="toast.title"
          [message]="toast.message"
          [dismissible]="toast.dismissible || true"
          [autoClose]="false"
          (dismiss)="dismissToast(toast.id)"
          class="toast-item">
        </app-toast>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      @apply fixed top-4 right-4 space-y-3;
      @apply pointer-events-none;
      z-index: 10000; /* Highest z-index for toasts */
    }

    .toast-item {
      @apply pointer-events-auto;
      @apply transform transition-all duration-300 ease-in-out;
      @apply translate-x-0 opacity-100;
      
      /* Animation for entering */
      animation: slideInRight 0.3s ease-out;
    }

    .toast-item.removing {
      @apply translate-x-full opacity-0;
    }

    @keyframes slideInRight {
      from {
        @apply translate-x-full opacity-0;
      }
      to {
        @apply translate-x-0 opacity-100;
      }
    }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .toast-container {
        @apply top-2 right-2 left-2;
      }
    }
  `]
})
export class ToastContainerComponent {
  public toastService = inject(ToastService);

  trackByToastId(index: number, toast: any): string {
    return toast.id;
  }

  dismissToast(id: string): void {
    this.toastService.dismiss(id);
  }
}