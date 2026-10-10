import { useEffect, useRef, useState } from 'react'
import Hoja from './Hoja'
import { Formulario, useEnvio } from './FormulariosGeografia'
import { api, useApi, type Asignacion, type ColoniaDeSeccion, type Pagina, type PersonaBreve, type SeccionFila } from '../api'
import { n, nombrePropio, numSeccion, telefono } from '../formato'
import { IcoBuscar, IcoCerrar } from '../iconos'
import { Link } from '../router'

// Formularios de la estructura: alta y edición de personas, enlaces y asignaciones (DISENO.md §5
// "Operadores y enlaces" y "Asignaciones"). Validan en la API (teléfono único, colonia de la sección,
// 1 o 2 enlaces) y muestran el error en línea.

/** Texto con espera para no consultar la API en cada tecla. */
function useDiferido(v: string, ms = 250) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v.trim()), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

/** Buscador de una persona del padrón (para elegir enlaces u operador). */
function SelectorPersona({
  etiqueta,
  municipioId,
  valor,
  excluir,
  onCambio,
}: {
  etiqueta: string
  municipioId: number
  valor: PersonaBreve | null
  excluir: number[]
  onCambio: (p: PersonaBreve | null) => void
}) {
  const [texto, setTexto] = useState('')
  const q = useDiferido(texto)
  const { datos, cargando } = useApi<PersonaBreve[]>(!valor && q.length >= 2 ? `/municipios/${municipioId}/personas?q=${encodeURIComponent(q)}` : null)

  if (valor) {
    return (
      <div className="campo">
        {etiqueta}
        <div className="mini-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{nombrePropio(valor.nombre)}</div>
            <div className="num muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {telefono(valor.telefono) || 'Sin teléfono'}
            </div>
          </div>
          <button type="button" className="icon-btn" aria-label={`Quitar ${etiqueta.toLowerCase()}`} onClick={() => onCambio(null)}>
            <IcoCerrar />
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className="campo">
      {etiqueta}
      <label className="campo-busqueda">
        <IcoBuscar />
        <input type="search" aria-label={`Buscar ${etiqueta.toLowerCase()}`} placeholder="Nombre o teléfono" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>
      {q.length >= 2 && (
        <ul className="lista-opciones" aria-busy={cargando} style={{ fontWeight: 400 }}>
          {datos
            ?.filter((p) => !excluir.includes(p.id))
            .map((p) => (
              <li key={p.id}>
                <div>
                  <div style={{ color: 'var(--ink)', fontWeight: 600 }}>{nombrePropio(p.nombre)}</div>
                  <div className="num nota">{telefono(p.telefono) || 'Sin teléfono'}</div>
                </div>
                <button type="button" className="btn sm" onClick={() => onCambio(p)}>
                  Elegir
                </button>
              </li>
            ))}
          {datos?.length === 0 && <li className="nota">Nadie con «{q}» en el padrón.</li>}
        </ul>
      )}
    </div>
  )
}

function CamposEnlaces({
  municipioId,
  operadorId,
  enlaces,
  setEnlaces,
  opcionales = false,
}: {
  municipioId: number
  operadorId?: number
  enlaces: (PersonaBreve | null)[]
  setEnlaces: (e: (PersonaBreve | null)[]) => void
  opcionales?: boolean
}) {
  const ids = enlaces.filter(Boolean).map((e) => e!.id).concat(operadorId ? [operadorId] : [])
  return (
    <>
      {[0, 1].map((i) => (
        <SelectorPersona
          key={i}
          etiqueta={i === 0 ? `Enlace 1${opcionales ? ' (opcional)' : ''}` : 'Enlace 2 (opcional)'}
          municipioId={municipioId}
          valor={enlaces[i]}
          excluir={ids}
          onCambio={(p) => setEnlaces(i === 0 ? [p, enlaces[1]] : [enlaces[0], p])}
        />
      ))}
      <p className="nota">
        Los enlaces aplican a todas las asignaciones del operador.{opcionales && ' Si aún no los tienes, puedes agregarlos después.'}
      </p>
    </>
  )
}

const idsEnlaces = (e: (PersonaBreve | null)[]) => e.filter(Boolean).map((x) => x!.id)

/** Aviso en línea si el teléfono (10 dígitos) ya es de otra persona activa del padrón. */
function AvisoTelefono({ municipioId, tel, excluir }: { municipioId: number; tel: string; excluir?: number }) {
  const d = tel.replace(/\D/g, '')
  const { datos } = useApi<PersonaBreve[]>(d.length === 10 ? `/municipios/${municipioId}/personas?q=${d}` : null)
  const otra = d.length === 10 ? datos?.find((p) => p.telefono === d && p.id !== excluir) : undefined
  if (!otra) return null
  return (
    <p role="alert" className="tag warn" style={{ whiteSpace: 'normal', alignSelf: 'flex-start' }}>
      Este teléfono ya está registrado a nombre de {nombrePropio(otra.nombre)}.{' '}
      <Link to={`/operadores/${otra.id}`} style={{ color: 'inherit' }}>
        Ver persona
      </Link>
    </p>
  )
}

/**
 * Alta de persona o edición de nombre y teléfono.
 * - `modo="operador"` (Nuevo operador): enlaces opcionales; se completan después.
 * - `modo="persona"` (Registrar persona): solo nombre y teléfono; ofrece "Guardar y asignar" y "Registrar otra".
 */
export function PersonaForm({
  municipioId,
  persona,
  modo = 'operador',
  onCerrar,
  onGuardada,
  onOtra,
}: {
  municipioId: number
  persona?: PersonaBreve
  modo?: 'operador' | 'persona'
  onCerrar: () => void
  /** `asignar`: el usuario eligió "Guardar y asignar". */
  onGuardada: (p: PersonaBreve, asignar: boolean) => void
  /** Se registró una persona y el formulario sigue abierto para otra. */
  onOtra?: () => void
}) {
  const [nombre, setNombre] = useState(persona ? nombrePropio(persona.nombre) : '')
  const [tel, setTel] = useState(telefono(persona?.telefono ?? null))
  const [enlaces, setEnlaces] = useState<(PersonaBreve | null)[]>([null, null])
  const [otra, setOtra] = useState(false)
  const [aviso, setAviso] = useState('')
  const asignar = useRef(false)
  const registrar = !persona && modo === 'persona'

  const { guardando, error, enviar } = useEnvio(async () => {
    const quiereAsignar = asignar.current
    asignar.current = false
    const datos = { nombre, telefono: tel || null }
    if (persona) {
      await api(`/personas/${persona.id}`, { metodo: 'PATCH', datos })
      onGuardada({ id: persona.id, nombre, telefono: tel.replace(/\D/g, '') || null }, false)
      return
    }
    const r = await api<{ id: number }>(`/municipios/${municipioId}/personas`, {
      metodo: 'POST',
      datos: registrar ? datos : { ...datos, enlaces: idsEnlaces(enlaces) },
    })
    const nueva = { id: r.id, nombre: nombre.toUpperCase(), telefono: tel.replace(/\D/g, '') || null }
    if (registrar && otra && !quiereAsignar) {
      setAviso(`${nombrePropio(nueva.nombre)} quedó registrada.`)
      setNombre('')
      setTel('')
      onOtra?.()
      return
    }
    onGuardada(nueva, quiereAsignar)
  })

  return (
    <Hoja titulo={persona ? 'Editar persona' : registrar ? 'Registrar persona' : 'Nuevo operador'} onCerrar={onCerrar}>
      <Formulario
        onSubmit={enviar}
        error={error}
        guardando={guardando}
        boton={persona || registrar ? 'Guardar' : 'Crear operador'}
        extra={
          registrar && (
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              disabled={guardando}
              onClick={(e) => {
                asignar.current = true
                e.currentTarget.form?.requestSubmit()
              }}
            >
              Guardar y asignar
            </button>
          )
        }
      >
        {registrar && (
          <p className="nota" style={{ fontSize: 13 }}>
            Da de alta a alguien en el padrón sin asignarle nada todavía. Se vuelve operador al asignarle una colonia, o enlace al elegirla como enlace de un operador.
          </p>
        )}
        {aviso && (
          <p role="status" className="tag" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>
            {aviso}
          </p>
        )}
        <label className="campo">
          Nombre completo
          <input required autoFocus autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo">
          Teléfono celular (10 dígitos)
          <input type="tel" inputMode="tel" autoComplete="off" placeholder="962 118 4402" value={tel} onChange={(e) => setTel(e.target.value)} />
        </label>
        <AvisoTelefono municipioId={municipioId} tel={tel} excluir={persona?.id} />
        {!persona && !registrar && <CamposEnlaces municipioId={municipioId} enlaces={enlaces} setEnlaces={setEnlaces} opcionales />}
        {registrar && (
          <label className="opcion" style={{ alignItems: 'center' }}>
            <input type="checkbox" checked={otra} onChange={(e) => setOtra(e.target.checked)} />
            <span className="opcion-nombre">Registrar otra al terminar</span>
          </label>
        )}
      </Formulario>
    </Hoja>
  )
}

export function EnlacesForm({ persona, municipioId, onCerrar, onGuardada }: { persona: PersonaBreve & { enlaces: PersonaBreve[] }; municipioId: number; onCerrar: () => void; onGuardada: () => void }) {
  const [enlaces, setEnlaces] = useState<(PersonaBreve | null)[]>([persona.enlaces[0] ?? null, persona.enlaces[1] ?? null])
  const { guardando, error, enviar } = useEnvio(async () => {
    if (!idsEnlaces(enlaces).length) throw new Error('Elige al menos un enlace')
    await api(`/personas/${persona.id}/enlaces`, { metodo: 'PUT', datos: { enlaces: idsEnlaces(enlaces) } })
    onGuardada()
  })
  return (
    <Hoja titulo="Enlaces del operador" onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Guardar enlaces">
        <CamposEnlaces municipioId={municipioId} operadorId={persona.id} enlaces={enlaces} setEnlaces={setEnlaces} />
      </Formulario>
    </Hoja>
  )
}

/**
 * Nueva asignación en el orden sección → colonia → operador (DISENO.md §5 "Asignaciones").
 * Con `persona` el operador ya está elegido (detalle del operador o "Asignar" de una persona);
 * con `seccion`/`colonia` la colonia ya está elegida ("Asignar" de una colonia sin operador).
 * Los enlaces no se piden: se completan después en el detalle del operador.
 */
export function AsignacionForm({
  municipioId,
  persona,
  seccion: seccionInicial,
  colonia: coloniaInicial,
  onCerrar,
  onGuardada,
  onOtra,
}: {
  municipioId: number
  persona?: PersonaBreve & { asignaciones?: Asignacion[] }
  seccion?: number
  colonia?: number
  onCerrar: () => void
  onGuardada: () => void
  /** Se guardó una asignación y el formulario sigue abierto ("Guardar y agregar otra"). */
  onOtra?: () => void
}) {
  const [numero, setNumero] = useState(seccionInicial ? String(seccionInicial) : '')
  const [coloniaId, setColoniaId] = useState(coloniaInicial ?? 0)
  const [operador, setOperador] = useState<PersonaBreve | null>(persona ?? null)
  const [nueva, setNueva] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tel, setTel] = useState('')
  const [personas, setPersonas] = useState('')
  const [obs, setObs] = useState('')
  const [otra, setOtra] = useState(false)
  const [aviso, setAviso] = useState('')
  const num = useDiferido(numero)

  // La sección se escribe por número; se busca su id y luego sus colonias (DISENO.md §8: la colonia se filtra por la sección).
  const secc = useApi<Pagina<SeccionFila>>(num ? `/municipios/${municipioId}/secciones?q=${num}&limite=1` : null)
  const seccion = secc.datos?.filas[0]?.numero === Number(num) ? secc.datos.filas[0] : undefined
  const cols = useApi<ColoniaDeSeccion[]>(seccion ? `/secciones/${seccion.id}/colonias` : null)
  const colonias = cols.datos?.length ? [...cols.datos].sort((a, b) => Number(a.operadores > 0) - Number(b.operadores > 0)) : cols.datos
  const ocupadas = persona?.asignaciones?.filter((a) => a.seccion_id === seccion?.id).map((a) => a.colonia_id) ?? []
  const colonia = cols.datos?.find((c) => c.id === coloniaId)

  // Al cambiar de sección se borra la colonia, salvo la que venía elegida al abrir.
  const seccionPrevia = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!seccion) return
    if (seccionPrevia.current !== undefined && seccionPrevia.current !== seccion.id) setColoniaId(0)
    seccionPrevia.current = seccion.id
  }, [seccion])

  const nombreOperador = operador ? nombrePropio(operador.nombre) : nueva ? nombre.trim() : ''

  const { guardando, error, enviar } = useEnvio(async () => {
    if (!seccion) throw new Error(`La sección ${numero} no existe en el municipio`)
    if (!colonia) throw new Error('Elige la colonia')
    let op = operador
    if (!op) {
      if (!nueva) throw new Error('Elige al operador o registra a una persona nueva')
      const r = await api<{ id: number }>(`/municipios/${municipioId}/personas`, { metodo: 'POST', datos: { nombre, telefono: tel || null } })
      // Ya existe: si la asignación falla, reintentar no la vuelve a registrar.
      op = { id: r.id, nombre: nombre.toUpperCase(), telefono: tel.replace(/\D/g, '') || null }
      setOperador(op)
      setNueva(false)
    }
    await api(`/personas/${op.id}/asignaciones`, {
      metodo: 'POST',
      datos: { seccion_id: seccion.id, colonia_id: colonia.id, num_personas: Number(personas || 0), observaciones: obs },
    })
    if (!otra) return onGuardada()
    setAviso(`${nombrePropio(op.nombre)} quedó asignado a ${colonia.nombre}.`)
    setColoniaId(0)
    setOperador(persona ?? null)
    setNombre('')
    setTel('')
    setPersonas('')
    setObs('')
    cols.recargar()
    onOtra?.()
  })

  return (
    <Hoja titulo="Nueva asignación" onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Guardar asignación">
        {aviso && (
          <p role="status" className="tag" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>
            {aviso}
          </p>
        )}
        <label className="campo">
          Sección
          <input required autoFocus={!seccionInicial} inputMode="numeric" maxLength={4} placeholder="1265" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
        </label>
        {num && !secc.cargando && secc.datos && !seccion && <p className="nota">La sección {num} no existe en el municipio.</p>}
        {seccion && (
          <p className="nota" style={{ marginTop: -8 }}>
            {n(seccion.colonias)} colonias · {seccion.colonias - seccion.colonias_cubiertas === 0 ? 'todas con operador' : `${n(seccion.colonias - seccion.colonias_cubiertas)} sin operador`}
          </p>
        )}

        {seccion && (
          <fieldset className="opciones">
            <legend>Colonia</legend>
            {!colonias && <p className="nota">Cargando colonias…</p>}
            {colonias?.length === 0 && <p className="nota">La sección no tiene colonias. Agrégalas en el detalle de la sección.</p>}
            {colonias?.map((c) => {
              const ya = ocupadas.includes(c.id)
              return (
                <label key={c.id} className="opcion" style={{ alignItems: 'center', opacity: ya ? 0.55 : 1 }}>
                  <input type="radio" name="colonia" required checked={coloniaId === c.id} disabled={ya} onChange={() => setColoniaId(c.id)} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="opcion-nombre">{c.nombre}</span>
                    {c.operadores > 0 && (
                      <span className="nota">
                        {n(c.operadores)} {c.operadores === 1 ? 'operador' : 'operadores'} · {n(c.personas)} pers.{ya && ' · ya asignada a esta persona'}
                      </span>
                    )}
                  </span>
                  {c.operadores === 0 && <span className="tag warn">Sin operador</span>}
                </label>
              )
            })}
          </fieldset>
        )}

        {persona ? (
          <div className="campo">
            Operador
            <div className="mini-card">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{nombrePropio(persona.nombre)}</div>
              <div className="num muted" style={{ fontSize: 13, fontWeight: 400 }}>
                {telefono(persona.telefono) || 'Sin teléfono'}
              </div>
            </div>
          </div>
        ) : nueva ? (
          <>
            <div className="partido-fila" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Persona nueva (operador)</span>
              <button type="button" className="link-btn" onClick={() => setNueva(false)}>
                Buscar en el padrón
              </button>
            </div>
            <label className="campo">
              Nombre completo
              <input required autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="campo">
              Teléfono celular (10 dígitos)
              <input type="tel" inputMode="tel" autoComplete="off" placeholder="962 118 4402" value={tel} onChange={(e) => setTel(e.target.value)} />
            </label>
            <AvisoTelefono municipioId={municipioId} tel={tel} />
          </>
        ) : (
          <>
            <SelectorPersona etiqueta="Operador" municipioId={municipioId} valor={operador} excluir={[]} onCambio={setOperador} />
            {!operador && (
              <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', marginTop: -8 }} onClick={() => setNueva(true)}>
                + Registrar persona nueva
              </button>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label className="campo" style={{ flex: '1 1 120px' }}>
            Personas que moviliza
            <input inputMode="numeric" value={personas} onChange={(e) => setPersonas(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="campo" style={{ flex: '2 1 200px' }}>
            Observaciones (opcional)
            <input value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
        </div>

        {seccion && colonia && nombreOperador && (
          <p className="mini-card" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, background: 'var(--th-bg)' }}>
            <strong>{nombreOperador}</strong> cubrirá <strong>{colonia.nombre}</strong> (sección <span className="num">{numSeccion(seccion.numero)}</span>) con{' '}
            <span className="num">{n(Number(personas || 0))}</span> personas.
          </p>
        )}
        <label className="opcion" style={{ alignItems: 'center' }}>
          <input type="checkbox" checked={otra} onChange={(e) => setOtra(e.target.checked)} />
          <span className="opcion-nombre">Guardar y agregar otra en la misma sección</span>
        </label>
      </Formulario>
    </Hoja>
  )
}

/** Edición de personas y observaciones de una asignación, o "Quitar asignación" (baja lógica). */
export function EditarAsignacionForm({
  asignacion,
  onCerrar,
  onGuardada,
}: {
  asignacion: Pick<Asignacion, 'id' | 'seccion' | 'colonia' | 'num_personas' | 'observaciones'>
  onCerrar: () => void
  onGuardada: () => void
}) {
  const [personas, setPersonas] = useState(String(asignacion.num_personas))
  const [obs, setObs] = useState(asignacion.observaciones ?? '')
  const [quitando, setQuitando] = useState(false)

  const { guardando, error, enviar } = useEnvio(async () => {
    await api(`/asignaciones/${asignacion.id}`, { metodo: 'PATCH', datos: { num_personas: Number(personas || 0), observaciones: obs } })
    onGuardada()
  })

  async function quitar() {
    if (!confirm(`¿Quitar la asignación en ${asignacion.colonia}? Queda en el historial de la sección.`)) return
    setQuitando(true)
    try {
      await api(`/asignaciones/${asignacion.id}`, { metodo: 'DELETE' })
      onGuardada()
    } catch (e) {
      alert((e as Error).message)
      setQuitando(false)
    }
  }

  return (
    <Hoja titulo={`${asignacion.colonia} · Sección ${numSeccion(asignacion.seccion)}`} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Guardar">
        <label className="campo">
          Personas que moviliza
          <input inputMode="numeric" autoFocus value={personas} onChange={(e) => setPersonas(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="campo">
          Observaciones (opcional)
          <input value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>
      </Formulario>
      <button type="button" className="btn peligro" disabled={quitando} onClick={quitar}>
        {quitando ? 'Quitando…' : 'Quitar asignación'}
      </button>
    </Hoja>
  )
}
