import { CanActivateFn } from '@angular/router';
import { keycloak } from './keycloak';

/** Sin sesión no se entra en la ruta: se va a la página de acceso y se vuelve a ella. */
export const conSesion: CanActivateFn = (_ruta, estado) => {
  if (keycloak.authenticated) {
    return true;
  }
  void keycloak.login({ redirectUri: location.origin + estado.url });
  return false;
};
