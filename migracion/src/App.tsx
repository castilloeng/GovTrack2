import { useEffect, useState } from 'react'

type Municipio = { id: number; clave_ine: number | null; nombre: string }

export default function App() {
  const [municipios, setMunicipios] = useState<Municipio[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/municipios')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setMunicipios(data as Municipio[]))
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>GovTrack</h1>
      <h2>Municipios</h2>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {!municipios && !error && <p>Cargando…</p>}
      {municipios?.length === 0 && <p>Sin municipios registrados.</p>}
      <ul>
        {municipios?.map((m) => (
          <li key={m.id}>{m.nombre}</li>
        ))}
      </ul>
    </main>
  )
}
