import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [class]="getAvatarClasses()">
      @if (src && !imageError) {
        <img 
          [src]="src" 
          [alt]="alt"
          (error)="onImageError()"
          class="w-full h-full object-cover rounded-full" />
      } @else {
        <div class="w-full h-full flex items-center justify-center rounded-full bg-accent-light dark:bg-accent-dark text-white font-medium">
          {{ getInitials() }}
        </div>
      }
      
      @if (status) {
        <div 
          [class]="getStatusClasses()"
          class="absolute bottom-0 right-0 rounded-full border-2 border-white-900">
        </div>
      }
    </div>
  `,
  styles: [`
    .avatar {
      @apply relative inline-flex items-center justify-center overflow-hidden rounded-full;
    }

    .avatar-xs {
      @apply w-6 h-6;
    }

    .avatar-sm {
      @apply w-8 h-8;
    }

    .avatar-md {
      @apply w-10 h-10;
    }

    .avatar-lg {
      @apply w-12 h-12;
    }

    .avatar-xl {
      @apply w-16 h-16;
    }

    .status-online {
      @apply bg-green-800;
    }

    .status-offline {
      @apply bg-black-300;
    }

    .status-busy {
      @apply bg-red-800;
    }

    .status-xs {
      @apply w-1.5 h-1.5;
    }

    .status-sm {
      @apply w-2 h-2;
    }

    .status-md {
      @apply w-2.5 h-2.5;
    }

    .status-lg {
      @apply w-3 h-3;
    }

    .status-xl {
      @apply w-4 h-4;
    }
  `]
})
export class AvatarComponent {
  @Input() src?: string;
  @Input() alt: string = '';
  @Input() name?: string;
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Input() status?: 'online' | 'offline' | 'busy';

  imageError = false;

  onImageError(): void {
    this.imageError = true;
  }

  getInitials(): string {
    if (!this.name) return '';
    
    return this.name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  getAvatarClasses(): string {
    return [
      'avatar',
      `avatar-${this.size}`
    ].join(' ');
  }

  getStatusClasses(): string {
    if (!this.status) return '';
    
    return [
      `status-${this.status}`,
      `status-${this.size}`
    ].join(' ');
  }
}