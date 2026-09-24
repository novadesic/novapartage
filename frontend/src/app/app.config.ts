import { ApplicationConfig, APP_INITIALIZER, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

registerLocaleData(localeFr);

import { routes } from './app.routes';
import { EnvironmentService } from './services/environment.service';
import { UnifiedAuthService } from './services/unified-auth.service';
import { ThemeService } from './services/theme.service';
import { initializeUnifiedAuth } from './app.init';
import { authInterceptor } from './interceptors/auth-functional.interceptor';
import { csrfInterceptor } from './interceptors/csrf.interceptor';
import { rateLimitInterceptor } from './interceptors/rate-limit.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, csrfInterceptor, rateLimitInterceptor])),
    UnifiedAuthService,
    EnvironmentService,
    ThemeService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUnifiedAuth,
      multi: true,
      deps: [UnifiedAuthService, EnvironmentService]
    }
  ]
};
