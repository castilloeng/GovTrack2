import { Fragment, useState, type ReactNode } from 'react'
import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'
import { useApi } from '../api'
import { IcoBuscar, IcoDescarga } from '../iconos'

// Administración → API: documentación OpenAPI de /api/openapi.json (worker/openapi.ts), con los
// componentes del sitio en lugar de Swagger UI para respetar DISENO.md y el tema.

type Schema = {
  $ref?: string
  type?: string | string[]
  enum?: unknown[]
  const?: unknown
  items?: Schema
  properties?: Record<string, Schema>
  required?: string[]
  allOf?: Schema[]
  additionalProperties?: Schema | boolean
  description?: string
  format?: string
  pattern?: string
  minimum?: number
  maximum?: number
  default?: unknown
  examples?: unknown[]
}
type Contenido = { content?: Record<string, { schema: Schema }> }
type Parametro = { name: string; in: string; required?: boolean; description?: string; schema?: Schema }
type Operacion = {
  tags?: string[]
  summary?: string
  description?: string
  parameters?: Parametro[]
  requestBody?: Contenido & { required?: boolean }
  responses: Record<string, Contenido & { description: string }>
  security?: unknown[]
}
type Spec = {
  info: { title: string; version: string; description?: string }
  servers?: { url: string }[]
  tags?: { name: string; description?: string }[]
  paths: Record<string, Record<string, Operacion>>
  components?: { schemas?: Record<string, Schema> }
  'x-sin-documentar'?: string[]
}

const METODOS = ['get', 'post', 'put', 'patch', 'delete']
const CLASE_METODO: Record<string, string> = { get: 'tag', delete: 'tag warn' }

/** Texto con `código` y **negritas** (lo que usan las descripciones de la especificación). */
function Texto({ children }: { children?: string }) {
  if (!children) return null
  return (
    <>
      {children.split('\n\n').map((parrafo, i) => (
        <p key={i} className="api-texto">
          {parrafo.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((t, j) =>
            t.startsWith('`') ? <code key={j}>{t.slice(1, -1)}</code> : t.startsWith('**') ? <strong key={j}>{t.slice(2, -2)}</strong> : <Fragment key={j}>{t}</Fragment>,
          )}
        </p>
      ))}
    </>
  )
}

const nombreRef = (ref: string) => ref.split('/').pop()!

/** Tipo en una línea: "integer", "string | null", "SeccionFila[]", "'a' | 'b'". */
function tipo(s: Schema): ReactNode {
  if (s.$ref) {
    const n = nombreRef(s.$ref)
    return <a href={`#esquema-${n}`}>{n}</a>
  }
  if (s.allOf) return s.allOf.map((x, i) => <Fragment key={i}>{i > 0 && ' & '}{tipo(x)}</Fragment>)
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ')
  if (s.const !== undefined) return JSON.stringify(s.const)
  const t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'any')
  if (s.type === 'array' && s.items) return <>{tipo(s.items)}[]</>
  if (s.type === 'object' && !s.properties && s.additionalProperties && typeof s.additionalProperties === 'object') return <>{'{ [clave]: '}{tipo(s.additionalProperties)}{' }'}</>
  return t
}

function detalles(s: Schema) {
  const d = [
    s.format,
    s.pattern && `patrón ${s.pattern}`,
    s.minimum !== undefined && `mín. ${s.minimum}`,
    s.maximum !== undefined && `máx. ${s.maximum}`,
    s.default !== undefined && `por omisión ${JSON.stringify(s.default)}`,
    s.examples && `p. ej. ${s.examples.map((e) => JSON.stringify(e)).join(', ')}`,
  ].filter(Boolean)
  return d.length ? d.join(' · ') : null
}

/** Propiedades de un objeto en tabla; los objetos anidados se muestran debajo con sangría. */
function Esquema({ schema, nivel = 0 }: { schema: Schema; nivel?: number }) {
  const objeto = schema.type === 'object' && schema.properties ? schema : schema.type === 'array' && schema.items?.properties ? schema.items : null
  const partes = schema.allOf?.filter((x) => x.properties)
  if (partes?.length) {
    return (
      <>
        <div className="api-tipo num">{tipo(schema)}</div>
        {partes.map((p, i) => (
          <Esquema key={i} schema={p} nivel={nivel} />
        ))}
      </>
    )
  }
  if (!objeto) {
    return (
      <div className="api-tipo">
        <span className="num">{tipo(schema)}</span>
        {schema.description && <span className="nota"> — {schema.description}</span>}
      </div>
    )
  }
  return (
    <>
      {schema.type === 'array' && nivel === 0 && <div className="api-tipo num">arreglo de:</div>}
      {objeto.description && nivel === 0 && <Texto>{objeto.description}</Texto>}
      <table className="tbl api-props">
        <tbody>
          {Object.entries(objeto.properties!).map(([nombre, p]) => (
            <tr key={nombre}>
              <td className="num" style={{ paddingLeft: 12 + nivel * 16 }}>
                {nombre}
                {objeto.required?.includes(nombre) && <span title="Obligatorio"> *</span>}
              </td>
              <td>
                <span className="num">{tipo(p)}</span>
                {(p.description || detalles(p)) && (
                  <div className="nota">{[p.description, detalles(p)].filter(Boolean).join(' · ')}</div>
                )}
                {(p.properties || p.items?.properties) && <Esquema schema={p} nivel={nivel + 1} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Endpoint({ metodo, ruta, op }: { metodo: string; ruta: string; op: Operacion }) {
  const cuerpo = op.requestBody?.content?.['application/json']?.schema
  return (
    <details className="api-endpoint" id={`${metodo}-${ruta}`}>
      <summary>
        <span className={CLASE_METODO[metodo] ?? 'tag gray'} style={{ minWidth: 58, textAlign: 'center' }}>
          {metodo.toUpperCase()}
        </span>
        <span className="num api-ruta">{ruta}</span>
        <span className="muted api-resumen">{op.summary}</span>
        {op.security && <span className="tag gray">Requiere usuario</span>}
      </summary>
      <div className="api-cuerpo">
        <Texto>{op.description}</Texto>
        {op.parameters && op.parameters.length > 0 && (
          <div>
            <h3 className="seccion-titulo">Parámetros</h3>
            <table className="tbl api-props">
              <tbody>
                {op.parameters.map((p) => (
                  <tr key={p.in + p.name}>
                    <td className="num">
                      {p.name}
                      {p.required && <span title="Obligatorio"> *</span>}
                    </td>
                    <td>
                      <span className="tag gray">{p.in === 'path' ? 'ruta' : 'consulta'}</span> <span className="num">{p.schema ? tipo(p.schema) : ''}</span>
                      {(p.description || (p.schema && detalles(p.schema))) && (
                        <div className="nota">{[p.description, p.schema && detalles(p.schema)].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cuerpo && (
          <div>
            <h3 className="seccion-titulo">Cuerpo (JSON)</h3>
            <Esquema schema={cuerpo} />
          </div>
        )}
        <div>
          <h3 className="seccion-titulo">Respuestas</h3>
          <ul className="api-respuestas">
            {Object.entries(op.responses).map(([codigo, r]) => {
              const s = r.content?.['application/json']?.schema
              return (
                <li key={codigo}>
                  <span className={'num ' + (codigo.startsWith('2') ? 'tag' : 'tag warn')}>{codigo}</span> {r.description}
                  {s && codigo.startsWith('2') && (
                    <div style={{ marginTop: 6 }}>
                      <Esquema schema={s} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </details>
  )
}

export default function ApiDocs() {
  const { datos: spec, error } = useApi<Spec>('/openapi.json')
  const [texto, setTexto] = useState('')

  const t = texto.trim().toLowerCase()
  const operaciones = spec
    ? Object.entries(spec.paths).flatMap(([ruta, ops]) =>
        METODOS.filter((m) => ops[m]).map((m) => ({ ruta, metodo: m, op: ops[m] })),
      ).filter(({ ruta, metodo, op }) => !t || `${metodo} ${ruta} ${op.summary ?? ''}`.toLowerCase().includes(t))
    : []
  const grupos = spec?.tags?.map((g) => ({ ...g, ops: operaciones.filter((o) => o.op.tags?.[0] === g.name) })).filter((g) => g.ops.length) ?? []
  const faltan = spec?.['x-sin-documentar'] ?? []

  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo="API" desc={spec ? `${spec.info.title} ${spec.info.version} · OpenAPI 3.1 · base ${spec.servers?.[0]?.url ?? '/api'}` : 'Documentación de la API del sitio.'}>
          <div className="acciones">
            <a className="btn" href="/api/openapi.json" download="govtrack-openapi.json">
              <IcoDescarga />
              Descargar OpenAPI
            </a>
          </div>
        </Encabezado>

        {error && (
          <div className="card vacio" role="alert">
            {error.message}
          </div>
        )}

        {faltan.length > 0 && (
          <div className="aviso" role="alert" style={{ background: 'var(--warn-bg)', color: 'var(--warn-fg)', display: 'block' }}>
            <strong>Rutas sin documentar:</strong> {faltan.join(', ')}. Agrégalas en <code>web/worker/openapi.ts</code>.
          </div>
        )}

        {spec && (
          <>
            <section className="card" style={{ padding: 18 }}>
              <Texto>{spec.info.description}</Texto>
            </section>

            <div className="filtros">
              <label className="campo-busqueda">
                <IcoBuscar />
                <input type="search" aria-label="Buscar en la API" placeholder="Ruta, método o descripción" value={texto} onChange={(e) => setTexto(e.target.value)} />
              </label>
            </div>

            {grupos.map((g) => (
              <section key={g.name} className="card" style={{ overflow: 'hidden' }}>
                <div className="card-head">
                  <h2>{g.name}</h2>
                  {g.description && <span className="muted" style={{ fontSize: 13 }}>{g.description}</span>}
                </div>
                {g.ops.map((o) => (
                  <Endpoint key={o.metodo + o.ruta} {...o} />
                ))}
              </section>
            ))}
            {grupos.length === 0 && <div className="card vacio">No hay rutas con «{texto}».</div>}

            {!t && spec.components?.schemas && (
              <section className="card" style={{ overflow: 'hidden' }}>
                <div className="card-head">
                  <h2>Esquemas</h2>
                </div>
                {Object.entries(spec.components.schemas).map(([nombre, s]) => (
                  <div key={nombre} id={`esquema-${nombre}`} className="api-esquema">
                    <h3 className="num">{nombre}</h3>
                    <Esquema schema={s} />
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </Shell>
  )
}
