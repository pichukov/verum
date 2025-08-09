import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CardComponent } from '../ui/card/card.component';
import { ButtonComponent } from '../ui/button/button.component';
import { InputComponent } from '../ui/input/input.component';
import { ToastComponent } from '../ui/toast/toast.component';
import { AvatarComponent } from '../ui/avatar/avatar.component';
import { ThemeToggleComponent } from '../ui/theme-toggle/theme-toggle.component';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-dark-mode-demo',
  standalone: true,
  imports: [
    CommonModule, 
    FontAwesomeModule, 
    CardComponent, 
    ButtonComponent, 
    InputComponent, 
    ToastComponent, 
    AvatarComponent, 
    ThemeToggleComponent
  ],
  template: `
    <div class="min-h-screen bg-white-100 dark:bg-black-900 transition-colors duration-300">
      <div class="max-w-6xl mx-auto p-8">
        
        <!-- Header with Theme Toggle -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-h1 font-bold text-black-900 dark:text-white-100 mb-2">
              Dark Mode Demo
            </h1>
            <p class="text-body text-black-600 dark:text-white-400">
              Showcasing our complete dark mode implementation
            </p>
          </div>
          
          <div class="flex items-center space-x-4">
            <span class="text-label text-black-600 dark:text-white-400">
              Current theme: {{ getCurrentTheme() }}
            </span>
            <app-theme-toggle></app-theme-toggle>
          </div>
        </div>

        <!-- Cards Showcase -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          <!-- Elevated Card -->
          <app-card variant="elevated" [hasHeader]="true">
            <div slot="header">
              <div class="flex items-center">
                <fa-icon [icon]="['fas', 'moon']" class="text-kaspa-600 mr-2"></fa-icon>
                <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100">Elevated Card</h3>
              </div>
            </div>
            
            <p class="text-body text-black-700 dark:text-white-300 mb-4">
              This card demonstrates the elevated style with shadow effects in both light and dark modes.
            </p>
            
            <div class="flex items-center space-x-3">
              <app-avatar name="John Doe" size="sm"></app-avatar>
              <span class="text-label text-black-600 dark:text-white-400">John Doe</span>
            </div>
          </app-card>

          <!-- Outlined Card -->
          <app-card variant="outlined" [hasHeader]="true">
            <div slot="header">
              <div class="flex items-center">
                <fa-icon [icon]="['fas', 'sun']" class="text-yellow-600 mr-2"></fa-icon>
                <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100">Outlined Card</h3>
              </div>
            </div>
            
            <p class="text-body text-black-700 dark:text-white-300 mb-4">
              Border-based styling that adapts beautifully to theme changes.
            </p>
            
            <div class="flex space-x-2">
              <app-button variant="primary" size="sm">Primary</app-button>
              <app-button variant="secondary" size="sm">Secondary</app-button>
            </div>
          </app-card>

          <!-- Interactive Card -->
          <app-card variant="flat" [interactive]="true">
            <div class="text-center">
              <fa-icon [icon]="['fas', 'bolt']" class="text-4xl text-kaspa-600 mb-4"></fa-icon>
              <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100 mb-2">Interactive</h3>
              <p class="text-body text-black-700 dark:text-white-300">
                Hover effects work seamlessly across themes
              </p>
            </div>
          </app-card>
        </div>

        <!-- Form Elements -->
        <app-card variant="elevated" [hasHeader]="true" class="mb-8">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900 dark:text-white-100">Form Elements</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <app-input 
                label="Username" 
                placeholder="Enter your username"
                helperText="This field supports dark mode">
              </app-input>
              
              <app-input 
                label="Email" 
                type="email"
                placeholder="your@email.com"
                [required]="true">
              </app-input>
            </div>
            
            <div class="space-y-4">
              <app-input 
                label="Error Example" 
                placeholder="This has an error"
                errorMessage="This field is required">
              </app-input>
              
              <div class="flex space-x-2">
                <app-button variant="primary">Save Changes</app-button>
                <app-button variant="ghost">Cancel</app-button>
              </div>
            </div>
          </div>
        </app-card>

        <!-- Toast Notifications -->
        <app-card variant="outlined" [hasHeader]="true" class="mb-8">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900 dark:text-white-100">Toast Notifications</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <app-toast 
                type="success" 
                title="Success!" 
                message="Dark mode has been enabled successfully."
                [autoClose]="false">
              </app-toast>
              
              <app-toast 
                type="info" 
                title="Theme Info" 
                message="You can toggle between light and dark modes anytime."
                [autoClose]="false">
              </app-toast>
            </div>
            
            <div class="space-y-4">
              <app-toast 
                type="warning" 
                title="Warning" 
                message="Some features may look different in dark mode."
                [autoClose]="false">
              </app-toast>
              
              <app-toast 
                type="error" 
                title="Error" 
                message="Failed to load theme preferences."
                [autoClose]="false">
              </app-toast>
            </div>
          </div>
        </app-card>

        <!-- Color Palette -->
        <app-card variant="elevated" [hasHeader]="true">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900 dark:text-white-100">Color Palette</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Primary Colors -->
            <div>
              <h4 class="text-h5 font-semibold text-black-800 dark:text-white-200 mb-4">Primary Colors</h4>
              <div class="space-y-2">
                @for (color of primaryColors; track color.name) {
                  <div class="flex items-center space-x-3">
                  <div 
                    class="w-8 h-8 rounded-md border border-white-300 dark:border-black-600"
                    [style.background-color]="color.value">
                  </div>
                  <div>
                    <span class="text-label font-medium text-black-800 dark:text-white-200">{{ color.name }}</span>
                    <span class="text-label text-black-500 dark:text-white-500 ml-2">{{ color.value }}</span>
                  </div>
                  </div>
                }
              </div>
            </div>

            <!-- Semantic Colors -->
            <div>
              <h4 class="text-h5 font-semibold text-black-800 dark:text-white-200 mb-4">Semantic Colors</h4>
              <div class="space-y-2">
                @for (color of semanticColors; track color.name) {
                  <div class="flex items-center space-x-3">
                  <div 
                    class="w-8 h-8 rounded-md border border-white-300 dark:border-black-600"
                    [style.background-color]="color.value">
                  </div>
                  <div>
                    <span class="text-label font-medium text-black-800 dark:text-white-200">{{ color.name }}</span>
                    <span class="text-label text-black-500 dark:text-white-500 ml-2">{{ color.value }}</span>
                  </div>
                  </div>
                }
              </div>
            </div>

            <!-- Theme Status -->
            <div>
              <h4 class="text-h5 font-semibold text-black-800 dark:text-white-200 mb-4">Theme Status</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between p-3 bg-white-200 dark:bg-black-700 rounded-md">
                  <span class="text-label text-black-700 dark:text-white-300">Dark Mode</span>
                  <span class="text-label font-semibold" 
                        [class]="isDarkMode() ? 'text-green-800' : 'text-black-500 dark:text-white-500'">
                    {{ isDarkMode() ? 'ON' : 'OFF' }}
                  </span>
                </div>
                
                <div class="flex items-center justify-between p-3 bg-white-200 dark:bg-black-700 rounded-md">
                  <span class="text-label text-black-700 dark:text-white-300">Auto-save</span>
                  <span class="text-label font-semibold text-green-800">ON</span>
                </div>
                
                <div class="flex items-center justify-between p-3 bg-white-200 dark:bg-black-700 rounded-md">
                  <span class="text-label text-black-700 dark:text-white-300">Transitions</span>
                  <span class="text-label font-semibold text-green-800">SMOOTH</span>
                </div>
              </div>
            </div>
          </div>
        </app-card>
      </div>
    </div>
  `,
  styles: [`
    /* Custom animations for theme demo */
    .theme-transition {
      @apply transition-all duration-500 ease-in-out;
    }
  `]
})
export class DarkModeDemoComponent {
  private themeService = inject(ThemeService);

  primaryColors = [
    { name: 'Kaspa 900', value: '#1A341A' },
    { name: 'Kaspa 700', value: '#316C31' },
    { name: 'Kaspa 600', value: '#3D8B3D' },
    { name: 'Kaspa 500', value: '#49AA49' },
  ];

  semanticColors = [
    { name: 'Success', value: '#49AA49' },
    { name: 'Warning', value: '#E8AF2F' },
    { name: 'Error', value: '#C23729' },
    { name: 'Info', value: '#3D8B3D' },
  ];

  getCurrentTheme(): string {
    const theme = this.themeService.getCurrentTheme();
    return `${theme.style} - ${theme.colorMode}`;
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }
}