import { useEffect, type ReactNode } from 'react'
import { IcoCerrar } from '../iconos'

/** Hoja inferior en celular; diálogo centrado en iPad y escritorio. Se cierra con Esc o al tocar fuera. */
export default function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  return (
    <>
      <button type="button" className="scrim alto" aria-label="Cerrar" onClick={onCerrar} />
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-asa" />
        <div className="hoja-head">
          <h2>{titulo}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onCerrar}>
            <IcoCerrar />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
