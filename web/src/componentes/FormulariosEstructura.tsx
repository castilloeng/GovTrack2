import { useEffect, useState } from 'react'
import Hoja from './Hoja'
import { Formulario, useEnvio } from './FormulariosGeografia'
import { api, useApi, type Asignacion, type ColoniaDeSeccion, type Pagina, type PersonaBreve, type PersonaDetalle, type SeccionFila } from '../api'
import { nombrePropio, numSeccion, telefono } from '../formato'
import { IcoBuscar, IcoCerrar } from '../iconos'

// Formularios de Operadores y enlaces: alta y edición de personas, enlaces y asignaciones.
// Validan en la API (teléfono único, colonia de la sección, 1 o 2 enlaces) y muestran el error en línea.

/** Texto con espera para no consultar la API en cada tecla. */
function useDiferido(v: string, ms = 250) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v.trim()), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

/** Buscador de una persona del padrón (para elegir enlaces). */
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

function CamposEnlaces({ municipioId, operadorId, enlaces, setEnlaces }: { municipioId: number; operadorId?: number; enlaces: (PersonaBreve | null)[]; setEnlaces: (e: (PersonaBreve | null)[]) => void }) {
  const ids = enlaces.filter(Boolean).map((e) => e!.id).concat(operadorId ? [operadorId] : [])
  return (
    <>
      {[0, 1].map((i) => (
        <SelectorPersona
          key={i}
          etiqueta={i === 0 ? 'Enlace 1' : 'Enlace 2 (opcional)'}
          municipioId={municipioId}
          valor={enlaces[i]}
          excluir={ids}
          onCambio={(p) => setEnlaces(i === 0 ? [p, enlaces[1]] : [enlaces[0], p])}
        />
      ))}
      <p className="nota">Los enlaces aplican a todas las asignaciones del operador.</p>
    </>
  )
}

const idsEnlaces = (e: (PersonaBreve | null)[]) => e.filter(Boolean).map((x) => x!.id)

/** Alta de operador (con enlaces) o edición de nombre y teléfono de una persona. */
export function PersonaForm({ municipioId, persona, onCerrar, onGuardada }: { municipioId: number; persona?: PersonaDetalle; onCerrar: () => void; onGuardada: (id: number) => void }) {
  const [nombre, setNombre] = useState(persona ? nombrePropio(persona.nombre) : '')
  const [tel, setTel] = useState(telefono(persona?.telefono ?? null))
  const [enlaces, setEnlaces] = useState<(PersonaBreve | null)[]>([null, null])
  const { guardando, error, enviar } = useEnvio(async () => {
    const datos = { nombre, telefono: tel || null }
    if (persona) {
      await api(`/personas/${persona.id}`, { metodo: 'PATCH', datos })
      onGuardada(persona.id)
    } else {
      if (!idsEnlaces(enlaces).length) throw new Error('Elige al menos un enlace')
      const r = await api<{ id: number }>(`/municipios/${municipioId}/personas`, { metodo: 'POST', datos: { ...datos, enlaces: idsEnlaces(enlaces) } })
      onGuardada(r.id)
    }
  })
  return (
    <Hoja titulo={persona ? 'Editar persona' : 'Nuevo operador'} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton={persona ? 'Guardar' : 'Crear operador'}>
        <label className="campo">
          Nombre completo
          <input required autoFocus autoComplete="off" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo">
          Teléfono (10 dígitos)
          <input type="tel" inputMode="tel" autoComplete="off" placeholder="962 118 4402" value={tel} onChange={(e) => setTel(e.target.value)} />
        </label>
        {!persona && <CamposEnlaces municipioId={municipioId} enlaces={enlaces} setEnlaces={setEnlaces} />}
      </Formulario>
    </Hoja>
  )
}

export function EnlacesForm({ persona, onCerrar, onGuardada }: { persona: PersonaDetalle; onCerrar: () => void; onGuardada: () => void }) {
  const [enlaces, setEnlaces] = useState<(PersonaBreve | null)[]>([persona.enlaces[0] ?? null, persona.enlaces[1] ?? null])
  const { guardando, error, enviar } = useEnvio(async () => {
    if (!idsEnlaces(enlaces).length) throw new Error('Elige al menos un enlace')
    await api(`/personas/${persona.id}/enlaces`, { metodo: 'PUT', datos: { enlaces: idsEnlaces(enlaces) } })
    onGuardada()
  })
  return (
    <Hoja titulo="Enlaces del operador" onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton="Guardar enlaces">
        <CamposEnlaces municipioId={persona.municipio_id} operadorId={persona.id} enlaces={enlaces} setEnlaces={setEnlaces} />
      </Formulario>
    </Hoja>
  )
}

/** Alta de asignación (sección → colonia de esa sección) o edición de personas y observaciones. */
export function AsignacionForm({ persona, asignacion, onCerrar, onGuardada }: { persona: PersonaDetalle; asignacion?: Asignacion; onCerrar: () => void; onGuardada: () => void }) {
  const [numero, setNumero] = useState('')
  const [coloniaId, setColoniaId] = useState(0)
  const [personas, setPersonas] = useState(String(asignacion?.num_personas ?? ''))
  const [obs, setObs] = useState(asignacion?.observaciones ?? '')
  const [quitando, setQuitando] = useState(false)
  const num = useDiferido(numero)

  // La sección se escribe por número; se busca su id y luego sus colonias (DISENO.md §8: la colonia se filtra por la sección).
  const secc = useApi<Pagina<SeccionFila>>(!asignacion && num ? `/municipios/${persona.municipio_id}/secciones?q=${num}&limite=1` : null)
  const seccion = secc.datos?.filas[0]?.numero === Number(num) ? secc.datos.filas[0] : undefined
  const cols = useApi<ColoniaDeSeccion[]>(seccion ? `/secciones/${seccion.id}/colonias` : null)
  const ocupadas = persona.asignaciones.filter((a) => a.seccion_id === seccion?.id).map((a) => a.colonia_id)
  useEffect(() => setColoniaId(0), [seccion?.id])

  const { guardando, error, enviar } = useEnvio(async () => {
    const datos = { num_personas: Number(personas || 0), observaciones: obs }
    if (asignacion) await api(`/asignaciones/${asignacion.id}`, { metodo: 'PATCH', datos })
    else {
      if (!seccion) throw new Error(`La sección ${numero} no existe en el municipio`)
      if (!coloniaId) throw new Error('Elige la colonia')
      await api(`/personas/${persona.id}/asignaciones`, { metodo: 'POST', datos: { ...datos, seccion_id: seccion.id, colonia_id: coloniaId } })
    }
    onGuardada()
  })

  async function quitar() {
    if (!confirm(`¿Quitar la asignación en ${asignacion!.colonia}? Queda en el historial de la sección.`)) return
    setQuitando(true)
    try {
      await api(`/asignaciones/${asignacion!.id}`, { metodo: 'DELETE' })
      onGuardada()
    } catch (e) {
      alert((e as Error).message)
      setQuitando(false)
    }
  }

  return (
    <Hoja titulo={asignacion ? `${asignacion.colonia} · Sección ${numSeccion(asignacion.seccion)}` : 'Nueva asignación'} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton={asignacion ? 'Guardar' : 'Asignar'}>
        {!asignacion && (
          <>
            <label className="campo">
              Sección
              <input required autoFocus inputMode="numeric" maxLength={4} placeholder="1265" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} />
            </label>
            {num && !secc.cargando && secc.datos && !seccion && <p className="nota">La sección {num} no existe en el municipio.</p>}
            <label className="campo">
              Colonia
              <select required value={coloniaId} disabled={!cols.datos} onChange={(e) => setColoniaId(Number(e.target.value))}>
                <option value={0}>{seccion ? (cols.datos ? 'Elige una colonia' : 'Cargando…') : 'Primero escribe la sección'}</option>
                {cols.datos?.map((c) => (
                  <option key={c.id} value={c.id} disabled={ocupadas.includes(c.id)}>
                    {c.nombre}
                    {ocupadas.includes(c.id) ? ' (ya asignada)' : c.operadores === 0 ? ' · sin operador' : ''}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="campo">
          Personas que moviliza
          <input inputMode="numeric" value={personas} onChange={(e) => setPersonas(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="campo">
          Observaciones (opcional)
          <input value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>
      </Formulario>
      {asignacion && (
        <button type="button" className="btn peligro" disabled={quitando} onClick={quitar}>
          {quitando ? 'Quitando…' : 'Quitar asignación'}
        </button>
      )}
    </Hoja>
  )
}
