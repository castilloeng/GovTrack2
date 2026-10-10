import { Hono } from 'hono'
import { accesoMunicipio, cuerpo, ErrorApi, esUnico, idParam, type Ctx, type Env } from './comun'

// Secciones y colonias (DISENO.md §5 "Secciones y colonias" y "Detalle de sección").
// Las rutas de consulta van bajo el municipio porque el número de sección solo es único dentro de él.

const geografia = new Hono<Env>()

const TIPOS_SECCION = ['URBANA', 'RURAL', 'MIXTA']
const POR_PAGINA_MAX = 100

/** Asignaciones vigentes: ni la asignación ni el operador están dados de baja. */
const ASIG = `asig AS (
  SELECT a.seccion_id, a.colonia_id, a.operador_id, a.num_personas
  FROM operador_asignacion a JOIN persona o ON o.id = a.operador_id
  WHERE a.deleted_at IS NULL AND o.deleted_at IS NULL)`

/** Orden natural de casillas: B, C1, C2…, E1, E1C1…, S. */
const ORDEN_CASILLA = `CASE substr(k.tipo, 1, 1) WHEN 'B' THEN 0 WHEN 'C' THEN 1 WHEN 'E' THEN 2 ELSE 3 END, length(k.tipo), k.tipo`

function paginacion(c: Ctx) {
  const limite = Math.min(POR_PAGINA_MAX, Math.max(1, Number(c.req.query('limite')) || 50))
  const pagina = Math.max(1, Number(c.req.query('pagina')) || 1)
  return { limite, offset: (pagina - 1) * limite }
}

/** Proceso pedido en ?proceso= o, si no viene, el más reciente. */
async function procesoId(c: Ctx): Promise<number | null> {
  const q = c.req.query('proceso')
  if (q) return idParam(q, 'proceso')
  const r = await c.env.DB.prepare('SELECT id FROM proceso_electoral ORDER BY anio DESC, id DESC LIMIT 1').first<{ id: number }>()
  return r?.id ?? null
}

async function seccionPorId(c: Ctx, id: number) {
  const s = await c.env.DB.prepare('SELECT id, municipio_id, numero FROM seccion WHERE id = ?')
    .bind(id)
    .first<{ id: number; municipio_id: number; numero: number }>()
  if (!s) throw new ErrorApi(404, 'La sección no existe')
  return s
}

async function coloniaPorId(c: Ctx, id: number) {
  const col = await c.env.DB.prepare('SELECT id, municipio_id, nombre FROM colonia WHERE id = ?')
    .bind(id)
    .first<{ id: number; municipio_id: number; nombre: string }>()
  if (!col) throw new ErrorApi(404, 'La colonia no existe')
  return col
}

// ---------------------------------------------------------------------------
// Catálogo de procesos electorales (selector de la barra superior)
// ---------------------------------------------------------------------------

geografia.get('/procesos', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.anio, p.nombre,
            (SELECT json_group_array(json_object('id', e.id, 'cargo', e.cargo))
               FROM (SELECT id, cargo FROM eleccion WHERE proceso_id = p.id ORDER BY id) e) AS elecciones
     FROM proceso_electoral p ORDER BY p.anio DESC, p.id DESC`,
  ).all<{ id: number; anio: number; nombre: string; elecciones: string }>()
  return c.json(results.map((p) => ({ ...p, elecciones: JSON.parse(p.elecciones) })))
})

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

/**
 * Lista de secciones del municipio con su cobertura.
 * ?q= número (prefijo) · ?filtro=sin-operador|huecos · ?proceso= · ?pagina= · ?limite=
 */
geografia.get('/municipios/:mid/secciones', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const proceso = await procesoId(c)
  const { limite, offset } = paginacion(c)
  const q = (c.req.query('q') ?? '').replace(/\D/g, '')
  const filtro = c.req.query('filtro')
  const condFiltro =
    filtro === 'sin-operador' ? 'AND coalesce(e.operadores, 0) = 0'
    : filtro === 'huecos' ? 'AND coalesce(e.colonias_cubiertas, 0) < coalesce(sc.colonias, 0)'
    : ''

  const { results } = await c.env.DB.prepare(
    `WITH ${ASIG},
     e AS (SELECT seccion_id, count(DISTINCT operador_id) AS operadores, count(DISTINCT colonia_id) AS colonias_cubiertas,
                  sum(num_personas) AS personas
           FROM asig GROUP BY seccion_id),
     k AS (SELECT seccion_id, count(*) AS casillas, sum(lista_nominal) AS ln FROM casilla WHERE proceso_id = ?2 GROUP BY seccion_id),
     sc AS (SELECT seccion_id, count(*) AS colonias FROM seccion_colonia GROUP BY seccion_id)
     SELECT s.id, s.numero, s.tipo, s.sector,
            coalesce(sc.colonias, 0) AS colonias,
            coalesce(e.colonias_cubiertas, 0) AS colonias_cubiertas,
            coalesce(e.operadores, 0) AS operadores,
            coalesce(e.personas, 0) AS personas,
            coalesce(k.casillas, 0) AS casillas,
            coalesce(k.ln, 0) AS ln,
            count(*) OVER () AS total
     FROM seccion s
     LEFT JOIN e ON e.seccion_id = s.id
     LEFT JOIN k ON k.seccion_id = s.id
     LEFT JOIN sc ON sc.seccion_id = s.id
     WHERE s.municipio_id = ?1 AND (?3 = '' OR CAST(s.numero AS TEXT) LIKE ?3 || '%') ${condFiltro}
     ORDER BY s.numero
     LIMIT ?4 OFFSET ?5`,
  )
    .bind(mid, proceso, q, limite, offset)
    .all<Record<string, unknown> & { total: number }>()

  return c.json({ total: results[0]?.total ?? 0, filas: results.map(({ total: _, ...r }) => r) })
})

/** Detalle de una sección (por número dentro del municipio) con casillas y resultados del proceso. */
geografia.get('/municipios/:mid/secciones/:numero', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  const numero = idParam(c.req.param('numero'), 'número de sección')
  await accesoMunicipio(c, mid)
  const proceso = await procesoId(c)
  const db = c.env.DB

  const s = await db
    .prepare(
      `WITH ${ASIG}
       SELECT s.id, s.numero, s.tipo, s.sector, m.id AS municipio_id, m.nombre AS municipio,
              (SELECT count(*) FROM seccion_colonia WHERE seccion_id = s.id) AS colonias,
              (SELECT count(DISTINCT colonia_id) FROM asig WHERE seccion_id = s.id) AS colonias_cubiertas,
              (SELECT count(DISTINCT operador_id) FROM asig WHERE seccion_id = s.id) AS operadores,
              (SELECT coalesce(sum(num_personas), 0) FROM asig WHERE seccion_id = s.id) AS personas
       FROM seccion s JOIN municipio m ON m.id = s.municipio_id
       WHERE s.municipio_id = ? AND s.numero = ?`,
    )
    .bind(mid, numero)
    .first<{ id: number }>()
  if (!s) throw new ErrorApi(404, `La sección ${numero} no existe en este municipio`)

  const [casillas, elecciones, resultados] = await db.batch([
    db.prepare(`SELECT k.id, k.tipo, k.lista_nominal AS ln, k.ubicacion FROM casilla k
                WHERE k.seccion_id = ?1 AND k.proceso_id = ?2 ORDER BY ${ORDEN_CASILLA}`).bind(s.id, proceso),
    db.prepare('SELECT id, cargo FROM eleccion WHERE proceso_id = ? ORDER BY id').bind(proceso),
    db.prepare(`SELECT r.casilla_id, r.eleccion_id, p.siglas, r.votos
                FROM resultado r JOIN casilla k ON k.id = r.casilla_id JOIN partido p ON p.id = r.partido_id
                WHERE k.seccion_id = ?1 AND k.proceso_id = ?2 ORDER BY p.id`).bind(s.id, proceso),
  ])
  const ks = casillas.results as { id: number; tipo: string; ln: number | null; ubicacion: string | null }[]
  const rs = resultados.results as { casilla_id: number; eleccion_id: number; siglas: string; votos: number }[]

  // Una tabla por elección: columnas = partidos con votos en esa elección, filas = casillas.
  const porEleccion = (elecciones.results as { id: number; cargo: string }[]).map((e) => {
    const propios = rs.filter((r) => r.eleccion_id === e.id)
    const partidos = [...new Set(propios.map((r) => r.siglas))]
    const votos = new Map(propios.map((r) => [`${r.casilla_id}|${r.siglas}`, r.votos]))
    return {
      ...e,
      partidos,
      casillas: ks
        .filter((k) => propios.some((r) => r.casilla_id === k.id))
        .map((k) => ({ casilla: k.tipo, ln: k.ln ?? 0, votos: partidos.map((p) => votos.get(`${k.id}|${p}`) ?? 0) })),
    }
  })

  return c.json({
    ...s,
    proceso_id: proceso,
    casillas: ks.length,
    ln: ks.reduce((t, k) => t + (k.ln ?? 0), 0),
    lista_casillas: ks,
    elecciones: porEleccion,
  })
})

/** Colonias de la sección con su estructura: operadores, personas y enlaces. */
geografia.get('/secciones/:id/colonias', async (c) => {
  const s = await seccionPorId(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, s.municipio_id)
  const db = c.env.DB
  const [colonias, enlaces] = await db.batch([
    db.prepare(
      `WITH ${ASIG}
       SELECT col.id, col.nombre, col.tipo_asentamiento, col.cp,
              count(a.operador_id) AS operadores,
              coalesce(sum(a.num_personas), 0) AS personas,
              (SELECT json_group_array(numero) FROM (
                 SELECT s2.numero FROM seccion_colonia x JOIN seccion s2 ON s2.id = x.seccion_id
                 WHERE x.colonia_id = col.id AND x.seccion_id <> ?1 ORDER BY s2.numero)) AS otras_secciones
       FROM seccion_colonia sc
       JOIN colonia col ON col.id = sc.colonia_id
       LEFT JOIN asig a ON a.seccion_id = sc.seccion_id AND a.colonia_id = sc.colonia_id
       WHERE sc.seccion_id = ?1
       GROUP BY col.id
       ORDER BY operadores = 0, col.nombre`,
    ).bind(s.id),
    db.prepare(
      `WITH ${ASIG}
       SELECT DISTINCT a.colonia_id, p.id, p.nombre
       FROM asig a
       JOIN operador_enlace oe ON oe.operador_id = a.operador_id
       JOIN persona p ON p.id = oe.enlace_id AND p.deleted_at IS NULL
       WHERE a.seccion_id = ? ORDER BY p.nombre`,
    ).bind(s.id),
  ])
  const es = enlaces.results as { colonia_id: number; id: number; nombre: string }[]
  return c.json(
    (colonias.results as { id: number; otras_secciones: string }[]).map((col) => ({
      ...col,
      otras_secciones: JSON.parse(col.otras_secciones) as number[],
      enlaces: es.filter((e) => e.colonia_id === col.id).map(({ id, nombre }) => ({ id, nombre })),
    })),
  )
})

/** Historial de la sección: altas y bajas de asignaciones (no hay bitácora general todavía). */
geografia.get('/secciones/:id/historial', async (c) => {
  const s = await seccionPorId(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, s.municipio_id)
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM (
       SELECT 'alta' AS tipo, a.created_at AS fecha, col.nombre AS colonia, o.nombre AS operador, u.nombre AS usuario
       FROM operador_asignacion a
       JOIN colonia col ON col.id = a.colonia_id JOIN persona o ON o.id = a.operador_id
       LEFT JOIN usuario u ON u.id = a.created_by
       WHERE a.seccion_id = ?1
       UNION ALL
       SELECT 'baja', a.deleted_at, col.nombre, o.nombre, NULL
       FROM operador_asignacion a
       JOIN colonia col ON col.id = a.colonia_id JOIN persona o ON o.id = a.operador_id
       WHERE a.seccion_id = ?1 AND a.deleted_at IS NOT NULL)
     ORDER BY fecha DESC LIMIT 30`,
  )
    .bind(s.id)
    .all()
  return c.json(results)
})

geografia.post('/municipios/:mid/secciones', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid, true)
  const b = await cuerpo<{ numero: unknown; tipo: unknown; sector: unknown }>(c)
  const numero = Number(b.numero)
  if (!Number.isInteger(numero) || numero < 1 || numero > 9999) throw new ErrorApi(400, 'El número de sección debe ser un entero entre 1 y 9999')
  const tipo = tipoSeccion(b.tipo)
  const sector = texto(b.sector)
  try {
    const r = await c.env.DB.prepare('INSERT INTO seccion (municipio_id, numero, tipo, sector) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(mid, numero, tipo, sector)
      .first<{ id: number }>()
    return c.json({ id: r!.id, numero }, 201)
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, `La sección ${numero} ya existe en este municipio`)
    throw e
  }
})

geografia.patch('/secciones/:id', async (c) => {
  const s = await seccionPorId(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, s.municipio_id, true)
  const b = await cuerpo<{ tipo: unknown; sector: unknown }>(c)
  const cambios: [string, string | null][] = []
  if ('tipo' in b) cambios.push(['tipo', tipoSeccion(b.tipo)])
  if ('sector' in b) cambios.push(['sector', texto(b.sector)])
  if (cambios.length) {
    await c.env.DB.prepare(`UPDATE seccion SET ${cambios.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...cambios.map(([, v]) => v), s.id)
      .run()
  }
  return c.json({ ok: true })
})

/** Agrega una colonia existente a la sección (deben ser del mismo municipio). */
geografia.put('/secciones/:id/colonias/:cid', async (c) => {
  const s = await seccionPorId(c, idParam(c.req.param('id')))
  const col = await coloniaPorId(c, idParam(c.req.param('cid'), 'colonia'))
  await accesoMunicipio(c, s.municipio_id, true)
  if (col.municipio_id !== s.municipio_id) throw new ErrorApi(400, 'La colonia es de otro municipio')
  await c.env.DB.prepare('INSERT OR IGNORE INTO seccion_colonia (seccion_id, colonia_id) VALUES (?, ?)').bind(s.id, col.id).run()
  return c.json({ ok: true })
})

/** Quita la colonia de la sección. No se permite si tiene asignaciones (la FK las protege, incluso las dadas de baja). */
geografia.delete('/secciones/:id/colonias/:cid', async (c) => {
  const s = await seccionPorId(c, idParam(c.req.param('id')))
  const cid = idParam(c.req.param('cid'), 'colonia')
  await accesoMunicipio(c, s.municipio_id, true)
  const a = await c.env.DB.prepare(
    `SELECT count(*) AS total, sum(deleted_at IS NULL) AS activas FROM operador_asignacion WHERE seccion_id = ? AND colonia_id = ?`,
  )
    .bind(s.id, cid)
    .first<{ total: number; activas: number | null }>()
  if (a && a.total > 0) {
    throw new ErrorApi(
      409,
      a.activas
        ? `No se puede quitar: la colonia tiene ${a.activas} asignación(es) activa(s) en esta sección`
        : 'No se puede quitar: la colonia conserva asignaciones dadas de baja en esta sección',
    )
  }
  await c.env.DB.prepare('DELETE FROM seccion_colonia WHERE seccion_id = ? AND colonia_id = ?').bind(s.id, cid).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Colonias
// ---------------------------------------------------------------------------

/**
 * Colonias del municipio con las secciones a las que pertenecen y su cobertura.
 * ?q= nombre, CP o número de sección · ?filtro=sin-operador · ?pagina= · ?limite=
 */
geografia.get('/municipios/:mid/colonias', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const { limite, offset } = paginacion(c)
  const q = (c.req.query('q') ?? '').trim()
  const num = /^\d{1,4}$/.test(q) ? Number(q) : null
  const condFiltro = c.req.query('filtro') === 'sin-operador' ? 'AND coalesce(e.operadores, 0) = 0' : ''

  const { results } = await c.env.DB.prepare(
    `WITH ${ASIG},
     e AS (SELECT colonia_id, count(DISTINCT operador_id) AS operadores, sum(num_personas) AS personas FROM asig GROUP BY colonia_id)
     SELECT col.id, col.nombre, col.tipo_asentamiento, col.cp,
            coalesce(e.operadores, 0) AS operadores,
            coalesce(e.personas, 0) AS personas,
            (SELECT json_group_array(json_object('id', id, 'numero', numero)) FROM (
               SELECT s.id, s.numero FROM seccion_colonia x JOIN seccion s ON s.id = x.seccion_id
               WHERE x.colonia_id = col.id ORDER BY s.numero)) AS secciones,
            count(*) OVER () AS total
     FROM colonia col
     LEFT JOIN e ON e.colonia_id = col.id
     WHERE col.municipio_id = ?1
       AND (?2 = '' OR col.nombre LIKE '%' || ?2 || '%' OR col.cp = ?2
            OR EXISTS (SELECT 1 FROM seccion_colonia x JOIN seccion s ON s.id = x.seccion_id
                       WHERE x.colonia_id = col.id AND s.numero = ?3))
       ${condFiltro}
     ORDER BY col.nombre, col.cp
     LIMIT ?4 OFFSET ?5`,
  )
    .bind(mid, q, num, limite, offset)
    .all<{ secciones: string; total: number }>()

  return c.json({
    total: results[0]?.total ?? 0,
    filas: results.map(({ total: _, ...r }) => ({ ...r, secciones: JSON.parse(r.secciones) })),
  })
})

geografia.post('/municipios/:mid/colonias', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid, true)
  const b = await cuerpo<{ nombre: unknown; tipo_asentamiento: unknown; cp: unknown; secciones: unknown }>(c)
  const datos = datosColonia(b)
  if (!datos.nombre) throw new ErrorApi(400, 'Escribe el nombre de la colonia')
  // Las secciones llegan por número (es como las conoce el usuario) y deben ser del municipio.
  const numeros = Array.isArray(b.secciones) ? [...new Set(b.secciones.map(Number))] : []
  if (numeros.some((n) => !Number.isInteger(n) || n <= 0)) throw new ErrorApi(400, 'Números de sección inválidos')

  const db = c.env.DB
  let secciones: number[] = []
  if (numeros.length) {
    const { results } = await db
      .prepare('SELECT id, numero FROM seccion WHERE municipio_id = ? AND numero IN (SELECT value FROM json_each(?))')
      .bind(mid, JSON.stringify(numeros))
      .all<{ id: number; numero: number }>()
    const faltan = numeros.filter((n) => !results.some((r) => r.numero === n))
    if (faltan.length) throw new ErrorApi(400, `No existe(n) la(s) sección(es) ${faltan.join(', ')} en este municipio`)
    secciones = results.map((r) => r.id)
  }
  let id: number
  try {
    const r = await db
      .prepare('INSERT INTO colonia (municipio_id, nombre, tipo_asentamiento, cp) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(mid, datos.nombre, datos.tipo_asentamiento ?? null, datos.cp ?? null)
      .first<{ id: number }>()
    id = r!.id
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'Ya existe una colonia con ese nombre y código postal')
    throw e
  }
  if (secciones.length) {
    await db.batch(secciones.map((s) => db.prepare('INSERT INTO seccion_colonia (seccion_id, colonia_id) VALUES (?, ?)').bind(s, id)))
  }
  return c.json({ id }, 201)
})

geografia.patch('/colonias/:id', async (c) => {
  const col = await coloniaPorId(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, col.municipio_id, true)
  const datos = datosColonia(await cuerpo(c))
  if ('nombre' in datos && !datos.nombre) throw new ErrorApi(400, 'Escribe el nombre de la colonia')
  const campos = Object.keys(datos) as (keyof typeof datos)[]
  if (!campos.length) return c.json({ ok: true })
  try {
    await c.env.DB.prepare(`UPDATE colonia SET ${campos.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...campos.map((k) => datos[k] ?? null), col.id)
      .run()
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'Ya existe una colonia con ese nombre y código postal')
    throw e
  }
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

function texto(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new ErrorApi(400, 'Se esperaba texto')
  return v.trim().replace(/\s+/g, ' ') || null
}

function tipoSeccion(v: unknown): string | null {
  const t = texto(v)?.toUpperCase() ?? null
  if (t !== null && !TIPOS_SECCION.includes(t)) throw new ErrorApi(400, `Tipo de sección inválido; usa ${TIPOS_SECCION.join(', ')}`)
  return t
}

/** Solo incluye los campos presentes en el cuerpo, ya normalizados. Los nombres van en mayúsculas como el catálogo del INE. */
function datosColonia(b: Partial<{ nombre: unknown; tipo_asentamiento: unknown; cp: unknown }>) {
  const d: { nombre?: string | null; tipo_asentamiento?: string | null; cp?: string | null } = {}
  if ('nombre' in b) d.nombre = texto(b.nombre)?.toUpperCase() ?? null
  if ('tipo_asentamiento' in b) d.tipo_asentamiento = texto(b.tipo_asentamiento)?.toUpperCase() ?? null
  if ('cp' in b) {
    d.cp = texto(b.cp)
    if (d.cp !== null && !/^\d{5}$/.test(d.cp)) throw new ErrorApi(400, 'El código postal debe tener 5 dígitos')
  }
  return d
}

export default geografia
