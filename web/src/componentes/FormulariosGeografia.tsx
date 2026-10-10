import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import Hoja from './Hoja'
import { api, useApi, type ColoniaFila, type Pagina } from '../api'
import { numSeccion } from '../formato'
import { IcoBuscar } from '../iconos'

// Formularios de alta y edición de secciones y colonias. Se abren en una Hoja
// (hoja inferior en celular, diálogo en iPad y escritorio) y guardan contra la API.

const TIPOS_SECCION = [
  { valor: '', texto: 'Sin especificar' },
  { valor: 'URBANA', texto: 'Urbana' },
  { valor: 'RURAL', texto: 'Rural' },
  { valor: 'MIXTA', texto: 'Mixta' },
]

const TIPOS_ASENTAMIENTO = ['COLONIA', 'FRACCIONAMIENTO', 'BARRIO', 'EJIDO', 'LOCALIDAD', 'RESIDENCIAL', 'UNIDAD HABITACIONAL', 'CANTON', 'RANCHERIA']

/** Envío con estado de guardado y mensaje de error en línea. */
export function useEnvio(accion: () => Promise<void>) {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  async function enviar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await accion()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      // Si el formulario sigue abierto (p. ej. "agregar otra"), vuelve a quedar disponible.
      setGuardando(false)
    }
  }
  return { guardando, error, enviar }
}

export function Formulario({
  onSubmit,
  error,
  children,
  guardando,
  boton,
  extra,
}: {
  onSubmit: (e: FormEvent) => void
  error: string
  children: ReactNode
  guardando: boolean
  boton: string
  /** Controles junto al botón principal (p. ej. un segundo botón de envío). */
  extra?: ReactNode
}) {
  return (
    <form className="pila" style={{ gap: 16 }} onSubmit={onSubmit}>
      {children}
      {error && (
        <p role="alert" className="tag warn" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>
          {error}
        </p>
      )}
      {extra ? (
        <div className="acciones">
          {extra}
          <button type="submit" className="btn pri" style={{ flex: 1 }} disabled={guardando}>
            {guardando ? 'Guardando…' : boton}
          </button>
        </div>
      ) : (
        <button type="submit" className="btn pri" disabled={guardando}>
          {guardando ? 'Guardando…' : boton}
        </button>
      )}
    </form>
  )
}

export function NuevaSeccion({ municipioId, onCerrar, onCreada }: { municipioId: number; onCerrar: () => void; onCreada: (numero: number) => void }) {
  const [numero, setNumero] = useState('')
  const [tipo, setTipo] = useState('')
  const [sector, setSector] = useState('')
  const { guardando, error, enviar } = useEnvio(async () => {
    const r = await api<{ numero: number }>(`/municipios/${municipioId}/secciones`, {
      metodo: 'POST',
      datos: { numero: Number(numero), tipo: tipo || null, sector },
    })
    onCreada(r.numero)
  })
  return (
    <Hoja titulo="Nueva sección" onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Crear sección">
        <label className="campo">
          Número de sección
          <input required inputMode="numeric" pattern="\d{1,4}" maxLength={4} autoFocus value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
        </label>
        <CamposSeccion tipo={tipo} setTipo={setTipo} sector={sector} setSector={setSector} />
      </Formulario>
    </Hoja>
  )
}

export function EditarSeccion({ seccion, onCerrar, onGuardada }: { seccion: { id: number; numero: number; tipo: string | null; sector: string | null }; onCerrar: () => void; onGuardada: () => void }) {
  const [tipo, setTipo] = useState(seccion.tipo ?? '')
  const [sector, setSector] = useState(seccion.sector ?? '')
  const { guardando, error, enviar } = useEnvio(async () => {
    await api(`/secciones/${seccion.id}`, { metodo: 'PATCH', datos: { tipo: tipo || null, sector } })
    onGuardada()
  })
  return (
    <Hoja titulo={`Sección ${numSeccion(seccion.numero)}`} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Guardar">
        <CamposSeccion tipo={tipo} setTipo={setTipo} sector={sector} setSector={setSector} />
      </Formulario>
    </Hoja>
  )
}

function CamposSeccion({ tipo, setTipo, sector, setSector }: { tipo: string; setTipo: (v: string) => void; sector: string; setSector: (v: string) => void }) {
  return (
    <>
      <label className="campo">
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {TIPOS_SECCION.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.texto}
            </option>
          ))}
        </select>
      </label>
      <label className="campo">
        Sector (opcional)
        <input value={sector} onChange={(e) => setSector(e.target.value)} />
      </label>
    </>
  )
}

type ColoniaEditable = { id: number; nombre: string; tipo_asentamiento: string | null; cp: string | null }

/**
 * Alta (sin `colonia`) o edición de una colonia. En el alta, `secciones` son los números de sección
 * a los que pertenece; desde el detalle de una sección viene fija esa sección.
 */
export function ColoniaForm({
  municipioId,
  colonia,
  seccionFija,
  onCerrar,
  onGuardada,
}: {
  municipioId: number
  colonia?: ColoniaEditable
  seccionFija?: number
  onCerrar: () => void
  onGuardada: () => void
}) {
  const [nombre, setNombre] = useState(colonia?.nombre ?? '')
  const [tipo, setTipo] = useState(colonia?.tipo_asentamiento ?? 'COLONIA')
  const [cp, setCp] = useState(colonia?.cp ?? '')
  const [secciones, setSecciones] = useState('')
  const { guardando, error, enviar } = useEnvio(async () => {
    const datos = { nombre, tipo_asentamiento: tipo || null, cp: cp || null }
    if (colonia) {
      await api(`/colonias/${colonia.id}`, { metodo: 'PATCH', datos })
    } else {
      const nums = seccionFija ? [seccionFija] : secciones.split(/[^\d]+/).filter(Boolean).map(Number)
      await api(`/municipios/${municipioId}/colonias`, { metodo: 'POST', datos: { ...datos, secciones: nums } })
    }
    onGuardada()
  })
  return (
    <Hoja titulo={colonia ? 'Editar colonia' : 'Nueva colonia'} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton={colonia ? 'Guardar' : 'Crear colonia'}>
        <label className="campo">
          Nombre
          <input required autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo">
          Tipo de asentamiento
          <input list="tipos-asentamiento" value={tipo} onChange={(e) => setTipo(e.target.value)} />
          <datalist id="tipos-asentamiento">
            {TIPOS_ASENTAMIENTO.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="campo">
          Código postal (opcional)
          <input inputMode="numeric" pattern="\d{5}" maxLength={5} value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, ''))} />
        </label>
        {!colonia &&
          (seccionFija ? (
            <p className="nota">
              Se agregará a la sección <span className="num">{numSeccion(seccionFija)}</span>.
            </p>
          ) : (
            <label className="campo">
              Secciones (números separados por coma)
              <input inputMode="numeric" placeholder="1265, 1266" value={secciones} onChange={(e) => setSecciones(e.target.value)} />
            </label>
          ))}
      </Formulario>
    </Hoja>
  )
}

/** Busca una colonia del municipio y la agrega a la sección; si no existe, permite crearla. */
export function AgregarColonia({
  municipioId,
  seccion,
  yaIncluidas,
  onCerrar,
  onAgregada,
}: {
  municipioId: number
  seccion: { id: number; numero: number }
  yaIncluidas: number[]
  onCerrar: () => void
  onAgregada: () => void
}) {
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [nueva, setNueva] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])
  const { datos, cargando } = useApi<Pagina<ColoniaFila>>(q.length >= 2 ? `/municipios/${municipioId}/colonias?limite=20&q=${encodeURIComponent(q)}` : null)

  if (nueva) return <ColoniaForm municipioId={municipioId} seccionFija={seccion.numero} onCerrar={onCerrar} onGuardada={onAgregada} />

  async function agregar(id: number) {
    setError('')
    try {
      await api(`/secciones/${seccion.id}/colonias/${id}`, { metodo: 'PUT' })
      onAgregada()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Hoja titulo={`Agregar colonia a la sección ${numSeccion(seccion.numero)}`} onCerrar={onCerrar}>
      <label className="campo-busqueda">
        <IcoBuscar />
        <input type="search" autoFocus aria-label="Buscar colonia" placeholder="Nombre o código postal" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="tag warn" style={{ whiteSpace: 'normal' }}>
          {error}
        </p>
      )}
      <ul className="lista-opciones" aria-busy={cargando}>
        {q.length >= 2 &&
          datos?.filas.map((c) => {
            const incluida = yaIncluidas.includes(c.id)
            return (
              <li key={c.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                  <div className="nota">
                    {[c.tipo_asentamiento, c.cp && `CP ${c.cp}`].filter(Boolean).join(' · ')}
                    {c.secciones.length > 0 && ` · Secc. ${c.secciones.map((s) => numSeccion(s.numero)).join(', ')}`}
                  </div>
                </div>
                <button type="button" className="btn sm" disabled={incluida} onClick={() => agregar(c.id)}>
                  {incluida ? 'Ya está' : 'Agregar'}
                </button>
              </li>
            )
          })}
      </ul>
      {q.length >= 2 && !cargando && datos?.filas.length === 0 && <p className="nota">No hay colonias con «{q}» en el municipio.</p>}
      <button type="button" className="btn" onClick={() => setNueva(true)}>
        Crear colonia nueva
      </button>
    </Hoja>
  )
}
