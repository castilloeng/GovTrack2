import { useState } from 'react'
import Shell from '../componentes/Shell'
import { Barra, Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { bitacoraImportaciones, importacionEjemplo as imp, TIPOS_CARGA } from '../datos'
import { n } from '../formato'
import { IcoExcel, IcoPalomita } from '../iconos'

// Importar desde Excel (diseno/pantallas/Importar.dc.html). Asistente: Archivo → Columnas → Validación → Confirmar.

const PASOS = ['Archivo', 'Columnas', 'Validación', 'Confirmar']

export default function Importar() {
  const { municipio } = useContexto()
  // Arranca en Validación, el paso del diseño aprobado; los demás pasos se navegan con los botones.
  const [paso, setPaso] = useState(2)

  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo="Importar desde Excel" desc="Secciones, colonias, casillas con lista nominal y resultados por casilla." />

        <ol className="pasos" aria-label="Pasos de la importación">
          {PASOS.map((p, i) => (
            <li key={p} className={'paso' + (i < paso ? ' hecho' : i > paso ? ' pendiente' : '')} aria-current={i === paso ? 'step' : undefined}>
              <span className="paso-circ num">{i < paso ? <IcoPalomita /> : i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <div className="pasos-compacto solo-movil" aria-hidden="true">
          Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}
          <Barra valor={((paso + 1) / PASOS.length) * 100} />
        </div>

        <div className="dos-col">
          <div className="ancha pila">
            {paso === 0 && <PasoArchivo />}
            {paso === 1 && <PasoColumnas />}
            {paso === 2 && <PasoValidacion municipio={municipio} />}
            {paso === 3 && <PasoConfirmar />}

            <div className="pie-acciones">
              {paso > 0 ? (
                <button className="btn" type="button" onClick={() => setPaso(paso - 1)}>
                  Volver a {PASOS[paso - 1].toLowerCase()}
                </button>
              ) : (
                <span />
              )}
              <div className="acciones" style={{ alignItems: 'center' }}>
                {paso === 2 && <span className="muted desde-tablet" style={{ fontSize: 13 }}>Las filas con error no se importan.</span>}
                <div className="barra-movil">
                  {paso < 3 ? (
                    <button className="btn pri" type="button" onClick={() => setPaso(paso + 1)}>
                      {paso === 2 ? `Importar ${n(imp.validas)} filas` : 'Continuar'}
                    </button>
                  ) : (
                    <button className="btn pri" type="button" onClick={() => setPaso(0)}>
                      Nueva importación
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="card lateral" aria-label="Bitácora de importaciones" style={{ padding: 18 }}>
            <h2 style={{ marginBottom: 14 }}>Bitácora</h2>
            <ul className="bitacora">
              {bitacoraImportaciones.map((b, i) => (
                <li key={i}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{b.tipo}</div>
                    <div className="nota">
                      {b.fecha} · <span className="num">{n(b.filas)}</span> filas
                    </div>
                  </div>
                  {b.ok ? <span className="tag">Completada</span> : <span className="tag warn">Falló</span>}
                </li>
              ))}
            </ul>
            <div className="muted" style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line-soft)', fontSize: 13, lineHeight: 1.5 }}>
              Cada carga queda registrada con usuario, archivo y número de filas.
            </div>
          </aside>
        </div>
      </main>
    </Shell>
  )
}

function PasoArchivo() {
  return (
    <section className="card">
      <div className="card-head" style={{ paddingBottom: 0 }}>
        <h2>Archivo</h2>
      </div>
      <div className="form-grid">
        <label className="campo">
          Tipo de carga
          <select defaultValue={TIPOS_CARGA[3]}>
            {TIPOS_CARGA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          Elección
          <select defaultValue="Ayuntamiento">
            <option>Ayuntamiento</option>
            <option>Diputación local</option>
            <option>Gubernatura</option>
          </select>
        </label>
        <label className="campo" style={{ gridColumn: '1 / -1' }}>
          Archivo de Excel o CSV
          <input type="file" accept=".xlsx,.xls,.csv" />
        </label>
      </div>
    </section>
  )
}

function PasoColumnas() {
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head">
        <h2>Columnas</h2>
        <span className="muted" style={{ fontSize: 13 }}>
          Relaciona cada columna del archivo con un dato de GovTrack.
        </span>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Columna del archivo</th>
              <th>Dato en GovTrack</th>
              <th className="col-sec">Ejemplo</th>
            </tr>
          </thead>
          <tbody>
            {imp.columnas.map((c) => (
              <tr key={c.origen}>
                <td className="num">{c.origen}</td>
                <td>
                  <label className="campo" style={{ fontWeight: 400 }}>
                    <span className="sr-only">Dato para {c.origen}</span>
                    <select defaultValue={c.destino}>
                      {imp.columnas.map((o) => (
                        <option key={o.destino}>{o.destino}</option>
                      ))}
                      <option>No importar</option>
                    </select>
                  </label>
                </td>
                <td className="num col-sec muted">{c.ejemplo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PasoValidacion({ municipio }: { municipio: string }) {
  return (
    <>
      <section className="card archivo">
        <div className="archivo-icono">
          <IcoExcel />
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div className="num" style={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>
            {imp.archivo}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {imp.descripcion}
          </div>
        </div>
        <div className="tres-cifras">
          <div>
            <div className="nota">Filas</div>
            <div className="num">{n(imp.filas)}</div>
          </div>
          <div>
            <div className="nota">Válidas</div>
            <div className="num" style={{ color: 'var(--accent)' }}>
              {n(imp.validas)}
            </div>
          </div>
          <div>
            <div className="nota">Con error</div>
            <div className="num" style={{ color: 'var(--warn-fg)' }}>
              {n(imp.errores)}
            </div>
          </div>
        </div>
      </section>

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="card-head">
          <h2>Filas con error</h2>
          <button className="btn md" type="button">
            Descargar errores
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl apilable">
            <thead>
              <tr>
                <th className="r">Fila</th>
                <th>Sección</th>
                <th>Casilla</th>
                <th>Problema</th>
              </tr>
            </thead>
            <tbody>
              {imp.filasError.map((e) => (
                <tr key={e.fila}>
                  <td className="r num">
                    <span className="solo-movil">Fila&nbsp;</span>
                    {e.fila}
                  </td>
                  <td className="num" data-label="Sección">{e.seccion}</td>
                  <td className="num" data-label="Casilla">{e.casilla}</td>
                  <td data-label="Problema" className="ancho" style={{ whiteSpace: 'normal' }}>
                    {e.problema.replace('Tapachula', municipio)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          {imp.filasError.length} de {imp.errores} errores · <a href="#">Ver todos</a>
        </div>
      </section>
    </>
  )
}

function PasoConfirmar() {
  return (
    <section className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="acciones" style={{ alignItems: 'center' }}>
        <span className="tag">Completada</span>
        <h2>Importación lista</h2>
      </div>
      <p className="muted" style={{ lineHeight: 1.5 }}>
        Se importaron <span className="num">{n(imp.validas)}</span> filas de <span className="num">{imp.archivo}</span>. Las{' '}
        <span className="num">{n(imp.errores)}</span> filas con error no se importaron; puedes descargarlas, corregirlas y cargarlas de nuevo.
      </p>
    </section>
  )
}
