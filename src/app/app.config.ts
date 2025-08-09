import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { initializeFontAwesome } from './shared/font-awesome';
import { provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';

export function initializeFontAwesomeFactory(library: FaIconLibrary) {
  return () => {
    initializeFontAwesome(library);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideMarkdown(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeFontAwesomeFactory,
      deps: [FaIconLibrary],
      multi: true
    }
  ]
};
