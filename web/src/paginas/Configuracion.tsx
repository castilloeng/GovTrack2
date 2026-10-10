import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'
import { aplicarTema, cargarTema, guardarTema, temaGuardado, TEMAS, type Tema } from '../tema'
import { IcoPalomita } from '../iconos'
import { api, useApi, type Partido } from '../api'

// Configuración → tema global del sitio (DISENO.md §6). Solo ADMIN.
// La vista previa se aplica al pasar o seleccionar; "Guardar" lo fija en la tabla `configuracion` (D1).
// Cada tarjeta (tema y partido propio) tiene su propio "Guardar".

const NOMBRE: Record<Tema, string> = { verde: 'Verde', azul: 'Azul', naranja: 'Naranja', guinda: 'Guinda' }

export default function Configuracion() {
  const [guardado, setGuardado] = useState<Tema>(temaGuardado)
  const [elegido, setElegido] = useState<Tema>(guardado)
  const [vista, setVista] = useState<Tema | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)

  // El tema vigente es el de la BD; la copia local solo sirve mientras responde la API.
  useEffect(() => {
    let vigente = true
    cargarTema().then((t) => {
      if (!vigente) return
      setGuardado(t)
      setElegido(t)
    })
    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => aplicarTema(vista ?? elegido), [vista, elegido])
  // Al salir sin guardar se restaura el tema guardado.
  useEffect(() => () => aplicarTema(temaGuardado()), [])

  return (
    <Shell>
      <main className="contenido angosto">
        <Encabezado titulo="Configuración" desc="Ajustes globales del sitio para todos los usuarios." />

        <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2>Tema del sitio</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Pasa el cursor o toca una opción para ver la vista previa antes de guardar.
            </p>
          </div>
          <div className="temas" role="radiogroup" aria-label="Tema del sitio" onMouseLeave={() => setVista(null)}>
            {TEMAS.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={elegido === t}
                className="card tema-card"
                data-tema={t}
                onMouseEnter={() => setVista(t)}
                onFocus={() => setVista(t)}
                onBlur={() => setVista(null)}
                onClick={() => {
                  setElegido(t)
                  setAviso(null)
                }}
              >
                <div className="tema-prev">
                  <div className="tema-prev-side">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="tema-prev-main">
                    <span className="tema-prev-btn">Botón</span>
                    <span className="tag">Cubierta</span>
                    <span className="tag warn">Sin operador</span>
                  </div>
                </div>
                <div className="tema-nombre">
                  {NOMBRE[t]}
                  {t === 'verde' && (
                    <span className="nota" style={{ fontWeight: 400, marginRight: 'auto', marginLeft: 8 }}>
                      predeterminado
                    </span>
                  )}
                  {elegido === t && (
                    <span className="paso-circ" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }}>
                      <IcoPalomita />
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="acciones" style={{ alignItems: 'center' }}>
            <button
              className="btn pri"
              type="button"
              disabled={elegido === guardado || guardando}
              onClick={async () => {
                setGuardando(true)
                try {
                  await guardarTema(elegido)
                  setGuardado(elegido)
                  setAviso({ ok: true, texto: 'Tema guardado' })
                } catch (e) {
                  setAviso({ ok: false, texto: `No se pudo guardar: ${(e as Error).message}` })
                } finally {
                  setGuardando(false)
                }
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {aviso && (
              <p role="status" className={'tag' + (aviso.ok ? '' : ' warn')} style={{ whiteSpace: 'normal' }}>
                {aviso.texto}
              </p>
            )}
          </div>
        </section>

        <AjustesPrioridad />
      </main>
    </Shell>
  )
}

/** Efectividad por omisión (igual que EFECTIVIDAD en worker/prioridad.ts). */
const EFECTIVIDAD = 50

/**
 * Ajustes de Prioridad (claves `partido_propio` y `efectividad` de `configuracion`): el partido con el que se
 * calcula el resultado y el % de las personas comprometidas que se espera que voten por el partido.
 */
function AjustesPrioridad() {
  const config = useApi<Record<string, string>>('/configuracion')
  const partidos = useApi<Partido[]>('/partidos')
  const guardado = config.datos ? { partido: config.datos.partido_propio ?? '', efectividad: config.datos.efectividad ?? String(EFECTIVIDAD) } : null
  const [partido, setPartido] = useState<string | null>(null)
  const [efectividad, setEfectividad] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const valorPartido = partido ?? guardado?.partido ?? ''
  const valorEfectividad = efectividad ?? guardado?.efectividad ?? String(EFECTIVIDAD)
  const efectividadNum = Number(valorEfectividad)
  const efectividadOk = Number.isInteger(efectividadNum) && efectividadNum >= 1 && efectividadNum <= 100
  const cambio = !!guardado && (valorPartido !== guardado.partido || valorEfectividad !== guardado.efectividad)

  return (
    <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
      <div>
        <h2>Prioridad</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Con qué partido se calcula el resultado de cada sección y cuántos votos se esperan de la meta de la estructura. No cambia el color del sitio.
        </p>
      </div>
      {config.error || partidos.error ? (
        <div className="muted" role="alert" style={{ fontSize: 13 }}>
          {(config.error ?? partidos.error)!.message}{' '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              config.recargar()
              partidos.recargar()
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !guardado || !partidos.datos ? (
        <div className="muted" style={{ fontSize: 13 }}>
          Cargando…
        </div>
      ) : (
        <>
          <div className="form-grid" style={{ padding: 0 }}>
            <label className="campo">
              Partido propio
              <select
                value={valorPartido}
                onChange={(e) => {
                  setPartido(e.target.value)
                  setAviso(null)
                }}
              >
                <option value="">Sin elegir</option>
                {partidos.datos.map((p) => (
                  <option key={p.id} value={p.siglas}>
                    {p.siglas}
                    {p.nombre ? ` · ${p.nombre}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              Efectividad de la meta (%)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={valorEfectividad}
                aria-invalid={!efectividadOk}
                onChange={(e) => {
                  setEfectividad(e.target.value)
                  setAviso(null)
                }}
              />
              <span className="nota" style={{ fontWeight: 400 }}>
                De cada 100 personas comprometidas, cuántas se espera que voten por el partido (algunas no votan o votan por otro). Por omisión, {EFECTIVIDAD}.
              </span>
            </label>
          </div>
          <div className="acciones" style={{ alignItems: 'center' }}>
            <button
              className="btn pri"
              type="button"
              disabled={!cambio || !efectividadOk || guardando}
              onClick={async () => {
                setGuardando(true)
                try {
                  await api('/configuracion', {
                    metodo: 'PATCH',
                    datos: { partido_propio: valorPartido || null, efectividad: efectividadNum },
                  })
                  config.recargar()
                  setPartido(null)
                  setEfectividad(null)
                  setAviso({ ok: true, texto: 'Ajustes guardados' })
                } catch (e) {
                  setAviso({ ok: false, texto: `No se pudo guardar: ${(e as Error).message}` })
                } finally {
                  setGuardando(false)
                }
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
            {!efectividadOk && (
              <p role="alert" className="tag warn" style={{ whiteSpace: 'normal' }}>
                La efectividad debe ser un entero de 1 a 100
              </p>
            )}
            {aviso && (
              <p role="status" className={'tag' + (aviso.ok ? '' : ' warn')} style={{ whiteSpace: 'normal' }}>
                {aviso.texto}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
