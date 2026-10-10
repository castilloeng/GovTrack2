import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Barra, Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { usePorPagina } from '../componentes/usePorPagina'
import { useApi, type CategoriaPrioridad, type PrioridadDatos } from '../api'
import { UMBRAL_BAJA_COBERTURA, UMBRAL_COMPETIDA } from '../datos'
import { n, nombreCargo, numSeccion, pct } from '../formato'
import { IcoFlecha } from '../iconos'
import { Link } from '../router'

// Prioridad por sección (DISENO.md §5 "Prioridad"): resultado del partido propio × cobertura de la estructura.

const CATEGORIA: Record<CategoriaPrioridad, { etiqueta: string; nombre: string; clase: '' | 'warn' | 'gray' }> = {
  'competida-sin': { etiqueta: 'Prioridad', nombre: 'Competida sin estructura', clase: 'warn' },
  'competida-con': { etiqueta: 'Sostener', nombre: 'Competida con estructura', clase: '' },
  'ganada-sin': { etiqueta: 'Reforzar', nombre: 'Ganada sin estructura', clase: 'gray' },
  'perdida-con': { etiqueta: 'Revisar', nombre: 'Perdida con estructura', clase: 'gray' },
  'perdida-sin': { etiqueta: 'Abrir', nombre: 'Perdida sin estructura', clase: 'gray' },
  'ganada-con': { etiqueta: 'Bastión', nombre: 'Ganada con estructura', clase: '' },
}

const FILAS_MATRIZ = [
  { banda: 'ganada', texto: 'Ganada' },
  { banda: 'competida', texto: 'Competida' },
  { banda: 'perdida', texto: 'Perdida' },
] as const

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

  const params = new URLSearchParams({
    pagina: String(pagina),
    limite: String(limite),
    margen: String(UMBRAL_COMPETIDA),
    cobertura: String(UMBRAL_BAJA_COBERTURA),
  })
  if (procesoId) params.set('proceso', String(procesoId))
  if (eleccionId) params.set('eleccion', String(eleccionId))
  if (categoria) params.set('categoria', categoria)
  const { datos, error, cargando, recargar } = useApi<PrioridadDatos>(municipioId ? `/municipios/${municipioId}/prioridad?${params}` : null)

  const elecciones = procesos.find((p) => p.id === procesoId)?.elecciones ?? []
  const propio = datos?.partido_propio
  const m = datos?.municipio
  const competidas = datos ? datos.matriz['competida-sin'].secciones + datos.matriz['competida-con'].secciones : 0
  const conResultados = datos ? Object.values(datos.matriz).reduce((t, c) => t + c.secciones, 0) : 0
  const prioridad = datos?.matriz['competida-sin']

  return (
    <Shell>
      <main className="contenido">
        <Encabezado
          titulo="Prioridad por sección"
          desc={`Cruza el resultado ${propio ? `de ${propio}` : 'del partido propio'} con la estructura de cada sección para decidir dónde trabajar.`}
        >
          {elecciones.length > 1 && (
            <label className="btn btn-select">
              {nombreCargo(elecciones.find((e) => e.id === (eleccionId ?? datos?.eleccion?.id))?.cargo ?? 'Elección')}
              <IcoFlecha />
              <select aria-label="Elección" value={eleccionId ?? datos?.eleccion?.id ?? ''} onChange={(e) => setEleccionId(Number(e.target.value))}>
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
        ) : !datos.eleccion || !m ? (
          <div className="card vacio" role="status">
            Este proceso no tiene resultados cargados en el municipio.
          </div>
        ) : (
          <div className="pila" style={{ gap: 24 }} aria-busy={cargando}>
            <div className="kpis">
              <div className="card kpi">
                <div className="kpi-lbl">Secciones prioritarias</div>
                <div className="num kpi-num">
                  {n(prioridad!.secciones)} <small>/ {n(conResultados)}</small>
                </div>
                <div className="kpi-ctx">competidas y sin estructura</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Secciones competidas</div>
                <div className="num kpi-num">{n(competidas)}</div>
                <div className="kpi-ctx">margen de ±{n(datos.umbral_margen)} puntos</div>
              </div>
              <div className="card kpi">
                <div className="kpi-lbl">Ventaja en el municipio</div>
                <div className="num kpi-num">{puntos(porcentaje(m.propio - m.votos_rival, m.votos))}</div>
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
                <div className="kpi-lbl">Lista nominal en prioridad</div>
                <div className="num kpi-num">{n(prioridad!.ln)}</div>
                <div className="kpi-ctx">{pct(porcentaje(prioridad!.ln, m.ln))} del municipio</div>
              </div>
            </div>

            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="card-head">
                <div>
                  <h2>Matriz de prioridad</h2>
                  <div className="nota" style={{ marginTop: 2 }}>
                    {nombreCargo(datos.eleccion.cargo)} · toca una celda para filtrar la tabla
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
                <span className="matriz-col">Sin estructura</span>
                <span className="matriz-col">Con estructura</span>
                {FILAS_MATRIZ.map((f) => (
                  <MatrizFila key={f.banda} texto={f.texto} banda={f.banda} datos={datos} categoria={categoria} onElegir={setCategoria} />
                ))}
              </div>
              <p className="card-foot">
                Ganada o perdida por más de {n(datos.umbral_margen)} puntos sobre el rival principal; con estructura desde {pct(datos.umbral_cobertura)} de la lista nominal
                movilizada.
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
                      <th className="r">Margen</th>
                      <th>Diferencia</th>
                      <th className="col-sec">Rival</th>
                      <th className="r">Personas</th>
                      <th>Cobertura</th>
                      <th className="r col-sec" style={{ whiteSpace: 'normal' }}>
                        Lista nominal
                      </th>
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
                          <td className="r num" data-label="Margen">
                            {puntos(s.margen)}
                          </td>
                          <td data-label="Diferencia">
                            <span>
                              {dif > 0 ? 'Gana' : dif < 0 ? 'Pierde' : 'Empata'}
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
                          <td className="r num" data-label="Personas">
                            {n(s.personas)}
                          </td>
                          <td data-label="Cobertura" className="ancho">
                            {s.operadores === 0 ? (
                              <span className="tag warn">Sin operador</span>
                            ) : (
                              <div className="cobertura">
                                <Barra valor={s.cobertura * 10} alerta={s.cobertura < datos.umbral_cobertura} />
                                <span className="num" style={{ fontSize: 13 }}>
                                  {pct(s.cobertura)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="r num col-sec" data-label="Lista nominal">
                            {n(s.ln)}
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

function MatrizFila({
  texto,
  banda,
  datos,
  categoria,
  onElegir,
}: {
  texto: string
  banda: 'ganada' | 'competida' | 'perdida'
  datos: PrioridadDatos
  categoria: CategoriaPrioridad | null
  onElegir: (c: CategoriaPrioridad | null) => void
}) {
  return (
    <>
      <span className="matriz-fila">{texto}</span>
      {(['sin', 'con'] as const).map((e) => {
        const cat = `${banda}-${e}` as CategoriaPrioridad
        const celda = datos.matriz[cat]
        const elegida = categoria === cat
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
              LN <span className="num">{n(celda.ln)}</span>
            </span>
          </button>
        )
      })}
    </>
  )
}
