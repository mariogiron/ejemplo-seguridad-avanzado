// «Keycloak de bolsillo»: un servidor OpenID Connect mínimo para practicar sin Docker.
// Imita lo que usa keycloak-js del realm «curso» de Keycloak: acceso con código y PKCE,
// refresco, cierre de sesión y claves públicas. Solo para clase: no es Keycloak ni es seguro.
// Arranca con: node servidores/keycloak-local.mjs
import crypto from 'node:crypto';
import http from 'node:http';

const PUERTO = Number(process.env.PUERTO ?? 8080);
/** Segundos de vida del token de acceso. Como el accessTokenLifespan del realm. */
const VIDA = Number(process.env.VIDA ?? 60);
/** Minutos sin actividad que aguanta la sesión. Como el ssoSessionIdleTimeout del realm. */
const INACTIVIDAD = 30 * 60;
const REALM = 'curso';
const EMISOR = `http://localhost:${PUERTO}/realms/${REALM}`;
const CLIENTE = 'tablon';
const APLICACION = 'http://localhost:4200';

const USUARIOS = {
  ana: { nombre: 'Ana', apellidos: 'González', roles: ['usuario'] },
  ramon: { nombre: 'Ramón', apellidos: 'Ruiz', roles: ['usuario', 'admin'] },
};
const CONTRASENA = 'curso';

// ---------- Claves y tokens ----------

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = crypto.randomBytes(8).toString('hex');
const b64url = (datos) => Buffer.from(datos).toString('base64url');

function firmar(contenido) {
  const cabecera = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KID }));
  const cuerpo = b64url(JSON.stringify(contenido));
  const firma = crypto.sign('RSA-SHA256', Buffer.from(`${cabecera}.${cuerpo}`), privateKey);
  return `${cabecera}.${cuerpo}.${b64url(firma)}`;
}

const sesiones = new Map(); // id de sesión → { usuario, ultimaActividad }
const codigos = new Map(); // código → { sesion, desafio, redirectUri, nonce, caduca }
const refrescos = new Map(); // token de refresco → id de sesión (cada uno sirve una vez)

function emitirTokens(idSesion, nonce) {
  const sesion = sesiones.get(idSesion);
  sesion.ultimaActividad = Date.now();
  const datos = USUARIOS[sesion.usuario];
  const ahora = Math.floor(Date.now() / 1000);
  const comun = { iss: EMISOR, sub: `usuario-${sesion.usuario}`, iat: ahora, sid: idSesion };
  const persona = {
    name: `${datos.nombre} ${datos.apellidos}`,
    given_name: datos.nombre,
    family_name: datos.apellidos,
    preferred_username: sesion.usuario,
    email: `${sesion.usuario}@example.com`,
    email_verified: true,
  };
  // En Keycloak el token de refresco también es un JWT, y keycloak-js lo decodifica.
  const refresco = firmar({
    ...comun,
    exp: ahora + INACTIVIDAD,
    jti: crypto.randomUUID(),
    typ: 'Refresh',
    azp: CLIENTE,
  });
  refrescos.set(refresco, idSesion);
  return {
    access_token: firmar({
      ...comun,
      exp: ahora + VIDA,
      jti: crypto.randomUUID(),
      typ: 'Bearer',
      azp: CLIENTE,
      scope: 'openid profile email',
      realm_access: { roles: datos.roles },
      ...persona,
    }),
    id_token: firmar({ ...comun, exp: ahora + VIDA, aud: CLIENTE, typ: 'ID', nonce, ...persona }),
    refresh_token: refresco,
    token_type: 'Bearer',
    expires_in: VIDA,
    refresh_expires_in: INACTIVIDAD,
    session_state: idSesion,
    scope: 'openid profile email',
  };
}

function sesionViva(idSesion) {
  const sesion = sesiones.get(idSesion);
  if (sesion && Date.now() - sesion.ultimaActividad < INACTIVIDAD * 1000) {
    return true;
  }
  sesiones.delete(idSesion);
  return false;
}

// ---------- Utilidades HTTP ----------

const cookies = (req) =>
  Object.fromEntries((req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')));

async function leerFormulario(req) {
  let texto = '';
  for await (const trozo of req) texto += trozo;
  return Object.fromEntries(new URLSearchParams(texto));
}

function redirigir(res, url, cabeceras = {}) {
  res.writeHead(302, { location: url, ...cabeceras });
  res.end();
}

function json(res, estado, cuerpo) {
  res.writeHead(estado, {
    'content-type': 'application/json',
    'access-control-allow-origin': APLICACION,
    'access-control-allow-credentials': 'true',
  });
  res.end(JSON.stringify(cuerpo));
}

/** Devuelve el navegador a la aplicación con el resultado en el fragmento (response_mode=fragment). */
function volver(res, params, resultado, cabeceras) {
  const datos = new URLSearchParams({ ...resultado, state: params.state ?? '', iss: EMISOR });
  redirigir(res, `${params.redirect_uri}#${datos}`, cabeceras);
}

function emitirCodigo(idSesion, params) {
  const codigo = crypto.randomBytes(16).toString('hex');
  codigos.set(codigo, {
    sesion: idSesion,
    desafio: params.code_challenge,
    redirectUri: params.redirect_uri,
    nonce: params.nonce,
    caduca: Date.now() + 60_000,
  });
  return codigo;
}

function paginaDeAcceso(params, error = '') {
  const ocultos = Object.entries(params)
    .map(
      ([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`,
    )
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acceso · Tablón</title>
<style>body{font-family:system-ui;background:#f2f4f7;display:grid;place-items:center;height:100vh;margin:0}
form{background:#fff;padding:32px;border-radius:8px;box-shadow:0 2px 8px #0002;width:300px}
input[type=text],input[type=password]{width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box}
button{width:100%;padding:10px;background:#1f6feb;color:#fff;border:0;border-radius:6px}
.error{color:#cf222e}.nota{color:#57606a;font-size:.85em}</style></head><body>
<form method="post" action="/realms/${REALM}/login-actions/authenticate">
<h2>Tablón · Angular Avanzado</h2><p class="nota">Keycloak de bolsillo · realm ${REALM}</p>
${error ? `<p class="error">${error}</p>` : ''}
<label>Usuario<input type="text" name="username" autofocus></label>
<label>Contraseña<input type="password" name="password"></label>
${ocultos}<button type="submit">Entrar</button>
<p class="nota">Usuarios: ana y ramon · contraseña: curso</p></form></body></html>`;
}

// ---------- Rutas ----------

const BASE = `/realms/${REALM}/protocol/openid-connect`;

async function atender(req, res) {
  const url = new URL(req.url, EMISOR);
  const ruta = url.pathname;
  const params = Object.fromEntries(url.searchParams);
  const registrar = (texto) => console.log(`[keycloak] ${req.method} ${ruta} → ${texto}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': APLICACION,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type, accept',
    });
    return res.end();
  }

  if (ruta === `/realms/${REALM}/.well-known/openid-configuration`) {
    return json(res, 200, {
      issuer: EMISOR,
      authorization_endpoint: `${EMISOR}/protocol/openid-connect/auth`,
      token_endpoint: `${EMISOR}/protocol/openid-connect/token`,
      end_session_endpoint: `${EMISOR}/protocol/openid-connect/logout`,
      jwks_uri: `${EMISOR}/protocol/openid-connect/certs`,
      code_challenge_methods_supported: ['S256'],
    });
  }

  if (ruta === `${BASE}/certs`) {
    return json(res, 200, {
      keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' }],
    });
  }

  // Paso 1: la aplicación manda aquí el navegador
  if (ruta === `${BASE}/auth`) {
    if (params.client_id !== CLIENTE || !params.redirect_uri?.startsWith(`${APLICACION}/`)) {
      registrar('400 redirect_uri o client_id no válidos');
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Invalid parameter: redirect_uri');
    }
    if (params.code_challenge_method !== 'S256' || !params.code_challenge) {
      registrar('error: falta PKCE');
      return volver(res, params, {
        error: 'invalid_request',
        error_description: 'Missing parameter: code_challenge_method',
      });
    }
    const idSesion = cookies(req).KEYCLOAK_IDENTITY;
    if (idSesion && sesionViva(idSesion)) {
      registrar(`código para ${sesiones.get(idSesion).usuario} (sesión ya abierta)`);
      return volver(res, params, { session_state: idSesion, code: emitirCodigo(idSesion, params) });
    }
    if (params.prompt === 'none') {
      registrar('login_required (prompt=none y no hay sesión)');
      return volver(res, params, { error: 'login_required' });
    }
    registrar('página de acceso');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(paginaDeAcceso(params));
  }

  // Paso 2: la persona escribe usuario y contraseña en una página de Keycloak
  if (ruta === `/realms/${REALM}/login-actions/authenticate` && req.method === 'POST') {
    const { username, password, ...resto } = await leerFormulario(req);
    if (!USUARIOS[username] || password !== CONTRASENA) {
      registrar(`contraseña incorrecta para «${username}»`);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(paginaDeAcceso(resto, 'Usuario o contraseña incorrectos.'));
    }
    const idSesion = crypto.randomUUID();
    sesiones.set(idSesion, { usuario: username, ultimaActividad: Date.now() });
    registrar(`sesión abierta para ${username}`);
    // Paso 3: vuelta a la aplicación con un código de un solo uso
    return volver(
      res,
      resto,
      { session_state: idSesion, code: emitirCodigo(idSesion, resto) },
      {
        'set-cookie': `KEYCLOAK_IDENTITY=${idSesion}; Path=/realms/${REALM}/; HttpOnly; SameSite=Lax`,
      },
    );
  }

  // Pasos 4 y 5: canje del código, y refresco
  if (ruta === `${BASE}/token` && req.method === 'POST') {
    const datos = await leerFormulario(req);
    if (datos.grant_type === 'authorization_code') {
      const codigo = codigos.get(datos.code);
      codigos.delete(datos.code);
      const huella = crypto
        .createHash('sha256')
        .update(datos.code_verifier ?? '')
        .digest('base64url');
      if (!codigo || codigo.caduca < Date.now() || codigo.redirectUri !== datos.redirect_uri) {
        registrar('400 invalid_grant (código no válido)');
        return json(res, 400, { error: 'invalid_grant', error_description: 'Code not valid' });
      }
      if (huella !== codigo.desafio) {
        registrar('400 invalid_grant (PKCE no coincide)');
        return json(res, 400, {
          error: 'invalid_grant',
          error_description: 'PKCE verification failed',
        });
      }
      registrar(`tokens para ${sesiones.get(codigo.sesion).usuario} (canje del código)`);
      return json(res, 200, emitirTokens(codigo.sesion, codigo.nonce));
    }
    if (datos.grant_type === 'refresh_token') {
      const idSesion = refrescos.get(datos.refresh_token);
      refrescos.delete(datos.refresh_token);
      if (!idSesion || !sesionViva(idSesion)) {
        registrar('400 invalid_grant (la sesión ya no existe)');
        return json(res, 400, { error: 'invalid_grant', error_description: 'Session not active' });
      }
      registrar(`tokens para ${sesiones.get(idSesion).usuario} (refresco)`);
      return json(res, 200, emitirTokens(idSesion));
    }
    return json(res, 400, { error: 'unsupported_grant_type' });
  }

  // Cerrar la sesión (keycloak-js usa GET por defecto; también se admite POST)
  if (ruta === `${BASE}/logout`) {
    const datos = req.method === 'POST' ? await leerFormulario(req) : params;
    const idSesion = cookies(req).KEYCLOAK_IDENTITY;
    if (idSesion) {
      registrar(`sesión cerrada (${sesiones.get(idSesion)?.usuario ?? 'ya no existía'})`);
      sesiones.delete(idSesion);
    }
    const destino = datos.post_logout_redirect_uri?.startsWith(APLICACION)
      ? datos.post_logout_redirect_uri
      : APLICACION;
    return redirigir(res, destino, {
      'set-cookie': `KEYCLOAK_IDENTITY=; Path=/realms/${REALM}/; HttpOnly; Max-Age=0`,
    });
  }

  if (ruta === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  registrar('404');
  res.writeHead(404);
  res.end();
}

http
  .createServer((req, res) =>
    atender(req, res).catch((error) => {
      console.error(error);
      res.writeHead(500);
      res.end();
    }),
  )
  .listen(PUERTO, () =>
    console.log(
      `Keycloak de bolsillo en ${EMISOR} · token de acceso: ${VIDA} s · usuarios: ana, ramon (curso)`,
    ),
  );
