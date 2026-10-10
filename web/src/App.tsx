import { ContextoProvider } from './componentes/Contexto'
import { useRuta } from './router'
import Login from './paginas/Login'
import Panel from './paginas/Panel'
import Operadores from './paginas/Operadores'
import Seccion from './paginas/Seccion'
import Importar from './paginas/Importar'
import Configuracion from './paginas/Configuracion'
import Pendiente from './paginas/Pendiente'

// Pantallas según diseno/DISENO.md. Solo diseño: los datos son de ejemplo (src/datos.ts), sin llamadas a la API.

function Pantalla({ ruta }: { ruta: string }) {
  let m: RegExpMatchArray | null
  if (ruta === '/login') return <Login />
  if (ruta === '/') return <Panel />
  if (ruta === '/operadores') return <Operadores />
  if ((m = ruta.match(/^\/operadores\/(\d+)$/))) return <Operadores id={Number(m[1])} />
  if ((m = ruta.match(/^\/secciones\/(\d+)$/))) return <Seccion key={m[1]} num={m[1]} />
  if (ruta === '/secciones' || ruta === '/resultados') return <Seccion num="0812" />
  if (ruta === '/importaciones') return <Importar />
  if (ruta === '/configuracion') return <Configuracion />
  if (ruta === '/asignaciones') return <Pendiente titulo="Asignaciones" desc="Tabla completa de asignaciones y formulario de alta." />
  if (ruta === '/usuarios') return <Pendiente titulo="Usuarios" desc="Alta por email, rol, municipios permitidos y estado." />
  return <Pendiente titulo="Página no encontrada" desc={`No existe la ruta ${ruta}.`} />
}

export default function App() {
  const ruta = useRuta()
  return (
    <ContextoProvider>
      <Pantalla ruta={ruta} />
    </ContextoProvider>
  )
}
