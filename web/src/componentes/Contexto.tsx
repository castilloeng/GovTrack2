import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type Municipio, type Proceso, type Usuario } from '../api'
import { nombrePropio } from '../formato'

// Municipio y proceso electoral seleccionados en la barra superior (DISENO.md §1.2).
// Los catálogos salen de la API; la selección se recuerda en localStorage.

type Contexto = {
  municipios: Municipio[]
  procesos: Proceso[]
  municipioId: number | null
  procesoId: number | null
  /** Nombre para mostrar del municipio elegido ("Tapachula"). */
  municipio: string
  /** Nombre corto del proceso elegido ("Proceso 2024"). */
  proceso: string
  setMunicipioId: (id: number) => void
  setProcesoId: (id: number) => void
  /** Usuario de /api/me. El contexto solo se muestra con sesión. */
  usuario: Usuario
  puedeCapturar: boolean
}

const Ctx = createContext<Contexto | null>(null)

const CLAVE = 'govtrack.contexto'

function leerGuardado(): { municipio?: number; proceso?: number } {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '{}')
  } catch {
    return {}
  }
}

export const nombreProceso = (p: Proceso) => `Proceso ${p.anio}`

export function ContextoProvider({ children }: { children: ReactNode }) {
  const [municipios, setMunicipios] = useState<Municipio[]>([])
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [municipioId, setMunicipioId] = useState<number | null>(() => leerGuardado().municipio ?? null)
  const [procesoId, setProcesoId] = useState<number | null>(() => leerGuardado().proceso ?? null)
  const [usuario, setUsuario] = useState<Usuario | null>(null)

  useEffect(() => {
    // Sin sesión, api() redirige al login.
    api<Usuario>('/me').then(setUsuario, () => setUsuario(null))
    api<Municipio[]>('/municipios').then((ms) => {
      setMunicipios(ms)
      setMunicipioId((id) => (ms.some((m) => m.id === id) ? id : (ms[0]?.id ?? null)))
    }, console.error)
    api<Proceso[]>('/procesos').then((ps) => {
      setProcesos(ps)
      setProcesoId((id) => (ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? null)))
    }, console.error)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ municipio: municipioId, proceso: procesoId }))
    } catch {
      // Sin localStorage la selección dura solo la sesión.
    }
  }, [municipioId, procesoId])

  // Mientras se valida la sesión no se pinta nada (evita mostrar pantallas a quien no ha entrado).
  if (!usuario) return null

  const m = municipios.find((x) => x.id === municipioId)
  const p = procesos.find((x) => x.id === procesoId)

  return (
    <Ctx.Provider
      value={{
        municipios,
        procesos,
        municipioId: m ? municipioId : null,
        procesoId: p ? procesoId : null,
        municipio: m ? nombrePropio(m.nombre) : '…',
        proceso: p ? nombreProceso(p) : '…',
        setMunicipioId,
        setProcesoId,
        usuario,
        puedeCapturar: usuario.rol === 'ADMIN' || usuario.rol === 'CAPTURISTA',
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useContexto() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useContexto fuera de ContextoProvider')
  return c
}
