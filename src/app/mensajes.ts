import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';

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
    @if (aviso()) {
      <p class="aviso">{{ aviso() }}</p>
    }
    @if (mensajes.hasValue()) {
      <ul>
        @for (mensaje of mensajes.value(); track mensaje.id) {
          <li>
            <strong>{{ mensaje.autor }}</strong
            >: {{ mensaje.texto }}
            <button (click)="borrar(mensaje)">Borrar</button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .error {
      color: #b91c1c;
    }
    .aviso {
      color: #92400e;
    }
    li {
      margin: 8px 0;
    }
  `,
})
export class Mensajes {
  private readonly http = inject(HttpClient);

  /** Una ruta protegida de la API: el interceptor pone el token. */
  protected readonly mensajes = httpResource<Mensaje[]>(() => '/api/mensajes');

  /** El código de estado y el motivo que da la API, si algo ha ido mal. */
  protected readonly error = computed(() => {
    const error = this.mensajes.error();
    return error instanceof HttpErrorResponse ? `${error.status}: ${error.error?.error}` : '';
  });

  /** Lo que ha pasado al borrar. */
  protected readonly aviso = signal('');

  /** Borrar pide el rol admin en la API. */
  protected borrar(mensaje: Mensaje) {
    this.http.delete(`/api/mensajes/${mensaje.id}`).subscribe({
      next: () => {
        this.aviso.set(`Borrado el mensaje de ${mensaje.autor}`);
        this.mensajes.reload();
      },
      error: (error: HttpErrorResponse) =>
        this.aviso.set(`No se ha borrado. La API contesta ${error.status}: ${error.error?.error}`),
    });
  }
}
