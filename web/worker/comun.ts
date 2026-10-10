import type { Context } from 'hono'
import { usuarioDeSesion } from './auth'

export type Bindings = {
  DB: D1Database
  // Login con Google (secretos del Worker; en local, en .dev.vars).
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  // Firma las cookies de sesión. Cadena aleatoria larga.
  SESSION_SECRET?: string
  // Solo para desarrollo local (en .dev.vars): entra con este usuario sin pasar por Google.
  USUARIO_PRUEBA_EMAIL?: string
}

export type Env = { Bindings: Bindings; Variables: { usuario?: Usuario | null } }
export type Ctx = Context<Env>

export type Rol = 'ADMIN' | 'CAPTURISTA' | 'CONSULTA'
export type Usuario = { id: number; email: string; nombre: string; rol: Rol }

/**
 * Usuario de la petición: el de la cookie de sesión (login con Google) o, en local, USUARIO_PRUEBA_EMAIL.
 * Solo entran usuarios activos. Se consulta una vez por petición.
 */
export async function usuarioActual(c: Ctx): Promise<Usuario | null> {
  const guardado = c.get('usuario')
  if (guardado !== undefined) return guardado
  const id = await usuarioDeSesion(c)
  const campos = 'SELECT id, email, nombre, rol FROM usuario WHERE activo = 1 AND '
  let u: Usuario | null = null
  if (id) u = await c.env.DB.prepare(campos + 'id = ?').bind(id).first<Usuario>()
  else if (c.env.USUARIO_PRUEBA_EMAIL) u = await c.env.DB.prepare(campos + 'email = ?').bind(c.env.USUARIO_PRUEBA_EMAIL).first<Usuario>()
  c.set('usuario', u)
  return u
}

/** Error con código HTTP; el manejador de errores de la app lo convierte en `{ error }`. */
export class ErrorApi extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

/**
 * Verifica el acceso a un municipio: si el usuario no es ADMIN, solo ve sus municipios.
 * Las escrituras exigen ADMIN o CAPTURISTA. (La sesión ya la exige el middleware de index.ts.)
 */
export async function accesoMunicipio(c: Ctx, municipioId: number, escritura = false): Promise<Usuario | null> {
  const u = await usuarioActual(c)
  if (escritura) {
    if (!u) throw new ErrorApi(401, 'No autenticado')
    if (u.rol === 'CONSULTA') throw new ErrorApi(403, 'Tu rol solo permite consultar')
  }
  if (u && u.rol !== 'ADMIN') {
    const ok = await c.env.DB.prepare('SELECT 1 FROM usuario_municipio WHERE usuario_id = ? AND municipio_id = ?')
      .bind(u.id, municipioId)
      .first()
    if (!ok) throw new ErrorApi(403, 'No tienes acceso a este municipio')
  }
  return u
}

/** Entero positivo de un parámetro de ruta o de consulta. */
export function idParam(v: string | undefined, nombre = 'id'): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new ErrorApi(400, `${nombre} inválido`)
  return n
}

export async function cuerpo<T extends object>(c: Ctx): Promise<Partial<T>> {
  const b = await c.req.json().catch(() => null)
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ErrorApi(400, 'Se esperaba un objeto JSON')
  return b as Partial<T>
}

/** D1 reporta las violaciones de UNIQUE como un error con este texto. */
export const esUnico = (e: unknown) => e instanceof Error && /UNIQUE constraint failed/i.test(e.message)
