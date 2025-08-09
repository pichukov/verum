import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../ui/button/button.component';
import { AvatarComponent } from '../ui/avatar/avatar.component';
import { InputComponent } from '../ui/input/input.component';
import { ToastComponent } from '../ui/toast/toast.component';
import { CardComponent } from '../ui/card/card.component';

@Component({
  selector: 'app-design-system-showcase',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    AvatarComponent,
    InputComponent,
    ToastComponent,
    CardComponent
  ],
  template: `
    <div class="min-h-screen bg-white-100 p-8">
      <div class="max-w-6xl mx-auto space-y-12">
        
        <!-- Header -->
        <header class="text-center">
          <h1 class="text-h1 font-bold text-black-900 mb-4">Design System Showcase</h1>
          <p class="text-body text-black-600 max-w-2xl mx-auto">
            A comprehensive showcase of our design system components built with Angular and Tailwind CSS,
            based on the Figma design tokens.
          </p>
        </header>

        <!-- Colors Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Colors</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <!-- Primary Colors -->
            <div>
              <h3 class="text-h4 font-semibold text-black-800 mb-4">Primary</h3>
              <div class="space-y-2">
                @for (shade of primaryShades; track shade.name) {
                  <div class="flex items-center justify-between p-3 rounded-md"
                       [style.background-color]="shade.color">
                    <span class="text-label font-medium" 
                          [class]="shade.textClass">{{ shade.name }}</span>
                    <span class="text-label" 
                          [class]="shade.textClass">{{ shade.hex }}</span>
                  </div>
                }
              </div>
            </div>

            <!-- Semantic Colors -->
            <div>
              <h3 class="text-h4 font-semibold text-black-800 mb-4">Semantic</h3>
              <div class="space-y-2">
                <div class="flex items-center justify-between p-3 rounded-md bg-green-800">
                  <span class="text-label font-medium text-white">Success</span>
                  <span class="text-label text-white">#2A7841</span>
                </div>
                <div class="flex items-center justify-between p-3 rounded-md bg-yellow-800">
                  <span class="text-label font-medium text-white">Warning</span>
                  <span class="text-label text-white">#E8AF2F</span>
                </div>
                <div class="flex items-center justify-between p-3 rounded-md bg-red-800">
                  <span class="text-label font-medium text-white">Error</span>
                  <span class="text-label text-white">#C23729</span>
                </div>
              </div>
            </div>

            <!-- Neutral Colors -->
            <div>
              <h3 class="text-h4 font-semibold text-black-800 mb-4">Neutral</h3>
              <div class="space-y-2">
                @for (shade of neutralShades; track shade.name) {
                  <div class="flex items-center justify-between p-3 rounded-md"
                       [style.background-color]="shade.color">
                    <span class="text-label font-medium" 
                          [class]="shade.textClass">{{ shade.name }}</span>
                  <span class="text-label" 
                        [class]="shade.textClass">{{ shade.hex }}</span>
                  </div>
                }
              </div>
            </div>
          </div>
        </section>

        <!-- Typography Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Typography</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Headings & Text</h3>
            </div>
            
            <div class="space-y-6">
              <div>
                <h1 class="text-h1 font-semibold text-black-900">Heading 1 - 40px</h1>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 600</p>
              </div>
              
              <div>
                <h2 class="text-h2 font-bold text-black-900">Heading 2 - 32px</h2>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 700</p>
              </div>
              
              <div>
                <h3 class="text-h3 font-bold text-black-900">Heading 3 - 24px</h3>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 700</p>
              </div>
              
              <div>
                <h4 class="text-h4 font-semibold text-black-900">Heading 4 - 18px</h4>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 600</p>
              </div>
              
              <div>
                <p class="text-body text-black-800">
                  Body text - 14px with 175% line height. Lorem ipsum dolor sit amet, 
                  consectetur adipiscing elit. Vivamus in neque in massa rhoncus suscipit.
                </p>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 400</p>
              </div>
              
              <div>
                <p class="text-label text-black-700">Label text - 12px</p>
                <p class="text-label text-black-600 mt-1">Font: Inter, Weight: 400</p>
              </div>
            </div>
          </app-card>
        </section>

        <!-- Buttons Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Buttons</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Button Variants & Sizes</h3>
            </div>
            
            <div class="space-y-6">
              <!-- Button Variants -->
              <div>
                <h4 class="text-h5 font-medium text-black-800 mb-4">Variants</h4>
                <div class="flex flex-wrap gap-4">
                  <app-button variant="primary">Primary Button</app-button>
                  <app-button variant="secondary">Secondary Button</app-button>
                  <app-button variant="ghost">Ghost Button</app-button>
                  <app-button variant="primary" [disabled]="true">Disabled Button</app-button>
                </div>
              </div>
              
              <!-- Button Sizes -->
              <div>
                <h4 class="text-h5 font-medium text-black-800 mb-4">Sizes</h4>
                <div class="flex flex-wrap items-center gap-4">
                  <app-button variant="primary" size="sm">Small</app-button>
                  <app-button variant="primary" size="md">Medium</app-button>
                  <app-button variant="primary" size="lg">Large</app-button>
                </div>
              </div>
            </div>
          </app-card>
        </section>

        <!-- Avatars Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Avatars</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Avatar Sizes & States</h3>
            </div>
            
            <div class="space-y-6">
              <!-- Avatar Sizes -->
              <div>
                <h4 class="text-h5 font-medium text-black-800 mb-4">Sizes</h4>
                <div class="flex items-center gap-4">
                  <app-avatar size="xs" name="John Doe"></app-avatar>
                  <app-avatar size="sm" name="Jane Smith"></app-avatar>
                  <app-avatar size="md" name="Bob Johnson"></app-avatar>
                  <app-avatar size="lg" name="Alice Brown"></app-avatar>
                  <app-avatar size="xl" name="Charlie Wilson"></app-avatar>
                </div>
              </div>
              
              <!-- Avatar with Status -->
              <div>
                <h4 class="text-h5 font-medium text-black-800 mb-4">With Status</h4>
                <div class="flex items-center gap-4">
                  <app-avatar size="lg" name="Online User" status="online"></app-avatar>
                  <app-avatar size="lg" name="Busy User" status="busy"></app-avatar>
                  <app-avatar size="lg" name="Offline User" status="offline"></app-avatar>
                </div>
              </div>
            </div>
          </app-card>
        </section>

        <!-- Form Elements Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Form Elements</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Inputs & Form Controls</h3>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <app-input 
                  label="Default Input" 
                  placeholder="Enter some text..."
                  helperText="This is helper text">
                </app-input>
                
                <app-input 
                  label="Required Input" 
                  placeholder="This field is required"
                  [required]="true">
                </app-input>
                
                <app-input 
                  label="Error State" 
                  placeholder="This has an error"
                  errorMessage="This field has an error">
                </app-input>
              </div>
              
              <div class="space-y-4">
                <app-input 
                  label="Small Input" 
                  size="sm"
                  placeholder="Small size input">
                </app-input>
                
                <app-input 
                  label="Large Input" 
                  size="lg"
                  placeholder="Large size input">
                </app-input>
                
                <app-input 
                  label="Disabled Input" 
                  placeholder="This is disabled"
                  [disabled]="true">
                </app-input>
              </div>
            </div>
          </app-card>
        </section>

        <!-- Toast Messages Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Toast Messages</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Notification Types</h3>
            </div>
            
            <div class="space-y-4">
              <app-toast 
                type="success" 
                title="Success!" 
                message="Your action was completed successfully."
                [autoClose]="false">
              </app-toast>
              
              <app-toast 
                type="error" 
                title="Error" 
                message="Something went wrong. Please try again."
                [autoClose]="false">
              </app-toast>
              
              <app-toast 
                type="warning" 
                title="Warning" 
                message="Please review your input before proceeding."
                [autoClose]="false">
              </app-toast>
              
              <app-toast 
                type="info" 
                title="Information" 
                message="Here's some helpful information for you."
                [autoClose]="false">
              </app-toast>
            </div>
          </app-card>
        </section>

        <!-- Cards Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Cards</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <app-card variant="elevated" [hasHeader]="true" [hasFooter]="true">
              <div slot="header">
                <h4 class="text-h5 font-medium text-black-800">Elevated Card</h4>
              </div>
              
              <p class="text-body text-black-700">
                This is an elevated card with shadow and rounded corners.
              </p>
              
              <div slot="footer">
                <app-button variant="primary" size="sm">Action</app-button>
              </div>
            </app-card>
            
            <app-card variant="outlined" [hasHeader]="true">
              <div slot="header">
                <h4 class="text-h5 font-medium text-black-800">Outlined Card</h4>
              </div>
              
              <p class="text-body text-black-700">
                This is an outlined card with border styling.
              </p>
            </app-card>
            
            <app-card variant="flat" [interactive]="true">
              <h4 class="text-h5 font-medium text-black-800 mb-3">Interactive Card</h4>
              <p class="text-body text-black-700">
                This card has hover effects and is interactive.
              </p>
            </app-card>
          </div>
        </section>

        <!-- Spacing Section -->
        <section>
          <h2 class="text-h2 font-bold text-black-900 mb-6">Spacing System</h2>
          
          <app-card [hasHeader]="true" variant="outlined">
            <div slot="header">
              <h3 class="text-h4 font-semibold text-black-800">Spacing Scale</h3>
            </div>
            
            <div class="space-y-4">
              @for (space of spacingScale; track space.name) {
                <div class="flex items-center">
                  <div class="w-20 text-label font-medium text-black-700">{{ space.name }}</div>
                  <div 
                    class="bg-primary-800 h-3"
                    [style.width.px]="space.size">
                  </div>
                  <div class="ml-4 text-label text-black-600">{{ space.size }}px</div>
                </div>
              }
            </div>
          </app-card>
        </section>

      </div>
    </div>
  `,
  styles: []
})
export class DesignSystemShowcaseComponent {
  primaryShades = [
    { name: '900', hex: '#4C68D5', color: '#4C68D5', textClass: 'text-white' },
    { name: '800', hex: '#6174D9', color: '#6174D9', textClass: 'text-white' },
    { name: '700', hex: '#7381DD', color: '#7381DD', textClass: 'text-white' },
    { name: '600', hex: '#858EE1', color: '#858EE1', textClass: 'text-white' },
    { name: '500', hex: '#959CE5', color: '#959CE5', textClass: 'text-black-900' },
    { name: '400', hex: '#A5A9E9', color: '#A5A9E9', textClass: 'text-black-900' },
    { name: '300', hex: '#B4B7ED', color: '#B4B7ED', textClass: 'text-black-900' },
    { name: '200', hex: '#C3C5F1', color: '#C3C5F1', textClass: 'text-black-900' },
    { name: '100', hex: '#E1E2F8', color: '#E1E2F8', textClass: 'text-black-900' },
  ];

  neutralShades = [
    { name: '900', hex: '#0C1024', color: '#0C1024', textClass: 'text-white' },
    { name: '800', hex: '#27364B', color: '#27364B', textClass: 'text-white' },
    { name: '700', hex: '#39465A', color: '#39465A', textClass: 'text-white' },
    { name: '600', hex: '#4B5669', color: '#4B5669', textClass: 'text-white' },
    { name: '500', hex: '#5D6778', color: '#5D6778', textClass: 'text-white' },
    { name: '400', hex: '#707988', color: '#707988', textClass: 'text-white' },
    { name: '300', hex: '#838B98', color: '#838B98', textClass: 'text-black-900' },
    { name: '200', hex: '#979DA9', color: '#979DA9', textClass: 'text-black-900' },
    { name: '100', hex: '#ABB0B9', color: '#ABB0B9', textClass: 'text-black-900' },
  ];

  spacingScale = [
    { name: '01', size: 4 },
    { name: '02', size: 6 },
    { name: '03', size: 8 },
    { name: '04', size: 12 },
    { name: '05', size: 16 },
    { name: '06', size: 24 },
    { name: '07', size: 32 },
    { name: '08', size: 40 },
    { name: '09', size: 48 },
    { name: '10', size: 56 },
    { name: '11', size: 64 },
    { name: '12', size: 72 },
  ];
}