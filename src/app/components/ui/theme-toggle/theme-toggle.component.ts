import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <button
      (click)="toggleTheme()"
      [class]="getButtonClasses()"
      [attr.aria-label]="getAriaLabel()"
      title="{{ getTooltipText() }}">
      
      <fa-icon 
        [icon]="getIcon()" 
        [class]="getIconClasses()"
        [attr.aria-hidden]="true">
      </fa-icon>
      
      <!-- Optional text label -->
      @if (showLabel) {
        <span class="ml-2 text-label font-medium">
          {{ getButtonText() }}
        </span>
      }
    </button>
  `,
  styles: [`
    .theme-toggle-btn {
      @apply relative p-2 rounded-md transition-all duration-300 ease-in-out;
      @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
      @apply hover:scale-105 active:scale-95;
    }

    .theme-toggle-light {
      @apply bg-white-200 hover:bg-white-300 text-black-700;
      @apply border border-white-400;
      @apply focus:ring-primary-500 focus:ring-offset-white-100;
    }

    .theme-toggle-dark {
      @apply bg-black-700 hover:bg-black-600 text-white-300;
      @apply border border-black-600;
      @apply focus:ring-primary-400 focus:ring-offset-black-900;
    }

    .theme-toggle-icon {
      @apply transition-transform duration-300 ease-in-out;
    }

    .theme-toggle-icon-light {
      @apply text-yellow-600;
    }

    .theme-toggle-icon-dark {
      @apply text-blue-400;
    }

    /* Animation for icon rotation */
    .theme-toggle-btn:hover .theme-toggle-icon {
      @apply transform rotate-12;
    }

    /* Compact variant */
    .theme-toggle-compact {
      @apply p-1.5;
    }

    .theme-toggle-compact .theme-toggle-icon {
      @apply text-sm;
    }

    /* Large variant */
    .theme-toggle-large {
      @apply p-3;
    }

    .theme-toggle-large .theme-toggle-icon {
      @apply text-lg;
    }
  `]
})
export class ThemeToggleComponent {
  private themeService = inject(ThemeService);
  
  // Configuration inputs
  showLabel = false;
  size: 'compact' | 'medium' | 'large' = 'medium';
  variant: 'default' | 'minimal' = 'default';

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  getIcon(): [string, string] {
    return this.themeService.isDarkMode() 
      ? ['fas', 'moon'] 
      : ['fas', 'sun'];
  }

  getButtonText(): string {
    return this.themeService.isDarkMode() ? 'Light Mode' : 'Dark Mode';
  }

  getAriaLabel(): string {
    return this.themeService.isDarkMode() 
      ? 'Switch to light mode' 
      : 'Switch to dark mode';
  }

  getTooltipText(): string {
    return this.themeService.isDarkMode() 
      ? 'Switch to light mode' 
      : 'Switch to dark mode';
  }

  getButtonClasses(): string {
    const baseClasses = ['theme-toggle-btn'];
    
    // Size classes
    if (this.size === 'compact') {
      baseClasses.push('theme-toggle-compact');
    } else if (this.size === 'large') {
      baseClasses.push('theme-toggle-large');
    }
    
    // Theme classes
    if (this.themeService.isDarkMode()) {
      baseClasses.push('theme-toggle-dark');
    } else {
      baseClasses.push('theme-toggle-light');
    }
    
    return baseClasses.join(' ');
  }

  getIconClasses(): string {
    const baseClasses = ['theme-toggle-icon'];
    
    // Theme-specific icon colors
    if (this.themeService.isDarkMode()) {
      baseClasses.push('theme-toggle-icon-dark');
    } else {
      baseClasses.push('theme-toggle-icon-light');
    }
    
    return baseClasses.join(' ');
  }
}