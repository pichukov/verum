import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      [class]="getButtonClasses()"
      [disabled]="disabled || loading"
      [type]="type">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .btn {
      @apply inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200;
      @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .btn-primary {
      @apply bg-kaspa-600 hover:bg-kaspa-700 active:bg-kaspa-800 focus:ring-kaspa-500 text-white;
      @apply dark:bg-kaspa-600-dark dark:hover:bg-kaspa-700-dark dark:active:bg-kaspa-800-dark dark:focus:ring-kaspa-600-dark;
    }

    /* Cyberpunk primary button styles */
    :host-context(.cyberpunk-theme) .btn-primary {
      @apply bg-cyber-dark-2 border-2 border-neon-cyan text-neon-cyan font-tech uppercase tracking-wider;
      @apply hover:bg-neon-cyan hover:text-black-900 hover:border-neon-cyan;
      @apply focus:ring-neon-cyan/50;
      position: relative;
      overflow: hidden;
      transition: all 0.3s ease;
      
      /* Glitch overlay effects */
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: 
          linear-gradient(90deg, transparent 0%, rgba(255, 0, 255, 0.1) 25%, transparent 50%, rgba(0, 255, 255, 0.1) 75%, transparent 100%);
        opacity: 0;
        z-index: -1;
        transition: opacity 0.3s ease;
      }
      
      /* Digital noise overlay */
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
          radial-gradient(circle at 25% 25%, rgba(255, 0, 255, 0.2) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(0, 255, 255, 0.2) 0%, transparent 50%),
          radial-gradient(circle at 75% 25%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 25% 75%, rgba(176, 38, 255, 0.1) 0%, transparent 50%);
        opacity: 0;
        z-index: -1;
        transition: opacity 0.3s ease;
      }
      
      &:hover {
        box-shadow: 
          0 0 20px rgba(0, 255, 255, 0.6),
          0 0 40px rgba(0, 255, 255, 0.4),
          inset 0 0 20px rgba(0, 255, 255, 0.1);
        animation: button-glitch 0.8s ease-in-out;
        
        &::before {
          opacity: 1;
          animation: glitch-bars 0.8s ease-in-out;
        }
        
        &::after {
          opacity: 1;
          animation: digital-noise 0.8s ease-in-out;
        }
      }
      
      &:active {
        transform: scale(0.98);
        animation: button-glitch-intense 0.3s ease-in-out;
      }
    }

    /* Glitch animations */
    @keyframes button-glitch {
      0%, 100% { 
        transform: translate(0);
        filter: hue-rotate(0deg) contrast(1);
      }
      5% { 
        transform: translate(-1px, 1px);
        filter: hue-rotate(90deg) contrast(1.1);
      }
      10% { 
        transform: translate(1px, -1px);
        filter: hue-rotate(180deg) contrast(0.9);
      }
      15% { 
        transform: translate(-1px, -1px);
        filter: hue-rotate(270deg) contrast(1.2);
      }
      20% { 
        transform: translate(1px, 1px);
        filter: hue-rotate(0deg) contrast(1);
      }
      40% { 
        transform: translate(0px, -1px);
        filter: hue-rotate(45deg) contrast(1.1) saturate(1.2);
      }
      60% { 
        transform: translate(-1px, 0px);
        filter: hue-rotate(180deg) contrast(0.8) saturate(1.5);
      }
      80% { 
        transform: translate(1px, 0px);
        filter: hue-rotate(270deg) contrast(1.3);
      }
    }

    @keyframes glitch-bars {
      0%, 100% {
        transform: translateX(0%);
        opacity: 0;
      }
      10% {
        transform: translateX(-100%);
        opacity: 0.8;
      }
      20% {
        transform: translateX(100%);
        opacity: 0.6;
      }
      30% {
        transform: translateX(-50%);
        opacity: 0.9;
      }
      40% {
        transform: translateX(75%);
        opacity: 0.4;
      }
      50% {
        transform: translateX(-25%);
        opacity: 0.7;
      }
      60% {
        transform: translateX(50%);
        opacity: 0.8;
      }
      70% {
        transform: translateX(-75%);
        opacity: 0.5;
      }
      80% {
        transform: translateX(25%);
        opacity: 0.9;
      }
      90% {
        transform: translateX(-10%);
        opacity: 0.6;
      }
    }

    @keyframes digital-noise {
      0%, 100% {
        transform: scale(1) rotate(0deg);
        opacity: 0;
      }
      10% {
        transform: scale(1.1) rotate(1deg);
        opacity: 0.3;
      }
      20% {
        transform: scale(0.9) rotate(-1deg);
        opacity: 0.6;
      }
      30% {
        transform: scale(1.05) rotate(0.5deg);
        opacity: 0.4;
      }
      40% {
        transform: scale(0.95) rotate(-0.5deg);
        opacity: 0.8;
      }
      50% {
        transform: scale(1.02) rotate(0.2deg);
        opacity: 0.5;
      }
      60% {
        transform: scale(0.98) rotate(-0.2deg);
        opacity: 0.7;
      }
      70% {
        transform: scale(1.01) rotate(0.1deg);
        opacity: 0.3;
      }
      80% {
        transform: scale(0.99) rotate(-0.1deg);
        opacity: 0.6;
      }
      90% {
        transform: scale(1.005) rotate(0.05deg);
        opacity: 0.4;
      }
    }

    @keyframes button-glitch-intense {
      0%, 100% { 
        transform: scale(0.98) translate(0);
        filter: contrast(1) saturate(1);
      }
      20% { 
        transform: scale(0.98) translate(-1px, 1px);
        filter: contrast(1.4) saturate(1.3) hue-rotate(90deg);
      }
      40% { 
        transform: scale(0.98) translate(1px, -1px);
        filter: contrast(0.8) saturate(1.8) hue-rotate(180deg);
      }
      60% { 
        transform: scale(0.98) translate(-1px, -1px);
        filter: contrast(1.6) saturate(0.7) hue-rotate(270deg);
      }
      80% { 
        transform: scale(0.98) translate(1px, 1px);
        filter: contrast(1.2) saturate(1.4) hue-rotate(45deg);
      }
    }

    .btn-secondary {
      @apply bg-white-400 dark:bg-black-700 text-black-800 dark:text-white-200;
      @apply hover:bg-white-300 dark:hover:bg-black-600 active:bg-white-200 dark:active:bg-black-800;
      @apply border border-white-400 dark:border-black-700 focus:ring-kaspa-500;
    }

    .btn-ghost {
      @apply bg-transparent text-black-800 dark:text-white-200;
      @apply hover:bg-white-200 dark:hover:bg-black-800 active:bg-white-300 dark:active:bg-black-700;
      @apply focus:ring-kaspa-500;
    }

    .btn-sm {
      @apply px-3 py-1.5 text-body h-8;
    }

    .btn-md {
      @apply px-4 py-2.5 text-body h-10;
    }

    .btn-lg {
      @apply px-6 py-3 text-h5 h-12;
    }
  `]
})
export class ButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'ghost' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  getButtonClasses(): string {
    return [
      'btn',
      `btn-${this.variant}`,
      `btn-${this.size}`
    ].join(' ');
  }
}