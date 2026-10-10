// Formato de México: coma para miles y punto para decimales (DISENO.md §3).
const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const n = (v: number) => entero.format(v)
export const pct = (v: number) => `${decimal.format(v)} %`

/** "Jorge Ramírez" → "J. Ramírez" */
export function abreviar(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length < 2) return nombre
  return `${partes[0][0]}. ${partes[partes.length >= 4 ? 2 : partes.length - 1]}`
}

/** "María Elena Cruz Pérez" → "MC" */
export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  const apellido = partes.length >= 4 ? partes[2] : partes[partes.length - 1]
  return (partes[0][0] + (partes.length > 1 ? apellido[0] : '')).toUpperCase()
}

/** Número de sección con 4 dígitos, como en el INE: 812 → "0812". */
export const numSeccion = (v: number) => String(v).padStart(4, '0')

/** "TAPACHULA" → "Tapachula" (los catálogos del INE vienen en mayúsculas). */
export function nombrePropio(s: string) {
  return s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
}

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
