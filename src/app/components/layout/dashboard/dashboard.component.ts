import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { CardComponent } from '../../ui/card/card.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ToastContainerComponent } from '../../ui/toast-container/toast-container.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent, CardComponent, ButtonComponent, FontAwesomeModule, ToastContainerComponent],
  template: `
    <!-- Navigation Bar -->
    <app-navbar></app-navbar>

    <!-- Main Dashboard Content -->
    <main class="dashboard-main" [class.opacity-0]="!isLoaded" [class.opacity-100]="isLoaded" [class.transition-opacity]="true" [class.duration-300]="true">
      <div class="dashboard-container">
        
        <!-- Main Content Area -->
        <div class="dashboard-content">
          <!-- Welcome Section -->
          <section class="welcome-section">
            <app-card variant="elevated" [hasHeader]="true">
              <div slot="header">
                <h2 class="text-h3 font-bold text-black-900 dark:text-white-100">Welcome to Verum</h2>
                <p class="text-body text-black-600 dark:text-white-400 mt-2">
                  A decentralized platform built on Kaspa
                </p>
              </div>
              
              <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <!-- Feature Card 1 -->
                  <div class="feature-card">
                    <div class="feature-icon">
                      <fa-icon [icon]="['fas', 'comments']" class="text-kaspa-600"></fa-icon>
                    </div>
                    <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100 mb-2">Share Thoughts</h3>
                    <p class="text-body text-black-600 dark:text-white-400">
                      Post your thoughts and connect with others on Kaspa
                    </p>
                  </div>

                  <!-- Feature Card 2 -->
                  <div class="feature-card">
                    <div class="feature-icon">
                      <fa-icon [icon]="['fas', 'link']" class="text-kaspa-600"></fa-icon>
                    </div>
                    <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100 mb-2">Decentralized</h3>
                    <p class="text-body text-black-600 dark:text-white-400">
                      Your data lives on the blockchain, ensuring true ownership
                    </p>
                  </div>

                  <!-- Feature Card 3 -->
                  <div class="feature-card">
                    <div class="feature-icon">
                      <fa-icon [icon]="['fas', 'bolt']" class="text-kaspa-600"></fa-icon>
                    </div>
                    <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100 mb-2">Fast & Secure</h3>
                    <p class="text-body text-black-600 dark:text-white-400">
                      Powered by Kaspa's lightning-fast blockchain technology
                    </p>
                  </div>
                </div>

                <!-- Call to Action -->
                <div class="cta-section">
                  <div class="text-center">
                    <h3 class="text-h4 font-semibold text-black-900 dark:text-white-100 mb-4">
                      Ready to get started?
                    </h3>
                    <p class="text-body text-black-600 dark:text-white-400 mb-6 max-w-2xl mx-auto">
                      Connect your Kaspa wallet to start posting, following others, and 
                      building your decentralized social presence.
                    </p>
                    <app-button variant="primary" size="lg">
                      <fa-icon [icon]="['fas', 'wallet']" class="mr-2"></fa-icon>
                      Connect Your Wallet
                    </app-button>
                  </div>
                </div>
              </div>
            </app-card>
          </section>

          <!-- Posts Feed Placeholder -->
          <section class="feed-section">
            <app-card variant="outlined">
              <div class="text-center py-12">
                <div class="empty-state-icon">
                  <fa-icon [icon]="['fas', 'edit']" class="text-black-400"></fa-icon>
                </div>
                <h3 class="text-h4 font-semibold text-black-900 dark:text-white-100 mb-4">
                  Your feed awaits
                </h3>
                <p class="text-body text-black-600 dark:text-white-400 mb-6 max-w-md mx-auto">
                  Connect your wallet to start seeing posts from the Verum community 
                  and share your own thoughts.
                </p>
                <app-button variant="secondary">
                  <fa-icon [icon]="['fas', 'info-circle']" class="mr-2"></fa-icon>
                  Learn More
                </app-button>
              </div>
            </app-card>
          </section>
        </div>

        <!-- Sidebar (for future features) -->
        <aside class="dashboard-sidebar">
          <!-- Trending Section -->
          <app-card variant="outlined" [hasHeader]="true">
            <div slot="header">
              <div class="flex items-center">
                <fa-icon [icon]="['fas', 'fire']" class="text-red-800 mr-2"></fa-icon>
                <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100">Trending on Kaspa</h3>
              </div>
            </div>
            
            <div class="space-y-4">
              <div class="trending-item">
                <div class="flex items-start">
                  <fa-icon [icon]="['fas', 'hashtag']" class="text-black-400 text-sm mt-1 mr-2"></fa-icon>
                  <div>
                    <p class="text-label text-black-500 dark:text-white-500">KaspaGreen</p>
                    <p class="text-body font-medium text-kaspa-600">12.5K posts</p>
                  </div>
                </div>
              </div>
              <div class="trending-item">
                <div class="flex items-start">
                  <fa-icon [icon]="['fas', 'hashtag']" class="text-black-400 text-sm mt-1 mr-2"></fa-icon>
                  <div>
                    <p class="text-label text-black-500 dark:text-white-500">DeFi</p>
                    <p class="text-body font-medium text-black-900 dark:text-white-100">8.2K posts</p>
                  </div>
                </div>
              </div>
              <div class="trending-item">
                <div class="flex items-start">
                  <fa-icon [icon]="['fas', 'hashtag']" class="text-black-400 text-sm mt-1 mr-2"></fa-icon>
                  <div>
                    <p class="text-label text-black-500 dark:text-white-500">Blockchain</p>
                    <p class="text-body font-medium text-black-900 dark:text-white-100">5.8K posts</p>
                  </div>
                </div>
              </div>
            </div>
          </app-card>

          <!-- Stats Card -->
          <app-card variant="flat" [hasHeader]="true">
            <div slot="header">
              <div class="flex items-center">
                <fa-icon [icon]="['fas', 'chart-line']" class="text-kaspa-600 mr-2"></fa-icon>
                <h3 class="text-h5 font-semibold text-black-900 dark:text-white-100">Network Stats</h3>
              </div>
            </div>
            
            <div class="space-y-3">
              <div class="stat-item">
                <div class="flex items-center">
                  <fa-icon [icon]="['fas', 'edit']" class="text-black-400 text-sm mr-2"></fa-icon>
                  <span class="text-label text-black-500 dark:text-white-500">Total Posts</span>
                </div>
                <span class="text-body font-semibold text-black-900 dark:text-white-100">156.2K</span>
              </div>
              <div class="stat-item">
                <div class="flex items-center">
                  <fa-icon [icon]="['fas', 'users']" class="text-black-400 text-sm mr-2"></fa-icon>
                  <span class="text-label text-black-500 dark:text-white-500">Active Users</span>
                </div>
                <span class="text-body font-semibold text-black-900 dark:text-white-100">12.8K</span>
              </div>
              <div class="stat-item">
                <div class="flex items-center">
                  <fa-icon [icon]="['fas', 'bolt']" class="text-black-400 text-sm mr-2"></fa-icon>
                  <span class="text-label text-black-500 dark:text-white-500">Kaspa TPS</span>
                </div>
                <span class="text-body font-semibold text-kaspa-600">1,024</span>
              </div>
            </div>
          </app-card>
        </aside>
      </div>
    </main>

    <!-- Toast Container -->
    <app-toast-container></app-toast-container>
  `,
  styles: [`
    .dashboard-main {
      @apply min-h-screen bg-white-100 dark:bg-black-900;
    }

    .dashboard-container {
      @apply max-w-7xl mx-auto px-6 py-8;
      @apply grid grid-cols-1 lg:grid-cols-4 gap-8;
    }

    .dashboard-content {
      @apply lg:col-span-3 space-y-8;
    }

    .dashboard-sidebar {
      @apply lg:col-span-1 space-y-6;
    }

    .welcome-section {
      @apply mb-8;
    }

    .feed-section {
      @apply mb-8;
    }

    .feature-card {
      @apply text-center p-6 rounded-md bg-white-200 dark:bg-black-800 border border-white-300 dark:border-black-700;
      @apply hover:bg-white-100 dark:hover:bg-black-700 transition-colors duration-200;
    }

    .feature-icon {
      @apply text-4xl mb-4 flex justify-center;
    }

    .cta-section {
      @apply mt-8 pt-8 border-t border-white-300 dark:border-black-700;
    }

    .empty-state-icon {
      @apply text-6xl mb-6 flex justify-center;
    }

    .trending-item {
      @apply flex justify-between items-center py-2;
      @apply border-b border-white-200 dark:border-black-700 last:border-b-0;
    }

    .stat-item {
      @apply flex justify-between items-center;
    }

    /* Mobile responsive */
    @media (max-width: 1024px) {
      .dashboard-container {
        @apply grid-cols-1 px-4;
      }
      
      .dashboard-sidebar {
        @apply order-first lg:order-last;
      }
      
      .feature-card {
        @apply p-4;
      }
    }

    @media (max-width: 768px) {
      .dashboard-container {
        @apply py-4;
      }
      
      .feature-icon {
        @apply text-3xl mb-3 flex justify-center;
      }
      
      .empty-state-icon {
        @apply text-5xl mb-4 flex justify-center;
      }
    }
  `]
})
export class DashboardComponent {
  isLoaded = false;

  constructor() {
    // Ensure component is fully loaded before showing content
    setTimeout(() => {
      this.isLoaded = true;
    }, 0);
  }
}