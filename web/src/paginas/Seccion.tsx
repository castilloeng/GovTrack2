import { useState } from 'react'
import Shell from '../componentes/Shell'
import { BarrasPartidos } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { seccionDetalle, type Eleccion } from '../datos'
import { n, pct } from '../formato'
import { Link } from '../router'

// Detalle de sección (diseno/pantallas/Seccion.dc.html). Pestañas: Resultados, Estructura, Colonias, Historial.

type Pestana = 'resultados' | 'estructura' | 'colonias' | 'historial'

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'resultados', texto: 'Resultados' },
  { id: 'estructura', texto: 'Estructura' },
  { id: 'colonias', texto: 'Colonias' },
  { id: 'historial', texto: 'Historial' },
]

export default function Seccion({ num }: { num: string }) {
  const d = seccionDetalle
  const [pestana, setPestana] = useState<Pestana>('resultados')
  const [eleccionId, setEleccionId] = useState(d.elecciones[0].id)
  const eleccion = d.elecciones.find((e) => e.id === eleccionId)!

  return (
    <Shell>
      <main className="contenido">
        <div>
          <nav className="migas" aria-label="Ruta">
            <Link to="/">Secciones</Link> / <span className="num">{num}</span>
          </nav>
          <div className="sec-titulo">
            <h1>
              Sección <span className="num" style={{ fontWeight: 500 }}>{num}</span>
            </h1>
            <span className="tag">{d.tipo}</span>
            <span className="muted" style={{ fontSize: 14 }}>
              {d.casillas} casillas · {d.colonias} colonias · LN <span className="num">{n(d.ln)}</span>
            </span>
          </div>
        </div>

        <div className="tabs" role="tablist" aria-label="Vistas de la sección">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              id={`tab-${p.id}`}
              className="tab"
              role="tab"
              type="button"
              aria-selected={pestana === p.id}
              aria-controls={`panel-${p.id}`}
              onClick={() => setPestana(p.id)}
            >
              {p.texto}
            </button>
          ))}
        </div>

        <div id={`panel-${pestana}`} role="tabpanel" aria-labelledby={`tab-${pestana}`} className="pila">
          {pestana === 'resultados' && (
            <>
              <div className="acciones" style={{ alignItems: 'center', gap: 8 }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
                  Elección
                </span>
                <div className="seg" role="group" aria-label="Elección">
                  {d.elecciones.map((e) => (
                    <button key={e.id} className="btn md" type="button" aria-pressed={e.id === eleccionId} onClick={() => setEleccionId(e.id)}>
                      {e.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <Resultados eleccion={eleccion} personas={d.personasMovilizadas} />
              <Estructura />
            </>
          )}
          {pestana === 'estructura' && <Estructura />}
          {pestana === 'colonias' && <Colonias />}
          {pestana === 'historial' && <Historial />}
        </div>
        <p className="nota">Cifras de ejemplo para el diseño.</p>
      </main>
    </Shell>
  )
}

function Resultados({ eleccion, personas }: { eleccion: Eleccion; personas: number }) {
  const { proceso } = useContexto()
  const totPartido = eleccion.partidos.map((_, i) => eleccion.casillas.reduce((s, c) => s + c.votos[i], 0))
  const ln = eleccion.casillas.reduce((s, c) => s + c.ln, 0)
  const total = totPartido.reduce((s, v) => s + v, 0)
  const distribucion = eleccion.partidos.map((nombre, i) => ({ nombre, votos: totPartido[i], pct: (totPartido[i] / total) * 100 })).sort((a, b) => b.votos - a.votos)
  const [primero, segundo] = distribucion
  const anio = proceso.replace(/\D/g, '')

  return (
    <div className="dos-col">
      <section className="card ancha" style={{ overflow: 'hidden' }}>
        <h2 style={{ padding: '16px 18px' }}>Votos por casilla</h2>
        <div className="tbl-wrap">
          <table className="tbl fija-1">
            <thead>
              <tr>
                <th>Casilla</th>
                <th className="r">Lista nominal</th>
                {eleccion.partidos.map((p) => (
                  <th key={p} className="r">
                    {p}
                  </th>
                ))}
                <th className="r">Total</th>
                <th className="r">Particip.</th>
              </tr>
            </thead>
            <tbody>
              {eleccion.casillas.map((c) => {
                const t = c.votos.reduce((s, v) => s + v, 0)
                return (
                  <tr key={c.casilla}>
                    <td className="num" style={{ fontWeight: 500 }}>
                      {c.casilla}
                    </td>
                    <td className="r num">{n(c.ln)}</td>
                    {c.votos.map((v, i) => (
                      <td key={i} className="r num">
                        {n(v)}
                      </td>
                    ))}
                    <td className="r num">{n(t)}</td>
                    <td className="r num">{pct((t / c.ln) * 100)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="r num">{n(ln)}</td>
                {totPartido.map((v, i) => (
                  <td key={i} className="r num">
                    {n(v)}
                  </td>
                ))}
                <td className="r num">{n(total)}</td>
                <td className="r num">{pct((total / ln) * 100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card lateral" style={{ padding: 18 }}>
        <h2 style={{ marginBottom: 4 }}>Distribución</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          {eleccion.nombre} {anio} · <span className="num">{n(total)}</span> votos
        </div>
        <BarrasPartidos partidos={distribucion} grande />
        <div className="resumen-2">
          <div>
            <div className="nota">
              Ventaja {primero.nombre.replace('Partido ', '')} sobre {segundo.nombre.replace('Partido ', '')}
            </div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}>
              {n(primero.votos - segundo.votos)}
            </div>
          </div>
          <div>
            <div className="nota">Personas movilizadas</div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}>
              {n(personas)}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function Estructura() {
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <h2>Estructura en la sección</h2>
        <Link to="/operadores" className="btn">
          Ver operadores
        </Link>
      </div>
      <div className="tbl-wrap">
        <table className="tbl apilable">
          <thead>
            <tr>
              <th>Colonia</th>
              <th className="r">Operadores</th>
              <th className="r">Personas</th>
              <th className="col-sec">Enlaces</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {seccionDetalle.estructura.map((c) => (
              <tr key={c.colonia}>
                <td style={{ fontWeight: 600 }}>{c.colonia}</td>
                <td className="r num" data-label="Operadores">{n(c.operadores)}</td>
                <td className="r num" data-label="Personas">{n(c.personas)}</td>
                <td className="col-sec ancho" data-label="Enlaces" style={c.enlaces ? undefined : { color: 'var(--muted)' }}>
                  {c.enlaces || '—'}
                </td>
                <td data-label="Estado">{c.operadores > 0 ? <span className="tag">Cubierta</span> : <span className="tag warn">Sin operador</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Colonias() {
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <h2>Colonias de la sección</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          Una colonia puede pertenecer a varias secciones.
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl apilable">
          <thead>
            <tr>
              <th>Colonia</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {seccionDetalle.estructura.map((c) => (
              <tr key={c.colonia}>
                <td style={{ fontWeight: 600 }}>{c.colonia}</td>
                <td data-label="Estado">{c.operadores > 0 ? <span className="tag">Cubierta</span> : <span className="tag warn">Sin operador</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Historial() {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 12 }}>Historial</h2>
      <ul className="bitacora actividad">
        {seccionDetalle.historial.map((h, i) => (
          <li key={i} style={{ gap: 10 }}>
            <span className={'punto' + (h.alerta ? ' warn' : '')} aria-hidden="true" />
            <div>
              <div>{h.texto}</div>
              <div className="nota" style={{ marginTop: 2 }}>
                {h.cuando}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
