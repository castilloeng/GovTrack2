import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare()],
  // La vista previa puede asignar otro puerto (PORT) si 5173 está ocupado.
  server: { port: Number(process.env.PORT) || 5173 },
})
