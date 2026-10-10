// Formato de México: coma para miles y punto para decimales (DISENO.md §3).
const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const n = (v: number) => entero.format(v)
export const pct = (v: number) => `${decimal.format(v)} %`

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

/**
 * Primer apellido, suponiendo "nombre(s) apellido1 apellido2". Las partículas van con la palabra que
 * sigue ("de la Torre" cuenta como una). Con 2–3 piezas es la segunda; con 4 o más, la penúltima:
 * "José Luis de la Torre Pérez" → "de la Torre", "Juan Pérez de la Cruz" → "Pérez".
 */
function primerApellido(partes: string[]) {
  const piezas: string[] = []
  let pendiente: string[] = []
  for (const p of partes) {
    pendiente.push(p)
    if (!PARTICULAS.has(p.toLowerCase())) {
      piezas.push(pendiente.join(' '))
      pendiente = []
    }
  }
  if (pendiente.length) piezas.push(pendiente.join(' '))
  return piezas[piezas.length >= 4 ? piezas.length - 2 : 1] ?? partes[1]
}

/** "Jorge Ramírez" → "J. Ramírez"; "Mayany Marroquín Pérez" → "M. Marroquín" */
export function abreviar(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length < 2) return nombre
  return `${partes[0][0]}. ${primerApellido(partes)}`
}

/** "María Elena Cruz Pérez" → "MC" */
export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length < 2) return partes[0][0].toUpperCase()
  const apellido = primerApellido(partes).split(' ').filter((x) => !PARTICULAS.has(x.toLowerCase()))[0] ?? partes[1]
  return (partes[0][0] + apellido[0]).toUpperCase()
}

/** Número de sección con 4 dígitos, como en el INE: 812 → "0812". */
export const numSeccion = (v: number) => String(v).padStart(4, '0')

/** "TAPACHULA" → "Tapachula" (los catálogos del INE vienen en mayúsculas). */
export function nombrePropio(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s(-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    .replace(/ (De|Del|La|Las|Los|Y)(?= )/g, (m) => m.toLowerCase())
}

/** "9621184402" → "962 118 4402". */
export const telefono = (t: string | null) => (t && /^\d{10}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}` : (t ?? ''))

const CARGOS: Record<string, string> = {
  PRESIDENCIA: 'Presidencia',
  SENADURIA: 'Senaduría',
  DIPUTACION_FEDERAL: 'Diputación federal',
  GUBERNATURA: 'Gubernatura',
  DIPUTACION_LOCAL: 'Diputación local',
  AYUNTAMIENTO: 'Ayuntamiento',
}
export const nombreCargo = (cargo: string) => CARGOS[cargo] ?? cargo

const fechaCorta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

/** Fecha ISO-8601 UTC de la BD → "Hoy, 09:15", "Ayer, 18:03" o "6 oct 2026". */
export function cuando(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const dias = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000)
  if (dias === 0) return `Hoy, ${hora.format(d)}`
  if (dias === 1) return `Ayer, ${hora.format(d)}`
  return fechaCorta.format(d)
}
