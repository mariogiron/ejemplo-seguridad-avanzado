import { HttpInterceptorFn } from '@angular/common/http';
import { keycloak } from './keycloak';

/** Pone el token en todas las peticiones a nuestra API. Las demás salen tal cual. */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/') || !keycloak.token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${keycloak.token}` } }));
};
