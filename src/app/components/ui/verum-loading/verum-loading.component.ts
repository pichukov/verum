import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-verum-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="verum-loading-container">
      <div class="verum-loading-content">
        <div class="verum-loading-spinner">
          <div class="spinner"></div>
        </div>
        <h2 class="verum-loading-title">{{ title }}</h2>
        <p class="verum-loading-text">{{ message }}</p>
        @if (showProgress && percentage > 0) {
          <div class="verum-progress-bar">
            <div class="verum-progress-fill" [style.width.%]="percentage"></div>
          </div>
          <div class="verum-progress-text">{{ percentage }}%</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .verum-loading-container {
      @apply flex items-center justify-center py-16;
      @apply bg-white dark:bg-black-800 rounded-lg;
      @apply border border-white-200 dark:border-black-700;
      @apply shadow-small;
    }
    
    .verum-loading-content {
      @apply text-center space-y-6;
    }
    
    .verum-loading-spinner {
      @apply flex justify-center mb-6;
    }
    
    .spinner {
      @apply w-12 h-12 border-4 border-gray-200 dark:border-black-700 border-t-kaspa-600 dark:border-t-kaspa-400 rounded-full;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .verum-loading-title {
      @apply text-2xl font-heading font-semibold text-black-900 dark:text-white-100 mb-2;
    }
    
    .verum-loading-text {
      @apply text-black-600 dark:text-white-400 font-body;
    }
    
    .verum-progress-bar {
      @apply w-full max-w-xs mx-auto bg-gray-200 dark:bg-black-700 rounded-full h-2 overflow-hidden;
    }
    
    .verum-progress-fill {
      @apply h-full bg-kaspa-600 dark:bg-kaspa-400 rounded-full transition-all duration-300 ease-out;
    }
    
    .verum-progress-text {
      @apply text-sm text-black-500 dark:text-white-300 font-medium;
    }
    
    /* Cyberpunk theme styles */
    :host-context(.cyberpunk-theme) .verum-loading-container {
      @apply bg-cyber-dark-2 border-2 border-neon-cyan/30;
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        border-radius: inherit;
        background: linear-gradient(45deg, transparent, rgba(0, 255, 255, 0.1), transparent);
        z-index: -1;
        animation: cyber-border-glow 3s ease-in-out infinite;
      }
      
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 255, 0.02) 2px,
            rgba(0, 255, 255, 0.02) 4px
          );
        pointer-events: none;
        z-index: 1;
      }
    }
    
    :host-context(.cyberpunk-theme) .verum-loading-content {
      position: relative;
      z-index: 2;
    }
    
    :host-context(.cyberpunk-theme) .spinner {
      @apply border-cyber-dark-3 border-t-neon-cyan;
      filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.8));
      animation: cyber-spin 1s linear infinite, cyber-pulse 2s ease-in-out infinite alternate;
    }
    
    :host-context(.cyberpunk-theme) .verum-loading-title {
      @apply text-neon-cyan font-cyber;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
      animation: cyber-text-flicker 3s ease-in-out infinite;
    }
    
    :host-context(.cyberpunk-theme) .verum-loading-text {
      @apply text-cyber-gray-5 font-tech;
    }
    
    :host-context(.cyberpunk-theme) .verum-progress-bar {
      @apply bg-cyber-dark-3 border border-neon-cyan/20;
    }
    
    :host-context(.cyberpunk-theme) .verum-progress-fill {
      @apply bg-neon-cyan;
      box-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
      animation: cyber-progress-glow 2s ease-in-out infinite alternate;
    }
    
    :host-context(.cyberpunk-theme) .verum-progress-text {
      @apply text-neon-cyan font-tech;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.6);
    }
    
    @keyframes cyber-border-glow {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
    
    @keyframes cyber-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes cyber-pulse {
      0% { filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.8)); }
      100% { filter: drop-shadow(0 0 15px rgba(0, 255, 255, 1)); }
    }
    
    @keyframes cyber-text-flicker {
      0%, 100% { 
        opacity: 1; 
        text-shadow: 0 0 10px rgba(0, 255, 255, 0.6); 
      }
      50% { 
        opacity: 0.8; 
        text-shadow: 0 0 15px rgba(0, 255, 255, 0.9); 
      }
    }
    
    @keyframes cyber-progress-glow {
      0% { 
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.5); 
      }
      100% { 
        box-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 30px rgba(0, 255, 255, 0.4); 
      }
    }
  `]
})
export class VerumLoadingComponent {
  @Input() title: string = 'Loading Verum';
  @Input() message: string = 'Please wait...';
  @Input() showProgress: boolean = false;
  @Input() percentage: number = 0;
}