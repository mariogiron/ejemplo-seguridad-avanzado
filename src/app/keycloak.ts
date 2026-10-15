import Keycloak from 'keycloak-js';

/**
 * La única instancia de keycloak-js de la aplicación.
 * Los tres datos salen del realm: dónde está Keycloak, qué realm y qué cliente somos.
 */
export const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'curso',
  clientId: 'tablon',
});
