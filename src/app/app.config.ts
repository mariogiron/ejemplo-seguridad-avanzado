import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { keycloak } from './keycloak';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Angular espera a que esta promesa termine antes de pintar nada
    provideAppInitializer(() =>
      keycloak.init({
        onLoad: 'check-sso', // ¿hay ya una sesión abierta? Si no, seguimos sin ella
        pkceMethod: 'S256', // Authorization Code con PKCE
        checkLoginIframe: false, // sin el iframe que vigila la sesión
      }),
    ),
  ],
};
