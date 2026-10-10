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
import Usuarios from './paginas/Usuarios'
import Asignaciones from './paginas/Asignaciones'
import Pendiente from './paginas/Pendiente'

// Pantallas según diseno/DISENO.md. Secciones y colonias ya usan la API; el resto aún usa los datos de ejemplo (src/datos.ts).

function Pantalla({ ruta }: { ruta: string }) {
  let m: RegExpMatchArray | null
  if (ruta === '/') return <Panel />
  if (ruta === '/operadores') return <Operadores />
  if ((m = ruta.match(/^\/operadores\/(\d+)$/))) return <Operadores id={Number(m[1])} />
  if ((m = ruta.match(/^\/secciones\/(\d{1,4})$/))) return <Seccion key={m[1]} numero={Number(m[1])} />
  // `key` por vista: cada una se monta de cero y nunca pinta las filas de la otra mientras carga.
  if (ruta === '/secciones' || ruta === '/resultados') return <Secciones key="secciones" vista="secciones" />
  if (ruta === '/colonias') return <Secciones key="colonias" vista="colonias" />
  if (ruta === '/importaciones') return <Importar />
  if (ruta === '/configuracion') return <Configuracion />
  if (ruta === '/api-docs') return <ApiDocs />
  if (ruta === '/asignaciones') return <Asignaciones />
  if (ruta === '/usuarios') return <Usuarios />
  return <Pendiente titulo="Página no encontrada" desc={`No existe la ruta ${ruta}.`} />
}

export default function App() {
  const ruta = useRuta()
  // El login va fuera del contexto: el contexto exige sesión y redirige aquí si no la hay.
  if (ruta === '/login') return <Login />
  return (
    <ContextoProvider>
      <Pantalla ruta={ruta} />
    </ContextoProvider>
  )
}
