import { useEffect, useState, type ReactNode } from 'react'
import { Link, useRuta } from '../router'
import { municipios, procesos, ROL_NOMBRE, usuarioActual, type Rol } from '../datos'
import { iniciales } from '../formato'
import {
  IcoAjustes,
  IcoBarras,
  IcoBuscar,
  IcoDescarga,
  IcoFlecha,
  IcoLista,
  IcoMapa,
  IcoMenu,
  IcoPanel,
  IcoPersonas,
  IcoPin,
  IcoUsuario,
  IcoAtras,
} from '../iconos'
import { useContexto } from './Contexto'
import Hoja from './Hoja'

type Item = { to: string; texto: string; icono: ReactNode; activo: (ruta: string) => boolean; roles?: Rol[] }
type Grupo = { titulo: string; items: Item[]; roles?: Rol[] }

const empieza = (p: string) => (ruta: string) => ruta === p || ruta.startsWith(p + '/')

const MENU: Grupo[] = [
  { titulo: 'General', items: [{ to: '/', texto: 'Panel', icono: <IcoPanel />, activo: (r) => r === '/' }] },
  {
    titulo: 'Estructura',
    items: [
      { to: '/operadores', texto: 'Operadores y enlaces', icono: <IcoPersonas />, activo: empieza('/operadores') },
      { to: '/asignaciones', texto: 'Asignaciones', icono: <IcoLista />, activo: empieza('/asignaciones') },
    ],
  },
  {
    titulo: 'Geografía y elección',
    items: [
      { to: '/secciones/0812', texto: 'Secciones y colonias', icono: <IcoMapa />, activo: empieza('/secciones') },
      { to: '/resultados', texto: 'Resultados', icono: <IcoBarras />, activo: empieza('/resultados') },
    ],
  },
  {
    titulo: 'Administración',
    roles: ['ADMIN', 'CAPTURISTA'],
    items: [
      { to: '/importaciones', texto: 'Importaciones', icono: <IcoDescarga />, activo: empieza('/importaciones') },
      { to: '/usuarios', texto: 'Usuarios', icono: <IcoUsuario />, activo: empieza('/usuarios'), roles: ['ADMIN'] },
      { to: '/configuracion', texto: 'Configuración', icono: <IcoAjustes />, activo: empieza('/configuracion'), roles: ['ADMIN'] },
    ],
  },
]

const puede = (roles: Rol[] | undefined) => !roles || roles.includes(usuarioActual.rol)

/** Layout común: barra lateral (cajón en celular, riel en iPad, completa en escritorio) + barra superior. */
export default function Shell({ children, busqueda = false }: { children: ReactNode; busqueda?: boolean }) {
  const ruta = useRuta()
  const [navAbierta, setNavAbierta] = useState(false)
  const [hojaContexto, setHojaContexto] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const { municipio, proceso, setMunicipio, setProceso } = useContexto()

  // El cajón se cierra al elegir una opción.
  useEffect(() => setNavAbierta(false), [ruta])

  useEffect(() => {
    if (!navAbierta) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setNavAbierta(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [navAbierta])

  return (
    <div className={'app' + (navAbierta ? ' nav-abierta' : '')}>
      <nav className="side" id="menu-principal" aria-label="Navegación principal">
        <div className="side-marca">
          <div className="logo">G</div>
          <div className="side-nombre">GovTrack</div>
        </div>
        {MENU.filter((g) => puede(g.roles)).map((g) => (
          <div key={g.titulo}>
            <h2>{g.titulo}</h2>
            {g.items
              .filter((i) => puede(i.roles))
              .map((i) => (
                <Link key={i.to} to={i.to} className="side-link" aria-current={i.activo(ruta) ? 'page' : undefined} aria-label={i.texto} title={i.texto}>
                  {i.icono}
                  <span className="side-txt">{i.texto}</span>
                </Link>
              ))}
          </div>
        ))}
      </nav>
      {navAbierta && <button type="button" className="scrim" aria-label="Cerrar menú" onClick={() => setNavAbierta(false)} />}

      <div className="col-principal">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn no-escritorio"
            aria-label={navAbierta ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={navAbierta}
            aria-controls="menu-principal"
            onClick={() => setNavAbierta((v) => !v)}
          >
            <IcoMenu />
          </button>

          {/* Celular: nombre del municipio que abre la hoja con municipio y proceso. */}
          <button type="button" className="btn municipio-movil solo-movil" onClick={() => setHojaContexto(true)} aria-label={`${municipio}, ${proceso}. Cambiar municipio o proceso`}>
            <span>{municipio}</span>
            <IcoFlecha />
          </button>

          <label className="btn btn-select desde-tablet">
            <IcoPin />
            {municipio}
            <IcoFlecha />
            <select aria-label="Cambiar municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
              {municipios.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="btn btn-select desde-tablet">
            {proceso}
            <IcoFlecha />
            <select aria-label="Cambiar proceso electoral" value={proceso} onChange={(e) => setProceso(e.target.value)}>
              {procesos.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>

          {busqueda && (
            <>
              <label className="campo-busqueda desde-tablet">
                <IcoBuscar />
                <span className="sr-only">Buscar</span>
                <input type="search" placeholder="Buscar persona, teléfono, sección o colonia" />
              </label>
              <button type="button" className="icon-btn solo-movil" aria-label="Buscar" onClick={() => setBuscando(true)}>
                <IcoBuscar />
              </button>
            </>
          )}

          <div className="usuario">
            <div className="usuario-txt desde-tablet">
              <div className="usuario-nombre">{usuarioActual.nombre}</div>
              <div className="usuario-rol">{ROL_NOMBRE[usuarioActual.rol]}</div>
            </div>
            <Link to="/login" className="avatar" aria-label={`${usuarioActual.nombre}, ${ROL_NOMBRE[usuarioActual.rol]}. Cerrar sesión`} title="Cerrar sesión" style={{ textDecoration: 'none' }}>
              {iniciales(usuarioActual.nombre)}
            </Link>
          </div>
        </header>

        {children}
      </div>

      {hojaContexto && (
        <Hoja titulo="Municipio y proceso" onCerrar={() => setHojaContexto(false)}>
          <label className="campo">
            Municipio
            <select value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
              {municipios.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="campo">
            Proceso electoral
            <select value={proceso} onChange={(e) => setProceso(e.target.value)}>
              {procesos.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn pri" onClick={() => setHojaContexto(false)}>
            Listo
          </button>
        </Hoja>
      )}

      {buscando && (
        <div className="busqueda-completa" role="dialog" aria-modal="true" aria-label="Buscar">
          <div className="fila">
            <button type="button" className="icon-btn" aria-label="Cerrar búsqueda" onClick={() => setBuscando(false)}>
              <IcoAtras />
            </button>
            <label className="campo-busqueda">
              <IcoBuscar />
              <span className="sr-only">Buscar</span>
              <input type="search" autoFocus placeholder="Persona, teléfono, sección o colonia" />
            </label>
          </div>
          <p className="nota">Escribe para buscar en {municipio}.</p>
        </div>
      )}
    </div>
  )
}
