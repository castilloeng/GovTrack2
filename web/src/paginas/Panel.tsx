import { useState, type ReactNode } from 'react'
import Shell from '../componentes/Shell'
import { Barra, BarrasPartidos, Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { AsignacionForm } from '../componentes/FormulariosEstructura'
import { useApi, type EventoActividad, type Pagina, type PanelDatos, type SeccionFila } from '../api'
import { UMBRAL_BAJA_COBERTURA } from '../datos'
import { cuando, n, nombreCargo, nombrePropio, numSeccion, pct } from '../formato'
import { IcoMas } from '../iconos'
import { Link } from '../router'

// Panel del municipio (diseno/pantallas/Main.dc.html).

type Filtro = 'todas' | 'sin' | 'baja'

const FILTROS: { id: Filtro; texto: string; param: string }[] = [
  { id: 'todas', texto: 'Todas', param: '' },
  { id: 'sin', texto: 'Sin operador', param: 'sin-operador' },
  { id: 'baja', texto: 'Baja cobertura', param: 'baja-cobertura' },
]

/** Filas de la tabla "Cobertura por sección"; el resto se ve en Secciones y colonias. */
const FILAS_PANEL = 10

/** Partidos que se muestran con nombre en el resumen; los demás se suman en "Otros". */
const PARTIDOS_RESUMEN = 3

const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0)

export default function Panel() {
  const { municipio, municipioId, procesoId, procesos, puedeCapturar } = useContexto()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [alta, setAlta] = useState(false)

  const base = municipioId ? `/municipios/${municipioId}` : null
  const resumen = useApi<PanelDatos>(base && `${base}/panel${procesoId ? `?proceso=${procesoId}` : ''}`)
  const actividad = useApi<EventoActividad[]>(base && `${base}/actividad?limite=6`)

  const params = new URLSearchParams({ limite: String(FILAS_PANEL) })
  if (procesoId) params.set('proceso', String(procesoId))
  const f = FILTROS.find((x) => x.id === filtro)!
  if (f.param) params.set('filtro', f.param)
  if (filtro === 'baja') params.set('umbral', String(UMBRAL_BAJA_COBERTURA))
  const tabla = useApi<Pagina<SeccionFila>>(base && `${base}/secciones?${params}`)

  const k = resumen.datos
  const filas = (tabla.datos?.filas ?? []).map((s) => ({ ...s, cobertura: porcentaje(s.personas, s.ln) }))

  // Elección principal del proceso: Ayuntamiento o, si no tiene votos, la primera que sí tenga.
  const eleccion = k?.elecciones.find((e) => e.cargo === 'AYUNTAMIENTO' && e.votos > 0) ?? k?.elecciones.find((e) => e.votos > 0)
  const anio = procesos.find((p) => p.id === k?.proceso_id)?.anio

  return (
    <Shell busqueda>
      <main className="contenido angosto">
        <Encabezado antetitulo="Panel del municipio" titulo={municipio} grande>
          <div className="acciones">
            <button className="btn desde-tablet" type="button">
              Exportar a Excel
            </button>
            {puedeCapturar && municipioId && (
              <div className="barra-movil">
                <button className="btn pri" type="button" onClick={() => setAlta(true)}>
                  <IcoMas />
                  Nueva asignación
                </button>
              </div>
            )}
          </div>
        </Encabezado>

        {resumen.error && (
          <div className="card vacio" role="alert" style={{ marginBottom: 24 }}>
            {resumen.error.message}{' '}
            <button type="button" className="link-btn" onClick={resumen.recargar}>
              Reintentar
            </button>
          </div>
        )}

        <div className="kpis">
          <div className="card kpi">
            <div className="kpi-lbl">Secciones cubiertas</div>
            <div className="num kpi-num">
              {k ? n(k.secciones_cubiertas) : '—'} <small>/ {k ? n(k.secciones) : '—'}</small>
            </div>
            <div style={{ marginTop: 12 }}>
              <Barra valor={k ? porcentaje(k.secciones_cubiertas, k.secciones) : 0} />
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Operadores activos</div>
            <div className="num kpi-num">{k ? n(k.operadores) : '—'}</div>
            <div className="kpi-ctx">en {k ? n(k.colonias) : '—'} colonias</div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Enlaces</div>
            <div className="num kpi-num">{k ? n(k.enlaces) : '—'}</div>
            <div className="kpi-ctx">{k && k.enlaces > 0 ? `${(k.operadores / k.enlaces).toFixed(1)} operadores por enlace` : 'Sin enlaces'}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-lbl">Personas movilizadas</div>
            <div className="num kpi-num">{k ? n(k.personas) : '—'}</div>
            <div className="kpi-ctx">{k && k.ln > 0 ? `${pct(porcentaje(k.personas, k.ln))} de la lista nominal` : 'Sin lista nominal'}</div>
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
              {tabla.error ? (
                <div className="vacio" role="alert">
                  {tabla.error.message}{' '}
                  <button type="button" className="link-btn" onClick={tabla.recargar}>
                    Reintentar
                  </button>
                </div>
              ) : !tabla.datos ? (
                <div className="vacio">Cargando…</div>
              ) : (
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
                      <tr key={s.id}>
                        <td>
                          <Link to={`/secciones/${s.numero}`} className="num" style={{ fontWeight: 500 }}>
                            <span className="solo-movil">Sección </span>
                            {numSeccion(s.numero)}
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
              )}
              {tabla.datos && filas.length === 0 && !tabla.error && <div className="vacio">No hay secciones con este filtro.</div>}
            </div>
            <div className="card-foot">
              Mostrando {n(filas.length)} de {n(tabla.datos?.total ?? 0)} secciones · <Link to="/secciones">Ver todas</Link>
            </div>
          </section>

          <div className="lateral pila" style={{ gap: 24 }}>
            <section className="card" style={{ padding: 18 }}>
              <h2 style={{ marginBottom: 4 }}>
                Resultado{anio ? ` ${anio}` : ''}
                {eleccion ? ` · ${nombreCargo(eleccion.cargo)}` : ''}
              </h2>
              <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
                Votación total del municipio
              </div>
              {!k ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  {resumen.error ? 'No disponible.' : 'Cargando…'}
                </div>
              ) : !eleccion ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Este proceso no tiene resultados cargados.
                </div>
              ) : (
                <>
                  <BarrasPartidos partidos={resumenPartidos(eleccion.partidos, eleccion.votos)} />
                  <div className="partido-fila muted" style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line-soft)', fontSize: 13 }}>
                    <span>Participación</span>
                    <span className="num" style={{ color: 'var(--ink)' }}>
                      {pct(porcentaje(eleccion.votos, eleccion.ln))}
                    </span>
                  </div>
                </>
              )}
            </section>

            <section className="card" style={{ padding: 18 }}>
              <h2 style={{ marginBottom: 12 }}>Actividad reciente</h2>
              {actividad.error ? (
                <div className="muted" role="alert" style={{ fontSize: 13 }}>
                  {actividad.error.message}{' '}
                  <button type="button" className="link-btn" onClick={actividad.recargar}>
                    Reintentar
                  </button>
                </div>
              ) : !actividad.datos ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Cargando…
                </div>
              ) : actividad.datos.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>
                  Todavía no hay altas, bajas ni importaciones.
                </div>
              ) : (
                <ul className="bitacora actividad">
                  {actividad.datos.map((a, i) => {
                    const { texto, alerta } = describir(a)
                    return (
                      <li key={i} style={{ gap: 10 }}>
                        <span className={'punto' + (alerta ? ' warn' : '')} aria-hidden="true" />
                        <div>
                          <div>{texto}</div>
                          <div className="nota" style={{ marginTop: 2 }}>
                            {cuando(a.fecha)}
                            {a.usuario && ` · ${a.usuario}`}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>

      {alta && municipioId && (
        <AsignacionForm
          municipioId={municipioId}
          onCerrar={() => setAlta(false)}
          onOtra={() => {
            resumen.recargar()
            actividad.recargar()
            tabla.recargar()
          }}
          onGuardada={() => {
            setAlta(false)
            resumen.recargar()
            actividad.recargar()
            tabla.recargar()
          }}
        />
      )}
    </Shell>
  )
}

/** Los partidos más votados con su porcentaje y el resto sumado en "Otros". */
function resumenPartidos(partidos: { siglas: string; votos: number }[], total: number) {
  const orden = [...partidos].sort((a, b) => b.votos - a.votos)
  const visibles = orden.length > PARTIDOS_RESUMEN + 1 ? orden.slice(0, PARTIDOS_RESUMEN) : orden
  const resto = orden.slice(visibles.length).reduce((t, p) => t + p.votos, 0)
  const filas = visibles.map((p) => ({ nombre: p.siglas, pct: porcentaje(p.votos, total) }))
  return resto > 0 ? [...filas, { nombre: 'Otros', pct: porcentaje(resto, total) }] : filas
}

const DESTINOS: Record<string, string> = { seccion: 'secciones', colonia: 'colonias', casilla: 'casillas', resultado: 'resultados' }

/** Texto de un evento de la actividad reciente; las cifras van en mono. */
function describir(a: EventoActividad): { texto: ReactNode; alerta: boolean } {
  if (a.tipo === 'importacion') {
    const que = DESTINOS[a.destino] ?? a.destino
    if (a.filas_ok === 0) return { texto: <>Falló la importación de {que}</>, alerta: true }
    return {
      texto: (
        <>
          Importación de {que} completada: <span className="num">{n(a.filas_ok)}</span> filas
          {a.filas_error > 0 && (
            <>
              , <span className="num">{n(a.filas_error)}</span> con error
            </>
          )}
        </>
      ),
      alerta: a.filas_error > 0,
    }
  }
  const sec = <span className="num">{numSeccion(a.seccion)}</span>
  if (a.tipo === 'baja' && a.sin_operador) return { texto: <>Sección {sec} quedó sin operador</>, alerta: true }
  return {
    texto: (
      <>
        {a.tipo === 'alta' ? 'Nueva asignación' : 'Baja de asignación'} en sección {sec}, {nombrePropio(a.colonia)}
      </>
    ),
    alerta: false,
  }
}
