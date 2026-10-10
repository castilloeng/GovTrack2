import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { ColoniaForm, NuevaSeccion } from '../componentes/FormulariosGeografia'
import { useApi, type ColoniaFila, type Pagina, type SeccionFila } from '../api'
import { n, nombrePropio, numSeccion } from '../formato'
import { IcoBuscar, IcoMas } from '../iconos'
import { Link, navegar } from '../router'

// Secciones y colonias del municipio (DISENO.md §5 "Secciones y colonias").
// Dos vistas con su propia URL: /secciones y /colonias. Los datos se paginan desde la API.

type Vista = 'secciones' | 'colonias'

const FILTROS: Record<Vista, { id: string; texto: string }[]> = {
  secciones: [
    { id: '', texto: 'Todas' },
    { id: 'sin-operador', texto: 'Sin operador' },
    { id: 'huecos', texto: 'Con colonias sin operador' },
  ],
  colonias: [
    { id: '', texto: 'Todas' },
    { id: 'sin-operador', texto: 'Sin operador' },
  ],
}

/** 25 filas en celular y 50 en iPad o escritorio (DISENO.md §8). */
function usePorPagina() {
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

export default function Secciones({ vista }: { vista: Vista }) {
  const { municipioId, procesoId, municipio, puedeCapturar } = useContexto()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const [alta, setAlta] = useState(false)
  const limite = usePorPagina()

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])
  // Cambiar de vista, municipio, búsqueda o filtro regresa a la primera página.
  useEffect(() => setPagina(1), [vista, municipioId, q, filtro, limite])
  useEffect(() => setFiltro(''), [vista])

  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) })
  if (q) params.set('q', q)
  if (filtro) params.set('filtro', filtro)
  if (vista === 'secciones' && procesoId) params.set('proceso', String(procesoId))
  const { datos, error, cargando, recargar } = useApi<Pagina<SeccionFila | ColoniaFila>>(municipioId ? `/municipios/${municipioId}/${vista}?${params}` : null)

  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo="Secciones y colonias" desc={`Catálogo de ${municipio}. Una colonia puede pertenecer a varias secciones.`}>
          {puedeCapturar && municipioId && (
            <div className="barra-movil">
              <button className="btn pri" type="button" onClick={() => setAlta(true)}>
                <IcoMas />
                {vista === 'secciones' ? 'Nueva sección' : 'Nueva colonia'}
              </button>
            </div>
          )}
        </Encabezado>

        <div className="tabs" role="tablist" aria-label="Vista">
          {(['secciones', 'colonias'] as const).map((v) => (
            <button key={v} className="tab" role="tab" type="button" aria-selected={vista === v} onClick={() => navegar(`/${v}`, { reemplazar: true })}>
              {v === 'secciones' ? 'Secciones' : 'Colonias'}
            </button>
          ))}
        </div>

        <div className="filtros">
          <label className="campo-busqueda">
            <IcoBuscar />
            <input
              type="search"
              inputMode={vista === 'secciones' ? 'numeric' : undefined}
              aria-label={vista === 'secciones' ? 'Buscar sección' : 'Buscar colonia'}
              placeholder={vista === 'secciones' ? 'Número de sección' : 'Colonia, código postal o sección'}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <div className="seg" role="group" aria-label="Filtrar">
            {FILTROS[vista].map((f) => (
              <button key={f.id} className="btn md" type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
                {f.texto}
              </button>
            ))}
          </div>
        </div>

        <section className="card" style={{ overflow: 'hidden' }} aria-busy={cargando}>
          {error ? (
            <div className="vacio" role="alert">
              {error.message}{' '}
              <button type="button" className="link-btn" onClick={recargar}>
                Reintentar
              </button>
            </div>
          ) : !datos ? (
            <div className="vacio">Cargando…</div>
          ) : vista === 'secciones' ? (
            <TablaSecciones filas={datos.filas as SeccionFila[]} />
          ) : (
            <TablaColonias filas={datos.filas as ColoniaFila[]} municipioId={municipioId!} puedeEditar={puedeCapturar} onCambio={recargar} />
          )}
          {datos && datos.filas.length === 0 && !error && <div className="vacio">No hay {vista} con este filtro.</div>}
          {datos && datos.total > 0 && (
            <div className="paginacion" style={{ borderTop: '1px solid var(--line-soft)' }}>
              <span>
                <span className="num">
                  {n((pagina - 1) * limite + 1)}–{n(Math.min(pagina * limite, datos.total))}
                </span>{' '}
                de <span className="num">{n(datos.total)}</span> {vista}
              </span>
              <div className="acciones">
                <button type="button" className="btn sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
                  Anterior
                </button>
                <button type="button" className="btn sm" disabled={pagina * limite >= datos.total} onClick={() => setPagina((p) => p + 1)}>
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {alta && municipioId && vista === 'secciones' && (
        <NuevaSeccion municipioId={municipioId} onCerrar={() => setAlta(false)} onCreada={(num) => navegar(`/secciones/${num}`)} />
      )}
      {alta && municipioId && vista === 'colonias' && (
        <ColoniaForm
          municipioId={municipioId}
          onCerrar={() => setAlta(false)}
          onGuardada={() => {
            setAlta(false)
            recargar()
          }}
        />
      )}
    </Shell>
  )
}

function Estado({ operadores, sinCubrir }: { operadores: number; sinCubrir: number }) {
  if (operadores === 0) return <span className="tag warn">Sin operador</span>
  if (sinCubrir > 0) return <span className="tag warn">{n(sinCubrir)} sin operador</span>
  return <span className="tag">Cubierta</span>
}

function TablaSecciones({ filas }: { filas: SeccionFila[] }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl apilable">
        <thead>
          <tr>
            <th>Sección</th>
            <th className="col-sec">Tipo</th>
            <th className="r">Colonias</th>
            <th className="r">Operadores</th>
            <th className="r">Personas</th>
            <th className="r col-sec">Casillas</th>
            <th className="r">Lista nominal</th>
            <th>Estado</th>
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
              <td className="col-sec" data-label="Tipo">
                {s.tipo ? nombrePropio(s.tipo) : '—'}
              </td>
              <td className="r num" data-label="Colonias">
                {n(s.colonias_cubiertas)} / {n(s.colonias)}
              </td>
              <td className="r num" data-label="Operadores">{n(s.operadores)}</td>
              <td className="r num" data-label="Personas">{n(s.personas)}</td>
              <td className="r num col-sec" data-label="Casillas">{n(s.casillas)}</td>
              <td className="r num" data-label="Lista nominal">{n(s.ln)}</td>
              <td data-label="Estado">
                <Estado operadores={s.operadores} sinCubrir={s.colonias - s.colonias_cubiertas} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TablaColonias({ filas, municipioId, puedeEditar, onCambio }: { filas: ColoniaFila[]; municipioId: number; puedeEditar: boolean; onCambio: () => void }) {
  const [editando, setEditando] = useState<ColoniaFila | null>(null)
  return (
    <div className="tbl-wrap">
      <table className="tbl apilable">
        <thead>
          <tr>
            <th>Colonia</th>
            <th className="col-sec">CP</th>
            <th>Secciones</th>
            <th className="r">Operadores</th>
            <th className="r">Personas</th>
            <th>Estado</th>
            {puedeEditar && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.id}>
              <td>
                <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                {c.tipo_asentamiento && <div className="nota">{nombrePropio(c.tipo_asentamiento)}</div>}
              </td>
              <td className="num col-sec" data-label="CP">
                {c.cp ?? '—'}
              </td>
              <td data-label="Secciones">
                <span className="secciones-chips">
                  {c.secciones.length === 0 && <span className="muted">—</span>}
                  {c.secciones.map((s) => (
                    <Link key={s.id} to={`/secciones/${s.numero}`} className="num">
                      {numSeccion(s.numero)}
                    </Link>
                  ))}
                </span>
              </td>
              <td className="r num" data-label="Operadores">{n(c.operadores)}</td>
              <td className="r num" data-label="Personas">{n(c.personas)}</td>
              <td data-label="Estado">{c.operadores > 0 ? <span className="tag">Cubierta</span> : <span className="tag warn">Sin operador</span>}</td>
              {puedeEditar && (
                <td data-label="">
                  <button type="button" className="link-btn" onClick={() => setEditando(c)} aria-label={`Editar ${c.nombre}`}>
                    Editar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editando && (
        <ColoniaForm
          municipioId={municipioId}
          colonia={editando}
          onCerrar={() => setEditando(null)}
          onGuardada={() => {
            setEditando(null)
            onCambio()
          }}
        />
      )}
    </div>
  )
}
