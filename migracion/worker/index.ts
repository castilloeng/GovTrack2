import { Hono } from 'hono'

type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.get('/health', (c) => c.json({ ok: true }))

app.get('/municipios', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, clave_ine, nombre FROM municipio ORDER BY nombre',
  ).all()
  return c.json(results)
})

export default app
