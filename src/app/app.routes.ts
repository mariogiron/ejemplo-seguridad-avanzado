import { Routes } from '@angular/router';
import { conSesion } from './guards';
import { Inicio } from './inicio';
import { Mensajes } from './mensajes';

export const routes: Routes = [
  { path: '', component: Inicio, title: 'Tablón' },
  { path: 'mensajes', component: Mensajes, title: 'Mensajes · Tablón', canActivate: [conSesion] },
];
