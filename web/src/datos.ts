// Datos de ejemplo tomados de los diseños aprobados (diseno/pantallas/*.dc.html).
// Solo los usan las pantallas que aún no están conectadas a la API (Panel e Importar).

export type Rol = 'ADMIN' | 'CAPTURISTA' | 'CONSULTA'

export const ROL_NOMBRE: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CAPTURISTA: 'Capturista',
  CONSULTA: 'Consulta',
}

/** Umbral de "baja cobertura" (personas / lista nominal). Debe ser configurable. */
export const UMBRAL_BAJA_COBERTURA = 3

// ---------- Panel ----------

export const kpis = {
  seccionesCubiertas: 112,
  seccionesTotal: 148,
  operadores: 386,
  colonias: 214,
  enlaces: 154,
  personas: 9420,
  pctListaNominal: 3.8,
}

export type SeccionCobertura = { num: string; colonias: number; operadores: number; personas: number; ln: number }

export const coberturaSecciones: SeccionCobertura[] = [
  { num: '0812', colonias: 6, operadores: 9, personas: 214, ln: 2980 },
  { num: '0813', colonias: 4, operadores: 5, personas: 131, ln: 2410 },
  { num: '0815', colonias: 3, operadores: 2, personas: 48, ln: 1905 },
  { num: '0821', colonias: 7, operadores: 11, personas: 302, ln: 3640 },
  { num: '0824', colonias: 5, operadores: 0, personas: 0, ln: 2155 },
  { num: '0830', colonias: 2, operadores: 3, personas: 77, ln: 1320 },
]

export const resultadoMunicipio = {
  titulo: 'Resultado 2024 · Ayuntamiento',
  partidos: [
    { nombre: 'Partido A', pct: 41.2 },
    { nombre: 'Partido B', pct: 27.9 },
    { nombre: 'Partido C', pct: 16.4 },
    { nombre: 'Otros', pct: 14.5 },
  ],
  participacion: 58.6,
}

export type Actividad = { texto: string; cifra?: string; despues?: string; cuando: string; alerta?: boolean }

export const actividadReciente: Actividad[] = [
  { texto: 'Importación de casillas completada: ', cifra: '1,180', despues: ' filas', cuando: 'Hoy, 10:42 · Rosain Castillo' },
  { texto: 'Nueva asignación en sección ', cifra: '0812', despues: ', Col. Centro', cuando: 'Hoy, 09:15 · Capturista' },
  { texto: 'Sección ', cifra: '0824', despues: ' quedó sin operador', cuando: 'Ayer, 18:03', alerta: true },
]

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
