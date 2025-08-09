import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="home-page">
      <div class="home-container">
        <div class="welcome-message">
          <h1 class="home-title">
            <fa-icon [icon]="['fas', 'home']" class="title-icon"></fa-icon>
            Welcome to Your Feed
          </h1>
          <p class="home-description">
            This is where your posts and content from users you follow will appear.
          </p>
        </div>
        
        <div class="coming-soon">
          <div class="coming-soon-content">
            <fa-icon [icon]="['fas', 'rocket']" class="coming-soon-icon"></fa-icon>
            <h2 class="coming-soon-title">Coming Soon</h2>
            <p class="coming-soon-text">
              Post creation, feed display, and social features are currently under development.
            </p>
            <div class="features-preview">
              <div class="feature-preview">
                <fa-icon [icon]="['fas', 'edit']" class="feature-icon"></fa-icon>
                <span>Create Posts</span>
              </div>
              <div class="feature-preview">
                <fa-icon [icon]="['fas', 'heart']" class="feature-icon"></fa-icon>
                <span>Like & Comment</span>
              </div>
              <div class="feature-preview">
                <fa-icon [icon]="['fas', 'users']" class="feature-icon"></fa-icon>
                <span>Follow Users</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .home-page {
      @apply flex-1 p-6;
    }
    
    .home-container {
      @apply max-w-4xl mx-auto space-y-8;
    }
    
    .welcome-message {
      @apply text-center space-y-4;
    }
    
    .home-title {
      @apply text-3xl font-bold text-black-900 dark:text-white-100;
      @apply flex items-center justify-center space-x-3;
    }
    
    .title-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    .home-description {
      @apply text-lg text-black-600 dark:text-white-400;
    }
    
    .coming-soon {
      @apply bg-white-900 dark:bg-black-800 rounded-xl p-8;
      @apply border border-white-200 dark:border-black-700;
      @apply text-center;
    }
    
    .coming-soon-content {
      @apply space-y-6;
    }
    
    .coming-soon-icon {
      @apply text-4xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    .coming-soon-title {
      @apply text-2xl font-bold text-black-900 dark:text-white-100;
    }
    
    .coming-soon-text {
      @apply text-black-600 dark:text-white-400;
    }
    
    .features-preview {
      @apply flex justify-center space-x-8 mt-6;
    }
    
    .feature-preview {
      @apply flex flex-col items-center space-y-2;
      @apply text-black-700 dark:text-white-300;
    }
    
    .feature-icon {
      @apply text-2xl text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      .home-page {
        @apply p-4;
      }
      
      .features-preview {
        @apply flex-col space-x-0 space-y-4;
      }
      
      .home-title {
        @apply text-2xl;
      }
    }
  `]
})
export class HomeComponent {
}