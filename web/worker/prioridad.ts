import { Hono } from 'hono'
import { accesoMunicipio, ErrorApi, idParam, type Env } from './comun'

// Prioridad por sección (DISENO.md §5 "Prioridad"): cruza el resultado del partido propio
// (configuracion.partido_propio) con la cobertura de la estructura en cada sección.

const prioridad = new Hono<Env>()

/** Categorías en orden de prioridad. */
export const CATEGORIAS = ['competida-sin', 'competida-con', 'ganada-sin', 'perdida-con', 'perdida-sin', 'ganada-con'] as const
type Categoria = (typeof CATEGORIAS)[number]

type Fila = {
  id: number
  numero: number
  categoria: Categoria
  votos: number
  propio: number
  rival: string | null
  votos_rival: number
  /** (propio − rival) / votos, en puntos. */
  margen: number
  operadores: number
  personas: number
  ln: number
  /** personas / ln, en %. */
  cobertura: number
}

/** Número de un parámetro de consulta con valor por omisión y límites. */
function numero(v: string | undefined, nombre: string, defecto: number, max: number): number {
  if (v === undefined || v === '') return defecto
  const x = Number(v)
  if (!Number.isFinite(x) || x <= 0 || x > max) throw new ErrorApi(400, `${nombre} inválido`)
  return x
}

prioridad.get('/municipios/:mid/prioridad', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const db = c.env.DB
  const umbralMargen = numero(c.req.query('margen'), 'margen', 10, 100)
  const umbralCobertura = numero(c.req.query('cobertura'), 'cobertura', 3, 100)
  const categoria = c.req.query('categoria')
  if (categoria && !(CATEGORIAS as readonly string[]).includes(categoria)) throw new ErrorApi(400, 'categoria inválida')
  const pagina = Math.max(1, Math.floor(Number(c.req.query('pagina')) || 1))
  const limite = Math.min(100, Math.max(1, Math.floor(Number(c.req.query('limite')) || 50)))

  const propio = (await db.prepare(`SELECT valor FROM configuracion WHERE clave = 'partido_propio'`).first<{ valor: string }>())?.valor ?? null

  // Proceso pedido o el más reciente; elección pedida o Ayuntamiento (o la primera con votos en el municipio).
  const procesoQ = c.req.query('proceso')
  const proceso = procesoQ
    ? idParam(procesoQ, 'proceso')
    : ((await db.prepare('SELECT id FROM proceso_electoral ORDER BY anio DESC, id DESC LIMIT 1').first<{ id: number }>())?.id ?? null)
  const { results: elecciones } = await db
    .prepare(
      `SELECT e.id, e.cargo FROM eleccion e
       WHERE e.proceso_id = ?2 AND EXISTS (
         SELECT 1 FROM resultado r JOIN casilla k ON k.id = r.casilla_id JOIN seccion s ON s.id = k.seccion_id
         WHERE r.eleccion_id = e.id AND s.municipio_id = ?1)
       ORDER BY e.cargo <> 'AYUNTAMIENTO', e.id`,
    )
    .bind(mid, proceso)
    .all<{ id: number; cargo: string }>()
  const eleccionQ = c.req.query('eleccion')
  let eleccion: { id: number; cargo: string } | null = elecciones[0] ?? null
  if (eleccionQ) {
    const id = idParam(eleccionQ, 'eleccion')
    eleccion = elecciones.find((e) => e.id === id) ?? null
    if (!eleccion) throw new ErrorApi(404, 'La elección no tiene resultados en este municipio y proceso')
  }

  const vacio = { secciones: 0, ln: 0 }
  const base = {
    partido_propio: propio,
    proceso_id: proceso,
    eleccion,
    umbral_margen: umbralMargen,
    umbral_cobertura: umbralCobertura,
  }
  if (!propio || !eleccion) {
    return c.json({
      ...base,
      municipio: null,
      matriz: Object.fromEntries(CATEGORIAS.map((k) => [k, vacio])),
      sin_resultados: 0,
      total: 0,
      filas: [],
    })
  }

  const [secciones, votos] = await db.batch([
    db
      .prepare(
        `SELECT s.id, s.numero,
                (SELECT coalesce(sum(k.lista_nominal), 0) FROM casilla k WHERE k.seccion_id = s.id AND k.proceso_id = ?2) AS ln,
                (SELECT count(DISTINCT a.operador_id) FROM operador_asignacion a JOIN persona o ON o.id = a.operador_id
                   WHERE a.seccion_id = s.id AND a.deleted_at IS NULL AND o.deleted_at IS NULL) AS operadores,
                (SELECT coalesce(sum(a.num_personas), 0) FROM operador_asignacion a JOIN persona o ON o.id = a.operador_id
                   WHERE a.seccion_id = s.id AND a.deleted_at IS NULL AND o.deleted_at IS NULL) AS personas
         FROM seccion s WHERE s.municipio_id = ?1`,
      )
      .bind(mid, proceso),
    db
      .prepare(
        `SELECT k.seccion_id, p.siglas, sum(r.votos) AS votos
         FROM resultado r
         JOIN casilla k ON k.id = r.casilla_id
         JOIN seccion s ON s.id = k.seccion_id
         JOIN partido p ON p.id = r.partido_id
         WHERE r.eleccion_id = ?2 AND s.municipio_id = ?1
         GROUP BY k.seccion_id, p.id`,
      )
      .bind(mid, eleccion.id),
  ])

  // Votos por sección y partido.
  const porSeccion = new Map<number, Map<string, number>>()
  const totalMunicipio = new Map<string, number>()
  for (const v of votos.results as { seccion_id: number; siglas: string; votos: number }[]) {
    if (!porSeccion.has(v.seccion_id)) porSeccion.set(v.seccion_id, new Map())
    porSeccion.get(v.seccion_id)!.set(v.siglas, v.votos)
    totalMunicipio.set(v.siglas, (totalMunicipio.get(v.siglas) ?? 0) + v.votos)
  }

  const esPropio = (siglas: string) => siglas.toUpperCase() === propio.toUpperCase()
  /** Votos totales, del partido propio y del rival principal (el más votado distinto del propio). */
  function contar(partidos: Map<string, number>) {
    let total = 0
    let suyos = 0
    let rival: string | null = null
    let votosRival = 0
    for (const [siglas, v] of partidos) {
      total += v
      if (esPropio(siglas)) suyos += v
      else if (v > votosRival || rival === null) {
        rival = siglas
        votosRival = v
      }
    }
    return { total, suyos, rival, votosRival }
  }

  const matriz = Object.fromEntries(CATEGORIAS.map((k) => [k, { secciones: 0, ln: 0 }])) as Record<Categoria, { secciones: number; ln: number }>
  let sinResultados = 0
  const filas: Fila[] = []
  for (const s of secciones.results as { id: number; numero: number; ln: number; operadores: number; personas: number }[]) {
    const partidos = porSeccion.get(s.id)
    const cuenta = partidos && contar(partidos)
    if (!cuenta || cuenta.total === 0) {
      sinResultados++
      continue
    }
    const margen = ((cuenta.suyos - cuenta.votosRival) / cuenta.total) * 100
    const cobertura = s.ln > 0 ? (s.personas / s.ln) * 100 : 0
    const banda = margen > umbralMargen ? 'ganada' : margen < -umbralMargen ? 'perdida' : 'competida'
    const cat = `${banda}-${cobertura >= umbralCobertura ? 'con' : 'sin'}` as Categoria
    matriz[cat].secciones++
    matriz[cat].ln += s.ln
    filas.push({
      id: s.id,
      numero: s.numero,
      categoria: cat,
      votos: cuenta.total,
      propio: cuenta.suyos,
      rival: cuenta.rival,
      votos_rival: cuenta.votosRival,
      margen: Math.round(margen * 10) / 10,
      operadores: s.operadores,
      personas: s.personas,
      ln: s.ln,
      cobertura: Math.round(cobertura * 100) / 100,
    })
  }

  // Por prioridad y, dentro de cada categoría, el margen más cerrado primero.
  filas.sort(
    (a, b) => CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) || Math.abs(a.margen) - Math.abs(b.margen) || a.numero - b.numero,
  )
  const filtradas = categoria ? filas.filter((f) => f.categoria === categoria) : filas

  const mun = contar(totalMunicipio)
  return c.json({
    ...base,
    municipio: {
      votos: mun.total,
      propio: mun.suyos,
      rival: mun.rival,
      votos_rival: mun.votosRival,
      ln: (secciones.results as { ln: number }[]).reduce((t, s) => t + s.ln, 0),
    },
    matriz,
    sin_resultados: sinResultados,
    total: filtradas.length,
    filas: filtradas.slice((pagina - 1) * limite, pagina * limite),
  })
})

export default prioridad
