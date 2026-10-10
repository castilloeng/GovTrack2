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

        <PartidoPropio />
      </main>
    </Shell>
  )
}

/** Partido propio: base del margen en Prioridad (clave `partido_propio` de `configuracion`). */
function PartidoPropio() {
  const config = useApi<Record<string, string>>('/configuracion')
  const partidos = useApi<Partido[]>('/partidos')
  const guardado = config.datos ? (config.datos.partido_propio ?? '') : null
  const [elegido, setElegido] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const valor = elegido ?? guardado ?? ''

  return (
    <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
      <div>
        <h2>Partido propio</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Se usa en Prioridad para calcular el margen de cada sección. No cambia el color del sitio.
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
      ) : guardado === null || !partidos.datos ? (
        <div className="muted" style={{ fontSize: 13 }}>
          Cargando…
        </div>
      ) : (
        <>
          <label className="campo" style={{ maxWidth: 360 }}>
            Partido
            <select
              value={valor}
              onChange={(e) => {
                setElegido(e.target.value)
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
          <div className="acciones" style={{ alignItems: 'center' }}>
            <button
              className="btn pri"
              type="button"
              disabled={valor === guardado || guardando}
              onClick={async () => {
                setGuardando(true)
                try {
                  await api('/configuracion/partido_propio', { metodo: 'PUT', datos: { partido_propio: valor || null } })
                  config.recargar()
                  setElegido(null)
                  setAviso({ ok: true, texto: valor ? `Partido propio: ${valor}` : 'Partido propio quitado' })
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
        </>
      )}
    </section>
  )
}
