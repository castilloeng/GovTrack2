// Datos de ejemplo tomados de los diseños aprobados (diseno/pantallas/*.dc.html).
// Solo sirven para maquetar: cuando exista la API, cada pantalla los obtendrá de /api/*.

export type Rol = 'ADMIN' | 'CAPTURISTA' | 'CONSULTA'

export const ROL_NOMBRE: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CAPTURISTA: 'Capturista',
  CONSULTA: 'Consulta',
}

export const usuarioActual = { nombre: 'Rosain Castillo', rol: 'ADMIN' as Rol }

export const municipios = ['Tapachula', 'Cacahoatán']
export const procesos = ['Proceso 2024', 'Proceso 2021']

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

// ---------- Operadores y enlaces ----------

export type Persona = { id: number; nombre: string; telefono: string }
export type Asignacion = { colonia: string; seccion: string; personas: number }
export type Operador = Persona & { enlaces: number[]; asignaciones: Asignacion[]; enlaceDe?: number }

export const enlaces: Persona[] = [
  { id: 101, nombre: 'Jorge Ramírez', telefono: '962 300 1145' },
  { id: 102, nombre: 'Laura Ochoa', telefono: '962 455 8820' },
  { id: 103, nombre: 'Pedro Morales', telefono: '962 281 7034' },
  { id: 104, nombre: 'Sergio Díaz', telefono: '962 619 2251' },
]

export const operadores: Operador[] = [
  {
    id: 1,
    nombre: 'María Elena Cruz Pérez',
    telefono: '962 118 4402',
    enlaces: [101, 102],
    enlaceDe: 2,
    asignaciones: [
      { colonia: 'Col. Centro', seccion: '0812', personas: 34 },
      { colonia: 'Col. Las Palmas', seccion: '0812', personas: 28 },
      { colonia: 'Fracc. Los Laureles', seccion: '0813', personas: 24 },
    ],
  },
  {
    id: 2,
    nombre: 'José Luis Gómez Ruiz',
    telefono: '962 204 1187',
    enlaces: [101],
    asignaciones: [
      { colonia: 'Col. Centro', seccion: '0812', personas: 30 },
      { colonia: 'Col. Infonavit', seccion: '0812', personas: 24 },
    ],
  },
  {
    id: 3,
    nombre: 'Ana Karen Velázquez',
    telefono: '962 330 9051',
    enlaces: [103, 102],
    asignaciones: [{ colonia: 'Col. Las Palmas', seccion: '0812', personas: 30 }],
  },
  {
    id: 4,
    nombre: 'Héctor Martínez López',
    telefono: '962 147 6623',
    enlaces: [103],
    asignaciones: [
      { colonia: 'Col. Infonavit', seccion: '0812', personas: 14 },
      { colonia: 'Col. Del Valle', seccion: '0813', personas: 27 },
    ],
  },
  {
    id: 5,
    nombre: 'Rosa Isela Hernández',
    telefono: '962 512 0384',
    enlaces: [104],
    asignaciones: [
      { colonia: 'Col. Centro', seccion: '0812', personas: 32 },
      { colonia: 'Col. San Juan', seccion: '0812', personas: 22 },
      { colonia: 'Col. Obrera', seccion: '0821', personas: 30 },
      { colonia: 'Col. Lomas del Sol', seccion: '0821', personas: 28 },
    ],
  },
  {
    id: 6,
    nombre: 'Carlos Alberto Toledo',
    telefono: '962 093 7710',
    enlaces: [104, 101],
    asignaciones: [{ colonia: 'Col. Obrera', seccion: '0821', personas: 25 }],
  },
  {
    id: 7,
    nombre: 'Guadalupe Sánchez Ortiz',
    telefono: '962 668 2295',
    enlaces: [102],
    asignaciones: [
      { colonia: 'Fracc. Los Laureles', seccion: '0813', personas: 33 },
      { colonia: 'Col. 5 de Febrero', seccion: '0830', personas: 30 },
    ],
  },
  {
    id: 8,
    nombre: 'Fernando Ríos Castañeda',
    telefono: '962 471 3308',
    enlaces: [103],
    asignaciones: [{ colonia: 'Col. 5 de Febrero', seccion: '0830', personas: 18 }],
  },
]

export const TOTAL_OPERADORES = 386

export const enlacePorId = (id: number) => enlaces.find((e) => e.id === id)!

// ---------- Detalle de sección ----------

export type Casilla = { casilla: string; ln: number; votos: number[] }
export type Eleccion = { id: string; nombre: string; partidos: string[]; casillas: Casilla[] }

export const seccionDetalle = {
  num: '0812',
  tipo: 'Urbana',
  casillas: 4,
  colonias: 6,
  ln: 2980,
  personasMovilizadas: 214,
  elecciones: [
    {
      id: 'ayuntamiento',
      nombre: 'Ayuntamiento',
      partidos: ['Partido A', 'Partido B', 'Partido C', 'Partido D'],
      casillas: [
        { casilla: 'B', ln: 745, votos: [182, 121, 70, 38] },
        { casilla: 'C1', ln: 744, votos: [175, 130, 66, 41] },
        { casilla: 'C2', ln: 744, votos: [190, 112, 72, 35] },
        { casilla: 'C3', ln: 747, votos: [168, 125, 79, 44] },
      ],
    },
    {
      id: 'diputacion',
      nombre: 'Diputación local',
      partidos: ['Partido A', 'Partido B', 'Partido C'],
      casillas: [
        { casilla: 'B', ln: 745, votos: [171, 140, 88] },
        { casilla: 'C1', ln: 744, votos: [166, 151, 82] },
        { casilla: 'C2', ln: 744, votos: [180, 129, 90] },
        { casilla: 'C3', ln: 747, votos: [159, 144, 97] },
      ],
    },
    {
      id: 'gubernatura',
      nombre: 'Gubernatura',
      partidos: ['Partido B', 'Partido A', 'Partido C', 'Partido D', 'Partido E'],
      casillas: [
        { casilla: 'B', ln: 745, votos: [160, 150, 52, 30, 21] },
        { casilla: 'C1', ln: 744, votos: [171, 139, 48, 33, 19] },
        { casilla: 'C2', ln: 744, votos: [158, 162, 50, 27, 15] },
        { casilla: 'C3', ln: 747, votos: [166, 141, 61, 29, 22] },
      ],
    },
  ] satisfies Eleccion[],
  estructura: [
    { colonia: 'Col. Centro', operadores: 4, personas: 96, enlaces: 'J. Ramírez, L. Ochoa, S. Díaz' },
    { colonia: 'Col. Las Palmas', operadores: 2, personas: 58, enlaces: 'J. Ramírez, L. Ochoa' },
    { colonia: 'Col. Infonavit', operadores: 2, personas: 38, enlaces: 'P. Morales' },
    { colonia: 'Col. San Juan', operadores: 1, personas: 22, enlaces: 'S. Díaz' },
    { colonia: 'Col. Los Pinos', operadores: 0, personas: 0, enlaces: '' },
    { colonia: 'Fracc. Bugambilias', operadores: 0, personas: 0, enlaces: '' },
  ],
  historial: [
    { texto: 'Nueva asignación: Col. Centro', cuando: 'Hoy, 09:15 · Capturista' },
    { texto: 'Resultados de Ayuntamiento importados (4 casillas)', cuando: '6 oct · Rosain Castillo' },
    { texto: 'Baja de operador en Col. Los Pinos', cuando: '3 oct · Capturista', alerta: true },
  ],
}

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
