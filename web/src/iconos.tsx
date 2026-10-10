import type { ReactNode } from 'react'

// Íconos SVG de trazo, currentColor y aria-hidden (DISENO.md §4). Sin emoji.

function Svg({ size = 18, stroke = 1.8, children }: { size?: number; stroke?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

type P = { size?: number }

export const IcoPanel = ({ size }: P) => (
  <Svg size={size}>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </Svg>
)
export const IcoPersonas = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
  </Svg>
)
export const IcoLista = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Svg>
)
export const IcoMapa = ({ size }: P) => (
  <Svg size={size}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </Svg>
)
export const IcoBarras = ({ size }: P) => (
  <Svg size={size}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Svg>
)
export const IcoDescarga = ({ size }: P) => (
  <Svg size={size}>
    <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />
  </Svg>
)
export const IcoUsuario = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </Svg>
)
export const IcoAjustes = ({ size }: P) => (
  <Svg size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
)
export const IcoMenu = () => (
  <Svg size={20} stroke={2}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
)
export const IcoCerrar = () => (
  <Svg size={18} stroke={2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const IcoFlecha = () => (
  <Svg size={14} stroke={2}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
export const IcoAtras = () => (
  <Svg size={16} stroke={2}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
)
export const IcoBuscar = () => (
  <Svg size={16} stroke={2}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)
export const IcoPin = () => (
  <Svg size={16} stroke={2}>
    <path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </Svg>
)
export const IcoMas = () => (
  <Svg size={16} stroke={2.2}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const IcoPalomita = ({ size = 14 }: P) => (
  <Svg size={size} stroke={3}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
)
export const IcoFiltro = () => (
  <Svg size={16} stroke={2}>
    <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />
  </Svg>
)
export const IcoCandado = () => (
  <Svg size={18} stroke={2}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
)
export const IcoGoogle = () => (
  <Svg size={20} stroke={2}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 12h8" />
  </Svg>
)
export const IcoExcel = () => (
  <Svg size={22}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" />
    <path d="M14 3v5h5M9 13l6 5M15 13l-6 5" />
  </Svg>
)
