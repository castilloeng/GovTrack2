import { ContextoProvider } from './componentes/Contexto'
import { useRuta } from './router'
import Login from './paginas/Login'
import Panel from './paginas/Panel'
import Operadores from './paginas/Operadores'
import Seccion from './paginas/Seccion'
import Secciones from './paginas/Secciones'
import Importar from './paginas/Importar'
import Configuracion from './paginas/Configuracion'
import ApiDocs from './paginas/ApiDocs'
import Pendiente from './paginas/Pendiente'

// Pantallas según diseno/DISENO.md. Secciones y colonias ya usan la API; el resto aún usa los datos de ejemplo (src/datos.ts).

function Pantalla({ ruta }: { ruta: string }) {
  let m: RegExpMatchArray | null
  if (ruta === '/login') return <Login />
  if (ruta === '/') return <Panel />
  if (ruta === '/operadores') return <Operadores />
  if ((m = ruta.match(/^\/operadores\/(\d+)$/))) return <Operadores id={Number(m[1])} />
  if ((m = ruta.match(/^\/secciones\/(\d{1,4})$/))) return <Seccion key={m[1]} numero={Number(m[1])} />
  if (ruta === '/secciones' || ruta === '/resultados') return <Secciones vista="secciones" />
  if (ruta === '/colonias') return <Secciones vista="colonias" />
  if (ruta === '/importaciones') return <Importar />
  if (ruta === '/configuracion') return <Configuracion />
  if (ruta === '/api-docs') return <ApiDocs />
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
