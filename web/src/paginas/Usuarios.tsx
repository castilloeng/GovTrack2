import { useEffect, useState } from 'react'
import Shell from '../componentes/Shell'
import Hoja from '../componentes/Hoja'
import { Encabezado } from '../componentes/ui'
import { useContexto } from '../componentes/Contexto'
import { Formulario, useEnvio } from '../componentes/FormulariosGeografia'
import { api, useApi, type Municipio, type UsuarioFila } from '../api'
import { ROL_NOMBRE, type Rol } from '../datos'
import { cuando, n, nombrePropio } from '../formato'
import { IcoBuscar, IcoMas } from '../iconos'

// Usuarios del sitio (DISENO.md §5 "Usuarios"). Solo ADMIN. No se borran: se desactivan.

const ESTADOS = [
  { id: '', texto: 'Todos' },
  { id: 'activos', texto: 'Activos' },
  { id: 'inactivos', texto: 'Inactivos' },
]

const ROLES: { rol: Rol; desc: string }[] = [
  { rol: 'ADMIN', desc: 'Todo el sitio, incluidos usuarios y configuración.' },
  { rol: 'CAPTURISTA', desc: 'Captura y consulta en sus municipios.' },
  { rol: 'CONSULTA', desc: 'Solo consulta en sus municipios.' },
]

export default function Usuarios() {
  const { usuario } = useContexto()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [editando, setEditando] = useState<UsuarioFila | 'nuevo' | null>(null)
  const esAdmin = usuario.rol === 'ADMIN'

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 250)
    return () => clearTimeout(t)
  }, [texto])

  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (estado) params.set('estado', estado)
  const { datos, error, cargando, recargar } = useApi<UsuarioFila[]>(esAdmin ? `/usuarios?${params}` : null)

  if (!esAdmin) {
    return (
      <Shell>
        <main className="contenido">
          <Encabezado titulo="Usuarios" />
          <section className="card vacio" role="alert">
            Solo el administrador puede administrar usuarios.
          </section>
        </main>
      </Shell>
    )
  }

  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo="Usuarios" desc="Quién puede entrar al sitio. Cada persona entra con su cuenta de Google.">
          <div className="barra-movil">
            <button className="btn pri" type="button" onClick={() => setEditando('nuevo')}>
              <IcoMas />
              Nuevo usuario
            </button>
          </div>
        </Encabezado>

        <div className="filtros">
          <label className="campo-busqueda">
            <IcoBuscar />
            <input type="search" aria-label="Buscar usuario" placeholder="Nombre o email" value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="seg" role="group" aria-label="Filtrar por estado">
            {ESTADOS.map((f) => (
              <button key={f.id} className="btn md" type="button" aria-pressed={estado === f.id} onClick={() => setEstado(f.id)}>
                {f.texto}
              </button>
            ))}
          </div>
        </div>

        <section className="card" style={{ overflow: 'hidden' }} aria-busy={cargando}>
          {error ? (
            <div className="vacio" role="alert">
              {error.message}{' '}
              <button type="button" className="link-btn" onClick={recargar}>
                Reintentar
              </button>
            </div>
          ) : !datos ? (
            <div className="vacio">Cargando…</div>
          ) : datos.length === 0 ? (
            <div className="vacio">No hay usuarios con este filtro.</div>
          ) : (
            <>
              <div className="tbl-wrap">
                <table className="tbl apilable">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Municipios</th>
                      <th>Último acceso</th>
                      <th>Estado</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {u.nombre}
                              {u.id === usuario.id && (
                                <span className="tag gray" style={{ marginLeft: 8 }}>
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="nota" style={{ fontWeight: 400 }}>
                              {u.email}
                            </div>
                          </div>
                        </td>
                        <td data-label="Rol" className="ancho">
                          <span className="tag gray">{ROL_NOMBRE[u.rol]}</span>
                        </td>
                        <td data-label="Municipios" className="ancho" style={{ whiteSpace: 'normal' }}>
                          {u.rol === 'ADMIN' ? 'Todos' : u.municipios.length ? u.municipios.map((m) => nombrePropio(m.nombre)).join(', ') : <span className="tag warn">Sin municipios</span>}
                        </td>
                        <td data-label="Último acceso" className="ancho">{u.ultimo_acceso ? cuando(u.ultimo_acceso) : <span className="muted">Aún no entra</span>}</td>
                        <td data-label="Estado">{u.activo ? <span className="tag">Activo</span> : <span className="tag gray">Inactivo</span>}</td>
                        <td data-label="">
                          <button type="button" className="link-btn" onClick={() => setEditando(u)} aria-label={`Editar ${u.nombre}`}>
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="paginacion" style={{ borderTop: '1px solid var(--line-soft)' }}>
                <span>
                  <span className="num">{n(datos.length)}</span> {datos.length === 1 ? 'usuario' : 'usuarios'}
                </span>
              </div>
            </>
          )}
        </section>
      </main>

      {editando && (
        <UsuarioForm
          usuario={editando === 'nuevo' ? undefined : editando}
          esYo={editando !== 'nuevo' && editando.id === usuario.id}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            recargar()
          }}
        />
      )}
    </Shell>
  )
}

/** Alta (sin `usuario`) o edición. El ADMIN no cambia su propio rol ni se desactiva. */
function UsuarioForm({ usuario, esYo, onCerrar, onGuardado }: { usuario?: UsuarioFila; esYo: boolean; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [email, setEmail] = useState(usuario?.email ?? '')
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'CAPTURISTA')
  const [municipios, setMunicipios] = useState<number[]>(usuario?.municipios.map((m) => m.id) ?? [])
  const [activo, setActivo] = useState(usuario?.activo ?? true)
  const { datos: catalogo } = useApi<Municipio[]>('/municipios')

  const { guardando, error, enviar } = useEnvio(async () => {
    if (rol !== 'ADMIN' && municipios.length === 0) throw new Error('Elige al menos un municipio')
    const datos: Record<string, unknown> = { nombre, rol, municipios: rol === 'ADMIN' ? [] : municipios }
    if (!usuario?.vinculado) datos.email = email
    if (usuario) {
      if (!esYo) datos.activo = activo
      await api(`/usuarios/${usuario.id}`, { metodo: 'PATCH', datos })
    } else {
      await api('/usuarios', { metodo: 'POST', datos })
    }
    onGuardado()
  })

  const marcar = (id: number, si: boolean) => setMunicipios((ms) => (si ? [...ms, id] : ms.filter((x) => x !== id)))

  return (
    <Hoja titulo={usuario ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar}>
      <Formulario onSubmit={enviar} error={error} guardando={guardando} boton={usuario ? 'Guardar' : 'Crear usuario'}>
        <label className="campo">
          Nombre
          <input required autoFocus={!usuario} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="campo">
          Email (cuenta de Google)
          <input
            required
            type="email"
            autoComplete="off"
            readOnly={usuario?.vinculado}
            aria-describedby={usuario?.vinculado ? 'email-nota' : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {usuario?.vinculado && (
            <span id="email-nota" className="nota" style={{ fontWeight: 400 }}>
              Ya entró con esta cuenta de Google; el email no se puede cambiar.
            </span>
          )}
        </label>

        <fieldset className="opciones">
          <legend>Rol</legend>
          {esYo ? (
            <p className="nota">
              Eres {ROL_NOMBRE[rol]}. No puedes cambiar tu propio rol; pídeselo a otro administrador.
            </p>
          ) : (
            ROLES.map((r) => (
              <label key={r.rol} className="opcion">
                <input type="radio" name="rol" value={r.rol} checked={rol === r.rol} onChange={() => setRol(r.rol)} />
                <span>
                  <span className="opcion-nombre">{ROL_NOMBRE[r.rol]}</span>
                  <span className="nota">{r.desc}</span>
                </span>
              </label>
            ))
          )}
        </fieldset>

        <fieldset className="opciones">
          <legend>Municipios permitidos</legend>
          {rol === 'ADMIN' ? (
            <p className="nota">El administrador ve todos los municipios.</p>
          ) : !catalogo ? (
            <p className="nota">Cargando municipios…</p>
          ) : (
            catalogo.map((m) => (
              <label key={m.id} className="opcion">
                <input type="checkbox" checked={municipios.includes(m.id)} onChange={(e) => marcar(m.id, e.target.checked)} />
                <span className="opcion-nombre">{nombrePropio(m.nombre)}</span>
              </label>
            ))
          )}
        </fieldset>

        {usuario && !esYo && (
            <fieldset className="opciones">
              <legend>Acceso</legend>
              <label className="opcion">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                <span>
                  <span className="opcion-nombre">Activo</span>
                  <span className="nota">Si lo desactivas no podrá entrar y su sesión abierta deja de funcionar.</span>
                </span>
              </label>
            </fieldset>
        )}
      </Formulario>
    </Hoja>
  )
}
