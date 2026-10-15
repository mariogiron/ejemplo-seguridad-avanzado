import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';

@Component({
  selector: 'app-inicio',
  template: `
    <h1>Inicio</h1>
    @if (publico.hasValue()) {
      <p>Hay {{ publico.value().mensajes }} mensajes en el tablón.</p>
    }
    <p>Para leerlos hay que entrar con un usuario del equipo.</p>
  `,
})
export class Inicio {
  /** Una ruta pública de la API: no pide token. */
  protected readonly publico = httpResource<{ mensajes: number }>(() => '/api/publico');
}
