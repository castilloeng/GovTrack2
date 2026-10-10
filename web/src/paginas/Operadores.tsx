import { useMemo, useState } from 'react'
import Shell from '../componentes/Shell'
import Hoja from '../componentes/Hoja'
import { Encabezado } from '../componentes/ui'
import { enlacePorId, enlaces, operadores, TOTAL_OPERADORES, type Operador } from '../datos'
import { abreviar, iniciales, n } from '../formato'
import { IcoAtras, IcoBuscar, IcoCerrar, IcoFiltro, IcoFlecha, IcoMas } from '../iconos'
import { Link, navegar } from '../router'

// Operadores y enlaces (diseno/pantallas/Operadores.dc.html). Patrón lista + detalle.
// /operadores/:id abre el detalle: en celular como pantalla propia, en iPad vertical como panel deslizante.

const secciones = [...new Set(operadores.flatMap((o) => o.asignaciones.map((a) => a.seccion)))].sort()
const totalPersonas = (o: Operador) => o.asignaciones.reduce((s, a) => s + a.personas, 0)

export default function Operadores({ id }: { id?: number }) {
  const [texto, setTexto] = useState('')
  const [seccion, setSeccion] = useState('')
  const [enlace, setEnlace] = useState(0)
  const [porEnlace, setPorEnlace] = useState(false)
  const [hojaFiltros, setHojaFiltros] = useState(false)

  const lista = useMemo(() => {
    const t = texto.trim().toLowerCase()
    const digitos = t.replace(/\D/g, '')
    return operadores.filter(
      (o) =>
        (!t || o.nombre.toLowerCase().includes(t) || (digitos && o.telefono.replace(/\D/g, '').includes(digitos))) &&
        (!seccion || o.asignaciones.some((a) => a.seccion === seccion)) &&
        (!enlace || o.enlaces.includes(enlace)),
    )
  }, [texto, seccion, enlace])

  const seleccionado = operadores.find((o) => o.id === id) ?? (porEnlace ? undefined : lista[0])
  const activos = (seccion ? 1 : 0) + (enlace ? 1 : 0) + (porEnlace ? 1 : 0)

  const filtrosSelect = (
    <>
      <label className="btn btn-select">
        Sección: {seccion || 'todas'}
        <IcoFlecha />
        <select aria-label="Filtrar por sección" value={seccion} onChange={(e) => setSeccion(e.target.value)}>
          <option value="">Todas</option>
          {secciones.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="btn btn-select">
        Enlace: {enlace ? abreviar(enlacePorId(enlace).nombre) : 'todos'}
        <IcoFlecha />
        <select aria-label="Filtrar por enlace" value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
          <option value={0}>Todos</option>
          {enlaces.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <button className="btn" type="button" aria-pressed={porEnlace} onClick={() => setPorEnlace((v) => !v)}>
        Vista: por enlace
      </button>
    </>
  )

  return (
    <Shell>
      <main className="contenido">
        <div className={id ? 'desde-tablet' : undefined}>
          <Encabezado titulo="Operadores y enlaces" desc="Cada operador tiene 1 o 2 enlaces y se asigna a una o varias colonias de una sección.">
            <div className="barra-movil">
              <button className="btn pri" type="button">
                <IcoMas />
                Nuevo operador
              </button>
            </div>
          </Encabezado>
        </div>

        <div className={'filtros' + (id ? ' desde-tablet' : '')}>
          <label className="campo-busqueda">
            <IcoBuscar />
            <input type="search" aria-label="Buscar operador" placeholder="Nombre o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} />
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
          <section className="card lista">
            {porEnlace ? <TablaPorEnlace lista={lista} /> : <TablaOperadores lista={lista} seleccionado={seleccionado?.id} auto={id === undefined} />}
          </section>

          {seleccionado && (
            <>
              {id !== undefined && <button type="button" className="scrim panel-scrim" aria-label="Cerrar detalle" onClick={() => navegar('/operadores')} />}
              <Detalle operador={seleccionado} auto={id === undefined} />
            </>
          )}
        </div>
      </main>

      {hojaFiltros && (
        <Hoja titulo="Filtros" onCerrar={() => setHojaFiltros(false)}>
          <label className="campo">
            Sección
            <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
              <option value="">Todas</option>
              {secciones.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            Enlace
            <select value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
              <option value={0}>Todos</option>
              {enlaces.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
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
              Ver {lista.length} operadores
            </button>
          </div>
        </Hoja>
      )}
    </Shell>
  )
}

function TablaOperadores({ lista, seleccionado, auto }: { lista: Operador[]; seleccionado?: number; auto: boolean }) {
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
            {lista.map((o) => {
              const sel = o.id === seleccionado
              return (
                <tr key={o.id} className={'clic' + (sel ? ' sel' : '') + (sel && auto ? ' auto' : '')} onClick={() => navegar(`/operadores/${o.id}`)}>
                  <td style={sel ? { fontWeight: 600 } : undefined}>
                    <Link to={`/operadores/${o.id}`} className="fila-link" aria-current={sel ? 'true' : undefined} onClick={(e) => e.stopPropagation()}>
                      {o.nombre}
                    </Link>
                  </td>
                  <td className="num col-sec ancho" data-label="Teléfono">{o.telefono}</td>
                  <td className="col-sec ancho" data-label="Enlaces" style={{ whiteSpace: 'normal' }}>{o.enlaces.map((e) => abreviar(enlacePorId(e).nombre)).join(' · ')}</td>
                  <td className="r num" data-label="Colonias">{n(o.asignaciones.length)}</td>
                  <td className="r num" data-label="Personas">{n(totalPersonas(o))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {lista.length === 0 && <div className="vacio">Ningún operador coincide con la búsqueda.</div>}
      </div>
      <div className="paginacion">
        <span>
          {lista.length} de {n(TOTAL_OPERADORES)} operadores
        </span>
        <div className="acciones" style={{ gap: 6 }}>
          <button className="btn sm" type="button" disabled>
            Anterior
          </button>
          <button className="btn sm" type="button">
            Siguiente
          </button>
        </div>
      </div>
    </>
  )
}

/** Vista alterna "por enlace" (equivale a la antigua Consulta de colonias por enlace). */
function TablaPorEnlace({ lista }: { lista: Operador[] }) {
  const filas = enlaces
    .map((e) => {
      const ops = lista.filter((o) => o.enlaces.includes(e.id))
      return {
        ...e,
        operadores: ops.length,
        colonias: new Set(ops.flatMap((o) => o.asignaciones.map((a) => `${a.seccion}|${a.colonia}`))).size,
        personas: ops.reduce((s, o) => s + totalPersonas(o), 0),
      }
    })
    .filter((f) => f.operadores > 0)

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
              <tr key={f.id}>
                <td style={{ fontWeight: 600 }}>{f.nombre}</td>
                <td className="num col-sec" data-label="Teléfono">{f.telefono}</td>
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
        <span>{filas.length} enlaces</span>
      </div>
    </>
  )
}

function Detalle({ operador: o, auto }: { operador: Operador; auto: boolean }) {
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  return (
    <aside className={'card detalle' + (auto ? ' auto' : ' panel')} aria-label="Detalle del operador">
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
        <div className="avatar lg">{iniciales(o.nombre)}</div>
        <div style={{ minWidth: 0 }}>
          <div className="detalle-nombre">{o.nombre}</div>
          <a className="num muted" href={`tel:${o.telefono.replace(/\D/g, '')}`} style={{ fontSize: 14, marginTop: 2, display: 'inline-block', textDecoration: 'none' }}>
            {o.telefono}
          </a>
        </div>
      </div>
      <div className="acciones" style={{ gap: 6 }}>
        <span className="tag">Operador</span>
        {o.enlaceDe ? <span className="tag gray">También es enlace de {o.enlaceDe} operadores</span> : null}
      </div>

      <div>
        <h2 className="seccion-titulo">Enlaces</h2>
        <div className="enlaces-grid">
          {o.enlaces.map((eid) => {
            const e = enlacePorId(eid)
            return (
              <div className="mini-card" key={eid}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{e.nombre}</div>
                <div className="num muted" style={{ fontSize: 13 }}>
                  {e.telefono}
                </div>
              </div>
            )
          })}
        </div>
        <p className="nota" style={{ marginTop: 8 }}>
          Los enlaces aplican a todas las asignaciones del operador.
        </p>
      </div>

      <div>
        <div className="partido-fila" style={{ alignItems: 'center', marginBottom: 6 }}>
          <h2 className="seccion-titulo" style={{ margin: 0 }}>
            Asignaciones
          </h2>
          <button type="button" className="link-btn">
            + Agregar
          </button>
        </div>
        <div className="lista-asign">
          {o.asignaciones.map((a) => (
            <div key={a.seccion + a.colonia}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{a.colonia}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Sección{' '}
                  <Link to={`/secciones/${a.seccion}`} className="num">
                    {a.seccion}
                  </Link>
                </div>
              </div>
              <div className="num" style={{ fontSize: 15 }}>
                {n(a.personas)}{' '}
                <span className="muted" style={{ fontSize: 12 }}>
                  pers.
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="acciones">
        <button className="btn" type="button" style={{ flex: 1 }}>
          Editar
        </button>
        <button className="btn peligro" type="button" style={{ flex: 1 }} onClick={() => setConfirmarBaja(true)}>
          Dar de baja
        </button>
      </div>

      {confirmarBaja && (
        <Hoja titulo="Dar de baja al operador" onCerrar={() => setConfirmarBaja(false)}>
          <p style={{ lineHeight: 1.5 }}>
            <strong>{o.nombre}</strong> dejará de aparecer en la estructura y sus {o.asignaciones.length} asignaciones quedarán inactivas. El registro se conserva en el historial.
          </p>
          <div className="acciones">
            <button className="btn" type="button" style={{ flex: 1 }} onClick={() => setConfirmarBaja(false)}>
              Cancelar
            </button>
            <button className="btn peligro" type="button" style={{ flex: 1 }} onClick={() => setConfirmarBaja(false)}>
              Dar de baja
            </button>
          </div>
        </Hoja>
      )}
    </aside>
  )
}
