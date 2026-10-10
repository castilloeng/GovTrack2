import { Hono } from 'hono'
import { accesoMunicipio, ErrorApi, idParam, type Env } from './comun'

// Prioridad por sección (DISENO.md §5 "Prioridad"). Los votos son de la elección registrada (pasada) y
// las personas de la estructura son la META para la siguiente elección: el cruce es una proyección.
//
// La meta "alcanza" si, contando como votos nuevos el `efectividad` % de las personas comprometidas,
// la sección quedaría ganada por al menos `margen` puntos (fuera de la zona competida).
// Las secciones ganadas por más de `margen` puntos ya lo cumplen (bastión).

const prioridad = new Hono<Env>()

/** Categorías en orden de prioridad. */
export const CATEGORIAS = ['prioridad', 'cubierta', 'apuesta', 'abrir', 'bastion'] as const
type Categoria = (typeof CATEGORIAS)[number]

/** Efectividad por omisión: % de las personas comprometidas que se cuentan como votos nuevos. */
export const EFECTIVIDAD = 50

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
  /** Meta: personas comprometidas para la siguiente elección. */
  personas: number
  /** Personas que harían falta comprometer para quedar ganada por `margen` puntos. */
  necesarias: number
  faltan: number
  /** Margen proyectado con la meta y la efectividad, en puntos. */
  proyeccion: number
  ln: number
}

/** Número de un parámetro de consulta con valor por omisión y límites. */
function numero(v: string | undefined, nombre: string, defecto: number, max: number): number {
  if (v === undefined || v === '') return defecto
  const x = Number(v)
  if (!Number.isFinite(x) || x <= 0 || x > max) throw new ErrorApi(400, `${nombre} inválido`)
  return x
}

/** Margen en puntos tras sumar `extra` votos nuevos al partido propio. */
const margenCon = (propio: number, rival: number, votos: number, extra: number) =>
  votos + extra > 0 ? ((propio + extra - rival) / (votos + extra)) * 100 : 0

prioridad.get('/municipios/:mid/prioridad', async (c) => {
  const mid = idParam(c.req.param('mid'), 'municipio')
  await accesoMunicipio(c, mid)
  const db = c.env.DB
  const umbralMargen = numero(c.req.query('margen'), 'margen', 10, 99)
  const categoria = c.req.query('categoria')
  if (categoria && !(CATEGORIAS as readonly string[]).includes(categoria)) throw new ErrorApi(400, 'categoria inválida')
  const pagina = Math.max(1, Math.floor(Number(c.req.query('pagina')) || 1))
  const limite = Math.min(100, Math.max(1, Math.floor(Number(c.req.query('limite')) || 50)))

  const { results: config } = await db
    .prepare(`SELECT clave, valor FROM configuracion WHERE clave IN ('partido_propio', 'efectividad')`)
    .all<{ clave: string; valor: string }>()
  const propio = config.find((r) => r.clave === 'partido_propio')?.valor ?? null
  const efectividad = numero(c.req.query('efectividad'), 'efectividad', Number(config.find((r) => r.clave === 'efectividad')?.valor) || EFECTIVIDAD, 100)

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

  const vacia = () => ({ secciones: 0, ln: 0, personas: 0, faltan: 0 })
  const matriz = Object.fromEntries(CATEGORIAS.map((k) => [k, vacia()])) as Record<Categoria, ReturnType<typeof vacia>>
  const base = { partido_propio: propio, proceso_id: proceso, eleccion, umbral_margen: umbralMargen, efectividad }
  if (!propio || !eleccion) {
    return c.json({ ...base, municipio: null, matriz, sin_resultados: 0, total: 0, filas: [] })
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

  const u = umbralMargen / 100
  const e = efectividad / 100
  let sinResultados = 0
  let personasMunicipio = 0
  const filas: Fila[] = []
  for (const s of secciones.results as { id: number; numero: number; ln: number; operadores: number; personas: number }[]) {
    personasMunicipio += s.personas
    const partidos = porSeccion.get(s.id)
    const cuenta = partidos && contar(partidos)
    if (!cuenta || cuenta.total === 0) {
      sinResultados++
      continue
    }
    const dif = cuenta.suyos - cuenta.votosRival
    const margen = (dif / cuenta.total) * 100
    // Votos nuevos x para que (dif + x) / (votos + x) ≥ u  →  x ≥ (u·votos − dif) / (1 − u).
    // (Se resta un épsilon para que el error de punto flotante no sume uno de más: 72.00000000000001 → 72.)
    const votosNecesarios = Math.max(0, Math.ceil((u * cuenta.total - dif) / (1 - u) - 1e-9))
    const necesarias = Math.ceil(votosNecesarios / e - 1e-9)
    const faltan = Math.max(0, necesarias - s.personas)
    const banda = margen > umbralMargen ? 'ganada' : margen < -umbralMargen ? 'perdida' : 'competida'
    const cat: Categoria =
      banda === 'ganada' ? 'bastion' : banda === 'competida' ? (faltan > 0 ? 'prioridad' : 'cubierta') : faltan > 0 ? 'abrir' : 'apuesta'
    const m = matriz[cat]
    m.secciones++
    m.ln += s.ln
    m.personas += s.personas
    m.faltan += faltan
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
      necesarias,
      faltan,
      proyeccion: Math.round(margenCon(cuenta.suyos, cuenta.votosRival, cuenta.total, s.personas * e) * 10) / 10,
      ln: s.ln,
    })
  }

  // Por prioridad. Donde la meta no alcanza, primero las que necesitan menos personas; en el resto, el margen más cerrado.
  filas.sort(
    (a, b) =>
      CATEGORIAS.indexOf(a.categoria) - CATEGORIAS.indexOf(b.categoria) ||
      (a.faltan > 0 ? a.faltan - b.faltan : Math.abs(a.margen) - Math.abs(b.margen)) ||
      a.numero - b.numero,
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
      margen: Math.round(margenCon(mun.suyos, mun.votosRival, mun.total, 0) * 10) / 10,
      personas: personasMunicipio,
      proyeccion: Math.round(margenCon(mun.suyos, mun.votosRival, mun.total, personasMunicipio * e) * 10) / 10,
      ln: (secciones.results as { ln: number }[]).reduce((t, s) => t + s.ln, 0),
    },
    matriz,
    sin_resultados: sinResultados,
    total: filtradas.length,
    filas: filtradas.slice((pagina - 1) * limite, pagina * limite),
  })
})

export default prioridad
