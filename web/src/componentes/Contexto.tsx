import { createContext, useContext, useState, type ReactNode } from 'react'
import { municipios, procesos } from '../datos'

// Municipio y proceso electoral seleccionados en la barra superior (DISENO.md §1.2).

type Contexto = {
  municipio: string
  proceso: string
  setMunicipio: (m: string) => void
  setProceso: (p: string) => void
}

const Ctx = createContext<Contexto | null>(null)

export function ContextoProvider({ children }: { children: ReactNode }) {
  const [municipio, setMunicipio] = useState(municipios[0])
  const [proceso, setProceso] = useState(procesos[0])
  return <Ctx.Provider value={{ municipio, proceso, setMunicipio, setProceso }}>{children}</Ctx.Provider>
}

export function useContexto() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useContexto fuera de ContextoProvider')
  return c
}
