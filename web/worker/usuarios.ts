import { Hono } from 'hono'
import { cuerpo, ErrorApi, esUnico, idParam, usuarioActual, type Ctx, type Env, type Rol, type Usuario } from './comun'

// Usuarios del sitio (DISENO.md §5 "Usuarios"). Solo ADMIN.
// No se borran (importacion y created_by los referencian): se desactivan con `activo = 0`.

const usuarios = new Hono<Env>()

const ROLES: Rol[] = ['ADMIN', 'CAPTURISTA', 'CONSULTA']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Entrada = { email: unknown; nombre: unknown; rol: unknown; activo: unknown; municipios: unknown }

async function soloAdmin(c: Ctx): Promise<Usuario> {
  const u = await usuarioActual(c)
  if (!u) throw new ErrorApi(401, 'No autenticado')
  if (u.rol !== 'ADMIN') throw new ErrorApi(403, 'Solo el administrador puede administrar usuarios')
  return u
}

function texto(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new ErrorApi(400, `Falta ${campo}`)
  return v.trim()
}

function email(v: unknown): string {
  const e = texto(v, 'el email').toLowerCase()
  if (!EMAIL.test(e)) throw new ErrorApi(400, 'El email no es válido')
  return e
}

function rol(v: unknown): Rol {
  if (!ROLES.includes(v as Rol)) throw new ErrorApi(400, `Rol inválido; usa ${ROLES.join(', ')}`)
  return v as Rol
}

/** Ids de municipio existentes y sin repetir. */
async function municipios(c: Ctx, v: unknown): Promise<number[]> {
  if (!Array.isArray(v)) throw new ErrorApi(400, 'municipios debe ser una lista de ids')
  const ids = [...new Set(v.map((x) => idParam(String(x), 'municipio')))]
  if (ids.length) {
    const r = await c.env.DB.prepare(`SELECT count(*) AS n FROM municipio WHERE id IN (${ids.map(() => '?').join(',')})`)
      .bind(...ids)
      .first<{ n: number }>()
    if (r?.n !== ids.length) throw new ErrorApi(400, 'Algún municipio no existe')
  }
  return ids
}

/** Un CAPTURISTA o CONSULTA sin municipios no vería nada. */
function exigirMunicipios(r: Rol, ids: number[]) {
  if (r !== 'ADMIN' && ids.length === 0) throw new ErrorApi(400, 'Elige al menos un municipio')
}

const reemplazarMunicipios = (c: Ctx, id: number, ids: number[]) => [
  c.env.DB.prepare('DELETE FROM usuario_municipio WHERE usuario_id = ?').bind(id),
  ...ids.map((m) => c.env.DB.prepare('INSERT INTO usuario_municipio (usuario_id, municipio_id) VALUES (?, ?)').bind(id, m)),
]

/** Lista de usuarios. ?q= nombre o email · ?estado=activos|inactivos */
usuarios.get('/usuarios', async (c) => {
  await soloAdmin(c)
  const q = (c.req.query('q') ?? '').trim()
  const estado = c.req.query('estado')
  const where: string[] = []
  const args: unknown[] = []
  if (q) {
    where.push(`(u.nombre LIKE ? OR u.email LIKE ?)`)
    args.push(`%${q}%`, `%${q}%`)
  }
  if (estado === 'activos') where.push('u.activo = 1')
  else if (estado === 'inactivos') where.push('u.activo = 0')
  else if (estado) throw new ErrorApi(400, 'estado inválido; usa activos o inactivos')
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.nombre, u.rol, u.activo, u.ultimo_acceso, u.created_at,
            u.google_sub IS NOT NULL AS vinculado,
            (SELECT json_group_array(json_object('id', m.id, 'nombre', m.nombre))
               FROM (SELECT m.id, m.nombre FROM usuario_municipio um JOIN municipio m ON m.id = um.municipio_id
                     WHERE um.usuario_id = u.id ORDER BY m.nombre) m) AS municipios
     FROM usuario u ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.activo DESC, u.nombre COLLATE NOCASE`,
  )
    .bind(...args)
    .all<{ activo: number; vinculado: number; municipios: string }>()
  return c.json(results.map((u) => ({ ...u, activo: !!u.activo, vinculado: !!u.vinculado, municipios: JSON.parse(u.municipios) })))
})

/** Alta por email. El usuario entra con Google y en su primer login se guarda su google_sub. */
usuarios.post('/usuarios', async (c) => {
  await soloAdmin(c)
  const b = await cuerpo<Entrada>(c)
  const datos = { email: email(b.email), nombre: texto(b.nombre, 'el nombre'), rol: rol(b.rol) }
  const ids = datos.rol === 'ADMIN' ? [] : await municipios(c, b.municipios ?? [])
  exigirMunicipios(datos.rol, ids)
  let id: number
  try {
    const r = await c.env.DB.prepare('INSERT INTO usuario (email, nombre, rol) VALUES (?, ?, ?) RETURNING id')
      .bind(datos.email, datos.nombre, datos.rol)
      .first<{ id: number }>()
    id = r!.id
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'Ya hay un usuario con ese email')
    throw e
  }
  if (ids.length) await c.env.DB.batch(reemplazarMunicipios(c, id, ids))
  return c.json({ id }, 201)
})

/**
 * Cambia los campos presentes. El email solo mientras no haya entrado (después lo identifica su
 * google_sub). El ADMIN no cambia su propio rol ni se desactiva, y siempre queda un ADMIN activo.
 */
usuarios.patch('/usuarios/:id', async (c) => {
  const yo = await soloAdmin(c)
  const id = idParam(c.req.param('id'))
  const actual = await c.env.DB.prepare('SELECT id, email, rol, activo, google_sub FROM usuario WHERE id = ?')
    .bind(id)
    .first<{ id: number; email: string; rol: Rol; activo: number; google_sub: string | null }>()
  if (!actual) throw new ErrorApi(404, 'El usuario no existe')
  const b = await cuerpo<Entrada>(c)

  const sets: string[] = []
  const args: unknown[] = []
  if (b.nombre !== undefined) {
    sets.push('nombre = ?')
    args.push(texto(b.nombre, 'el nombre'))
  }
  if (b.email !== undefined) {
    const e = email(b.email)
    if (e !== actual.email.toLowerCase()) {
      if (actual.google_sub) throw new ErrorApi(409, 'El email ya no se puede cambiar: el usuario ya entró con esa cuenta de Google')
      sets.push('email = ?')
      args.push(e)
    }
  }
  const nuevoRol = b.rol === undefined ? actual.rol : rol(b.rol)
  if (b.activo !== undefined && typeof b.activo !== 'boolean') throw new ErrorApi(400, 'activo debe ser true o false')
  const nuevoActivo = b.activo === undefined ? !!actual.activo : b.activo
  if (id === yo.id && (nuevoRol !== actual.rol || !nuevoActivo)) {
    throw new ErrorApi(409, 'No puedes cambiar tu propio rol ni desactivarte')
  }
  if (actual.rol === 'ADMIN' && actual.activo && (nuevoRol !== 'ADMIN' || !nuevoActivo)) {
    const otros = await c.env.DB.prepare(`SELECT count(*) AS n FROM usuario WHERE rol = 'ADMIN' AND activo = 1 AND id <> ?`)
      .bind(id)
      .first<{ n: number }>()
    if (!otros?.n) throw new ErrorApi(409, 'Debe quedar al menos un administrador activo')
  }
  if (nuevoRol !== actual.rol) {
    sets.push('rol = ?')
    args.push(nuevoRol)
  }
  if (nuevoActivo !== !!actual.activo) {
    sets.push('activo = ?')
    args.push(nuevoActivo ? 1 : 0)
  }

  // Municipios contra el rol final (null = sin cambios). El ADMIN ve todos y no guarda la lista;
  // quien deja de ser ADMIN necesita la suya.
  let ids: number[] | null = null
  if (nuevoRol === 'ADMIN') {
    if (actual.rol !== 'ADMIN') ids = []
  } else {
    if (b.municipios !== undefined) ids = await municipios(c, b.municipios)
    else if (actual.rol === 'ADMIN') ids = []
    if (ids) exigirMunicipios(nuevoRol, ids)
  }

  const lote = []
  if (sets.length) lote.push(c.env.DB.prepare(`UPDATE usuario SET ${sets.join(', ')} WHERE id = ?`).bind(...args, id))
  if (ids) lote.push(...reemplazarMunicipios(c, id, ids))
  if (lote.length) {
    try {
      await c.env.DB.batch(lote)
    } catch (e) {
      if (esUnico(e)) throw new ErrorApi(409, 'Ya hay un usuario con ese email')
      throw e
    }
  }
  return c.json({ ok: true })
})

export default usuarios
