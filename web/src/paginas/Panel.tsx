import { useState } from 'react'
import Shell from '../componentes/Shell'
import { Barra, BarrasPartidos, Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { actividadReciente, coberturaSecciones, kpis, resultadoMunicipio, UMBRAL_BAJA_COBERTURA } from '../datos'
import { n, pct } from '../formato'
import { IcoMas } from '../iconos'
import { Link } from '../router'

// Panel del municipio (diseno/pantallas/Main.dc.html).

type Filtro = 'todas' | 'sin' | 'baja'

const FILTROS: { id: Filtro; texto: string }[] = [
  { id: 'todas', texto: 'Todas' },
  { id: 'sin', texto: 'Sin operador' },
  { id: 'baja', texto: 'Baja cobertura' },
]

export default function Panel() {
  const { municipio } = useContexto()
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const filas = coberturaSecciones
    .map((s) => ({ ...s, cobertura: (s.personas / s.ln) * 100 }))
    .filter((s) => {
      if (filtro === 'sin') return s.operadores === 0
      if (filtro === 'baja') return s.operadores > 0 && s.cobertura < UMBRAL_BAJA_COBERTURA
      return true
    })

  return (
    <Shell busqueda>
      <main className="contenido angosto">
        <Encabezado antetitulo="Panel del municipio" titulo={municipio} grande>
          <div className="acciones">
            <button className="btn desde-tablet" type="button">
              Exportar a Excel
            </button>
            <div className="barra-movil">
              <Link className="btn pri" to="/operadores">
                <IcoMas />
                Nueva asignación
              </Link>
            </div>
          </div>
        </Encabezado>

        <div className="kpis">
          <div className="card kpi">
            <div className="kpi-lbl">Secciones cubiertas</div>
            <div className="num kpi-num">
              {n(kpis.seccionesCubiertas)} <small>/ {n(kpis.seccionesTotal)}</small>
            </div>
            <div style={{ marginTop: 12 }}>
              <Barra valor={(kpis.seccionesCubiertas / kpis.seccionesTotal) * 100} />
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Operadores activos</div>
            <div className="num kpi-num">{n(kpis.operadores)}</div>
            <div className="kpi-ctx">en {n(kpis.colonias)} colonias</div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Enlaces</div>
            <div className="num kpi-num">{n(kpis.enlaces)}</div>
            <div className="kpi-ctx">{(kpis.operadores / kpis.enlaces).toFixed(1)} operadores por enlace</div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Personas movilizadas</div>
            <div className="num kpi-num">{n(kpis.personas)}</div>
            <div className="kpi-ctx">{pct(kpis.pctListaNominal)} de la lista nominal</div>
          </div>
        </div>

        <div className="dos-col" style={{ gap: 24 }}>
          <section className="card ancha" style={{ overflow: 'hidden' }}>
            <div className="card-head">
              <h2>Cobertura por sección</h2>
              <div className="seg" role="group" aria-label="Filtrar secciones">
                {FILTROS.map((f) => (
                  <button key={f.id} className="btn sm" type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                    {f.texto}
                  </button>
                ))}
              </div>
            </div>
            <div className="tbl-wrap">
              <table className="tbl apilable">
                <thead>
                  <tr>
                    <th>Sección</th>
                    <th className="r col-sec">Colonias</th>
                    <th className="r">Operadores</th>
                    <th className="r">Personas</th>
                    <th className="r" style={{ whiteSpace: 'normal' }}>
                      Lista nominal
                    </th>
                    <th>Cobertura</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((s) => (
                    <tr key={s.num}>
                      <td>
                        <Link to={`/secciones/${s.num}`} className="num" style={{ fontWeight: 500 }}>
                          <span className="solo-movil">Sección </span>
                          {s.num}
                        </Link>
                      </td>
                      <td className="r num col-sec" data-label="Colonias">{n(s.colonias)}</td>
                      <td className="r num" data-label="Operadores">{n(s.operadores)}</td>
                      <td className="r num" data-label="Personas">{n(s.personas)}</td>
                      <td className="r num" data-label="Lista nominal">{n(s.ln)}</td>
                      <td data-label="Cobertura" className="ancho">
                        {s.operadores === 0 ? (
                          <span className="tag warn">Sin operador</span>
                        ) : (
                          <div className="cobertura">
                            <Barra valor={s.cobertura * 10} alerta={s.cobertura < UMBRAL_BAJA_COBERTURA} />
                            <span className="num" style={{ fontSize: 13 }}>
                              {pct(s.cobertura)}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.length === 0 && <div className="vacio">No hay secciones con este filtro.</div>}
            </div>
            <div className="card-foot">
              Mostrando {filas.length} de {n(kpis.seccionesTotal)} secciones · <a href="#">Ver todas</a>
            </div>
          </section>

          <div className="lateral pila" style={{ gap: 24 }}>
            <section className="card" style={{ padding: 18 }}>
              <h2 style={{ marginBottom: 4 }}>{resultadoMunicipio.titulo}</h2>
              <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                Votación total del municipio
              </div>
              <BarrasPartidos partidos={resultadoMunicipio.partidos} />
              <div className="partido-fila muted" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontSize: 13 }}>
                <span>Participación</span>
                <span className="num" style={{ color: 'var(--ink)' }}>
                  {pct(resultadoMunicipio.participacion)}
                </span>
              </div>
            </section>

            <section className="card" style={{ padding: 18 }}>
              <h2 style={{ marginBottom: 12 }}>Actividad reciente</h2>
              <ul className="bitacora actividad">
                {actividadReciente.map((a, i) => (
                  <li key={i} style={{ gap: 10 }}>
                    <span className={'punto' + (a.alerta ? ' warn' : '')} aria-hidden="true" />
                    <div>
                      <div>
                        {a.texto}
                        {a.cifra && <span className="num">{a.cifra}</span>}
                        {a.despues}
                      </div>
                      <div className="nota" style={{ marginTop: 2 }}>
                        {a.cuando}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
        <p className="nota">Cifras de ejemplo para el diseño.</p>
      </main>
    </Shell>
  )
}
