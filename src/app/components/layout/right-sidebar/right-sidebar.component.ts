import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-right-sidebar',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <aside class="right-sidebar">
      <!-- About Verum Widget -->
      <div class="info-widget">
        <div class="widget-header">
          <fa-icon [icon]="['fas', 'info-circle']" class="header-icon"></fa-icon>
          <h3 class="widget-title">About Verum</h3>
        </div>
        
        <div class="divider"></div>
        
        <div class="info-content">
          <p class="info-text">
            Verum is a decentralized social platform built on Kaspa, 
            ensuring your data remains yours while enabling fast, secure interactions.
          </p>
          
          <div class="feature-list">
            <div class="feature-item">
              <fa-icon [icon]="['fas', 'lock']" class="feature-icon"></fa-icon>
              <span>Decentralized & Secure</span>
            </div>
            <div class="feature-item">
              <fa-icon [icon]="['fas', 'bolt']" class="feature-icon"></fa-icon>
              <span>Fast Transactions</span>
            </div>
            <div class="feature-item">
              <fa-icon [icon]="['fas', 'coins']" class="feature-icon"></fa-icon>
              <span>KAS Native Integration</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .right-sidebar {
      @apply w-80 space-y-6;
      @apply sticky top-24;
    }

    /* Widget Base Styles */
    .info-widget {
      @apply bg-white dark:bg-black-800;
      @apply border border-white-200 dark:border-black-700;
      @apply rounded-lg overflow-hidden;
      @apply shadow-small;
    }
    
    /* Cyberpunk widget styles */
    :host-context(.cyberpunk-theme) .info-widget {
      @apply bg-cyber-dark-2 border border-white-200 dark:border-black-700 rounded-lg;
    }


    .widget-header {
      @apply flex items-center space-x-3 p-6 pb-4;
    }

    .header-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
    }
    
    /* Cyberpunk header icon */
    :host-context(.cyberpunk-theme) .header-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    .widget-title {
      @apply text-base font-semibold text-black-900 dark:text-white-100;
    }
    
    /* Cyberpunk widget title */
    :host-context(.cyberpunk-theme) .widget-title {
      @apply font-cyber text-neon-cyan uppercase tracking-wider;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
      animation: text-flicker 8s infinite;
    }

    @keyframes text-flicker {
      0%, 98% { opacity: 1; }
      99% { opacity: 0.8; }
      100% { opacity: 1; }
    }

    .divider {
      @apply border-t border-white-100 dark:border-black-700 mx-6;
    }
    
    /* Cyberpunk divider */
    :host-context(.cyberpunk-theme) .divider {
      @apply border-t border-neon-cyan/30;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, #00FFFF, transparent);
        animation: stat-line-glow 2s ease-in-out infinite alternate;
      }
    }

    @keyframes stat-line-glow {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    /* Info Content */
    .info-content {
      @apply p-6 pt-4 space-y-4;
    }

    .info-text {
      @apply text-sm text-black-600 dark:text-white-400;
      @apply leading-relaxed;
    }
    
    /* Cyberpunk info text */
    :host-context(.cyberpunk-theme) .info-text {
      @apply text-cyber-gray-5 font-tech;
    }

    .feature-list {
      @apply space-y-3;
    }

    .feature-item {
      @apply flex items-center space-x-3;
      @apply text-sm text-black-700 dark:text-white-300;
    }
    
    /* Cyberpunk feature item */
    :host-context(.cyberpunk-theme) .feature-item {
      @apply text-neon-cyan font-tech;
    }

    .feature-icon {
      @apply text-kaspa-600 dark:text-kaspa-400;
      @apply text-sm;
    }
    
    /* Cyberpunk feature icon */
    :host-context(.cyberpunk-theme) .feature-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.6));
    }

    /* Mobile responsive - hide on medium screens and below */
    @media (max-width: 1280px) {
      .right-sidebar {
        @apply hidden;
      }
    }
  `]
})
export class RightSidebarComponent {
}