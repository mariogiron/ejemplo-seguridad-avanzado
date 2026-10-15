import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap } from 'rxjs';
import { keycloak } from './keycloak';

/** Pone un token vigente en todas las peticiones a nuestra API. Las demás salen tal cual. */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || !keycloak.authenticated) {
    return next(req);
  }
  // tokenVigente() es una promesa; from() la convierte en observable para encadenar la petición
  return from(tokenVigente()).pipe(
    switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
  );
};

/** Si al token le quedan menos de 10 segundos, pide otro antes de usarlo. */
async function tokenVigente(): Promise<string | undefined> {
  try {
    await keycloak.updateToken(10);
  } catch {
    // Ni con el token de refresco: la sesión de Keycloak ya no existe. Hay que volver a entrar.
    await keycloak.login();
  }
  return keycloak.token;
}
