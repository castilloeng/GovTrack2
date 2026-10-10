import type { Context } from 'hono'

export type Bindings = {
  DB: D1Database
  // Solo para desarrollo local (en .dev.vars) mientras no exista el login con Google.
  USUARIO_PRUEBA_EMAIL?: string
}

export type Env = { Bindings: Bindings }
export type Ctx = Context<Env>

export type Rol = 'ADMIN' | 'CAPTURISTA' | 'CONSULTA'
export type Usuario = { id: number; email: string; nombre: string; rol: Rol }

/**
 * Usuario de la petición. Mientras no exista el login con Google se identifica por el email que
 * agrega Cloudflare Access o, en local, por USUARIO_PRUEBA_EMAIL. Solo entran usuarios activos.
 */
export async function usuarioActual(c: Ctx): Promise<Usuario | null> {
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ?? c.env.USUARIO_PRUEBA_EMAIL
  if (!email) return null
  return c.env.DB.prepare('SELECT id, email, nombre, rol FROM usuario WHERE email = ? AND activo = 1')
    .bind(email)
    .first<Usuario>()
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
 * Verifica el acceso a un municipio. Las lecturas siguen abiertas mientras no exista el login
 * (como /api/municipios), pero si hay usuario y no es ADMIN, solo ve sus municipios.
 * Las escrituras exigen usuario ADMIN o CAPTURISTA.
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
