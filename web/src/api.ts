import { useCallback, useEffect, useState } from 'react'
import { navegar } from './router'

// Cliente mínimo de la API (/api/*, mismo origen que el frontend).

export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje)
  }
}

export async function api<T>(ruta: string, opts: { metodo?: string; datos?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api${ruta}`, {
    method: opts.metodo ?? 'GET',
    headers: opts.datos === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: opts.datos === undefined ? undefined : JSON.stringify(opts.datos),
  })
  const cuerpo = (await r.json().catch(() => null)) as (T & { error?: string }) | null
  if (r.status === 401) irALogin()
  if (!r.ok) throw new ErrorApi(r.status, r.status === 401 ? 'Tu sesión terminó. Vuelve a iniciar sesión.' : (cuerpo?.error ?? `Error ${r.status}`))
  return cuerpo as T
}

/** Sin sesión (o expirada): al login, recordando a dónde volver. */
export function irALogin() {
  if (location.pathname === '/login') return
  navegar('/login?volver=' + encodeURIComponent(location.pathname + location.search), { reemplazar: true })
}

/** URL que inicia el login con Google (navegación completa, no fetch). */
export function urlLogin(volver: string | null) {
  return '/api/auth/login' + (volver ? '?volver=' + encodeURIComponent(volver) : '')
}

export async function cerrarSesion() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  navegar('/login', { reemplazar: true })
}

/** GET con estado de carga. `ruta = null` no consulta (p. ej. mientras falta el municipio). */
export function useApi<T>(ruta: string | null) {
  const [estado, setEstado] = useState<{ ruta: string | null; datos?: T; error?: ErrorApi }>({ ruta: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!ruta) return
    let vigente = true
    api<T>(ruta).then(
      (datos) => vigente && setEstado({ ruta, datos }),
      (e: unknown) => vigente && setEstado({ ruta, error: e instanceof ErrorApi ? e : new ErrorApi(0, 'No se pudo conectar con el servidor') }),
    )
    return () => {
      vigente = false
    }
  }, [ruta, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])
  // Mientras llega la respuesta de una ruta nueva se conservan los datos anteriores (sin parpadeo).
  return { datos: estado.datos, error: estado.ruta === ruta ? estado.error : undefined, cargando: !!ruta && estado.ruta !== ruta, recargar }
}

// ---------- Tipos de la API ----------

export type Municipio = { id: number; clave_ine: number | null; nombre: string }
export type Proceso = { id: number; anio: number; nombre: string; elecciones: { id: number; cargo: string }[] }
export type Usuario = { id: number; email: string; nombre: string; rol: 'ADMIN' | 'CAPTURISTA' | 'CONSULTA' }

export type Pagina<T> = { total: number; filas: T[] }

export type UsuarioFila = Usuario & {
  activo: boolean
  /** Ya entró con Google; su email ya no se puede cambiar. */
  vinculado: boolean
  ultimo_acceso: string | null
  created_at: string
  /** Vacío para ADMIN (ve todos). */
  municipios: { id: number; nombre: string }[]
}

export type SeccionFila = {
  id: number
  numero: number
  tipo: string | null
  sector: string | null
  colonias: number
  colonias_cubiertas: number
  operadores: number
  personas: number
  casillas: number
  ln: number
}

export type ColoniaFila = {
  id: number
  nombre: string
  tipo_asentamiento: string | null
  cp: string | null
  operadores: number
  personas: number
  secciones: { id: number; numero: number }[]
}

export type EleccionResultados = {
  id: number
  cargo: string
  partidos: string[]
  casillas: { casilla: string; ln: number; votos: number[] }[]
}

export type SeccionDetalle = {
  id: number
  numero: number
  tipo: string | null
  sector: string | null
  municipio_id: number
  municipio: string
  colonias: number
  colonias_cubiertas: number
  operadores: number
  personas: number
  casillas: number
  ln: number
  elecciones: EleccionResultados[]
}

export type ColoniaDeSeccion = {
  id: number
  nombre: string
  tipo_asentamiento: string | null
  cp: string | null
  operadores: number
  personas: number
  otras_secciones: number[]
  enlaces: { id: number; nombre: string }[]
}

export type EventoHistorial = { tipo: 'alta' | 'baja'; fecha: string; colonia: string; operador: string; usuario: string | null }

export type PersonaBreve = { id: number; nombre: string; telefono: string | null }

export type OperadorFila = PersonaBreve & { enlaces: PersonaBreve[]; colonias: number; personas: number; enlace_de: number }

export type EnlaceFila = PersonaBreve & { operadores: number; colonias: number; personas: number }

export type Asignacion = {
  id: number
  seccion_id: number
  seccion: number
  colonia_id: number
  colonia: string
  num_personas: number
  observaciones: string | null
}

/** Fila de /municipios/:mid/asignaciones (vigentes o dadas de baja). */
export type AsignacionFila = Asignacion & {
  operador_id: number
  operador: string
  telefono: string | null
  enlaces: PersonaBreve[]
  created_at: string
  deleted_at: string | null
}

/** Par sección + colonia sin asignación vigente (?estado=sin-operador). */
export type ColoniaSinOperador = { seccion_id: number; seccion: number; colonia_id: number; colonia: string }

export type PaginaAsignaciones<T> = Pagina<T> & { operadores: number; personas: number }

export type PersonaSinAsignar = PersonaBreve & { created_at: string }

export type PersonaDetalle = PersonaBreve & {
  municipio_id: number
  deleted_at: string | null
  enlaces: PersonaBreve[]
  asignaciones: Asignacion[]
  enlace_de: { id: number; nombre: string }[]
}

export type PanelDatos = {
  secciones: number
  secciones_cubiertas: number
  operadores: number
  colonias: number
  enlaces: number
  personas: number
  ln: number
  proceso_id: number | null
  elecciones: { id: number; cargo: string; ln: number; votos: number; partidos: { siglas: string; votos: number }[] }[]
}

export type Partido = { id: number; siglas: string; nombre: string | null }

/** Categorías de Prioridad, en orden: banda del margen + con/sin estructura. */
export type CategoriaPrioridad = 'competida-sin' | 'competida-con' | 'ganada-sin' | 'perdida-con' | 'perdida-sin' | 'ganada-con'

export type PrioridadFila = {
  id: number
  numero: number
  categoria: CategoriaPrioridad
  votos: number
  propio: number
  rival: string | null
  votos_rival: number
  /** Puntos: (propio − rival) / votos × 100. */
  margen: number
  operadores: number
  personas: number
  ln: number
  /** personas / ln, en %. */
  cobertura: number
}

export type PrioridadDatos = Pagina<PrioridadFila> & {
  partido_propio: string | null
  proceso_id: number | null
  eleccion: { id: number; cargo: string } | null
  umbral_margen: number
  umbral_cobertura: number
  municipio: { votos: number; propio: number; rival: string | null; votos_rival: number; ln: number } | null
  matriz: Record<CategoriaPrioridad, { secciones: number; ln: number }>
  sin_resultados: number
}

export type EventoActividad =
  | { tipo: 'alta' | 'baja'; fecha: string; seccion: number; colonia: string; operador: string; usuario: string | null; sin_operador?: boolean }
  | { tipo: 'importacion'; fecha: string; usuario: string | null; archivo: string; destino: string; filas_ok: number; filas_error: number }
