import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ColorMode = 'light' | 'dark';
export type ThemeStyle = 'default' | 'cyberpunk';

export interface ThemeConfig {
  colorMode: ColorMode;
  style: ThemeStyle;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  
  // Signals for reactive theme state
  private _colorMode = signal<ColorMode>('light');
  private _themeStyle = signal<ThemeStyle>('default');
  
  // Public readonly signals
  public readonly colorMode = this._colorMode.asReadonly();
  public readonly themeStyle = this._themeStyle.asReadonly();
  
  // Computed properties
  public readonly isDarkMode = signal(false);
  public readonly isCyberpunk = signal(false);

  constructor() {
    // Initialize theme from localStorage or system preference
    if (isPlatformBrowser(this.platformId)) {
      this.initializeTheme();
      
      // Effect to update DOM and localStorage when theme changes
      effect(() => {
        const colorMode = this._colorMode();
        const themeStyle = this._themeStyle();
        
        this.isDarkMode.set(colorMode === 'dark');
        this.isCyberpunk.set(themeStyle === 'cyberpunk');
        
        this.applyTheme({ colorMode, style: themeStyle });
        this.saveThemeToStorage({ colorMode, style: themeStyle });
      });
    }
  }

  private initializeTheme(): void {
    // Try to get saved theme config from localStorage
    const savedThemeStr = localStorage.getItem('theme-config');
    let savedTheme: ThemeConfig | null = null;
    
    if (savedThemeStr) {
      try {
        savedTheme = JSON.parse(savedThemeStr);
      } catch (e) {
        // Fallback for old theme format
        const oldTheme = localStorage.getItem('theme');
        if (oldTheme === 'light' || oldTheme === 'dark') {
          savedTheme = { colorMode: oldTheme, style: 'default' };
        }
      }
    }
    
    let initialConfig: ThemeConfig;
    if (savedTheme && this.isValidThemeConfig(savedTheme)) {
      initialConfig = savedTheme;
    } else {
      // Default to cyberpunk theme with dark mode
      initialConfig = { 
        colorMode: 'dark',
        style: 'cyberpunk'
      };
    }
    
    // Apply theme immediately to prevent flash
    this.applyTheme(initialConfig);
    this._colorMode.set(initialConfig.colorMode);
    this._themeStyle.set(initialConfig.style);
    this.isDarkMode.set(initialConfig.colorMode === 'dark');
    this.isCyberpunk.set(initialConfig.style === 'cyberpunk');

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        // Only auto-switch if user hasn't manually set a preference
        if (!localStorage.getItem('theme-config')) {
          this._colorMode.set(e.matches ? 'dark' : 'light');
        }
      });
  }

  private isValidThemeConfig(config: any): config is ThemeConfig {
    return config &&
           typeof config.colorMode === 'string' &&
           ['light', 'dark'].includes(config.colorMode) &&
           typeof config.style === 'string' &&
           ['default', 'cyberpunk'].includes(config.style);
  }

  private applyTheme(config: ThemeConfig): void {
    const root = document.documentElement;
    
    // Apply color mode (light/dark)
    if (config.colorMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Apply theme style
    if (config.style === 'cyberpunk') {
      root.classList.add('cyberpunk-theme');
    } else {
      root.classList.remove('cyberpunk-theme');
    }
  }

  private saveThemeToStorage(config: ThemeConfig): void {
    localStorage.setItem('theme-config', JSON.stringify(config));
  }

  // Public methods
  public toggleColorMode(): void {
    const newColorMode: ColorMode = this._colorMode() === 'light' ? 'dark' : 'light';
    this._colorMode.set(newColorMode);
  }

  public setColorMode(mode: ColorMode): void {
    this._colorMode.set(mode);
  }

  public setThemeStyle(style: ThemeStyle): void {
    this._themeStyle.set(style);
  }

  public setTheme(config: ThemeConfig): void {
    this._colorMode.set(config.colorMode);
    this._themeStyle.set(config.style);
  }

  public getCurrentTheme(): ThemeConfig {
    return {
      colorMode: this._colorMode(),
      style: this._themeStyle()
    };
  }

  // Legacy method for backward compatibility
  public toggleTheme(): void {
    this.toggleColorMode();
  }

  // Helper method to get theme-aware color classes
  public getThemeClasses(lightClass: string, darkClass: string): string {
    return `${lightClass} dark:${darkClass}`;
  }
}