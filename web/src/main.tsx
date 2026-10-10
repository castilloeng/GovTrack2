import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { cargarTema } from './tema'

// Aplica el tema del sitio guardado en D1 (index.html ya pintó la copia local para evitar el parpadeo).
void cargarTema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
