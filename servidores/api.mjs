// API de prácticas del módulo 4: un tablón de mensajes.
// Comprueba los tokens de Keycloak sin ninguna librería, solo con lo que trae Node.
// Arranca con: node servidores/api.mjs
import crypto from 'node:crypto';
import http from 'node:http';

const PUERTO = Number(process.env.PUERTO ?? 3000);
/** Quién tiene que haber emitido el token: el realm «curso» de Keycloak. */
const EMISOR = process.env.EMISOR ?? 'http://localhost:8080/realms/curso';

let mensajes = [
  { id: 1, autor: 'Ana', texto: 'El jueves no hay reunión de equipo.' },
  { id: 2, autor: 'Ramón', texto: 'Nueva versión desplegada en preproducción.' },
  { id: 3, autor: 'Laura', texto: '¿Alguien tiene el cargador del portátil gris?' },
  { id: 4, autor: 'Carlos', texto: 'Recordad rellenar las horas antes del viernes.' },
  { id: 5, autor: 'Marta', texto: 'Hay tarta en la cocina 🎂' },
];

// ---------- Validación del token ----------

class ErrorDeAcceso extends Error {
  constructor(estado, mensaje, quien) {
    super(mensaje);
    this.estado = estado;
    this.quien = quien;
  }
}

/** Claves públicas del realm, por identificador. Se piden a Keycloak la primera vez. */
let claves = new Map();

async function clavePublica(kid) {
  if (!claves.has(kid)) {
    const respuesta = await fetch(`${EMISOR}/protocol/openid-connect/certs`);
    const { keys } = await respuesta.json();
    claves = new Map(
      keys.map((jwk) => [jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })]),
    );
  }
  return claves.get(kid);
}

const leer = (parte) => JSON.parse(Buffer.from(parte, 'base64url').toString());

/** Devuelve el contenido del token si es válido. Si no, lanza un 401. */
async function validar(req) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    throw new ErrorDeAcceso(401, 'Falta la cabecera Authorization: Bearer <token>');
  }
  const [cabecera, contenido, firma] = token.split('.');
  if (!firma) {
    throw new ErrorDeAcceso(401, 'El token no tiene forma de JWT');
  }

  // 1. La firma: ¿lo ha emitido de verdad nuestro Keycloak y nadie lo ha tocado?
  const { alg, kid } = leer(cabecera);
  const clave = alg === 'RS256' ? await clavePublica(kid) : undefined;
  const datos = Buffer.from(`${cabecera}.${contenido}`);
  if (!clave || !crypto.verify('RSA-SHA256', datos, clave, Buffer.from(firma, 'base64url'))) {
    throw new ErrorDeAcceso(401, 'La firma del token no es válida');
  }

  // 2. El contenido: ¿es de nuestro realm y sigue vigente?
  const datosDelToken = leer(contenido);
  if (datosDelToken.iss !== EMISOR) {
    throw new ErrorDeAcceso(401, 'El token es de otro emisor');
  }
  if (datosDelToken.exp * 1000 < Date.now()) {
    throw new ErrorDeAcceso(401, 'El token ha caducado');
  }
  return datosDelToken;
}

/** Autenticación (401: ¿quién eres?) y autorización (403: ¿puedes?) son preguntas distintas. */
async function exigirRol(req, rol) {
  const token = await validar(req);
  if (!token.realm_access?.roles.includes(rol)) {
    throw new ErrorDeAcceso(403, `Hace falta el rol ${rol}`, token.preferred_username);
  }
  return token;
}

// ---------- Rutas ----------

async function atender(req) {
  const { pathname } = new URL(req.url, 'http://localhost');

  // Pública: no pide token
  if (req.method === 'GET' && pathname === '/api/publico') {
    return { estado: 200, cuerpo: { mensajes: mensajes.length } };
  }

  // Cualquier persona con sesión
  if (req.method === 'GET' && pathname === '/api/mensajes') {
    const token = await validar(req);
    return { estado: 200, cuerpo: mensajes, quien: token.preferred_username };
  }

  // Solo con el rol admin
  const borrado = /^\/api\/mensajes\/(\d+)$/.exec(pathname);
  if (req.method === 'DELETE' && borrado) {
    const token = await exigirRol(req, 'admin');
    const mensaje = mensajes.find((m) => m.id === Number(borrado[1]));
    if (!mensaje) {
      return { estado: 404, cuerpo: { error: 'No existe ese mensaje' } };
    }
    mensajes = mensajes.filter((m) => m !== mensaje);
    return { estado: 200, cuerpo: mensaje, quien: token.preferred_username };
  }

  return { estado: 404, cuerpo: { error: 'No existe esa ruta' } };
}

http
  .createServer(async (req, res) => {
    let resultado;
    try {
      resultado = await atender(req);
    } catch (error) {
      const estado = error instanceof ErrorDeAcceso ? error.estado : 500;
      resultado = { estado, cuerpo: { error: error.message }, quien: error.quien };
    }
    const { estado, cuerpo, quien = 'anónimo' } = resultado;
    console.log(
      `[api] ${req.method} ${req.url} → ${estado} (${quien})${estado >= 400 ? ` ${cuerpo.error}` : ''}`,
    );
    res.writeHead(estado, { 'content-type': 'application/json' });
    res.end(JSON.stringify(cuerpo));
  })
  .listen(PUERTO, () =>
    console.log(`API del tablón en http://localhost:${PUERTO} · emisor ${EMISOR}`),
  );
