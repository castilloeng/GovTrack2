import { useState } from 'react'
import Shell from '../componentes/Shell'
import { BarrasPartidos } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { AgregarColonia, EditarSeccion } from '../componentes/FormulariosGeografia'
import { api, useApi, type ColoniaDeSeccion, type EleccionResultados, type EventoHistorial, type SeccionDetalle } from '../api'
import { abreviar, cuando, n, nombreCargo, nombrePropio, numSeccion, pct } from '../formato'
import { IcoMas } from '../iconos'
import { Link } from '../router'

// Detalle de sección (diseno/pantallas/Seccion.dc.html). Pestañas: Resultados, Estructura, Colonias, Historial.
// La URL lleva el número de sección (/secciones/1265); se resuelve dentro del municipio elegido.

type Pestana = 'resultados' | 'estructura' | 'colonias' | 'historial'

const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'resultados', texto: 'Resultados' },
  { id: 'estructura', texto: 'Estructura' },
  { id: 'colonias', texto: 'Colonias' },
  { id: 'historial', texto: 'Historial' },
]

export default function Seccion({ numero }: { numero: number }) {
  const { municipioId, procesoId, municipio, puedeCapturar } = useContexto()
  const [pestana, setPestana] = useState<Pestana>('resultados')
  const [editando, setEditando] = useState(false)
  const det = useApi<SeccionDetalle>(municipioId && procesoId ? `/municipios/${municipioId}/secciones/${numero}?proceso=${procesoId}` : null)
  const d = det.datos?.numero === numero && det.datos.municipio_id === municipioId ? det.datos : undefined
  const col = useApi<ColoniaDeSeccion[]>(d ? `/secciones/${d.id}/colonias` : null)
  const colonias = d && col.datos ? col.datos : undefined
  const recargar = () => {
    det.recargar()
    col.recargar()
  }

  return (
    <Shell>
      <main className="contenido">
        <div>
          <nav className="migas" aria-label="Ruta">
            <Link to="/secciones">Secciones</Link> / <span className="num">{numSeccion(numero)}</span>
          </nav>
          <div className="sec-titulo">
            <h1>
              Sección <span className="num" style={{ fontWeight: 500 }}>{numSeccion(numero)}</span>
            </h1>
            {d && (
              <>
                {d.tipo && <span className="tag">{nombrePropio(d.tipo)}</span>}
                <span className="muted" style={{ fontSize: 14 }}>
                  {n(d.casillas)} casillas · {n(d.colonias)} colonias · LN <span className="num">{n(d.ln)}</span>
                </span>
                {puedeCapturar && (
                  <button type="button" className="btn sm" onClick={() => setEditando(true)}>
                    Editar
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {det.error ? (
          <section className="card vacio" role="alert">
            {det.error.status === 404 ? `La sección ${numSeccion(numero)} no existe en ${municipio}.` : det.error.message}{' '}
            <Link to="/secciones">Ver secciones</Link>
          </section>
        ) : !d ? (
          <section className="card vacio">Cargando…</section>
        ) : (
          <>
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
                  <Resultados seccion={d} />
                  <Estructura colonias={colonias} />
                </>
              )}
              {pestana === 'estructura' && <Estructura colonias={colonias} />}
              {pestana === 'colonias' && <Colonias seccion={d} colonias={colonias} puedeEditar={puedeCapturar} onCambio={recargar} />}
              {pestana === 'historial' && <Historial seccionId={d.id} />}
            </div>
          </>
        )}
      </main>
      {editando && d && (
        <EditarSeccion
          seccion={d}
          onCerrar={() => setEditando(false)}
          onGuardada={() => {
            setEditando(false)
            det.recargar()
          }}
        />
      )}
    </Shell>
  )
}

function Resultados({ seccion }: { seccion: SeccionDetalle }) {
  const { proceso } = useContexto()
  const [eleccionId, setEleccionId] = useState(seccion.elecciones[0]?.id)
  const eleccion = seccion.elecciones.find((e) => e.id === eleccionId) ?? seccion.elecciones[0]

  if (!eleccion) return <section className="card vacio">El proceso no tiene elecciones registradas.</section>

  return (
    <>
      {seccion.elecciones.length > 1 && (
        <div className="acciones" style={{ alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
            Elección
          </span>
          <div className="seg" role="group" aria-label="Elección">
            {seccion.elecciones.map((e) => (
              <button key={e.id} className="btn md" type="button" aria-pressed={e.id === eleccion.id} onClick={() => setEleccionId(e.id)}>
                {nombreCargo(e.cargo)}
              </button>
            ))}
          </div>
        </div>
      )}
      {eleccion.casillas.length === 0 ? (
        <section className="card vacio">
          No hay resultados de {nombreCargo(eleccion.cargo)} en esta sección para el {proceso.toLowerCase()}.
        </section>
      ) : (
        <TablaResultados eleccion={eleccion} personas={seccion.personas} anio={proceso.replace(/\D/g, '')} />
      )}
    </>
  )
}

function TablaResultados({ eleccion, personas, anio }: { eleccion: EleccionResultados; personas: number; anio: string }) {
  const totPartido = eleccion.partidos.map((_, i) => eleccion.casillas.reduce((s, c) => s + c.votos[i], 0))
  const ln = eleccion.casillas.reduce((s, c) => s + c.ln, 0)
  const total = totPartido.reduce((s, v) => s + v, 0)
  const distribucion = eleccion.partidos
    .map((nombre, i) => ({ nombre, votos: totPartido[i], pct: total ? (totPartido[i] / total) * 100 : 0 }))
    .sort((a, b) => b.votos - a.votos)
  const [primero, segundo] = distribucion
  const participacion = (votos: number, lista: number) => (lista ? pct((votos / lista) * 100) : '—')

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
                    <td className="r num">{participacion(t, c.ln)}</td>
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
                <td className="r num">{participacion(total, ln)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card lateral" style={{ padding: 18 }}>
        <h2 style={{ marginBottom: 4 }}>Distribución</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
          {nombreCargo(eleccion.cargo)} {anio} · <span className="num">{n(total)}</span> votos
        </div>
        <BarrasPartidos partidos={distribucion} grande />
        <div className="resumen-2">
          <div>
            <div className="nota">{segundo ? `Ventaja ${primero.nombre} sobre ${segundo.nombre}` : 'Votos del primer lugar'}</div>
            <div className="num" style={{ fontSize: 20, marginTop: 2 }}>
              {n(primero ? primero.votos - (segundo?.votos ?? 0) : 0)}
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

function Cargando({ colonias }: { colonias?: ColoniaDeSeccion[] }) {
  if (!colonias) return <div className="vacio">Cargando…</div>
  if (colonias.length === 0) return <div className="vacio">La sección no tiene colonias registradas.</div>
  return null
}

function Estructura({ colonias }: { colonias?: ColoniaDeSeccion[] }) {
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <h2>Estructura en la sección</h2>
        <Link to="/operadores" className="btn">
          Ver operadores
        </Link>
      </div>
      <Cargando colonias={colonias} />
      {colonias && colonias.length > 0 && (
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
              {colonias.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.nombre}</td>
                  <td className="r num" data-label="Operadores">{n(c.operadores)}</td>
                  <td className="r num" data-label="Personas">{n(c.personas)}</td>
                  <td className="col-sec ancho" data-label="Enlaces" style={c.enlaces.length ? undefined : { color: 'var(--muted)' }}>
                    {c.enlaces.length ? c.enlaces.map((e) => abreviar(nombrePropio(e.nombre))).join(', ') : '—'}
                  </td>
                  <td data-label="Estado">{c.operadores > 0 ? <span className="tag">Cubierta</span> : <span className="tag warn">Sin operador</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Colonias({ seccion, colonias, puedeEditar, onCambio }: { seccion: SeccionDetalle; colonias?: ColoniaDeSeccion[]; puedeEditar: boolean; onCambio: () => void }) {
  const [agregando, setAgregando] = useState(false)
  const [error, setError] = useState('')

  async function quitar(c: ColoniaDeSeccion) {
    if (!confirm(`¿Quitar ${c.nombre} de la sección ${numSeccion(seccion.numero)}? La colonia sigue en el catálogo.`)) return
    setError('')
    try {
      await api(`/secciones/${seccion.id}/colonias/${c.id}`, { metodo: 'DELETE' })
      onCambio()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <h2>Colonias de la sección</h2>
        {puedeEditar ? (
          <button type="button" className="btn" onClick={() => setAgregando(true)}>
            <IcoMas />
            Agregar colonia
          </button>
        ) : (
          <span className="muted" style={{ fontSize: 13 }}>
            Una colonia puede pertenecer a varias secciones.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="tag warn" style={{ margin: '0 18px 12px', whiteSpace: 'normal' }}>
          {error}
        </p>
      )}
      <Cargando colonias={colonias} />
      {colonias && colonias.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl apilable">
            <thead>
              <tr>
                <th>Colonia</th>
                <th className="col-sec">CP</th>
                <th>También en</th>
                <th>Estado</th>
                {puedeEditar && <th aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {colonias.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                    {c.tipo_asentamiento && <div className="nota">{nombrePropio(c.tipo_asentamiento)}</div>}
                  </td>
                  <td className="num col-sec" data-label="CP">
                    {c.cp ?? '—'}
                  </td>
                  <td data-label="También en">
                    <span className="secciones-chips">
                      {c.otras_secciones.length === 0 && <span className="muted">—</span>}
                      {c.otras_secciones.map((num) => (
                        <Link key={num} to={`/secciones/${num}`} className="num">
                          {numSeccion(num)}
                        </Link>
                      ))}
                    </span>
                  </td>
                  <td data-label="Estado">{c.operadores > 0 ? <span className="tag">Cubierta</span> : <span className="tag warn">Sin operador</span>}</td>
                  {puedeEditar && (
                    <td data-label="">
                      <button type="button" className="link-btn" onClick={() => quitar(c)} aria-label={`Quitar ${c.nombre} de la sección`}>
                        Quitar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {agregando && (
        <AgregarColonia
          municipioId={seccion.municipio_id}
          seccion={seccion}
          yaIncluidas={colonias?.map((c) => c.id) ?? []}
          onCerrar={() => setAgregando(false)}
          onAgregada={() => {
            setAgregando(false)
            onCambio()
          }}
        />
      )}
    </section>
  )
}

function Historial({ seccionId }: { seccionId: number }) {
  const { datos, error } = useApi<EventoHistorial[]>(`/secciones/${seccionId}/historial`)
  return (
    <section className="card" style={{ padding: 18 }}>
      <h2 style={{ marginBottom: 12 }}>Historial</h2>
      {error ? (
        <p role="alert" className="nota">
          {error.message}
        </p>
      ) : !datos ? (
        <p className="nota">Cargando…</p>
      ) : datos.length === 0 ? (
        <p className="nota">Sin movimientos registrados.</p>
      ) : (
        <ul className="bitacora actividad">
          {datos.map((h, i) => (
            <li key={i} style={{ gap: 10 }}>
              <span className={'punto' + (h.tipo === 'baja' ? ' warn' : '')} aria-hidden="true" />
              <div>
                <div>
                  {h.tipo === 'alta' ? 'Nueva asignación' : 'Baja de asignación'}: {h.colonia} · {nombrePropio(h.operador)}
                </div>
                <div className="nota" style={{ marginTop: 2 }}>
                  {cuando(h.fecha)}
                  {h.usuario && ` · ${h.usuario}`}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
