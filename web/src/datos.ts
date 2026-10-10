// Datos de ejemplo tomados de los diseños aprobados (diseno/pantallas/*.dc.html).
// Solo los usan las pantallas que aún no están conectadas a la API (Importar).

export type Rol = 'ADMIN' | 'CAPTURISTA' | 'CONSULTA'

export const ROL_NOMBRE: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CAPTURISTA: 'Capturista',
  CONSULTA: 'Consulta',
}

/** Umbral de "baja cobertura" (personas / lista nominal). Debe ser configurable. */
export const UMBRAL_BAJA_COBERTURA = 3

/** Prioridad: puntos de margen entre "competida" y "ganada" o "perdida". */
export const UMBRAL_COMPETIDA = 10

// ---------- Importar ----------

export const TIPOS_CARGA = ['Secciones', 'Colonias', 'Casillas con lista nominal', 'Resultados por casilla']

export const importacionEjemplo = {
  archivo: 'casillas_tapachula_2024.xlsx',
  descripcion: 'Tipo: casillas y resultados · Elección: Ayuntamiento',
  filas: 1204,
  validas: 1180,
  errores: 24,
  columnas: [
    { origen: 'SECCION', destino: 'Sección', ejemplo: '0812' },
    { origen: 'TIPO_CASILLA', destino: 'Casilla', ejemplo: 'C1' },
    { origen: 'LISTA_NOMINAL', destino: 'Lista nominal', ejemplo: '744' },
    { origen: 'PARTIDO_A', destino: 'Partido A', ejemplo: '175' },
    { origen: 'PARTIDO_B', destino: 'Partido B', ejemplo: '130' },
  ],
  filasError: [
    { fila: 48, seccion: '0824', casilla: 'C4', problema: 'La suma de votos (812) supera la lista nominal (760)' },
    { fila: 213, seccion: '9901', casilla: 'B', problema: 'La sección no existe en Tapachula' },
    { fila: 377, seccion: '0851', casilla: '—', problema: 'Falta el tipo de casilla' },
    { fila: 402, seccion: '0851', casilla: 'E1', problema: '«PARTIDO_X» no es un partido de esta elección' },
    { fila: 655, seccion: '0870', casilla: 'C1', problema: 'Casilla duplicada en el archivo (también en fila 654)' },
  ],
}

export const bitacoraImportaciones = [
  { tipo: 'Colonias', fecha: '7 oct', filas: 412, ok: true },
  { tipo: 'Secciones', fecha: '7 oct', filas: 148, ok: true },
  { tipo: 'Casillas', fecha: '6 oct', filas: 0, ok: false },
]
