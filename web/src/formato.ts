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
