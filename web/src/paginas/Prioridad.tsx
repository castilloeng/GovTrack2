import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Barra, Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { usePorPagina } from '../componentes/usePorPagina'
import { useApi, type CategoriaPrioridad, type PrioridadDatos } from '../api'
import { UMBRAL_COMPETIDA } from '../datos'
import { n, nombreCargo, numSeccion, pct } from '../formato'
import { IcoFlecha } from '../iconos'
import { Link } from '../router'

// Prioridad por sección (DISENO.md §5 "Prioridad"). La estructura es el voto con el que sí se cuenta: se mide
// si la meta de personas comprometidas para la siguiente elección alcanza por sí sola los votos para ganar
// (votos del ganador de la elección registrada + 1), con la efectividad de Configuración.

const CATEGORIA: Record<CategoriaPrioridad, { etiqueta: string; nombre: string; clase: '' | 'warn' | 'gray' }> = {
  prioridad: { etiqueta: 'Prioridad', nombre: 'Competida, la estructura no cubre', clase: 'warn' },
  reforzar: { etiqueta: 'Reforzar', nombre: 'Ganada, la estructura no cubre', clase: 'gray' },
  abrir: { etiqueta: 'Abrir', nombre: 'Perdida, la estructura no cubre', clase: 'gray' },
  cubierta: { etiqueta: 'Cubierta', nombre: 'Competida, la estructura cubre', clase: '' },
  apuesta: { etiqueta: 'Apuesta', nombre: 'Perdida, la estructura cubre', clase: 'gray' },
  bastion: { etiqueta: 'Bastión', nombre: 'Ganada, la estructura cubre', clase: '' },
}

const FILAS_MATRIZ: { texto: string; sin: CategoriaPrioridad; con: CategoriaPrioridad }[] = [
  { texto: 'Ganada', sin: 'reforzar', con: 'bastion' },
  { texto: 'Competida', sin: 'prioridad', con: 'cubierta' },
  { texto: 'Perdida', sin: 'abrir', con: 'apuesta' },
]

const decimal = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Puntos con signo: +4.2, −3.1 (signo menos tipográfico). */
const puntos = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + decimal.format(Math.abs(v))

function Etiqueta({ categoria }: { categoria: CategoriaPrioridad }) {
  const c = CATEGORIA[categoria]
  return (
    <span className={'tag' + (c.clase ? ' ' + c.clase : '')} title={c.nombre}>
      {c.etiqueta}
    </span>
  )
}

export default function Prioridad() {
  const { municipioId, procesoId, procesos, usuario } = useContexto()
  const [eleccionId, setEleccionId] = useState<number | null>(null)
  const [categoria, setCategoria] = useState<CategoriaPrioridad | null>(null)
  const [pagina, setPagina] = useState(1)
  const limite = usePorPagina()

  // Otro proceso tiene otras elecciones: se vuelve a la de omisión.
  useEffect(() => setEleccionId(null), [procesoId])
  useEffect(() => setPagina(1), [municipioId, procesoId, eleccionId, categoria, limite])

  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite), margen: String(UMBRAL_COMPETIDA) })
  if (procesoId) params.set('proceso', String(procesoId))
  if (eleccionId) params.set('eleccion', String(eleccionId))
  if (categoria) params.set('categoria', categoria)
  const { datos, error, cargando, recargar } = useApi<PrioridadDatos>(municipioId ? `/municipios/${municipioId}/prioridad?${params}` : null)

  const elecciones = procesos.find((p) => p.id === procesoId)?.elecciones ?? []
  const anio = procesos.find((p) => p.id === datos?.proceso_id)?.anio
  const propio = datos?.partido_propio
  const m = datos?.municipio
  const conResultados = datos ? Object.values(datos.matriz).reduce((t, c) => t + c.secciones, 0) : 0
  const prio = datos?.matriz.prioridad
  const registrada = datos?.eleccion ? `${nombreCargo(datos.eleccion.cargo)}${anio ? ` ${anio}` : ''}` : 'la elección registrada'

  return (
    <Shell>
      <main className="contenido">
        <Encabezado
          titulo="Prioridad por sección"
          desc={`Si la estructura de ${propio ?? 'el partido propio'}, por sí sola, alcanza los votos con los que se ganó cada sección en ${registrada}.`}
        >
          {elecciones.length > 1 && (
            <label className="btn btn-select">
              {nombreCargo(elecciones.find((e) => e.id === (eleccionId ?? datos?.eleccion?.id))?.cargo ?? 'Elección')}
              <IcoFlecha />
              <select aria-label="Elección registrada" value={eleccionId ?? datos?.eleccion?.id ?? ''} onChange={(e) => setEleccionId(Number(e.target.value))}>
                {elecciones.map((e) => (
                  <option key={e.id} value={e.id}>
                    {nombreCargo(e.cargo)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </Encabezado>

        {error ? (
          <div className="card vacio" role="alert">
            {error.message}{' '}
            <button type="button" className="link-btn" onClick={recargar}>
              Reintentar
            </button>
          </div>
        ) : !datos ? (
          <div className="card vacio">Cargando…</div>
        ) : !propio ? (
          <div className="card vacio" role="status">
            <p>Para calcular la prioridad hace falta elegir el partido propio.</p>
            {usuario.rol === 'ADMIN' ? (
              <p style={{ marginTop: 8 }}>
                <Link to="/configuracion">Elegir partido propio</Link>
              </p>
            ) : (
              <p className="nota" style={{ marginTop: 8 }}>
                Pide al administrador que elija el partido propio.
              </p>
            )}
          </div>
        ) : !datos.eleccion || !m || !prio ? (
          <div className="card vacio" role="status">
            Este proceso no tiene resultados cargados en el municipio.
          </div>
        ) : (
          <div className="pila" style={{ gap: 24 }} aria-busy={cargando}>
            <div className="kpis">
              <div className="card kpi">
                <div className="kpi-lbl">Secciones prioritarias</div>
                <div className="num kpi-num">
                  {n(prio.secciones)} <small>/ {n(conResultados)}</small>
                </div>
                <div className="kpi-ctx">competidas que la estructura no cubre</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Cobertura de la estructura</div>
                <div className="num kpi-num">{pct(m.cobertura)}</div>
                <div style={{ marginTop: 12 }}>
                  <Barra valor={m.cobertura} alerta={m.cobertura < 100} />
                </div>
                <div className="kpi-ctx">
                  <span className="num">{n(Math.round(m.votos_estructura))}</span> de <span className="num">{n(m.para_ganar)}</span> votos para ganar
                </div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Secciones cubiertas</div>
                <div className="num kpi-num">
                  {n(m.secciones_cubiertas)} <small>/ {n(conResultados)}</small>
                </div>
                <div className="kpi-ctx">la estructura alcanza para ganar</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Personas por comprometer</div>
                <div className="num kpi-num">{n(prio.faltan)}</div>
                <div className="kpi-ctx">
                  en las prioritarias · <span className="num">{n(m.faltan)}</span> en todo el municipio
                </div>
              </div>
            </div>

            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <div>
                  <h2>Matriz de prioridad</h2>
                  <div className="nota" style={{ marginTop: 2 }}>
                    Filas: resultado en {registrada} · toca una celda para filtrar la tabla
                  </div>
                </div>
                {categoria && (
                  <button type="button" className="btn sm" onClick={() => setCategoria(null)}>
                    Ver todas
                  </button>
                )}
              </div>
              <div className="matriz" role="group" aria-label="Filtrar por categoría">
                <span className="matriz-esquina" aria-hidden="true" />
                <span className="matriz-col">La estructura no cubre</span>
                <span className="matriz-col">La estructura cubre</span>
                {FILAS_MATRIZ.map((f) => (
                  <MatrizFila key={f.texto} {...f} datos={datos} categoria={categoria} onElegir={setCategoria} />
                ))}
              </div>
              <p className="card-foot">
                Votos para ganar: los del ganador de cada sección en {registrada} + 1. La estructura cubre la sección si su meta, al {n(datos.efectividad)} % de
                efectividad (de cada 100 comprometidos, cuántos se espera que voten por {propio}), alcanza esos votos. Ganada y perdida: por más de{' '}
                {n(datos.umbral_margen)} puntos.
                {datos.sin_resultados > 0 && ` ${n(datos.sin_resultados)} secciones sin resultados no entran en la matriz.`}
              </p>
            </section>

            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <h2>{categoria ? CATEGORIA[categoria].nombre : 'Secciones por prioridad'}</h2>
              </div>
              <div className="tbl-wrap">
                <table className="tbl apilable">
                  <thead>
                    <tr>
                      <th>Sección</th>
                      <th>Categoría</th>
                      <th className="r">Margen {anio ?? ''}</th>
                      <th className="col-sec">Ganó</th>
                      <th className="r">Para ganar</th>
                      <th className="r">Meta</th>
                      <th className="r col-sec">Votos estructura</th>
                      <th>Cobertura</th>
                      <th className="r">Faltan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.filas.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <Link to={`/secciones/${s.numero}`} className="num" style={{ fontWeight: 500 }}>
                            <span className="solo-movil">Sección </span>
                            {numSeccion(s.numero)}
                          </Link>
                        </td>
                        <td data-label="Categoría">
                          <Etiqueta categoria={s.categoria} />
                        </td>
                        <td className="r num" data-label={`Margen ${anio ?? ''}`}>
                          {puntos(s.margen)}
                        </td>
                        <td className="col-sec" data-label="Ganó">
                          <span>
                            {s.ganador} <span className="num">{n(s.votos_ganador)}</span>
                          </span>
                        </td>
                        <td className="r num" data-label="Para ganar">
                          {n(s.para_ganar)}
                        </td>
                        <td className="r num" data-label="Meta">
                          {s.operadores === 0 ? <span className="tag warn">Sin operador</span> : n(s.personas)}
                        </td>
                        <td className="r num col-sec" data-label="Votos estructura">
                          {n(Math.round(s.votos_estructura))}
                        </td>
                        <td data-label="Cobertura" className="ancho">
                          <div className="cobertura">
                            <Barra valor={s.cobertura} alerta={s.cobertura < 100} />
                            <span className="num" style={{ fontSize: 13 }}>
                              {pct(s.cobertura)}
                            </span>
                          </div>
                        </td>
                        <td className="r num" data-label="Faltan">
                          {s.faltan === 0 ? <span className="tag">Cubre</span> : n(s.faltan)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {datos.filas.length === 0 && <div className="vacio">No hay secciones en esta categoría.</div>}
              </div>
              {datos.total > 0 && (
                <div className="paginacion" style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <span>
                    <span className="num">
                      {n((pagina - 1) * limite + 1)}–{n(Math.min(pagina * limite, datos.total))}
                    </span>{' '}
                    de <span className="num">{n(datos.total)}</span> secciones
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
          </div>
        )}
      </main>
    </Shell>
  )
}

function MatrizFila({
  texto,
  sin,
  con,
  datos,
  categoria,
  onElegir,
}: {
  texto: string
  sin: CategoriaPrioridad
  con: CategoriaPrioridad
  datos: PrioridadDatos
  categoria: CategoriaPrioridad | null
  onElegir: (c: CategoriaPrioridad | null) => void
}) {
  return (
    <>
      <span className="matriz-fila">{texto}</span>
      {[sin, con].map((cat) => {
        const celda = datos.matriz[cat]
        const elegida = categoria === cat
        const falta = cat === sin
        return (
          <button
            key={cat}
            type="button"
            className="matriz-celda"
            aria-pressed={elegida}
            aria-label={`${CATEGORIA[cat].nombre}: ${celda.secciones} secciones`}
            onClick={() => onElegir(elegida ? null : cat)}
          >
            <Etiqueta categoria={cat} />
            <span className="num matriz-num">
              {n(celda.secciones)} <small>secc.</small>
            </span>
            <span className="nota">
              {falta ? 'Faltan' : 'Meta'} <span className="num">{n(falta ? celda.faltan : celda.personas)}</span> personas
            </span>
          </button>
        )
      })}
    </>
  )
}
