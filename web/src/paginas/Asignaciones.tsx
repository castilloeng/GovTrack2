import { useEffect, useState, type ReactNode } from 'react'
import Shell from '../componentes/Shell'
import Hoja from '../componentes/Hoja'
import { Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { usePorPagina } from '../componentes/usePorPagina'
import { AsignacionForm, EditarAsignacionForm, PersonaForm } from '../componentes/FormulariosEstructura'
import {
  useApi,
  type AsignacionFila,
  type ColoniaSinOperador,
  type EnlaceFila,
  type Pagina,
  type PaginaAsignaciones,
  type PersonaBreve,
  type PersonaSinAsignar,
} from '../api'
import { abreviar, cuando, n, nombrePropio, numSeccion, telefono } from '../formato'
import { IcoBuscar, IcoFiltro, IcoFlecha, IcoMas } from '../iconos'
import { Link } from '../router'

// Asignaciones (DISENO.md §5 "Asignaciones"): vista transversal de la estructura del municipio.
// Segmentos: vigentes, dadas de baja, colonias sin operador y personas sin asignar.

type Estado = 'vigentes' | 'bajas' | 'sin-operador' | 'sin-asignar'

type HojaAbierta =
  | { tipo: 'alta'; persona?: PersonaBreve; seccion?: number; colonia?: number }
  | { tipo: 'editar'; fila: AsignacionFila }
  | { tipo: 'persona'; persona?: PersonaBreve }

const BUSQUEDA: Record<Estado, string> = {
  vigentes: 'Operador o colonia',
  bajas: 'Operador o colonia',
  'sin-operador': 'Colonia',
  'sin-asignar': 'Nombre o teléfono',
}

export default function Asignaciones() {
  const { municipioId, puedeCapturar } = useContexto()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [seccion, setSeccion] = useState('')
  const [enlace, setEnlace] = useState(0)
  const [estado, setEstado] = useState<Estado>('vigentes')
  const [pagina, setPagina] = useState(1)
  const [hojaFiltros, setHojaFiltros] = useState(false)
  const [hoja, setHoja] = useState<HojaAbierta | null>(null)
  const limite = usePorPagina()

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])
  useEffect(() => setPagina(1), [municipioId, q, seccion, enlace, estado, limite])

  // Qué filtros aplican a cada segmento: la sección no aplica a personas; el enlace, solo a asignaciones.
  const conSeccion = estado !== 'sin-asignar'
  const conEnlace = estado === 'vigentes' || estado === 'bajas'
  const filtros = new URLSearchParams()
  if (q) filtros.set('q', q)
  if (conSeccion && seccion) filtros.set('seccion', seccion)
  if (conEnlace && enlace) filtros.set('enlace', String(enlace))
  if (estado !== 'sin-asignar') filtros.set('estado', estado)
  const pag = `pagina=${pagina}&limite=${limite}`

  const base = municipioId ? `/municipios/${municipioId}` : null
  // Una consulta por forma de fila, para no pintar filas de otro segmento mientras carga.
  const lista = useApi<PaginaAsignaciones<AsignacionFila>>(base && conEnlace ? `${base}/asignaciones?${filtros}&${pag}` : null)
  const sinOperador = useApi<PaginaAsignaciones<ColoniaSinOperador>>(base && estado === 'sin-operador' ? `${base}/asignaciones?${filtros}&${pag}` : null)
  const sinAsignar = useApi<Pagina<PersonaSinAsignar>>(base && estado === 'sin-asignar' ? `${base}/personas/sin-asignar?${filtros}&${pag}` : null)
  const conteoSinAsignar = useApi<Pagina<PersonaSinAsignar>>(base ? `${base}/personas/sin-asignar?limite=1` : null)
  const enlaces = useApi<EnlaceFila[]>(base ? `${base}/enlaces` : null)

  const recargar = () => {
    lista.recargar()
    sinOperador.recargar()
    sinAsignar.recargar()
    conteoSinAsignar.recargar()
    enlaces.recargar()
  }
  const cerrarYRecargar = () => {
    setHoja(null)
    recargar()
  }

  const actual = conEnlace ? lista : estado === 'sin-operador' ? sinOperador : sinAsignar
  const total = actual.datos?.total ?? 0
  const enlaceSel = enlaces.datos?.find((e) => e.id === enlace)
  const activos = (conSeccion && seccion ? 1 : 0) + (conEnlace && enlace ? 1 : 0)
  const nSinAsignar = conteoSinAsignar.datos?.total

  const segmentos: { id: Estado; texto: ReactNode }[] = [
    { id: 'vigentes', texto: 'Vigentes' },
    { id: 'bajas', texto: 'Dadas de baja' },
    { id: 'sin-operador', texto: 'Colonias sin operador' },
    {
      id: 'sin-asignar',
      texto: (
        <>
          Personas sin asignar{nSinAsignar !== undefined && <span className="num">&nbsp;({n(nSinAsignar)})</span>}
        </>
      ),
    },
  ]

  const campoSeccion = (
    <label className="campo-busqueda" style={{ flex: '0 1 150px' }}>
      <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
        Sección
      </span>
      <input inputMode="numeric" maxLength={4} aria-label="Filtrar por sección" placeholder="todas" value={seccion} onChange={(e) => setSeccion(e.target.value.replace(/\D/g, ''))} />
    </label>
  )
  const selectEnlace = (
    <label className="btn btn-select">
      Enlace: {enlaceSel ? abreviar(nombrePropio(enlaceSel.nombre)) : 'todos'}
      <IcoFlecha />
      <select aria-label="Filtrar por enlace" value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
        <option value={0}>Todos</option>
        {enlaces.datos?.map((e) => (
          <option key={e.id} value={e.id}>
            {nombrePropio(e.nombre)}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo="Asignaciones" desc="Qué operador cubre cada colonia de cada sección y cuántas personas moviliza.">
          {municipioId && (
            <div className="acciones">
              {estado !== 'sin-asignar' && (
                <a className="btn desde-tablet" href={`/api${base}/asignaciones?${filtros}&formato=csv`} download>
                  Exportar a Excel
                </a>
              )}
              {puedeCapturar && (
                <div className="barra-movil">
                  <button className="btn" type="button" onClick={() => setHoja({ tipo: 'persona' })}>
                    Registrar persona
                  </button>
                  <button className="btn pri" type="button" onClick={() => setHoja({ tipo: 'alta' })}>
                    <IcoMas />
                    Nueva asignación
                  </button>
                </div>
              )}
            </div>
          )}
        </Encabezado>

        <div className="filtros">
          <label className="campo-busqueda">
            <IcoBuscar />
            <input type="search" aria-label="Buscar" placeholder={BUSQUEDA[estado]} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="desde-tablet" style={{ display: 'contents' }}>
            {conSeccion && campoSeccion}
            {conEnlace && selectEnlace}
          </div>
          {(conSeccion || conEnlace) && (
            <button className="btn solo-movil" type="button" onClick={() => setHojaFiltros(true)}>
              <IcoFiltro />
              Filtros{activos ? ` (${activos})` : ''}
            </button>
          )}
        </div>
        <div className="seg" role="group" aria-label="Qué mostrar" style={{ marginBottom: 16 }}>
          {segmentos.map((s) => (
            <button key={s.id} className="btn md" type="button" aria-pressed={estado === s.id} onClick={() => setEstado(s.id)}>
              {s.texto}
            </button>
          ))}
        </div>

        <section className="card" style={{ overflow: 'hidden' }} aria-busy={actual.cargando}>
          {actual.error ? (
            <div className="vacio" role="alert">
              {actual.error.message}{' '}
              <button type="button" className="link-btn" onClick={recargar}>
                Reintentar
              </button>
            </div>
          ) : !actual.datos ? (
            <div className="vacio">Cargando…</div>
          ) : conEnlace ? (
            <TablaAsignaciones filas={lista.datos!.filas} bajas={estado === 'bajas'} puedeEditar={puedeCapturar} onEditar={(fila) => setHoja({ tipo: 'editar', fila })} />
          ) : estado === 'sin-operador' ? (
            <TablaSinOperador filas={sinOperador.datos!.filas} puedeEditar={puedeCapturar} onAsignar={(c) => setHoja({ tipo: 'alta', seccion: c.seccion, colonia: c.colonia_id })} />
          ) : (
            <TablaSinAsignar
              filas={sinAsignar.datos!.filas}
              puedeEditar={puedeCapturar}
              onAsignar={(p) => setHoja({ tipo: 'alta', persona: p })}
              onEditar={(p) => setHoja({ tipo: 'persona', persona: p })}
            />
          )}
          {actual.datos && !actual.error && actual.datos.filas.length === 0 && <div className="vacio">{VACIO[estado]}</div>}
          {actual.datos && total > 0 && (
            <div className="paginacion" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <span>
                <span className="num">
                  {n((pagina - 1) * limite + 1)}–{n(Math.min(pagina * limite, total))}
                </span>{' '}
                de <span className="num">{n(total)}</span> {UNIDAD[estado]}
                {conEnlace && lista.datos && (
                  <>
                    {' · '}
                    <span className="num">{n(lista.datos.operadores)}</span> operadores · <span className="num">{n(lista.datos.personas)}</span> personas
                  </>
                )}
              </span>
              <div className="acciones" style={{ gap: 6 }}>
                <button type="button" className="btn sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </button>
                <button type="button" className="btn sm" disabled={pagina * limite >= total} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {hojaFiltros && (
        <Hoja titulo="Filtros" onCerrar={() => setHojaFiltros(false)}>
          {conSeccion && (
            <label className="campo">
              Sección
              <input inputMode="numeric" maxLength={4} placeholder="Todas" value={seccion} onChange={(e) => setSeccion(e.target.value.replace(/\D/g, ''))} />
            </label>
          )}
          {conEnlace && (
            <label className="campo">
              Enlace
              <select value={enlace} onChange={(e) => setEnlace(Number(e.target.value))}>
                <option value={0}>Todos</option>
                {enlaces.datos?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {nombrePropio(e.nombre)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="acciones">
            <button
              className="btn"
              type="button"
              style={{ flex: 1 }}
              onClick={() => {
                setSeccion('')
                setEnlace(0)
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

      {hoja?.tipo === 'alta' && municipioId && (
        <AsignacionForm
          municipioId={municipioId}
          persona={hoja.persona}
          seccion={hoja.seccion}
          colonia={hoja.colonia}
          onCerrar={() => setHoja(null)}
          onGuardada={cerrarYRecargar}
          onOtra={recargar}
        />
      )}
      {hoja?.tipo === 'editar' && <EditarAsignacionForm asignacion={hoja.fila} onCerrar={() => setHoja(null)} onGuardada={cerrarYRecargar} />}
      {hoja?.tipo === 'persona' && municipioId && (
        <PersonaForm
          municipioId={municipioId}
          persona={hoja.persona}
          modo="persona"
          onCerrar={() => setHoja(null)}
          onOtra={recargar}
          onGuardada={(p, asignar) => {
            recargar()
            setHoja(asignar ? { tipo: 'alta', persona: p } : null)
          }}
        />
      )}
    </Shell>
  )
}

const UNIDAD: Record<Estado, string> = {
  vigentes: 'asignaciones',
  bajas: 'asignaciones',
  'sin-operador': 'colonias',
  'sin-asignar': 'personas',
}

const VACIO: Record<Estado, string> = {
  vigentes: 'Ninguna asignación coincide con los filtros.',
  bajas: 'No hay asignaciones dadas de baja con estos filtros.',
  'sin-operador': 'Todas las colonias de estos filtros tienen operador.',
  'sin-asignar': 'No hay personas sin asignar.',
}

function TablaAsignaciones({ filas, bajas, puedeEditar, onEditar }: { filas: AsignacionFila[]; bajas: boolean; puedeEditar: boolean; onEditar: (f: AsignacionFila) => void }) {
  const editar = puedeEditar && !bajas
  return (
    <div className="tbl-wrap">
      <table className="tbl apilable">
        <thead>
          <tr>
            <th>Sección</th>
            <th>Colonia</th>
            <th>Operador</th>
            <th className="col-sec">Enlaces</th>
            <th className="r">Personas</th>
            <th className="col-sec">{bajas ? 'Baja' : 'Alta'}</th>
            {editar && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((a) => (
            <tr key={a.id}>
              <td>
                <Link to={`/secciones/${a.seccion}`} className="num" style={{ fontWeight: 500 }}>
                  <span className="solo-movil">Sección </span>
                  {numSeccion(a.seccion)}
                </Link>
              </td>
              <td data-label="Colonia" style={{ fontWeight: 600, whiteSpace: 'normal' }}>
                {a.colonia}
              </td>
              <td data-label="Operador" style={{ whiteSpace: 'normal' }}>
                <Link to={`/operadores/${a.operador_id}`}>{nombrePropio(a.operador)}</Link>
              </td>
              <td className="col-sec" data-label="Enlaces" style={{ whiteSpace: 'normal' }}>
                {a.enlaces.length ? a.enlaces.map((e) => abreviar(nombrePropio(e.nombre))).join(' · ') : <span className="tag warn">Sin enlace</span>}
              </td>
              <td className="r num" data-label="Personas">
                {n(a.num_personas)}
              </td>
              <td className="num col-sec muted" data-label={bajas ? 'Baja' : 'Alta'}>
                {cuando((bajas ? a.deleted_at : a.created_at) ?? a.created_at)}
              </td>
              {editar && (
                <td data-label="">
                  <button type="button" className="link-btn" aria-label={`Editar asignación de ${nombrePropio(a.operador)} en ${a.colonia}`} onClick={() => onEditar(a)}>
                    Editar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaSinOperador({ filas, puedeEditar, onAsignar }: { filas: ColoniaSinOperador[]; puedeEditar: boolean; onAsignar: (c: ColoniaSinOperador) => void }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl apilable">
        <thead>
          <tr>
            <th>Sección</th>
            <th>Colonia</th>
            <th>Estado</th>
            {puedeEditar && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={`${c.seccion_id}-${c.colonia_id}`}>
              <td>
                <Link to={`/secciones/${c.seccion}`} className="num" style={{ fontWeight: 500 }}>
                  <span className="solo-movil">Sección </span>
                  {numSeccion(c.seccion)}
                </Link>
              </td>
              <td data-label="Colonia" style={{ fontWeight: 600, whiteSpace: 'normal' }}>
                {c.colonia}
              </td>
              <td data-label="Estado">
                <span className="tag warn">Sin operador</span>
              </td>
              {puedeEditar && (
                <td data-label="">
                  <button type="button" className="btn sm" onClick={() => onAsignar(c)}>
                    Asignar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaSinAsignar({
  filas,
  puedeEditar,
  onAsignar,
  onEditar,
}: {
  filas: PersonaSinAsignar[]
  puedeEditar: boolean
  onAsignar: (p: PersonaBreve) => void
  onEditar: (p: PersonaBreve) => void
}) {
  return (
    <div className="tbl-wrap">
      <table className="tbl apilable">
        <thead>
          <tr>
            <th>Persona</th>
            <th>Teléfono</th>
            <th className="col-sec">Registrada</th>
            {puedeEditar && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>
                <Link to={`/operadores/${p.id}`}>{nombrePropio(p.nombre)}</Link>
              </td>
              <td className="num" data-label="Teléfono">
                {telefono(p.telefono) || '—'}
              </td>
              <td className="num col-sec muted" data-label="Registrada">
                {cuando(p.created_at)}
              </td>
              {puedeEditar && (
                <td data-label="">
                  <div className="acciones" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <button type="button" className="btn sm" onClick={() => onAsignar(p)}>
                      Asignar
                    </button>
                    <button type="button" className="btn sm" onClick={() => onEditar(p)}>
                      Editar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
