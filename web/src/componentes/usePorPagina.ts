import { useEffect, useState } from 'react'

/** 25 filas en celular y 50 en iPad o escritorio (DISENO.md §8). */
export function usePorPagina() {
  const consulta = '(min-width: 768px)'
  const [ancho, setAncho] = useState(() => matchMedia(consulta).matches)
  useEffect(() => {
    const mq = matchMedia(consulta)
    const cambio = () => setAncho(mq.matches)
    mq.addEventListener('change', cambio)
    return () => mq.removeEventListener('change', cambio)
  }, [])
  return ancho ? 50 : 25
}
