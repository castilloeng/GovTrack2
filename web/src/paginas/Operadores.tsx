import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import Hoja from '../componentes/Hoja'
import { Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { usePorPagina } from '../componentes/usePorPagina'
import { AsignacionForm, EditarAsignacionForm, EnlacesForm, PersonaForm } from '../componentes/FormulariosEstructura'
import { api, useApi, type Asignacion, type EnlaceFila, type OperadorFila, type Pagina, type PersonaBreve, type PersonaDetalle } from '../api'
import { abreviar, iniciales, n, nombrePropio, numSeccion, telefono } from '../formato'
import { IcoAtras, IcoBuscar, IcoCerrar, IcoFiltro, IcoFlecha, IcoMas } from '../iconos'
import { Link, navegar } from '../router'

// Operadores y enlaces (diseno/pantallas/Operadores.dc.html). Patrón lista + detalle, con datos de la API.
// /operadores/:id abre el detalle de la persona: en celular como pantalla propia, en iPad vertical como panel deslizante.

export default function Operadores({ id }: { id?: number }) {
  const { municipioId, puedeCapturar } = useContexto()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [seccion, setSeccion] = useState('')
  const [enlace, setEnlace] = useState(0)
  const [porEnlace, setPorEnlace] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [hojaFiltros, setHojaFiltros] = useState(false)
  const [alta, setAlta] = useState<'operador' | 'persona' | null>(null)
  const [asignarA, setAsignarA] = useState<PersonaBreve | null>(null)
  const limite = usePorPagina()

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])
  useEffect(() => setPagina(1), [municipioId, q, seccion, enlace, limite])

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (seccion) params.set('seccion', seccion)
  const filtros = params.toString()
  if (enlace) params.set('enlace', String(enlace))
  params.set('pagina', String(pagina))
  params.set('limite', String(limite))

  const ops = useApi<Pagina<OperadorFila>>(municipioId && !porEnlace ? `/municipios/${municipioId}/operadores?${params}` : null)
  const todosEnlaces = useApi<EnlaceFila[]>(municipioId ? `/municipios/${municipioId}/enlaces` : null)
  const vistaEnlaces = useApi<EnlaceFila[]>(municipioId && porEnlace ? `/municipios/${municipioId}/enlaces?${filtros}` : null)

  // Sin id en la URL, en escritorio se muestra el primer operador de la lista.
  const seleccionadoId = id ?? (porEnlace ? undefined : ops.datos?.filas[0]?.id)
  const det = useApi<PersonaDetalle>(seleccionadoId ? `/personas/${seleccionadoId}` : null)
  const detalle = det.datos?.id === seleccionadoId ? det.datos : undefined

  const recargar = () => {
    ops.recargar()
    todosEnlaces.recargar()
    vistaEnlaces.recargar()
    det.recargar()
  }

  const enlaceSel = todosEnlaces.datos?.find((e) => e.id === enlace)
  const activos = (seccion ? 1 : 0) + (enlace ? 1 : 0) + (porEnlace ? 1 : 0)

  const filtrosSelect = (
    <>
      <label className="campo-busqueda" style={{ flex: '0 1 150px' }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          Sección
        </span>
        <input inputMode="numeric" maxLength={4} aria-label="Filtrar por sección" placeholder="todas" value={seccion} onChange={(e) => setSeccion(e.target.value.replace(/\D/g, ''))} />
      </label>
      <label className="btn btn-select">
        Enlace: {enlaceSel ? abreviar(nombrePropio(enlaceSel.nombre)) : 'todos'}
        <IcoFlecha />
        <select aria-label="Filtrar por enlace" value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
          <option value={0}>Todos</option>
          {todosEnlaces.datos?.map((e) => (
            <option key={e.id} value={e.id}>
              {nombrePropio(e.nombre)}
            </option>
          ))}
        </select>
      </label>
      <button className="btn" type="button" aria-pressed={porEnlace} onClick={() => setPorEnlace((v) => !v)}>
        Vista: por enlace
      </button>
    </>
  )

  const errorLista = porEnlace ? vistaEnlaces.error : ops.error

  return (
    <Shell>
      <main className="contenido">
        <div className={id ? 'desde-tablet' : undefined}>
          <Encabezado titulo="Operadores y enlaces" desc="Cada operador tiene 1 o 2 enlaces y se asigna a una o varias colonias de una sección.">
            {puedeCapturar && municipioId && (
              <div className="acciones">
                <div className="barra-movil">
                  <button className="btn" type="button" onClick={() => setAlta('persona')}>
                    Registrar persona
                  </button>
                  <button className="btn pri" type="button" onClick={() => setAlta('operador')}>
                    <IcoMas />
                    Nuevo operador
                  </button>
                </div>
              </div>
            )}
          </Encabezado>
        </div>

        <div className={'filtros' + (id ? ' desde-tablet' : '')}>
          <label className="campo-busqueda">
            <IcoBuscar />
            <input type="search" aria-label={porEnlace ? 'Buscar enlace' : 'Buscar operador'} placeholder="Nombre o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="desde-tablet" style={{ display: 'contents' }}>
            {filtrosSelect}
          </div>
          <button className="btn solo-movil" type="button" onClick={() => setHojaFiltros(true)}>
            <IcoFiltro />
            Filtros{activos ? ` (${activos})` : ''}
          </button>
        </div>

        <div className={'lista-detalle' + (id ? ' con-id' : '')}>
          <section className="card lista" aria-busy={porEnlace ? vistaEnlaces.cargando : ops.cargando}>
            {errorLista ? (
              <div className="vacio" role="alert">
                {errorLista.message}
              </div>
            ) : porEnlace ? (
              <TablaPorEnlace filas={vistaEnlaces.datos} seleccionado={id} />
            ) : (
              <TablaOperadores pagina={ops.datos} seleccionado={seleccionadoId} auto={id === undefined} numPagina={pagina} limite={limite} setPagina={setPagina} />
            )}
          </section>

          {seleccionadoId !== undefined && (
            <>
              {id !== undefined && <button type="button" className="scrim panel-scrim" aria-label="Cerrar detalle" onClick={() => navegar('/operadores')} />}
              {detalle ? (
                <Detalle persona={detalle} auto={id === undefined} puedeEditar={puedeCapturar} onCambio={recargar} />
              ) : (
                <aside className={'card detalle' + (id === undefined ? ' auto' : ' panel')} aria-label="Detalle">
                  <div className="vacio">{det.error ? det.error.message : 'Cargando…'}</div>
                </aside>
              )}
            </>
          )}
        </div>
      </main>

      {hojaFiltros && (
        <Hoja titulo="Filtros" onCerrar={() => setHojaFiltros(false)}>
          <label className="campo">
            Sección
            <input inputMode="numeric" maxLength={4} placeholder="Todas" value={seccion} onChange={(e) => setSeccion(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="campo">
            Enlace
            <select value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
              <option value={0}>Todos</option>
              {todosEnlaces.datos?.map((e) => (
                <option key={e.id} value={e.id}>
                  {nombrePropio(e.nombre)}
                </option>
              ))}
            </select>
          </label>
          <button className="btn" type="button" aria-pressed={porEnlace} onClick={() => setPorEnlace((v) => !v)}>
            Vista: por enlace
          </button>
          <div className="acciones">
            <button
              className="btn"
              type="button"
              style={{ flex: 1 }}
              onClick={() => {
                setSeccion('')
                setEnlace(0)
                setPorEnlace(false)
              }}
            >
              Limpiar
            </button>
            <button className="btn pri" type="button" style={{ flex: 1 }} onClick={() => setHojaFiltros(false)}>
              Ver resultados
            </button>
          </div>
        </Hoja>
      )}

      {alta && municipioId && (
        <PersonaForm
          municipioId={municipioId}
          modo={alta}
          onCerrar={() => setAlta(null)}
          onOtra={recargar}
          onGuardada={(nueva, asignar) => {
            setAlta(null)
            recargar()
            navegar(`/operadores/${nueva.id}`)
            if (asignar) setAsignarA(nueva)
          }}
        />
      )}
      {asignarA && municipioId && (
        <AsignacionForm
          municipioId={municipioId}
          persona={asignarA}
          onCerrar={() => setAsignarA(null)}
          onOtra={recargar}
          onGuardada={() => {
            setAsignarA(null)
            recargar()
          }}
        />
      )}
    </Shell>
  )
}

function TablaOperadores({
  pagina,
  seleccionado,
  auto,
  numPagina,
  limite,
  setPagina,
}: {
  pagina?: Pagina<OperadorFila>
  seleccionado?: number
  auto: boolean
  numPagina: number
  limite: number
  setPagina: (f: (p: number) => number) => void
}) {
  if (!pagina) return <div className="vacio">Cargando…</div>
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl apilable">
          <thead>
            <tr>
              <th>Operador</th>
              <th className="col-sec">Teléfono</th>
              <th className="col-sec">Enlaces</th>
              <th className="r">Colonias</th>
              <th className="r">Personas</th>
            </tr>
          </thead>
          <tbody>
            {pagina.filas.map((o) => {
              const sel = o.id === seleccionado
              return (
                <tr key={o.id} className={'clic' + (sel ? ' sel' : '') + (sel && auto ? ' auto' : '')} onClick={() => navegar(`/operadores/${o.id}`)}>
                  <td style={sel ? { fontWeight: 600 } : undefined}>
                    <Link to={`/operadores/${o.id}`} className="fila-link" aria-current={sel ? 'true' : undefined} onClick={(e) => e.stopPropagation()}>
                      {nombrePropio(o.nombre)}
                    </Link>
                  </td>
                  <td className="num col-sec ancho" data-label="Teléfono">
                    {telefono(o.telefono) || '—'}
                  </td>
                  <td className="col-sec ancho" data-label="Enlaces" style={{ whiteSpace: 'normal' }}>
                    {o.enlaces.length ? o.enlaces.map((e) => abreviar(nombrePropio(e.nombre))).join(' · ') : <span className="tag warn">Sin enlace</span>}
                  </td>
                  <td className="r num" data-label="Colonias">{n(o.colonias)}</td>
                  <td className="r num" data-label="Personas">{n(o.personas)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pagina.filas.length === 0 && <div className="vacio">Ningún operador coincide con la búsqueda.</div>}
      </div>
      {pagina.total > 0 && (
        <div className="paginacion">
          <span>
            <span className="num">
              {n((numPagina - 1) * limite + 1)}–{n(Math.min(numPagina * limite, pagina.total))}
            </span>{' '}
            de <span className="num">{n(pagina.total)}</span> operadores
          </span>
          <div className="acciones" style={{ gap: 6 }}>
            <button className="btn sm" type="button" disabled={numPagina === 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </button>
            <button className="btn sm" type="button" disabled={numPagina * limite >= pagina.total} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** Vista alterna "por enlace" (equivale a la antigua Consulta de colonias por enlace). */
function TablaPorEnlace({ filas, seleccionado }: { filas?: EnlaceFila[]; seleccionado?: number }) {
  if (!filas) return <div className="vacio">Cargando…</div>
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl apilable">
          <thead>
            <tr>
              <th>Enlace</th>
              <th className="col-sec">Teléfono</th>
              <th className="r">Operadores</th>
              <th className="r">Colonias</th>
              <th className="r">Personas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className={'clic' + (f.id === seleccionado ? ' sel' : '')} onClick={() => navegar(`/operadores/${f.id}`)}>
                <td style={{ fontWeight: 600 }}>
                  <Link to={`/operadores/${f.id}`} className="fila-link" onClick={(e) => e.stopPropagation()}>
                    {nombrePropio(f.nombre)}
                  </Link>
                </td>
                <td className="num col-sec" data-label="Teléfono">
                  {telefono(f.telefono) || '—'}
                </td>
                <td className="r num" data-label="Operadores">{n(f.operadores)}</td>
                <td className="r num" data-label="Colonias">{n(f.colonias)}</td>
                <td className="r num" data-label="Personas">{n(f.personas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filas.length === 0 && <div className="vacio">Ningún enlace coincide con los filtros.</div>}
      </div>
      <div className="paginacion">
        <span>
          <span className="num">{n(filas.length)}</span> enlaces
        </span>
      </div>
    </>
  )
}

type Formulario = { tipo: 'persona' } | { tipo: 'enlaces' } | { tipo: 'asignacion'; asignacion?: Asignacion } | { tipo: 'baja' }

function Detalle({ persona: p, auto, puedeEditar, onCambio }: { persona: PersonaDetalle; auto: boolean; puedeEditar: boolean; onCambio: () => void }) {
  const [form, setForm] = useState<Formulario | null>(null)
  const [errorBaja, setErrorBaja] = useState('')
  const esOperador = p.enlaces.length > 0 || p.asignaciones.length > 0
  const nombre = nombrePropio(p.nombre)
  const cerrar = () => setForm(null)
  const guardado = () => {
    setForm(null)
    onCambio()
  }

  async function darDeBaja() {
    setErrorBaja('')
    try {
      await api(`/personas/${p.id}`, { metodo: 'DELETE' })
      setForm(null)
      onCambio()
      navegar('/operadores', { reemplazar: true })
    } catch (e) {
      setErrorBaja((e as Error).message)
    }
  }

  return (
    <aside className={'card detalle' + (auto ? ' auto' : ' panel')} aria-label={`Detalle de ${nombre}`}>
      {!auto && (
        <div className="acciones hasta-ipad-v">
          <button type="button" className="btn volver solo-movil" onClick={() => navegar('/operadores')}>
            <IcoAtras />
            Volver
          </button>
          <button type="button" className="icon-btn desde-tablet" aria-label="Cerrar detalle" onClick={() => navegar('/operadores')} style={{ marginLeft: 'auto' }}>
            <IcoCerrar />
          </button>
        </div>
      )}

      <div className="detalle-persona">
        <div className="avatar lg">{iniciales(nombre)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="detalle-nombre">{nombre}</div>
          {p.telefono ? (
            <a className="num muted" href={`tel:${p.telefono}`} style={{ fontSize: 14, marginTop: 2, display: 'inline-block', textDecoration: 'none' }}>
              {telefono(p.telefono)}
            </a>
          ) : (
            <span className="muted" style={{ fontSize: 14 }}>
              Sin teléfono
            </span>
          )}
        </div>
      </div>
      <div className="acciones" style={{ gap: 6 }}>
        {p.deleted_at && <span className="tag warn">Dada de baja</span>}
        {esOperador && <span className="tag">Operador</span>}
        {p.enlace_de.length > 0 &&
          (esOperador ? <span className="tag gray">También es enlace de {n(p.enlace_de.length)} operadores</span> : <span className="tag">Enlace de {n(p.enlace_de.length)} operadores</span>)}
        {!esOperador && p.enlace_de.length === 0 && <span className="tag gray">Sin rol en la estructura</span>}
      </div>

      {(esOperador || puedeEditar) && !p.deleted_at && (
        <div>
          <div className="partido-fila" style={{ alignItems: 'center', marginBottom: 6 }}>
            <h2 className="seccion-titulo" style={{ margin: 0 }}>
              Enlaces
            </h2>
            {puedeEditar && (
              <button type="button" className="link-btn" onClick={() => setForm({ tipo: 'enlaces' })}>
                {p.enlaces.length ? 'Cambiar' : '+ Agregar'}
              </button>
            )}
          </div>
          {p.enlaces.length > 0 ? (
            <div className="enlaces-grid">
              {p.enlaces.map((e) => (
                <Link className="mini-card" key={e.id} to={`/operadores/${e.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{nombrePropio(e.nombre)}</div>
                  <div className="num muted" style={{ fontSize: 13 }}>
                    {telefono(e.telefono) || 'Sin teléfono'}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <span className="tag warn">Sin enlace</span>
          )}
          <p className="nota" style={{ marginTop: 8 }}>
            Los enlaces aplican a todas las asignaciones del operador.
          </p>
        </div>
      )}

      {(esOperador || puedeEditar) && !p.deleted_at && (
        <div>
          <div className="partido-fila" style={{ alignItems: 'center', marginBottom: 6 }}>
            <h2 className="seccion-titulo" style={{ margin: 0 }}>
              Asignaciones
            </h2>
            {puedeEditar && (
              <button type="button" className="link-btn" onClick={() => setForm({ tipo: 'asignacion' })}>
                + Agregar
              </button>
            )}
          </div>
          {p.asignaciones.length === 0 ? (
            <p className="nota">Sin asignaciones.</p>
          ) : (
            <div className="lista-asign">
              {p.asignaciones.map((a) => (
                <div key={a.id}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{a.colonia}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Sección{' '}
                      <Link to={`/secciones/${a.seccion}`} className="num">
                        {numSeccion(a.seccion)}
                      </Link>
                      {a.observaciones && ` · ${a.observaciones}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="num" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>
                      {n(a.num_personas)}{' '}
                      <span className="muted" style={{ fontSize: 12 }}>
                        pers.
                      </span>
                    </div>
                    {puedeEditar && (
                      <button type="button" className="link-btn" aria-label={`Editar asignación en ${a.colonia}`} onClick={() => setForm({ tipo: 'asignacion', asignacion: a })}>
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {p.enlace_de.length > 0 && (
        <div>
          <h2 className="seccion-titulo">Enlace de</h2>
          <div className="lista-asign">
            {p.enlace_de.map((o) => (
              <div key={o.id}>
                <Link to={`/operadores/${o.id}`} style={{ fontSize: 14, fontWeight: 600 }}>
                  {nombrePropio(o.nombre)}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {puedeEditar && !p.deleted_at && (
        <div className="acciones">
          <button className="btn" type="button" style={{ flex: 1 }} onClick={() => setForm({ tipo: 'persona' })}>
            Editar
          </button>
          <button className="btn peligro" type="button" style={{ flex: 1 }} onClick={() => setForm({ tipo: 'baja' })}>
            Dar de baja
          </button>
        </div>
      )}

      {form?.tipo === 'persona' && <PersonaForm municipioId={p.municipio_id} persona={p} onCerrar={cerrar} onGuardada={guardado} />}
      {form?.tipo === 'enlaces' && <EnlacesForm persona={p} municipioId={p.municipio_id} onCerrar={cerrar} onGuardada={guardado} />}
      {form?.tipo === 'asignacion' &&
        (form.asignacion ? (
          <EditarAsignacionForm asignacion={form.asignacion} onCerrar={cerrar} onGuardada={guardado} />
        ) : (
          <AsignacionForm municipioId={p.municipio_id} persona={p} onCerrar={cerrar} onGuardada={guardado} onOtra={onCambio} />
        ))}
      {form?.tipo === 'baja' && (
        <Hoja titulo="Dar de baja" onCerrar={cerrar}>
          <p style={{ lineHeight: 1.5 }}>
            <strong>{nombre}</strong> dejará de aparecer en la estructura
            {p.asignaciones.length === 1 && ' y su asignación quedará inactiva'}
            {p.asignaciones.length > 1 && ` y sus ${n(p.asignaciones.length)} asignaciones quedarán inactivas`}. El registro se conserva en el historial.
          </p>
          {errorBaja && (
            <p role="alert" className="tag warn" style={{ whiteSpace: 'normal', alignSelf: 'flex-start' }}>
              {errorBaja}
            </p>
          )}
          <div className="acciones">
            <button className="btn" type="button" style={{ flex: 1 }} onClick={cerrar}>
              Cancelar
            </button>
            <button className="btn peligro" type="button" style={{ flex: 1 }} onClick={darDeBaja}>
              Dar de baja
            </button>
          </div>
        </Hoja>
      )}
    </aside>
  )
}
