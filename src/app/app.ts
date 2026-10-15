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
}
