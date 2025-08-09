import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UserService } from '../../../services/user.service';
import { KaswareWalletService } from '../../../services/kasware-wallet.service';

@Component({
  selector: 'app-left-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule],
  template: `
    <aside class="left-sidebar">
      <!-- Cover Image -->
      <div class="cover-image">
        <div class="cover-gradient"></div>
      </div>

      <!-- Profile Section -->
      <div class="profile-section">
        <!-- Profile Avatar -->
        <div class="profile-avatar">
          @if (userService.currentUser()?.avatar) {
            <img 
              [src]="getUserAvatarUrl()" 
              [alt]="userService.currentUser()?.nickname"
              class="avatar-img">
          } @else {
            <div class="avatar-placeholder">
              <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
            </div>
          }
        </div>

        <!-- User Info -->
        <div class="user-info">
          <h3 class="user-name">{{ userService.currentUser()?.nickname || 'Anonymous' }}</h3>
          <p class="user-title">Kaspa User</p>
          <p class="user-address">{{ formatAddress() }}</p>
        </div>

        <!-- Navigation Menu -->
        <nav class="navigation-menu">
          <ul class="nav-list">
            <li class="nav-item">
              <a 
                routerLink="/dashboard" 
                routerLinkActive="active" 
                class="nav-link">
                <fa-icon [icon]="['fas', 'home']" class="nav-icon"></fa-icon>
                <span class="nav-text">Home</span>
              </a>
            </li>
            <li class="nav-item">
              <a 
                routerLink="/profile" 
                routerLinkActive="active" 
                class="nav-link">
                <fa-icon [icon]="['fas', 'user']" class="nav-icon"></fa-icon>
                <span class="nav-text">Profile</span>
              </a>
            </li>
            <li class="nav-item">
              <a 
                routerLink="/subscriptions" 
                routerLinkActive="active" 
                class="nav-link">
                <fa-icon [icon]="['fas', 'users']" class="nav-icon"></fa-icon>
                <span class="nav-text">Subscriptions</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  `,
  styles: [`
    .left-sidebar {
      @apply w-72 bg-white dark:bg-black-800;
      @apply border border-white-200 dark:border-black-700;
      @apply rounded-lg overflow-hidden;
      @apply sticky top-24;
      @apply shadow-small;
    }

    /* Cyberpunk sidebar styles */
    :host-context(.cyberpunk-theme) .left-sidebar {
      @apply bg-cyber-dark-2 border border-white-200 dark:border-black-700 rounded-lg;
    }

    /* Cover Image */
    .cover-image {
      @apply h-18 relative;
    }

    .cover-gradient {
      @apply w-full h-full;
      @apply bg-gradient-to-r from-kaspa-600 via-kaspa-500 to-kaspa-400;
    }

    /* Cyberpunk cover gradient - darker version */
    :host-context(.cyberpunk-theme) .cover-gradient {
      background: linear-gradient(
        135deg,
        #333 0%,
        #004d4d 25%,
        #111 50%,
        #003333 75%,
        #222 100%
      );
      animation: neon-pulse 4s ease-in-out infinite alternate;
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: 
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 255, 0.05) 2px,
            rgba(0, 255, 255, 0.05) 4px
          );
      }
    }

    @keyframes neon-pulse {
      0% { 
        filter: brightness(1) saturate(1);
        box-shadow: inset 0 0 20px rgba(0, 255, 255, 0.1);
      }
      100% { 
        filter: brightness(1.1) saturate(1.2);
        box-shadow: inset 0 0 25px rgba(0, 255, 255, 0.2);
      }
    }

    /* Profile Section */
    .profile-section {
      @apply px-8 pb-6;
    }

    .profile-avatar {
      @apply relative -mt-7 mb-4;
    }

    .avatar-img {
      @apply w-14 h-14 rounded-full object-cover;
      @apply border-2 border-white dark:border-black-800;
      @apply shadow-medium;
    }

    /* Cyberpunk avatar styles */
    :host-context(.cyberpunk-theme) .avatar-img {
      @apply border-2 border-neon-cyan rounded-full;
      box-shadow: 
        0 0 15px rgba(0, 255, 255, 0.6),
        0 0 30px rgba(0, 255, 255, 0.3),
        inset 0 0 15px rgba(0, 255, 255, 0.1);
      filter: contrast(1.1) saturate(1.2);
    }

    .avatar-placeholder {
      @apply w-14 h-14 rounded-full;
      @apply bg-white-200 dark:bg-black-700;
      @apply border-2 border-white dark:border-black-800;
      @apply flex items-center justify-center;
      @apply shadow-medium;
    }

    /* Cyberpunk avatar placeholder */
    :host-context(.cyberpunk-theme) .avatar-placeholder {
      @apply bg-cyber-dark-3 border-2 border-neon-cyan rounded-full;
      box-shadow: 
        0 0 15px rgba(0, 255, 255, 0.4),
        inset 0 0 10px rgba(0, 255, 255, 0.1);
    }

    .placeholder-icon {
      @apply text-xl text-black-400 dark:text-white-400;
    }

    /* Cyberpunk placeholder icon */
    :host-context(.cyberpunk-theme) .placeholder-icon {
      @apply text-neon-cyan;
      filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.8));
    }

    /* User Info */
    .user-info {
      @apply mb-8;
    }

    .user-name {
      @apply text-sm font-semibold text-black-900 dark:text-white-100;
      @apply mb-1;
    }

    /* Cyberpunk user name */
    :host-context(.cyberpunk-theme) .user-name {
      @apply font-cyber text-neon-cyan uppercase tracking-wider;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.6);
      animation: text-flicker 8s infinite;
    }

    @keyframes text-flicker {
      0%, 98% { opacity: 1; }
      99% { opacity: 0.8; }
      100% { opacity: 1; }
    }

    .user-title {
      @apply text-xs text-black-600 dark:text-white-400;
      @apply mb-1;
    }

    /* Cyberpunk user title */
    :host-context(.cyberpunk-theme) .user-title {
      @apply font-tech text-neon-magenta/80 uppercase tracking-widest;
      text-shadow: 0 0 5px rgba(255, 0, 255, 0.5);
    }

    .user-address {
      @apply text-xs text-black-500 dark:text-white-400;
      @apply font-mono truncate;
    }

    /* Cyberpunk user address */
    :host-context(.cyberpunk-theme) .user-address {
      @apply font-tech text-cyber-gray-5;
      background: linear-gradient(90deg, #00FFFF, #00D4FF);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }


    /* Navigation */
    .navigation-menu {
      @apply mt-6;
    }

    .nav-list {
      @apply space-y-0;
    }

    .nav-item {
      @apply border-b border-white-100 dark:border-black-700 last:border-b-0;
    }

    /* Cyberpunk nav item */
    :host-context(.cyberpunk-theme) .nav-item {
      @apply border-b border-neon-cyan/20 last:border-b-0;
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.3), transparent);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      &:hover::after {
        opacity: 1;
      }
    }

    .nav-link {
      @apply flex items-center justify-between py-3;
      @apply text-sm text-black-600 dark:text-white-400;
      @apply hover:text-black-900 dark:hover:text-white-100;
      @apply transition-colors duration-200;
    }

    /* Cyberpunk nav link */
    :host-context(.cyberpunk-theme) .nav-link {
      @apply font-tech text-cyber-gray-5 hover:text-neon-cyan;
      transition: all 0.3s ease;
      position: relative;
      
      &:hover {
        text-shadow: 0 0 5px rgba(0, 255, 255, 0.6);
        
        .nav-icon {
          filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.8));
        }
      }
    }

    .nav-link.active {
      @apply text-kaspa-600 dark:text-kaspa-400;
      @apply font-medium;
    }

    /* Cyberpunk active nav link */
    :host-context(.cyberpunk-theme) .nav-link.active {
      @apply text-neon-cyan font-cyber;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.8);
      background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.1), transparent);
      
      .nav-icon {
        filter: drop-shadow(0 0 8px rgba(0, 255, 255, 1));
      }
    }

    .nav-link.disabled {
      @apply text-black-400 dark:text-white-400;
      @apply cursor-not-allowed;
      @apply hover:text-black-400 dark:hover:text-white-400;
    }

    .nav-link .nav-icon {
      @apply mr-3 text-base;
    }

    .nav-link .nav-text {
      @apply flex-1;
    }

    .coming-soon {
      @apply text-xs bg-yellow-100 dark:bg-yellow-900/30;
      @apply text-yellow-600 dark:text-yellow-400;
      @apply px-2 py-1 rounded-full;
      @apply font-medium;
    }

    /* Mobile responsive - hide on small screens */
    @media (max-width: 1024px) {
      .left-sidebar {
        @apply hidden;
      }
    }
  `]
})
export class LeftSidebarComponent {
  public userService = inject(UserService);
  private walletService = inject(KaswareWalletService);
  private router = inject(Router);

  /**
   * Get user avatar URL
   */
  getUserAvatarUrl(): string {
    const user = this.userService.currentUser();
    if (!user?.avatar) return '';
    
    // Check if it's already a data URL
    if (user.avatar.startsWith('data:')) {
      return user.avatar;
    }
    
    // Assume it's base64 and add the data URL prefix
    return `data:image/png;base64,${user.avatar}`;
  }

  /**
   * Format wallet address
   */
  formatAddress(): string {
    return this.walletService.formatAddress(this.walletService.account(), 8);
  }
}