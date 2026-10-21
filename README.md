# Angular Avanzado · Módulo 4 · Autenticación con Keycloak desde cero

Una aplicación pequeña, el **Tablón**, que empieza recién salida de `ng new` y a la que se le añade, paso a paso, el inicio de sesión con Keycloak (OpenID Connect, Authorization Code con PKCE) usando solo `keycloak-js`.

## Arrancar

Tres terminales:

```
node servidores/keycloak-local.mjs     # Keycloak de bolsillo: realm curso, usuarios ana y ramon, contraseña curso
node servidores/api.mjs                # API del tablón en http://localhost:3000
npm start                              # la aplicación en http://localhost:4200 (la API va por el proxy /api)
```

`VIDA=20 node servidores/keycloak-local.mjs` da tokens de 20 segundos, para ver la caducidad sin esperar.

El Keycloak de bolsillo es un simulador para clase de lo que keycloak-js usa de Keycloak. No es Keycloak ni es seguro. Con Docker, `docker compose up` arranca un Keycloak de verdad con el realm de `keycloak/curso-realm.json` (no arranques los dos a la vez: comparten el puerto 8080).

La aplicación tiene que estar en `localhost:4200`: es la dirección a la que el realm deja volver.

Para comprobar el proxy, abre http://localhost:4200/api/publico: tiene que salir `{"mensajes":5}`. Si sale el HTML de la aplicación (y en Mensajes, «La API contesta 200: undefined»), ng serve no está usando `proxy.conf.json`: reinícialo y comprueba que `"options": { "proxyConfig": "proxy.conf.json" }` está en el bloque `serve` de `angular.json`.

## Usuarios

| Usuario | Contraseña | Roles              |
| ------- | ---------- | ------------------ |
| `ana`   | `curso`    | `usuario`          |
| `ramon` | `curso`    | `usuario`, `admin` |

## API

| Ruta                       | Pide                    |
| -------------------------- | ----------------------- |
| `GET /api/publico`         | Nada                    |
| `GET /api/mensajes`        | Un token válido (o 401) |
| `DELETE /api/mensajes/:id` | El rol `admin` (o 403)  |

## Etiquetas

`git checkout <etiqueta>` deja el código en ese paso; `git checkout main` vuelve al final.

| Etiqueta              | Paso                                                         |
| --------------------- | ------------------------------------------------------------ |
| `paso-0-ng-new`       | Lo que genera `ng new`, sin tocar                            |
| `paso-1-partida`      | Inicio, Mensajes, el proxy y los servidores: la API dice 401 |
| `paso-2-keycloak`     | `keycloak-js`: la instancia e `init()` antes de arrancar     |
| `paso-3-entrar-salir` | Entrar, Salir y el nombre que viene en el token              |
| `paso-4-ver-token`    | El token por dentro, en la página de inicio                  |
| `paso-5-token-a-mano` | El token a mano en la cabecera `Authorization`               |
| `paso-6-interceptor`  | Un interceptor pone el token en cada petición a `/api/`      |
| `paso-7-caducidad`    | `updateToken(10)` antes de cada petición                     |
| `paso-8-guard`        | La ruta Mensajes pide sesión                                 |
| `paso-9-borrar`       | Borrar: la API exige el rol `admin`                          |
| `paso-10-ocultar`     | El botón Borrar solo para quien tiene el rol `admin`         |
