import { HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';

interface Mensaje {
  id: number;
  autor: string;
  texto: string;
}

@Component({
  selector: 'app-mensajes',
  template: `
    <h1>Mensajes</h1>
    <button (click)="mensajes.reload()">Recargar</button>

    @if (error()) {
      <p class="error">La API contesta {{ error() }}</p>
    }
    @if (mensajes.hasValue()) {
      <ul>
        @for (mensaje of mensajes.value(); track mensaje.id) {
          <li>
            <strong>{{ mensaje.autor }}</strong
            >: {{ mensaje.texto }}
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .error {
      color: #b91c1c;
    }
  `,
})
export class Mensajes {
  /** Una ruta protegida de la API: sin token, contesta 401. */
  protected readonly mensajes = httpResource<Mensaje[]>(() => '/api/mensajes');

  /** El código de estado y el motivo que da la API, si algo ha ido mal. */
  protected readonly error = computed(() => {
    const error = this.mensajes.error();
    return error instanceof HttpErrorResponse ? `${error.status}: ${error.error?.error}` : '';
  });
}
