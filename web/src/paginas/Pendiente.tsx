import Shell from '../componentes/Shell'
import { Encabezado } from '../componentes/ui'

/** Pantallas sin diseño aprobado todavía (DISENO.md §5, "Pantallas pendientes de diseñar"). */
export default function Pendiente({ titulo, desc }: { titulo: string; desc: string }) {
  return (
    <Shell>
      <main className="contenido">
        <Encabezado titulo={titulo} desc={desc} />
        <section className="card vacio">Esta pantalla está pendiente de diseño.</section>
      </main>
    </Shell>
  )
}
