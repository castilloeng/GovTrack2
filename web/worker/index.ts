import { Hono } from 'hono'
import auth from './auth'
import { cuerpo, ErrorApi, usuarioActual, type Env } from './comun'
import estructura from './estructura'
import geografia from './geografia'
import { openapi, sinDocumentar } from './openapi'
import panel from './panel'
import prioridad from './prioridad'
import usuarios from './usuarios'

const TEMAS = ['verde', 'azul', 'naranja', 'guinda']

const app = new Hono<Env>().basePath('/api')

// Si una petición con cuerpo se rechaza antes de leerlo (401/403), el dev server local (miniflare)
// deja la conexión en mal estado y la siguiente petición falla con 500. Se consume siempre.
app.use(async (c, next) => {
  await next()
  if (c.req.raw.body && !c.req.raw.bodyUsed) await c.req.raw.arrayBuffer().catch(() => undefined)
})

app.onError((e, c) => {
  if (e instanceof ErrorApi) return c.json({ error: e.message }, e.status)
  console.error(e)
  return c.json({ error: 'Error interno' }, 500)
})

app.get('/health', (c) => c.json({ ok: true }))

// Login con Google: /auth/login, /auth/callback y /auth/logout.
app.route('/', auth)

// El resto de la API exige sesión, salvo la configuración (el tema se pinta también en el login).
const PUBLICAS = ['/api/health', '/api/configuracion']
app.use(async (c, next) => {
  if (PUBLICAS.includes(c.req.path) || c.req.path.startsWith('/api/auth/')) return next()
  if (!(await usuarioActual(c))) throw new ErrorApi(401, 'No autenticado')
  return next()
})

// Documentación OpenAPI (worker/openapi.ts). `x-sin-documentar` avisa de rutas que faltan en la especificación.
app.get('/openapi.json', (c) => c.json({ ...openapi, 'x-sin-documentar': sinDocumentar(app.routes) }))

// Municipios que puede ver el usuario: ADMIN todos; el resto, los de usuario_municipio.
app.get('/municipios', async (c) => {
  const u = (await usuarioActual(c))!
  const { results } = await (u.rol === 'ADMIN'
    ? c.env.DB.prepare('SELECT id, clave_ine, nombre FROM municipio ORDER BY nombre')
    : c.env.DB.prepare(
        `SELECT m.id, m.clave_ine, m.nombre FROM municipio m
         JOIN usuario_municipio um ON um.municipio_id = m.id AND um.usuario_id = ?
         ORDER BY m.nombre`,
      ).bind(u.id)
  ).all()
  return c.json(results)
})

app.get('/me', async (c) => {
  const u = await usuarioActual(c)
  if (!u) return c.json({ error: 'No autenticado' }, 401)
  return c.json(u)
})

// Catálogo de partidos (selector del partido propio en Configuración).
app.get('/partidos', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, siglas, nombre FROM partido ORDER BY siglas').all()
  return c.json(results)
})

// Ajustes globales del sitio (DISENO.md §6): lo leen todos, solo el ADMIN los cambia.
// Sin sesión solo se entrega el tema (se pinta también en el login); el resto exige sesión.
app.get('/configuracion', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT clave, valor FROM configuracion').all<{ clave: string; valor: string }>()
  const conSesion = !!(await usuarioActual(c))
  return c.json(Object.fromEntries(results.filter((r) => conSesion || r.clave === 'tema').map((r) => [r.clave, r.valor])))
})

app.put('/configuracion/tema', async (c) => {
  const u = await usuarioActual(c)
  if (!u) return c.json({ error: 'No autenticado' }, 401)
  if (u.rol !== 'ADMIN') return c.json({ error: 'Solo el administrador puede cambiar el tema' }, 403)
  const body = await c.req.json<{ tema?: unknown }>().catch(() => ({}) as { tema?: unknown })
  if (typeof body.tema !== 'string' || !TEMAS.includes(body.tema)) {
    return c.json({ error: `Tema inválido; usa ${TEMAS.join(', ')}` }, 400)
  }
  await c.env.DB.prepare(
    `INSERT INTO configuracion (clave, valor, updated_by) VALUES ('tema', ?1, ?2)
     ON CONFLICT (clave) DO UPDATE SET valor = ?1, updated_by = ?2,
       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
  )
    .bind(body.tema, u.id)
    .run()
  return c.json({ tema: body.tema })
})

// Ajustes de Prioridad (solo ADMIN): `partido_propio` (siglas del catálogo, o null para quitarlo) y
// `efectividad` (1–100: % de las personas comprometidas que se espera que voten por el partido).
app.patch('/configuracion', async (c) => {
  const u = (await usuarioActual(c))!
  if (u.rol !== 'ADMIN') throw new ErrorApi(403, 'Solo el administrador puede cambiar la configuración')
  const body = await cuerpo<{ partido_propio: unknown; efectividad: unknown }>(c)
  const cambios: [string, string | null][] = []
  if ('partido_propio' in body) {
    const v = body.partido_propio
    if (v === null) cambios.push(['partido_propio', null])
    else {
      if (typeof v !== 'string') throw new ErrorApi(400, 'partido_propio debe ser las siglas de un partido o null')
      const partido = await c.env.DB.prepare('SELECT siglas FROM partido WHERE siglas = ?').bind(v.trim()).first<{ siglas: string }>()
      if (!partido) throw new ErrorApi(400, `El partido ${v} no está en el catálogo`)
      cambios.push(['partido_propio', partido.siglas])
    }
  }
  if ('efectividad' in body) {
    const v = body.efectividad
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 100) throw new ErrorApi(400, 'efectividad debe ser un entero de 1 a 100')
    cambios.push(['efectividad', String(v)])
  }
  if (cambios.length === 0) throw new ErrorApi(400, 'Nada que cambiar; usa partido_propio o efectividad')
  const db = c.env.DB
  await db.batch(
    cambios.map(([clave, valor]) =>
      valor === null
        ? db.prepare('DELETE FROM configuracion WHERE clave = ?').bind(clave)
        : db
            .prepare(
              `INSERT INTO configuracion (clave, valor, updated_by) VALUES (?1, ?2, ?3)
               ON CONFLICT (clave) DO UPDATE SET valor = ?2, updated_by = ?3,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`,
            )
            .bind(clave, valor, u.id),
    ),
  )
  const { results } = await db.prepare('SELECT clave, valor FROM configuracion').all<{ clave: string; valor: string }>()
  return c.json(Object.fromEntries(results.map((r) => [r.clave, r.valor])))
})

// Procesos, secciones y colonias.
app.route('/', geografia)

// Operadores, enlaces, personas y asignaciones.
app.route('/', estructura)

// Panel del municipio: indicadores, resultados y actividad reciente.
app.route('/', panel)

// Prioridad por sección: resultado del partido propio × estructura.
app.route('/', prioridad)

// Usuarios del sitio (solo ADMIN).
app.route('/', usuarios)

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404))

export default app
