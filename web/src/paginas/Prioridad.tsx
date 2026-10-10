import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { usePorPagina } from '../componentes/usePorPagina'
import { useApi, type CategoriaPrioridad, type PrioridadDatos } from '../api'
import { UMBRAL_COMPETIDA } from '../datos'
import { n, nombreCargo, numSeccion, pct } from '../formato'
import { IcoFlecha } from '../iconos'
import { Link } from '../router'

// Prioridad por sección (DISENO.md §5 "Prioridad"). Es una PROYECCIÓN: los votos son de la elección
// registrada y las personas de la estructura son la meta para la siguiente elección.

const CATEGORIA: Record<CategoriaPrioridad, { etiqueta: string; nombre: string; clase: '' | 'warn' | 'gray' }> = {
  prioridad: { etiqueta: 'Prioridad', nombre: 'Competida, la meta no alcanza', clase: 'warn' },
  cubierta: { etiqueta: 'Cubierta', nombre: 'Competida, la meta alcanza', clase: '' },
  apuesta: { etiqueta: 'Apuesta', nombre: 'Perdida, la meta alcanza para voltearla', clase: 'gray' },
  abrir: { etiqueta: 'Abrir', nombre: 'Perdida, la meta no alcanza', clase: 'gray' },
  bastion: { etiqueta: 'Bastión', nombre: 'Ganada con ventaja', clase: '' },
}

const decimal = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
/** Puntos con signo: +4.2, −3.1 (signo menos tipográfico). */
const puntos = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + decimal.format(Math.abs(v))

const porcentaje = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : 0)

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
          desc={`Proyección para la siguiente elección: el resultado ${propio ? `de ${propio} ` : ''}en ${registrada} más la meta de personas de la estructura.`}
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
                <div className="kpi-ctx">competidas donde la meta no alcanza</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Personas por comprometer</div>
                <div className="num kpi-num">{n(prio.faltan)}</div>
                <div className="kpi-ctx">para asegurar las secciones prioritarias</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Margen {anio ?? ''}</div>
                <div className="num kpi-num">{puntos(m.margen)}</div>
                <div className="kpi-ctx">
                  {propio} <span className="num">{pct(porcentaje(m.propio, m.votos))}</span>
                  {m.rival && (
                    <>
                      {' '}
                      vs {m.rival} <span className="num">{pct(porcentaje(m.votos_rival, m.votos))}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Margen proyectado</div>
                <div className="num kpi-num">{puntos(m.proyeccion)}</div>
                <div className="kpi-ctx">
                  meta de <span className="num">{n(m.personas)}</span> personas al <span className="num">{n(datos.efectividad)} %</span>
                </div>
              </div>
            </div>

            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <div>
                  <h2>Matriz de prioridad</h2>
                  <div className="nota" style={{ marginTop: 2 }}>
                    {registrada} · toca una celda para filtrar la tabla
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
                <span className="matriz-col">La meta no alcanza</span>
                <span className="matriz-col">La meta alcanza</span>
                <span className="matriz-fila">Ganada</span>
                <Celda cat="bastion" datos={datos} categoria={categoria} onElegir={setCategoria} ancha />
                <span className="matriz-fila">Competida</span>
                <Celda cat="prioridad" datos={datos} categoria={categoria} onElegir={setCategoria} />
                <Celda cat="cubierta" datos={datos} categoria={categoria} onElegir={setCategoria} />
                <span className="matriz-fila">Perdida</span>
                <Celda cat="abrir" datos={datos} categoria={categoria} onElegir={setCategoria} />
                <Celda cat="apuesta" datos={datos} categoria={categoria} onElegir={setCategoria} />
              </div>
              <p className="card-foot">
                Los votos son de {registrada}; la meta es para la siguiente elección. Se cuenta el {n(datos.efectividad)} % de las personas comprometidas como
                votos nuevos, y la meta alcanza si con ellos la sección quedaría ganada por al menos {n(datos.umbral_margen)} puntos. Ganada y perdida: por más de{' '}
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
                      <th>Diferencia</th>
                      <th className="col-sec">Rival</th>
                      <th className="r">Meta</th>
                      <th className="r col-sec">Necesarias</th>
                      <th>Faltan</th>
                      <th className="r col-sec">Proyección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.filas.map((s) => {
                      const dif = s.propio - s.votos_rival
                      return (
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
                          <td data-label="Diferencia">
                            <span>
                              {dif > 0 ? 'Ganó' : dif < 0 ? 'Perdió' : 'Empató'}
                              {dif !== 0 && (
                                <>
                                  {' '}
                                  por <span className="num">{n(Math.abs(dif))}</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="col-sec" data-label="Rival">
                            {s.rival ?? '—'}
                          </td>
                          <td className="r num" data-label="Meta">
                            {s.operadores === 0 ? <span className="tag warn">Sin operador</span> : n(s.personas)}
                          </td>
                          <td className="r num col-sec" data-label="Necesarias">
                            {s.necesarias === 0 ? '—' : n(s.necesarias)}
                          </td>
                          <td data-label="Faltan">
                            {s.necesarias === 0 ? (
                              <span className="nota">No requiere</span>
                            ) : s.faltan === 0 ? (
                              <span className="tag">Alcanza</span>
                            ) : (
                              <span className="num">{n(s.faltan)}</span>
                            )}
                          </td>
                          <td className="r num col-sec" data-label="Proyección">
                            {puntos(s.proyeccion)}
                          </td>
                        </tr>
                      )
                    })}
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

/** Celda de la matriz: filtra la tabla por su categoría (otra vez, quita el filtro). */
function Celda({
  cat,
  datos,
  categoria,
  onElegir,
  ancha = false,
}: {
  cat: CategoriaPrioridad
  datos: PrioridadDatos
  categoria: CategoriaPrioridad | null
  onElegir: (c: CategoriaPrioridad | null) => void
  ancha?: boolean
}) {
  const celda = datos.matriz[cat]
  const elegida = categoria === cat
  const falta = cat === 'prioridad' || cat === 'abrir'
  return (
    <button
      type="button"
      className={'matriz-celda' + (ancha ? ' ancha' : '')}
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
}
