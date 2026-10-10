import type { ReactNode } from 'react'
import { pct } from '../formato'

/** Barra de progreso con pista --line-soft; en alerta usa --warn-fg. */
export function Barra({ valor, alerta = false }: { valor: number; alerta?: boolean }) {
  return (
    <div className={'barra' + (alerta ? ' warn' : '')} aria-hidden="true">
      <div style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
    </div>
  )
}

const ESCALA = ['var(--accent)', 'var(--accent-2)', 'var(--accent-3)', 'var(--accent-4)']

/** Barras por partido, de mayor a menor, con la escala del acento (no los colores oficiales). */
export function BarrasPartidos({ partidos, grande = false }: { partidos: { nombre: string; pct: number }[]; grande?: boolean }) {
  const orden = [...partidos].sort((a, b) => b.pct - a.pct)
  return (
    <div className={'partidos' + (grande ? ' grande' : '')}>
      {orden.map((p, i) => (
        <div className="partido" key={p.nombre}>
          <div className="partido-fila">
            <span style={grande && i === 0 ? { fontWeight: 600 } : undefined}>{p.nombre}</span>
            <span className="num">{pct(p.pct)}</span>
          </div>
          <div className="barra" aria-hidden="true">
            <div style={{ width: `${p.pct}%`, background: ESCALA[Math.min(i, ESCALA.length - 1)] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Encabezado de pantalla: título, descripción y acciones a la derecha. */
export function Encabezado({ titulo, antetitulo, desc, children, grande = false }: { titulo: ReactNode; antetitulo?: string; desc?: string; children?: ReactNode; grande?: boolean }) {
  return (
    <div className="encabezado">
      <div>
        {antetitulo && <div className="antetitulo">{antetitulo}</div>}
        <h1 className={grande ? 'grande' : undefined} style={antetitulo ? { marginTop: 4 } : undefined}>
          {titulo}
        </h1>
        {desc && <p className="desc">{desc}</p>}
      </div>
      {children}
    </div>
  )
}
