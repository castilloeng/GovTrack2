import { Hono } from 'hono'
import { accesoMunicipio, idParam, type Ctx, type Env } from './comun'

// Panel del municipio (DISENO.md §5 "Panel del municipio"): indicadores, resultado por elección y actividad reciente.
// La tabla "Cobertura por sección" usa GET /municipios/:mid/secciones (geografia.ts).

const panel = new Hono<Env>()

/** Proceso pedido en ?proceso= o, si no viene, el más reciente. */
async function procesoId(c: Ctx): Promise<number | null> {
  const q = c.req.query('proceso')
  if (q) return idParam(q, 'proceso')
  const r = await c.env.DB.prepare('SELECT id FROM proceso_electoral ORDER BY anio DESC, id DESC LIMIT 1').first<{ id: number }>()
  return r?.id ?? null
}

/**
 * Indicadores del municipio y votación total de cada elección del proceso.
 * Operadores y enlaces siguen la misma definición que /operadores y /enlaces (estructura.ts).
 */
panel.get('/municipios/:mid/panel', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const proceso = await procesoId(c)
  const db = c.env.DB

  const [kpis, elecciones, votos] = await db.batch([
    db.prepare(
      `WITH asig AS (
         SELECT a.seccion_id, a.colonia_id, a.operador_id, a.num_personas
         FROM operador_asignacion a
         JOIN persona o ON o.id = a.operador_id
         JOIN seccion s ON s.id = a.seccion_id
         WHERE a.deleted_at IS NULL AND o.deleted_at IS NULL AND s.municipio_id = ?1)
       SELECT (SELECT count(*) FROM seccion WHERE municipio_id = ?1) AS secciones,
              (SELECT count(DISTINCT seccion_id) FROM asig) AS secciones_cubiertas,
              (SELECT count(*) FROM persona p WHERE p.municipio_id = ?1 AND p.deleted_at IS NULL
                 AND (EXISTS (SELECT 1 FROM asig WHERE operador_id = p.id)
                      OR EXISTS (SELECT 1 FROM operador_enlace WHERE operador_id = p.id))) AS operadores,
              (SELECT count(DISTINCT colonia_id) FROM asig) AS colonias,
              (SELECT count(DISTINCT oe.enlace_id) FROM operador_enlace oe
                 JOIN persona o ON o.id = oe.operador_id AND o.deleted_at IS NULL
                 JOIN persona e ON e.id = oe.enlace_id AND e.deleted_at IS NULL
                 WHERE e.municipio_id = ?1) AS enlaces,
              (SELECT coalesce(sum(num_personas), 0) FROM asig) AS personas,
              (SELECT coalesce(sum(k.lista_nominal), 0) FROM casilla k JOIN seccion s ON s.id = k.seccion_id
                 WHERE s.municipio_id = ?1 AND k.proceso_id = ?2) AS ln`,
    ).bind(mid, proceso),
    // Lista nominal de las casillas con resultados en cada elección (base de la participación).
    db.prepare(
      `SELECT e.id, e.cargo,
              (SELECT coalesce(sum(k.lista_nominal), 0) FROM casilla k JOIN seccion s ON s.id = k.seccion_id
                 WHERE s.municipio_id = ?1 AND k.proceso_id = e.proceso_id
                   AND EXISTS (SELECT 1 FROM resultado r WHERE r.casilla_id = k.id AND r.eleccion_id = e.id)) AS ln
       FROM eleccion e WHERE e.proceso_id = ?2 ORDER BY e.id`,
    ).bind(mid, proceso),
    db.prepare(
      `SELECT r.eleccion_id, p.siglas, sum(r.votos) AS votos
       FROM resultado r
       JOIN eleccion e ON e.id = r.eleccion_id
       JOIN casilla k ON k.id = r.casilla_id
       JOIN seccion s ON s.id = k.seccion_id
       JOIN partido p ON p.id = r.partido_id
       WHERE e.proceso_id = ?2 AND s.municipio_id = ?1
       GROUP BY r.eleccion_id, p.id
       ORDER BY votos DESC`,
    ).bind(mid, proceso),
  ])

  const vs = votos.results as { eleccion_id: number; siglas: string; votos: number }[]
  return c.json({
    ...(kpis.results[0] as Record<string, number>),
    proceso_id: proceso,
    elecciones: (elecciones.results as { id: number; cargo: string; ln: number }[]).map((e) => {
      const partidos = vs.filter((v) => v.eleccion_id === e.id).map(({ siglas, votos }) => ({ siglas, votos }))
      return { ...e, votos: partidos.reduce((t, p) => t + p.votos, 0), partidos }
    }),
  })
})

/**
 * Actividad reciente del municipio: altas y bajas de asignaciones e importaciones, la más reciente primero.
 * En las bajas, `sin_operador` indica que la sección no tiene hoy ningún operador. ?limite= (máx. 50, por omisión 10)
 */
panel.get('/municipios/:mid/actividad', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const limite = Math.min(50, Math.max(1, Number(c.req.query('limite')) || 10))

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM (
       SELECT 'alta' AS tipo, a.created_at AS fecha, s.numero AS seccion, col.nombre AS colonia, o.nombre AS operador,
              u.nombre AS usuario, NULL AS archivo, NULL AS destino, NULL AS filas_ok, NULL AS filas_error, 0 AS sin_operador
       FROM operador_asignacion a
       JOIN seccion s ON s.id = a.seccion_id JOIN colonia col ON col.id = a.colonia_id JOIN persona o ON o.id = a.operador_id
       LEFT JOIN usuario u ON u.id = a.created_by
       WHERE s.municipio_id = ?1
       UNION ALL
       SELECT 'baja', a.deleted_at, s.numero, col.nombre, o.nombre, NULL, NULL, NULL, NULL, NULL,
              NOT EXISTS (SELECT 1 FROM operador_asignacion a2 JOIN persona o2 ON o2.id = a2.operador_id
                          WHERE a2.seccion_id = a.seccion_id AND a2.deleted_at IS NULL AND o2.deleted_at IS NULL)
       FROM operador_asignacion a
       JOIN seccion s ON s.id = a.seccion_id JOIN colonia col ON col.id = a.colonia_id JOIN persona o ON o.id = a.operador_id
       WHERE s.municipio_id = ?1 AND a.deleted_at IS NOT NULL
       UNION ALL
       SELECT 'importacion', i.created_at, NULL, NULL, NULL, u.nombre, i.archivo, i.destino, i.filas_ok, i.filas_error, 0
       FROM importacion i JOIN usuario u ON u.id = i.usuario_id
       WHERE i.municipio_id = ?1 OR i.municipio_id IS NULL)
     ORDER BY fecha DESC LIMIT ?2`,
  )
    .bind(mid, limite)
    .all<Record<string, unknown> & { tipo: string; sin_operador: number }>()

  // Cada tipo devuelve solo sus campos.
  return c.json(
    results.map(({ tipo, fecha, seccion, colonia, operador, usuario, archivo, destino, filas_ok, filas_error, sin_operador }) =>
      tipo === 'importacion'
        ? { tipo, fecha, usuario, archivo, destino, filas_ok, filas_error }
        : { tipo, fecha, seccion, colonia, operador, usuario, ...(tipo === 'baja' ? { sin_operador: !!sin_operador } : {}) },
    ),
  )
})

export default panel
