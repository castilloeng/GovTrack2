import { useCallback, useEffect, useState } from 'react'

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
  if (!r.ok) {
    const mensaje = r.status === 401 ? 'Inicia sesión con un usuario que pueda capturar.' : (cuerpo?.error ?? `Error ${r.status}`)
    throw new ErrorApi(r.status, mensaje)
  }
  return cuerpo as T
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
