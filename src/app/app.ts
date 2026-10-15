import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { keycloak } from './keycloak';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** Cuando la aplicación llega aquí, init() ya ha terminado: el dato es definitivo. */
  protected readonly conSesion = keycloak.authenticated;
  /** El nombre viene dentro del token, ya decodificado por keycloak-js. */
  protected readonly nombre = keycloak.tokenParsed?.['name'];

  /** Se va a la página de acceso de Keycloak y, al volver, la aplicación arranca de nuevo. */
  protected entrar() {
    void keycloak.login();
  }

  /** Cierra la sesión en Keycloak (no solo en esta pestaña) y vuelve a la página de inicio. */
  protected salir() {
    void keycloak.logout({ redirectUri: location.origin });
  }
}
