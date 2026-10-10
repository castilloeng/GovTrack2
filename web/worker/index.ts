import { Hono, type Context } from 'hono'

type Bindings = {
  DB: D1Database
  // Solo para desarrollo local (en .dev.vars) mientras no exista el login con Google.
  USUARIO_PRUEBA_EMAIL?: string
}

type Usuario = { id: number; email: string; nombre: string; rol: string }

const TEMAS = ['verde', 'azul', 'naranja', 'guinda']

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

/**
 * Usuario de la petición. Mientras no exista el login con Google se identifica por el email que
 * agrega Cloudflare Access o, en local, por USUARIO_PRUEBA_EMAIL. Solo entran usuarios activos.
 */
async function usuarioActual(c: Context<{ Bindings: Bindings }>): Promise<Usuario | null> {
  const email = c.req.header('Cf-Access-Authenticated-User-Email') ?? c.env.USUARIO_PRUEBA_EMAIL
  if (!email) return null
  return c.env.DB.prepare('SELECT id, email, nombre, rol FROM usuario WHERE email = ? AND activo = 1')
    .bind(email)
    .first<Usuario>()
}

app.get('/health', (c) => c.json({ ok: true }))

app.get('/municipios', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, clave_ine, nombre FROM municipio ORDER BY nombre',
  ).all()
  return c.json(results)
})

app.get('/me', async (c) => {
  const u = await usuarioActual(c)
  if (!u) return c.json({ error: 'No autenticado' }, 401)
  return c.json(u)
})

// Tema global del sitio (DISENO.md §6): lo leen todos, solo el ADMIN lo cambia.
app.get('/configuracion', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT clave, valor FROM configuracion').all<{ clave: string; valor: string }>()
  return c.json(Object.fromEntries(results.map((r) => [r.clave, r.valor])))
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

export default app
