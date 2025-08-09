import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Crypto polyfill for WASM modules - only set if not already present
if (typeof window !== 'undefined' && window.crypto) {
  // Check if globalThis.crypto is writable or doesn't exist
  if (typeof globalThis !== 'undefined' && !globalThis.crypto) {
    try {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: window.crypto
      });
    } catch (e) {
      // Silently fail if we can't set it
    }
  }
  
  // Check if self.crypto is writable or doesn't exist
  if (typeof self !== 'undefined' && self !== window && !self.crypto) {
    try {
      Object.defineProperty(self, 'crypto', {
        configurable: true,
        value: window.crypto
      });
    } catch (e) {
      // Silently fail if we can't set it
    }
  }
}

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
