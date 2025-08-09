import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CardComponent } from '../ui/card/card.component';

@Component({
  selector: 'app-icon-showcase',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, CardComponent],
  template: `
    <div class="p-8 bg-white-100 min-h-screen">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-h1 font-bold text-black-900 mb-8 text-center">Font Awesome Icons Showcase</h1>
        
        <!-- Navigation Icons -->
        <app-card [hasHeader]="true" variant="elevated" class="mb-8">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900">Navigation Icons</h2>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'home']" class="text-primary-700"></fa-icon>
              <span>Home</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'search']" class="text-primary-700"></fa-icon>
              <span>Search</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'bell']" class="text-primary-700"></fa-icon>
              <span>Notifications</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'envelope']" class="text-primary-700"></fa-icon>
              <span>Messages</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'wallet']" class="text-primary-700"></fa-icon>
              <span>Wallet</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'user']" class="text-primary-700"></fa-icon>
              <span>Profile</span>
            </div>
          </div>
        </app-card>

        <!-- Social Media Icons -->
        <app-card [hasHeader]="true" variant="elevated" class="mb-8">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900">Social Media Icons</h2>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'heart']" class="text-red-800"></fa-icon>
              <span>Like</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'comment']" class="text-green-800"></fa-icon>
              <span>Comment</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'share']" class="text-blue-600"></fa-icon>
              <span>Share</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'retweet']" class="text-green-600"></fa-icon>
              <span>Repost</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'bookmark']" class="text-yellow-600"></fa-icon>
              <span>Bookmark</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'users']" class="text-purple-600"></fa-icon>
              <span>Following</span>
            </div>
          </div>
        </app-card>

        <!-- Utility Icons -->
        <app-card [hasHeader]="true" variant="elevated" class="mb-8">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900">Utility Icons</h2>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'check']" class="text-green-800"></fa-icon>
              <span>Success</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'times']" class="text-red-800"></fa-icon>
              <span>Close</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'exclamation-triangle']" class="text-yellow-800"></fa-icon>
              <span>Warning</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'info-circle']" class="text-primary-800"></fa-icon>
              <span>Info</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'cog']" class="text-black-600"></fa-icon>
              <span>Settings</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'edit']" class="text-black-600"></fa-icon>
              <span>Edit</span>
            </div>
          </div>
        </app-card>

        <!-- Blockchain/Crypto Icons -->
        <app-card [hasHeader]="true" variant="elevated">
          <div slot="header">
            <h2 class="text-h3 font-semibold text-black-900">Blockchain & Crypto</h2>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'link']" class="text-primary-700"></fa-icon>
              <span>Blockchain</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'bolt']" class="text-yellow-600"></fa-icon>
              <span>Fast</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'chart-line']" class="text-green-800"></fa-icon>
              <span>Analytics</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'fire']" class="text-red-800"></fa-icon>
              <span>Trending</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'hashtag']" class="text-black-600"></fa-icon>
              <span>Tags</span>
            </div>
            <div class="icon-item">
              <fa-icon [icon]="['fas', 'globe']" class="text-blue-600"></fa-icon>
              <span>Network</span>
            </div>
          </div>
        </app-card>
      </div>
    </div>
  `,
  styles: [`
    .icon-item {
      @apply flex flex-col items-center justify-center p-4 bg-white-200 hover:bg-white-100;
      @apply rounded-md border border-white-300 transition-colors duration-200;
      @apply text-center cursor-pointer;
    }

    .icon-item fa-icon {
      @apply text-2xl mb-2;
    }

    .icon-item span {
      @apply text-label text-black-700 font-medium;
    }
  `]
})
export class IconShowcaseComponent {}