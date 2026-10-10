// Tema global del sitio (DISENO.md §6). La fuente de verdad es la tabla `configuracion` en D1
// (GET /api/configuracion, PUT /api/configuracion/tema, solo ADMIN). localStorage solo guarda una copia
// para pintar el color correcto antes de que responda la API y evitar el parpadeo.

export const TEMAS = ['verde', 'azul', 'naranja', 'guinda'] as const
export type Tema = (typeof TEMAS)[number]

const CLAVE = 'govtrack.tema'

const esTema = (t: unknown): t is Tema => typeof t === 'string' && (TEMAS as readonly string[]).includes(t)

export function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    if (esTema(t)) return t
  } catch {
    // localStorage puede no estar disponible (modo privado).
  }
  return 'verde'
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t
}

function recordar(t: Tema) {
  aplicarTema(t)
  try {
    localStorage.setItem(CLAVE, t)
  } catch {
    // Sin copia local; el tema se vuelve a pedir a la API la próxima vez.
  }
}

/** Lee el tema del sitio desde la API y lo aplica. Si la API no responde, se queda el de la copia local. */
export async function cargarTema(): Promise<Tema> {
  try {
    const r = await fetch('/api/configuracion')
    if (r.ok) {
      const { tema } = (await r.json()) as { tema?: unknown }
      if (esTema(tema)) {
        recordar(tema)
        return tema
      }
    }
  } catch {
    // Sin red: se usa la copia local.
  }
  return temaGuardado()
}

/** Guarda el tema del sitio (D1). Lanza un error si la API no lo acepta. */
export async function guardarTema(t: Tema) {
  const r = await fetch('/api/configuracion/tema', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tema: t }),
  })
  if (!r.ok) {
    const { error } = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(r.status === 401 ? 'Inicia sesión como administrador para guardar el tema.' : (error ?? `Error ${r.status}`))
  }
  recordar(t)
}
