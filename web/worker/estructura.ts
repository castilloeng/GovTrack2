import { Hono } from 'hono'
import { accesoMunicipio, cuerpo, ErrorApi, esUnico, idParam, type Ctx, type Env } from './comun'

// Estructura territorial: personas (padrón), operadores, enlaces y asignaciones (DISENO.md §5 "Operadores y enlaces").
// El rol no se guarda: es operador quien tiene asignaciones vigentes o enlaces; es enlace quien aparece
// en operador_enlace de un operador activo. Las bajas son lógicas (deleted_at).

const estructura = new Hono<Env>()

const POR_PAGINA_MAX = 100

/** Asignaciones vigentes: ni la asignación ni el operador están dados de baja. */
const ASIG = `asig AS (
  SELECT a.id, a.seccion_id, a.colonia_id, a.operador_id, a.num_personas
  FROM operador_asignacion a JOIN persona o ON o.id = a.operador_id
  WHERE a.deleted_at IS NULL AND o.deleted_at IS NULL)`

/** Enlaces (1 o 2) de la persona `p`, en orden, como JSON. */
const ENLACES_JSON = `(SELECT json_group_array(json_object('id', id, 'nombre', nombre, 'telefono', telefono)) FROM (
  SELECT e.id, e.nombre, e.telefono FROM operador_enlace oe JOIN persona e ON e.id = oe.enlace_id
  WHERE oe.operador_id = p.id AND e.deleted_at IS NULL ORDER BY oe.orden))`

/** Operadores activos de los que la persona `p` es enlace. */
const ENLACE_DE = `(SELECT count(*) FROM operador_enlace oe JOIN persona o ON o.id = oe.operador_id
  WHERE oe.enlace_id = p.id AND o.deleted_at IS NULL)`

function paginacion(c: Ctx) {
  const limite = Math.min(POR_PAGINA_MAX, Math.max(1, Number(c.req.query('limite')) || 50))
  const pagina = Math.max(1, Number(c.req.query('pagina')) || 1)
  return { limite, offset: (pagina - 1) * limite }
}

/** Filtros comunes: ?q= (nombre o teléfono) y ?seccion= (número). */
function filtrosPersona(c: Ctx) {
  const q = (c.req.query('q') ?? '').trim()
  const digitos = q.replace(/\D/g, '')
  const seccion = c.req.query('seccion') ? idParam(c.req.query('seccion'), 'sección') : null
  return { q, tel: digitos.length >= 3 ? digitos : '', seccion }
}

async function personaPorId(c: Ctx, id: number) {
  const p = await c.env.DB.prepare('SELECT id, municipio_id, nombre, deleted_at FROM persona WHERE id = ?')
    .bind(id)
    .first<{ id: number; municipio_id: number; nombre: string; deleted_at: string | null }>()
  if (!p) throw new ErrorApi(404, 'La persona no existe')
  return p
}

async function personaActiva(c: Ctx, id: number) {
  const p = await personaPorId(c, id)
  if (p.deleted_at) throw new ErrorApi(409, `${p.nombre} está dada de baja`)
  return p
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Operadores del municipio: nombre, teléfono, enlaces, colonias y personas movilizadas.
 * ?q= nombre o teléfono · ?seccion= número · ?enlace= id · ?pagina= · ?limite=
 */
estructura.get('/municipios/:mid/operadores', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const { limite, offset } = paginacion(c)
  const { q, tel, seccion } = filtrosPersona(c)
  const enlace = c.req.query('enlace') ? idParam(c.req.query('enlace'), 'enlace') : null

  const { results } = await c.env.DB.prepare(
    `WITH ${ASIG}
     SELECT p.id, p.nombre, p.telefono,
            ${ENLACES_JSON} AS enlaces,
            (SELECT count(*) FROM asig WHERE operador_id = p.id) AS colonias,
            (SELECT coalesce(sum(num_personas), 0) FROM asig WHERE operador_id = p.id) AS personas,
            ${ENLACE_DE} AS enlace_de,
            count(*) OVER () AS total
     FROM persona p
     WHERE p.municipio_id = ?1 AND p.deleted_at IS NULL
       AND (EXISTS (SELECT 1 FROM asig WHERE operador_id = p.id) OR EXISTS (SELECT 1 FROM operador_enlace WHERE operador_id = p.id))
       AND (?2 = '' OR p.nombre LIKE '%' || ?2 || '%' OR (?3 <> '' AND p.telefono LIKE '%' || ?3 || '%'))
       AND (?4 IS NULL OR EXISTS (SELECT 1 FROM asig a JOIN seccion s ON s.id = a.seccion_id WHERE a.operador_id = p.id AND s.numero = ?4))
       AND (?5 IS NULL OR EXISTS (SELECT 1 FROM operador_enlace WHERE operador_id = p.id AND enlace_id = ?5))
     ORDER BY p.nombre
     LIMIT ?6 OFFSET ?7`,
  )
    .bind(mid, q, tel, seccion, enlace, limite, offset)
    .all<{ enlaces: string; total: number }>()

  return c.json({
    total: results[0]?.total ?? 0,
    filas: results.map(({ total: _, ...r }) => ({ ...r, enlaces: JSON.parse(r.enlaces) })),
  })
})

/**
 * Enlaces del municipio con sus operadores, colonias y personas (vista "por enlace").
 * Son pocos por municipio, así que no se paginan. ?q= nombre o teléfono · ?seccion= número
 */
estructura.get('/municipios/:mid/enlaces', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const { q, tel, seccion } = filtrosPersona(c)

  // Con ?seccion= solo cuentan las asignaciones de esa sección.
  const { results } = await c.env.DB.prepare(
    `WITH ${ASIG},
     red AS (
       SELECT oe.enlace_id, CASE WHEN ?4 IS NULL OR a.id IS NOT NULL THEN oe.operador_id END AS operador_id,
              a.seccion_id, a.colonia_id, a.num_personas
       FROM operador_enlace oe
       JOIN persona o ON o.id = oe.operador_id AND o.deleted_at IS NULL
       LEFT JOIN asig a ON a.operador_id = oe.operador_id
         AND (?4 IS NULL OR a.seccion_id = (SELECT id FROM seccion WHERE municipio_id = ?1 AND numero = ?4)))
     SELECT p.id, p.nombre, p.telefono,
            count(DISTINCT r.operador_id) AS operadores,
            count(DISTINCT r.seccion_id || '-' || r.colonia_id) AS colonias,
            coalesce(sum(r.num_personas), 0) AS personas
     FROM persona p JOIN red r ON r.enlace_id = p.id
     WHERE p.municipio_id = ?1 AND p.deleted_at IS NULL
       AND (?2 = '' OR p.nombre LIKE '%' || ?2 || '%' OR (?3 <> '' AND p.telefono LIKE '%' || ?3 || '%'))
     GROUP BY p.id
     HAVING ?4 IS NULL OR count(r.operador_id) > 0
     ORDER BY p.nombre`,
  )
    .bind(mid, q, tel, seccion)
    .all()
  return c.json(results)
})

/** Filas de la exportación a Excel (CSV); más que esto no cabe en una respuesta razonable del Worker. */
const EXPORTAR_MAX = 20000

/**
 * Asignaciones del municipio en una tabla plana (DISENO.md §5 "Asignaciones").
 * ?estado=vigentes (por omisión) | bajas | sin-operador · ?q= operador o colonia · ?seccion= número
 * · ?enlace= id · ?pagina= · ?limite= · ?formato=csv (todo lo filtrado, sin paginar).
 * Con `sin-operador` las filas son los pares sección + colonia sin asignación vigente.
 */
estructura.get('/municipios/:mid/asignaciones', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const estado = c.req.query('estado') ?? 'vigentes'
  if (!['vigentes', 'bajas', 'sin-operador'].includes(estado)) throw new ErrorApi(400, 'estado debe ser vigentes, bajas o sin-operador')
  const csv = c.req.query('formato') === 'csv'
  const { limite, offset } = csv ? { limite: EXPORTAR_MAX, offset: 0 } : paginacion(c)
  const q = (c.req.query('q') ?? '').trim()
  const seccion = c.req.query('seccion') ? idParam(c.req.query('seccion'), 'sección') : null
  const enlace = c.req.query('enlace') ? idParam(c.req.query('enlace'), 'enlace') : null
  const db = c.env.DB

  if (estado === 'sin-operador') {
    const { results } = await db
      .prepare(
        `WITH ${ASIG}
         SELECT s.id AS seccion_id, s.numero AS seccion, col.id AS colonia_id, col.nombre AS colonia, count(*) OVER () AS total
         FROM seccion_colonia sc JOIN seccion s ON s.id = sc.seccion_id JOIN colonia col ON col.id = sc.colonia_id
         WHERE s.municipio_id = ?1
           AND NOT EXISTS (SELECT 1 FROM asig WHERE seccion_id = sc.seccion_id AND colonia_id = sc.colonia_id)
           AND (?2 = '' OR col.nombre LIKE '%' || ?2 || '%')
           AND (?3 IS NULL OR s.numero = ?3)
         ORDER BY s.numero, col.nombre
         LIMIT ?4 OFFSET ?5`,
      )
      .bind(mid, q, seccion, limite, offset)
      .all<{ seccion: number; colonia: string; total: number }>()
    if (csv) return respuestaCsv(c, 'colonias-sin-operador', [['Sección', 'Colonia'], ...results.map((r) => [r.seccion, r.colonia])])
    return c.json({ total: results[0]?.total ?? 0, operadores: 0, personas: 0, filas: results.map(({ total: _, ...r }) => r) })
  }

  const bajas = estado === 'bajas'
  const desde = `FROM operador_asignacion a
     JOIN persona p ON p.id = a.operador_id
     JOIN seccion s ON s.id = a.seccion_id
     JOIN colonia col ON col.id = a.colonia_id
     WHERE s.municipio_id = ?1
       AND ${bajas ? 'a.deleted_at IS NOT NULL' : 'a.deleted_at IS NULL AND p.deleted_at IS NULL'}
       AND (?2 = '' OR p.nombre LIKE '%' || ?2 || '%' OR col.nombre LIKE '%' || ?2 || '%')
       AND (?3 IS NULL OR s.numero = ?3)
       AND (?4 IS NULL OR EXISTS (SELECT 1 FROM operador_enlace WHERE operador_id = p.id AND enlace_id = ?4))`
  const [filas, totales] = await db.batch([
    db
      .prepare(
        `SELECT a.id, a.seccion_id, s.numero AS seccion, a.colonia_id, col.nombre AS colonia,
                p.id AS operador_id, p.nombre AS operador, p.telefono, ${ENLACES_JSON} AS enlaces,
                a.num_personas, a.observaciones, a.created_at, a.deleted_at
         ${desde}
         ORDER BY ${bajas ? 'a.deleted_at DESC' : 's.numero, col.nombre, p.nombre'}
         LIMIT ?5 OFFSET ?6`,
      )
      .bind(mid, q, seccion, enlace, limite, offset),
    db
      .prepare(`SELECT count(*) AS total, count(DISTINCT p.id) AS operadores, coalesce(sum(a.num_personas), 0) AS personas ${desde}`)
      .bind(mid, q, seccion, enlace),
  ])
  const rows = (filas.results as (FilaAsignacion & { enlaces: string })[]).map((r) => ({ ...r, enlaces: JSON.parse(r.enlaces) as Enlace[] }))

  if (csv) {
    const encabezado = ['Sección', 'Colonia', 'Operador', 'Teléfono', 'Enlace 1', 'Teléfono enlace 1', 'Enlace 2', 'Teléfono enlace 2', 'Personas', 'Observaciones', 'Alta']
    if (bajas) encabezado.push('Baja')
    return respuestaCsv(c, bajas ? 'asignaciones-dadas-de-baja' : 'asignaciones', [
      encabezado,
      ...rows.map((r) => {
        const fila: unknown[] = [r.seccion, r.colonia, r.operador, r.telefono, r.enlaces[0]?.nombre, r.enlaces[0]?.telefono, r.enlaces[1]?.nombre, r.enlaces[1]?.telefono, r.num_personas, r.observaciones, r.created_at.slice(0, 10)]
        if (bajas) fila.push(r.deleted_at?.slice(0, 10))
        return fila
      }),
    ])
  }
  return c.json({ ...(totales.results[0] as { total: number; operadores: number; personas: number }), filas: rows })
})

type Enlace = { id: number; nombre: string; telefono: string | null }
type FilaAsignacion = {
  seccion: number
  colonia: string
  operador: string
  telefono: string | null
  num_personas: number
  observaciones: string | null
  created_at: string
  deleted_at: string | null
}

/** CSV con BOM (Excel lo abre con acentos) y todos los campos entre comillas. */
function respuestaCsv(c: Ctx, nombre: string, filas: unknown[][]) {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const cuerpo = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n') + '\r\n'
  return c.body(cuerpo, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${nombre}-${new Date().toISOString().slice(0, 10)}.csv"`,
  })
}

/**
 * Personas del padrón sin rol en la estructura: sin asignaciones vigentes, sin enlaces propios y que
 * no son enlace de ningún operador activo. ?q= nombre o teléfono · ?pagina= · ?limite=
 */
estructura.get('/municipios/:mid/personas/sin-asignar', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const { limite, offset } = paginacion(c)
  const { q, tel } = filtrosPersona(c)
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.nombre, p.telefono, p.created_at, count(*) OVER () AS total
     FROM persona p
     WHERE p.municipio_id = ?1 AND p.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM operador_asignacion WHERE operador_id = p.id AND deleted_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM operador_enlace WHERE operador_id = p.id)
       AND ${ENLACE_DE} = 0
       AND (?2 = '' OR p.nombre LIKE '%' || ?2 || '%' OR (?3 <> '' AND p.telefono LIKE '%' || ?3 || '%'))
     ORDER BY p.created_at DESC, p.nombre
     LIMIT ?4 OFFSET ?5`,
  )
    .bind(mid, q, tel, limite, offset)
    .all<{ total: number }>()
  return c.json({ total: results[0]?.total ?? 0, filas: results.map(({ total: _, ...r }) => r) })
})

/** Búsqueda en el padrón (para elegir enlaces). ?q= nombre o teléfono; máximo 20. */
estructura.get('/municipios/:mid/personas', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const { q, tel } = filtrosPersona(c)
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.nombre, p.telefono FROM persona p
     WHERE p.municipio_id = ?1 AND p.deleted_at IS NULL
       AND (?2 = '' OR p.nombre LIKE '%' || ?2 || '%' OR (?3 <> '' AND p.telefono LIKE '%' || ?3 || '%'))
     ORDER BY p.nombre LIMIT 20`,
  )
    .bind(mid, q, tel)
    .all()
  return c.json(results)
})

/** Detalle de una persona: enlaces, asignaciones vigentes y de quién es enlace. */
estructura.get('/personas/:id', async (c) => {
  const id = idParam(c.req.param('id'))
  const db = c.env.DB
  const p = await db
    .prepare(`SELECT p.id, p.nombre, p.telefono, p.municipio_id, p.deleted_at, ${ENLACES_JSON} AS enlaces FROM persona p WHERE p.id = ?`)
    .bind(id)
    .first<{ municipio_id: number; enlaces: string }>()
  if (!p) throw new ErrorApi(404, 'La persona no existe')
  await accesoMunicipio(c, p.municipio_id)

  const [asignaciones, enlaceDe] = await db.batch([
    db.prepare(
      `SELECT a.id, a.seccion_id, s.numero AS seccion, a.colonia_id, col.nombre AS colonia, a.num_personas, a.observaciones
       FROM operador_asignacion a JOIN seccion s ON s.id = a.seccion_id JOIN colonia col ON col.id = a.colonia_id
       WHERE a.operador_id = ? AND a.deleted_at IS NULL ORDER BY s.numero, col.nombre`,
    ).bind(id),
    db.prepare(
      `SELECT o.id, o.nombre FROM operador_enlace oe JOIN persona o ON o.id = oe.operador_id
       WHERE oe.enlace_id = ? AND o.deleted_at IS NULL ORDER BY o.nombre`,
    ).bind(id),
  ])
  return c.json({ ...p, enlaces: JSON.parse(p.enlaces), asignaciones: asignaciones.results, enlace_de: enlaceDe.results })
})

// ---------------------------------------------------------------------------
// Personas y enlaces
// ---------------------------------------------------------------------------

/** Alta de persona. Sin `enlaces` queda en el padrón sin rol; con `enlaces`, como operador con sus 1 o 2 enlaces. */
estructura.post('/municipios/:mid/personas', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  const u = await accesoMunicipio(c, mid, true)
  const b = await cuerpo<{ nombre: unknown; telefono: unknown; enlaces: unknown }>(c)
  const nombre = nombrePersona(b.nombre)
  const telefono = telefonoPersona(b.telefono)
  const enlaces = b.enlaces === undefined ? [] : await validarEnlaces(c, mid, null, b.enlaces)

  const db = c.env.DB
  try {
    const r = await db
      .prepare('INSERT INTO persona (nombre, telefono, municipio_id, created_by) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(nombre, telefono, mid, u!.id)
      .first<{ id: number }>()
    if (enlaces.length) await db.batch(insertarEnlaces(c, r!.id, enlaces))
    return c.json({ id: r!.id }, 201)
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'El teléfono ya está registrado para otra persona activa')
    throw e
  }
})

estructura.patch('/personas/:id', async (c) => {
  const p = await personaActiva(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, p.municipio_id, true)
  const b = await cuerpo<{ nombre: unknown; telefono: unknown }>(c)
  const cambios: [string, string | null][] = []
  if ('nombre' in b) cambios.push(['nombre', nombrePersona(b.nombre)])
  if ('telefono' in b) cambios.push(['telefono', telefonoPersona(b.telefono)])
  if (!cambios.length) return c.json({ ok: true })
  try {
    await c.env.DB.prepare(
      `UPDATE persona SET ${cambios.map(([k]) => `${k} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    )
      .bind(...cambios.map(([, v]) => v), p.id)
      .run()
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'El teléfono ya está registrado para otra persona activa')
    throw e
  }
  return c.json({ ok: true })
})

/** Reemplaza los enlaces del operador (1 o 2). Aplican a todas sus asignaciones. */
estructura.put('/personas/:id/enlaces', async (c) => {
  const p = await personaActiva(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, p.municipio_id, true)
  const b = await cuerpo<{ enlaces: unknown }>(c)
  const enlaces = await validarEnlaces(c, p.municipio_id, p.id, b.enlaces)
  if (!enlaces.length) throw new ErrorApi(400, 'El operador debe tener 1 o 2 enlaces')
  await c.env.DB.batch([c.env.DB.prepare('DELETE FROM operador_enlace WHERE operador_id = ?').bind(p.id), ...insertarEnlaces(c, p.id, enlaces)])
  return c.json({ ok: true })
})

/**
 * Baja lógica de la persona y de sus asignaciones vigentes. No se permite si es enlace de
 * operadores activos (primero hay que cambiarles el enlace).
 */
estructura.delete('/personas/:id', async (c) => {
  const p = await personaActiva(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, p.municipio_id, true)
  const db = c.env.DB
  const r = await db
    .prepare('SELECT count(*) AS n FROM operador_enlace oe JOIN persona o ON o.id = oe.operador_id WHERE oe.enlace_id = ? AND o.deleted_at IS NULL')
    .bind(p.id)
    .first<{ n: number }>()
  if (r?.n) throw new ErrorApi(409, `No se puede dar de baja: es enlace de ${r.n} operador(es) activo(s). Cámbiales el enlace primero.`)
  const ahora = `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
  const [asig] = await db.batch([
    db.prepare(`UPDATE operador_asignacion SET deleted_at = ${ahora}, updated_at = ${ahora} WHERE operador_id = ? AND deleted_at IS NULL`).bind(p.id),
    db.prepare(`UPDATE persona SET deleted_at = ${ahora}, updated_at = ${ahora} WHERE id = ?`).bind(p.id),
  ])
  return c.json({ ok: true, asignaciones: asig.meta.changes })
})

// ---------------------------------------------------------------------------
// Asignaciones
// ---------------------------------------------------------------------------

/** Asigna el operador a una colonia de una sección. La colonia debe pertenecer a la sección. */
estructura.post('/personas/:id/asignaciones', async (c) => {
  const p = await personaActiva(c, idParam(c.req.param('id')))
  const u = await accesoMunicipio(c, p.municipio_id, true)
  const b = await cuerpo<{ seccion_id: unknown; colonia_id: unknown; num_personas: unknown; observaciones: unknown }>(c)
  const seccionId = idParam(String(b.seccion_id), 'sección')
  const coloniaId = idParam(String(b.colonia_id), 'colonia')
  const db = c.env.DB
  const sc = await db
    .prepare(
      `SELECT s.municipio_id FROM seccion_colonia sc JOIN seccion s ON s.id = sc.seccion_id
       WHERE sc.seccion_id = ? AND sc.colonia_id = ?`,
    )
    .bind(seccionId, coloniaId)
    .first<{ municipio_id: number }>()
  if (!sc) throw new ErrorApi(400, 'La colonia no pertenece a la sección')
  if (sc.municipio_id !== p.municipio_id) throw new ErrorApi(400, 'La sección es de otro municipio')
  try {
    const r = await db
      .prepare(
        `INSERT INTO operador_asignacion (operador_id, seccion_id, colonia_id, num_personas, observaciones, created_by)
         VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(p.id, seccionId, coloniaId, numPersonas(b.num_personas ?? 0), texto(b.observaciones), u!.id)
      .first<{ id: number }>()
    return c.json({ id: r!.id }, 201)
  } catch (e) {
    if (esUnico(e)) throw new ErrorApi(409, 'El operador ya está asignado a esa colonia en esa sección')
    throw e
  }
})

async function asignacionActiva(c: Ctx, id: number) {
  const a = await c.env.DB.prepare(
    `SELECT a.id, s.municipio_id FROM operador_asignacion a JOIN seccion s ON s.id = a.seccion_id
     WHERE a.id = ? AND a.deleted_at IS NULL`,
  )
    .bind(id)
    .first<{ id: number; municipio_id: number }>()
  if (!a) throw new ErrorApi(404, 'La asignación no existe o ya fue dada de baja')
  return a
}

estructura.patch('/asignaciones/:id', async (c) => {
  const a = await asignacionActiva(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, a.municipio_id, true)
  const b = await cuerpo<{ num_personas: unknown; observaciones: unknown }>(c)
  const cambios: [string, number | string | null][] = []
  if ('num_personas' in b) cambios.push(['num_personas', numPersonas(b.num_personas)])
  if ('observaciones' in b) cambios.push(['observaciones', texto(b.observaciones)])
  if (cambios.length) {
    await c.env.DB.prepare(
      `UPDATE operador_asignacion SET ${cambios.map(([k]) => `${k} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
    )
      .bind(...cambios.map(([, v]) => v), a.id)
      .run()
  }
  return c.json({ ok: true })
})

/** Baja lógica de la asignación (queda en el historial de la sección). */
estructura.delete('/asignaciones/:id', async (c) => {
  const a = await asignacionActiva(c, idParam(c.req.param('id')))
  await accesoMunicipio(c, a.municipio_id, true)
  await c.env.DB.prepare(
    `UPDATE operador_asignacion SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
  )
    .bind(a.id)
    .run()
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

/** Nombres en mayúsculas, como el padrón original. */
function nombrePersona(v: unknown): string {
  const n = texto(v)?.toUpperCase()
  if (!n) throw new ErrorApi(400, 'Escribe el nombre')
  return n
}

/** Teléfono de 10 dígitos (se ignoran espacios y guiones) o vacío. */
function telefonoPersona(v: unknown): string | null {
  const t = texto(v)
  if (t === null) return null
  const d = t.replace(/\D/g, '')
  if (d.length !== 10) throw new ErrorApi(400, 'El teléfono debe tener 10 dígitos')
  return d
}

function numPersonas(v: unknown): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > 100000) throw new ErrorApi(400, 'Personas debe ser un entero mayor o igual a 0')
  return n
}

/** 1 o 2 ids de personas activas del municipio, distintas entre sí y del operador. */
async function validarEnlaces(c: Ctx, municipioId: number, operadorId: number | null, v: unknown): Promise<number[]> {
  if (!Array.isArray(v)) throw new ErrorApi(400, 'enlaces debe ser una lista de ids')
  const ids = [...new Set(v.map(Number))]
  if (ids.length > 2) throw new ErrorApi(400, 'Un operador tiene como máximo 2 enlaces')
  if (ids.some((x) => !Number.isInteger(x) || x <= 0)) throw new ErrorApi(400, 'Enlaces inválidos')
  if (operadorId !== null && ids.includes(operadorId)) throw new ErrorApi(400, 'El operador no puede ser su propio enlace')
  if (!ids.length) return ids
  const r = await c.env.DB.prepare(
    `SELECT count(*) AS n FROM persona WHERE municipio_id = ? AND deleted_at IS NULL AND id IN (SELECT value FROM json_each(?))`,
  )
    .bind(municipioId, JSON.stringify(ids))
    .first<{ n: number }>()
  if (r?.n !== ids.length) throw new ErrorApi(400, 'Algún enlace no existe, está dado de baja o es de otro municipio')
  return ids
}

function insertarEnlaces(c: Ctx, operadorId: number, enlaces: number[]) {
  return enlaces.map((e, i) =>
    c.env.DB.prepare('INSERT INTO operador_enlace (operador_id, orden, enlace_id) VALUES (?, ?, ?)').bind(operadorId, i + 1, e),
  )
}

export default estructura
