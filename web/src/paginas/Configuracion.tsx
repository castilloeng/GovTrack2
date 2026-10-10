import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'
import { aplicarTema, cargarTema, guardarTema, temaGuardado, TEMAS, type Tema } from '../tema'
import { IcoPalomita } from '../iconos'

// Configuración → tema global del sitio (DISENO.md §6). Solo ADMIN.
// La vista previa se aplica al pasar o seleccionar; "Guardar" lo fija en la tabla `configuracion` (D1).

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
        <Encabezado titulo="Configuración" desc="El tema define el color del sitio para todos los usuarios.">
          <div className="barra-movil">
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
          </div>
        </Encabezado>

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
          {aviso && (
            <p role="status" className={'tag' + (aviso.ok ? '' : ' warn')} style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>
              {aviso.texto}
            </p>
          )}
        </section>
      </main>
    </Shell>
  )
}
