// Tema del sitio (DISENO.md §6). La fuente de verdad será la API (tabla `configuracion`, clave `tema`);
// mientras no exista, se guarda solo en localStorage, que además evita el parpadeo al cargar.

export const TEMAS = ['verde', 'azul', 'naranja', 'guinda'] as const
export type Tema = (typeof TEMAS)[number]

const CLAVE = 'govtrack.tema'

export function temaGuardado(): Tema {
  try {
    const t = localStorage.getItem(CLAVE)
    if (t && (TEMAS as readonly string[]).includes(t)) return t as Tema
  } catch {
    // localStorage puede no estar disponible (modo privado).
  }
  return 'verde'
}

export function aplicarTema(t: Tema) {
  document.documentElement.dataset.tema = t
}

export function guardarTema(t: Tema) {
  aplicarTema(t)
  try {
    localStorage.setItem(CLAVE, t)
  } catch {
    // Sin persistencia local; el tema se aplica solo en esta sesión.
  }
}
