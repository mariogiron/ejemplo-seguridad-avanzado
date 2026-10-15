import { DatePipe, JsonPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { keycloak } from './keycloak';

@Component({
  selector: 'app-inicio',
  imports: [JsonPipe, DatePipe],
  template: `
    <h1>Inicio</h1>
    @if (publico.hasValue()) {
      <p>Hay {{ publico.value().mensajes }} mensajes en el tablón.</p>
    }

    @if (contenido) {
      <h2>Tu token por dentro</h2>
      <p>Lo que viaja: cabecera . contenido . firma</p>
      <p class="crudo">
        <span class="cabecera">{{ partes[0] }}</span
        >.<span class="contenido">{{ partes[1] }}</span
        >.<span class="firma">{{ partes[2] }}</span>
      </p>
      <p>Lo que lleva dentro el contenido (keycloak-js ya lo ha decodificado):</p>
      <pre>{{ contenido | json }}</pre>
      <p>Caduca a las {{ caduca | date: 'HH:mm:ss' }}.</p>
    } @else {
      <p>Para leerlos hay que entrar con un usuario del equipo.</p>
    }
  `,
  styles: `
    .crudo {
      font-family: monospace;
      word-break: break-all;
    }
    .cabecera {
      color: #b91c1c;
    }
    .contenido {
      color: #7c3aed;
    }
    .firma {
      color: #0369a1;
    }
    pre {
      background: #f3f4f6;
      padding: 12px;
    }
  `,
})
export class Inicio {
  /** Una ruta pública de la API: no pide token. */
  protected readonly publico = httpResource<{ mensajes: number }>(() => '/api/publico');

  /** El token tal cual, en sus tres trozos separados por puntos. */
  protected readonly partes = keycloak.token?.split('.') ?? [];
  /** El contenido del token, decodificado. Sin sesión es undefined. */
  protected readonly contenido = keycloak.tokenParsed;
  /** exp viene en segundos desde 1970; Date trabaja en milisegundos. */
  protected readonly caduca = (keycloak.tokenParsed?.exp ?? 0) * 1000;
}
