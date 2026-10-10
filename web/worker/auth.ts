import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import type { Ctx, Env } from './comun'

// Login con Google (OpenID Connect, flujo "authorization code"). El ADMIN da de alta al usuario por
// email; en su primer login se guarda `google_sub` y desde entonces se identifica por ese valor.
// La sesión es un JWT firmado con SESSION_SECRET en una cookie HttpOnly. Cada petición vuelve a
// consultar `usuario`, así que desactivar a un usuario le corta el acceso de inmediato.

export const COOKIE_SESION = 'gt_sesion'
const COOKIE_OAUTH = 'gt_oauth'
const DURACION_SESION = 7 * 24 * 3600 // segundos
const DURACION_OAUTH = 10 * 60

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const GOOGLE_ISS = ['https://accounts.google.com', 'accounts.google.com']

const ahora = () => Math.floor(Date.now() / 1000)
const aleatorio = () => crypto.randomUUID().replaceAll('-', '')
const esHttps = (c: Ctx) => new URL(c.req.url).protocol === 'https:'
const redirectUri = (c: Ctx) => new URL('/api/auth/callback', c.req.url).toString()
/** Solo rutas locales, para no convertir `volver` en un redirect abierto. */
const rutaLocal = (v: string | undefined) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/')

/** Id del usuario de la cookie de sesión, o null si no hay sesión válida. */
export async function usuarioDeSesion(c: Ctx): Promise<number | null> {
  const token = getCookie(c, COOKIE_SESION)
  if (!token || !c.env.SESSION_SECRET) return null
  try {
    const p = await verify(token, c.env.SESSION_SECRET, 'HS256')
    return typeof p.uid === 'number' ? p.uid : null
  } catch {
    return null
  }
}

const auth = new Hono<Env>()

// Redirige a Google. `state` (anti-CSRF) y `nonce` (anti-replay del ID token) viajan en una cookie firmada.
auth.get('/auth/login', async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SESSION_SECRET) return c.redirect('/login?error=config')
  const state = aleatorio()
  const nonce = aleatorio()
  const volver = rutaLocal(c.req.query('volver'))
  setCookie(c, COOKIE_OAUTH, await sign({ state, nonce, volver, exp: ahora() + DURACION_OAUTH }, SESSION_SECRET), {
    path: '/api/auth',
    httpOnly: true,
    secure: esHttps(c),
    sameSite: 'Lax',
    maxAge: DURACION_OAUTH,
  })
  const url = new URL(GOOGLE_AUTH)
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(c),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  }).toString()
  return c.redirect(url.toString())
})

auth.get('/auth/callback', async (c) => {
  const fallo = (codigo: string) => c.redirect(`/login?error=${codigo}`)
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SESSION_SECRET) return fallo('config')

  const cookie = getCookie(c, COOKIE_OAUTH)
  deleteCookie(c, COOKIE_OAUTH, { path: '/api/auth', secure: esHttps(c) })
  if (c.req.query('error')) return fallo('cancelado')
  const code = c.req.query('code')
  if (!cookie || !code) return fallo('estado')
  let oauth: { state?: unknown; nonce?: unknown; volver?: unknown }
  try {
    oauth = (await verify(cookie, SESSION_SECRET, 'HS256')) as typeof oauth
  } catch {
    return fallo('estado')
  }
  if (oauth.state !== c.req.query('state')) return fallo('estado')

  // Canje del código. El ID token llega directo de Google por TLS, así que basta validar sus claims
  // (OpenID Connect Core §3.1.3.7) sin verificar la firma.
  const r = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri(c),
      grant_type: 'authorization_code',
    }),
  })
  if (!r.ok) {
    console.error('Google token', r.status, await r.text())
    return fallo('google')
  }
  const { id_token } = (await r.json()) as { id_token?: string }
  const claims = leerClaims(id_token)
  if (
    !claims ||
    !GOOGLE_ISS.includes(claims.iss as string) ||
    claims.aud !== GOOGLE_CLIENT_ID ||
    typeof claims.exp !== 'number' ||
    claims.exp < ahora() ||
    claims.nonce !== oauth.nonce ||
    typeof claims.sub !== 'string' ||
    typeof claims.email !== 'string'
  ) {
    return fallo('google')
  }
  if (claims.email_verified !== true) return fallo('no-verificado')

  // Primero por google_sub; si aún no tiene, por email (primer login). Un email ya ligado a otra
  // cuenta de Google no entra.
  const u = await c.env.DB.prepare(
    `SELECT id, activo, google_sub FROM usuario
     WHERE google_sub = ?1 OR (google_sub IS NULL AND email = ?2)
     ORDER BY google_sub IS NULL LIMIT 1`,
  )
    .bind(claims.sub, claims.email)
    .first<{ id: number; activo: number; google_sub: string | null }>()
  if (!u) return fallo('sin-acceso')
  if (!u.activo) return fallo('inactivo')
  await c.env.DB.prepare(
    `UPDATE usuario SET google_sub = ?2, ultimo_acceso = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?1`,
  )
    .bind(u.id, claims.sub)
    .run()

  setCookie(c, COOKIE_SESION, await sign({ uid: u.id, exp: ahora() + DURACION_SESION }, SESSION_SECRET), {
    path: '/',
    httpOnly: true,
    secure: esHttps(c),
    sameSite: 'Lax',
    maxAge: DURACION_SESION,
  })
  return c.redirect(rutaLocal(typeof oauth.volver === 'string' ? oauth.volver : undefined))
})

auth.post('/auth/logout', (c) => {
  deleteCookie(c, COOKIE_SESION, { path: '/', secure: esHttps(c) })
  return c.body(null, 204)
})

function leerClaims(idToken: string | undefined): Record<string, unknown> | null {
  const payload = idToken?.split('.')[1]
  if (!payload) return null
  try {
    const b64 = payload.replaceAll('-', '+').replaceAll('_', '/')
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export default auth
