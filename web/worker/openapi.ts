// Especificación OpenAPI 3.1 de la API (/api/*). Se sirve en GET /api/openapi.json y se consulta en
// Administración → API (/api-docs). REGLA: toda ruta nueva o modificada se documenta aquí en el mismo
// cambio; /api/openapi.json lista en `x-sin-documentar` las rutas del Worker que falten.

type Obj = Record<string, unknown>

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` })
const json = (schema: Obj, description = 'OK') => ({ description, content: { 'application/json': { schema } } })
const cuerpo = (schema: Obj) => ({ required: true, content: { 'application/json': { schema } } })
const err = (description: string) => json(ref('Error'), description)

const path = (name: string, description: string, schema: Obj = { type: 'integer', minimum: 1 }) => ({ name, in: 'path', required: true, description, schema })
const query = (name: string, description: string, schema: Obj = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema })

const MID = path('mid', 'Id del municipio.')
const SID = path('id', 'Id de la sección.')
const PAGINA = [
  query('pagina', 'Página (desde 1).', { type: 'integer', minimum: 1, default: 1 }),
  query('limite', 'Filas por página.', { type: 'integer', minimum: 1, maximum: 100, default: 50 }),
]

/** Respuestas de error comunes a las rutas de escritura. */
const ESCRITURA = {
  '400': err('Datos inválidos.'),
  '401': err('No autenticado.'),
  '403': err('Rol CONSULTA o sin acceso al municipio.'),
}
const LECTURA_MUNICIPIO = { '403': err('El usuario no tiene acceso al municipio.') }

const Ok = { type: 'object', properties: { ok: { type: 'boolean', const: true } }, required: ['ok'] }
const nullable = (type: string, extra: Obj = {}) => ({ type: [type, 'null'], ...extra })
const int = { type: 'integer' }

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'GovTrack API',
    version: '0.1.0',
    description:
      'API del Worker de GovTrack (Cloudflare Workers + D1). Todas las respuestas son JSON; los errores responden `{ "error": "mensaje" }` con su código HTTP.\n\n' +
      '**Autenticación (provisional):** mientras no exista el login con Google, el usuario se identifica por el header de Cloudflare Access ' +
      '`Cf-Access-Authenticated-User-Email` o, en local, por `USUARIO_PRUEBA_EMAIL`. Debe existir y estar activo en la tabla `usuario`. ' +
      'Las escrituras exigen ADMIN o CAPTURISTA (el tema, solo ADMIN); un usuario que no es ADMIN solo accede a sus municipios.',
  },
  servers: [{ url: '/api' }],
  // Las lecturas aceptan petición anónima mientras no haya login; las escrituras declaran `cfAccess` obligatorio.
  security: [{}, { cfAccess: [] }],
  tags: [
    { name: 'General', description: 'Estado del servicio, usuario y catálogos.' },
    { name: 'Configuración', description: 'Ajustes globales del sitio.' },
    { name: 'Secciones', description: 'Secciones electorales, casillas y resultados.' },
    { name: 'Colonias', description: 'Colonias y su relación con las secciones.' },
  ],
  components: {
    securitySchemes: {
      cfAccess: { type: 'apiKey', in: 'header', name: 'Cf-Access-Authenticated-User-Email', description: 'Email del usuario (lo agrega Cloudflare Access).' },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } }, required: ['error'] },
      Rol: { type: 'string', enum: ['ADMIN', 'CAPTURISTA', 'CONSULTA'] },
      Usuario: {
        type: 'object',
        properties: { id: int, email: { type: 'string', format: 'email' }, nombre: { type: 'string' }, rol: ref('Rol') },
        required: ['id', 'email', 'nombre', 'rol'],
      },
      Municipio: { type: 'object', properties: { id: int, clave_ine: nullable('integer'), nombre: { type: 'string' } }, required: ['id', 'nombre'] },
      Cargo: { type: 'string', enum: ['PRESIDENCIA', 'SENADURIA', 'DIPUTACION_FEDERAL', 'GUBERNATURA', 'DIPUTACION_LOCAL', 'AYUNTAMIENTO'] },
      Proceso: {
        type: 'object',
        properties: {
          id: int,
          anio: int,
          nombre: { type: 'string' },
          elecciones: { type: 'array', items: { type: 'object', properties: { id: int, cargo: ref('Cargo') } } },
        },
      },
      Tema: { type: 'string', enum: ['verde', 'azul', 'naranja', 'guinda'] },
      TipoSeccion: { type: ['string', 'null'], enum: ['URBANA', 'RURAL', 'MIXTA', null] },
      SeccionFila: {
        type: 'object',
        properties: {
          id: int,
          numero: int,
          tipo: ref('TipoSeccion'),
          sector: nullable('string'),
          colonias: { ...int, description: 'Colonias de la sección.' },
          colonias_cubiertas: { ...int, description: 'Colonias con al menos un operador.' },
          operadores: int,
          personas: { ...int, description: 'Personas movilizadas.' },
          casillas: { ...int, description: 'Casillas del proceso.' },
          ln: { ...int, description: 'Lista nominal del proceso.' },
        },
      },
      SeccionDetalle: {
        type: 'object',
        properties: {
          id: int,
          numero: int,
          tipo: ref('TipoSeccion'),
          sector: nullable('string'),
          municipio_id: int,
          municipio: { type: 'string' },
          colonias: int,
          colonias_cubiertas: int,
          operadores: int,
          personas: int,
          proceso_id: nullable('integer'),
          casillas: int,
          ln: int,
          lista_casillas: {
            type: 'array',
            items: { type: 'object', properties: { id: int, tipo: { type: 'string', examples: ['B', 'C1', 'E1'] }, ln: nullable('integer'), ubicacion: nullable('string') } },
          },
          elecciones: { type: 'array', items: ref('EleccionResultados') },
        },
      },
      EleccionResultados: {
        type: 'object',
        description: 'Tabla de votos de una elección: una columna por partido y una fila por casilla.',
        properties: {
          id: int,
          cargo: ref('Cargo'),
          partidos: { type: 'array', items: { type: 'string' }, description: 'Siglas, en el orden de `votos`.' },
          casillas: {
            type: 'array',
            items: { type: 'object', properties: { casilla: { type: 'string' }, ln: int, votos: { type: 'array', items: int } } },
          },
        },
      },
      ColoniaDeSeccion: {
        type: 'object',
        properties: {
          id: int,
          nombre: { type: 'string' },
          tipo_asentamiento: nullable('string'),
          cp: nullable('string', { pattern: '^\\d{5}$' }),
          operadores: int,
          personas: int,
          otras_secciones: { type: 'array', items: int, description: 'Números de las otras secciones a las que pertenece.' },
          enlaces: { type: 'array', items: { type: 'object', properties: { id: int, nombre: { type: 'string' } } } },
        },
      },
      ColoniaFila: {
        type: 'object',
        properties: {
          id: int,
          nombre: { type: 'string' },
          tipo_asentamiento: nullable('string'),
          cp: nullable('string'),
          operadores: int,
          personas: int,
          secciones: { type: 'array', items: { type: 'object', properties: { id: int, numero: int } } },
        },
      },
      EventoHistorial: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['alta', 'baja'] },
          fecha: { type: 'string', format: 'date-time' },
          colonia: { type: 'string' },
          operador: { type: 'string' },
          usuario: nullable('string'),
        },
      },
      ColoniaEntrada: {
        type: 'object',
        description: 'Los textos se normalizan a mayúsculas, como el catálogo del INE.',
        properties: {
          nombre: { type: 'string' },
          tipo_asentamiento: nullable('string', { examples: ['COLONIA', 'FRACCIONAMIENTO', 'EJIDO'] }),
          cp: nullable('string', { pattern: '^\\d{5}$' }),
        },
      },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['General'], summary: 'Estado del servicio', responses: { '200': json({ type: 'object', properties: { ok: { type: 'boolean' } } }) } },
    },
    '/openapi.json': {
      get: {
        tags: ['General'],
        summary: 'Esta especificación',
        description: 'Incluye `x-sin-documentar` con las rutas del Worker que aún no están en la especificación.',
        responses: { '200': json({ type: 'object' }) },
      },
    },
    '/me': {
      get: {
        tags: ['General'],
        summary: 'Usuario actual',
        security: [{ cfAccess: [] }],
        responses: { '200': json(ref('Usuario')), '401': err('No autenticado.') },
      },
    },
    '/municipios': {
      get: { tags: ['General'], summary: 'Municipios', responses: { '200': json({ type: 'array', items: ref('Municipio') }) } },
    },
    '/procesos': {
      get: {
        tags: ['General'],
        summary: 'Procesos electorales con sus elecciones',
        description: 'El más reciente primero.',
        responses: { '200': json({ type: 'array', items: ref('Proceso') }) },
      },
    },
    '/configuracion': {
      get: {
        tags: ['Configuración'],
        summary: 'Ajustes globales',
        responses: { '200': json({ type: 'object', additionalProperties: { type: 'string' }, examples: [{ tema: 'verde' }] }) },
      },
    },
    '/configuracion/tema': {
      put: {
        tags: ['Configuración'],
        summary: 'Cambiar el tema del sitio',
        description: 'Solo ADMIN.',
        security: [{ cfAccess: [] }],
        requestBody: cuerpo({ type: 'object', properties: { tema: ref('Tema') }, required: ['tema'] }),
        responses: { '200': json({ type: 'object', properties: { tema: ref('Tema') } }), '400': err('Tema inválido.'), '401': err('No autenticado.'), '403': err('No es ADMIN.') },
      },
    },
    '/municipios/{mid}/secciones': {
      get: {
        tags: ['Secciones'],
        summary: 'Secciones del municipio con su cobertura',
        parameters: [
          MID,
          query('q', 'Prefijo del número de sección.'),
          query('filtro', '`sin-operador`: sin ningún operador. `huecos`: con al menos una colonia sin operador.', { type: 'string', enum: ['sin-operador', 'huecos'] }),
          query('proceso', 'Proceso para casillas y lista nominal; por omisión, el más reciente.', { type: 'integer' }),
          ...PAGINA,
        ],
        responses: {
          '200': json({ type: 'object', properties: { total: int, filas: { type: 'array', items: ref('SeccionFila') } } }),
          ...LECTURA_MUNICIPIO,
        },
      },
      post: {
        tags: ['Secciones'],
        summary: 'Alta de sección',
        security: [{ cfAccess: [] }],
        parameters: [MID],
        requestBody: cuerpo({
          type: 'object',
          properties: { numero: { type: 'integer', minimum: 1, maximum: 9999 }, tipo: ref('TipoSeccion'), sector: nullable('string') },
          required: ['numero'],
        }),
        responses: { '201': json({ type: 'object', properties: { id: int, numero: int } }, 'Creada'), ...ESCRITURA, '409': err('La sección ya existe en el municipio.') },
      },
    },
    '/municipios/{mid}/secciones/{numero}': {
      get: {
        tags: ['Secciones'],
        summary: 'Detalle de sección por número',
        description: 'Incluye casillas, lista nominal y resultados por elección del proceso.',
        parameters: [MID, path('numero', 'Número de sección (único dentro del municipio).'), query('proceso', 'Por omisión, el más reciente.', { type: 'integer' })],
        responses: { '200': json(ref('SeccionDetalle')), '404': err('La sección no existe en el municipio.'), ...LECTURA_MUNICIPIO },
      },
    },
    '/secciones/{id}': {
      patch: {
        tags: ['Secciones'],
        summary: 'Editar tipo y sector',
        description: 'Solo cambia los campos presentes en el cuerpo.',
        security: [{ cfAccess: [] }],
        parameters: [SID],
        requestBody: cuerpo({ type: 'object', properties: { tipo: ref('TipoSeccion'), sector: nullable('string') } }),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La sección no existe.') },
      },
    },
    '/secciones/{id}/colonias': {
      get: {
        tags: ['Secciones'],
        summary: 'Colonias de la sección con su estructura',
        description: 'Operadores, personas movilizadas y enlaces por colonia. Primero las cubiertas.',
        parameters: [SID],
        responses: { '200': json({ type: 'array', items: ref('ColoniaDeSeccion') }), '404': err('La sección no existe.'), ...LECTURA_MUNICIPIO },
      },
    },
    '/secciones/{id}/historial': {
      get: {
        tags: ['Secciones'],
        summary: 'Historial de la sección',
        description: 'Últimas 30 altas y bajas de asignaciones.',
        parameters: [SID],
        responses: { '200': json({ type: 'array', items: ref('EventoHistorial') }), '404': err('La sección no existe.'), ...LECTURA_MUNICIPIO },
      },
    },
    '/secciones/{id}/colonias/{cid}': {
      put: {
        tags: ['Colonias'],
        summary: 'Agregar colonia a la sección',
        description: 'Idempotente. La colonia debe ser del mismo municipio.',
        security: [{ cfAccess: [] }],
        parameters: [SID, path('cid', 'Id de la colonia.')],
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La sección o la colonia no existen.') },
      },
      delete: {
        tags: ['Colonias'],
        summary: 'Quitar colonia de la sección',
        description: 'No se permite si la colonia tiene asignaciones en la sección, aunque estén dadas de baja.',
        security: [{ cfAccess: [] }],
        parameters: [SID, path('cid', 'Id de la colonia.')],
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La sección no existe.'), '409': err('La colonia tiene asignaciones en la sección.') },
      },
    },
    '/municipios/{mid}/colonias': {
      get: {
        tags: ['Colonias'],
        summary: 'Colonias del municipio',
        parameters: [
          MID,
          query('q', 'Parte del nombre, CP exacto o número de sección.'),
          query('filtro', 'Solo colonias sin operador.', { type: 'string', enum: ['sin-operador'] }),
          ...PAGINA,
        ],
        responses: {
          '200': json({ type: 'object', properties: { total: int, filas: { type: 'array', items: ref('ColoniaFila') } } }),
          ...LECTURA_MUNICIPIO,
        },
      },
      post: {
        tags: ['Colonias'],
        summary: 'Alta de colonia',
        security: [{ cfAccess: [] }],
        parameters: [MID],
        requestBody: cuerpo({
          allOf: [
            ref('ColoniaEntrada'),
            { type: 'object', required: ['nombre'], properties: { secciones: { type: 'array', items: int, description: 'Números de sección del municipio.' } } },
          ],
        }),
        responses: { '201': json({ type: 'object', properties: { id: int } }, 'Creada'), ...ESCRITURA, '409': err('Ya existe una colonia con ese nombre y CP.') },
      },
    },
    '/colonias/{id}': {
      patch: {
        tags: ['Colonias'],
        summary: 'Editar colonia',
        description: 'Solo cambia los campos presentes en el cuerpo.',
        security: [{ cfAccess: [] }],
        parameters: [path('id', 'Id de la colonia.')],
        requestBody: cuerpo(ref('ColoniaEntrada')),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La colonia no existe.'), '409': err('Ya existe una colonia con ese nombre y CP.') },
      },
    },
  } as Record<string, Obj>,
}

// operationId derivado de método y ruta (p. ej. getMunicipiosMidSecciones) para los generadores de clientes.
for (const [ruta, ops] of Object.entries(openapi.paths)) {
  for (const [metodo, op] of Object.entries(ops)) {
    const partes = ruta.split(/[/{}.]+/).filter(Boolean).map((x) => x[0].toUpperCase() + x.slice(1))
    ;(op as Obj).operationId ??= metodo + partes.join('')
  }
}

/** Rutas del Worker (`app.routes`) que no están en la especificación, como "GET /municipios/{mid}". */
export function sinDocumentar(rutas: { method: string; path: string }[]): string[] {
  const faltan = new Set<string>()
  for (const r of rutas) {
    if (r.method === 'ALL') continue // middleware
    const p = r.path.replace(/^\/api/, '').replace(/:(\w+)/g, '{$1}')
    const op = openapi.paths[p] as Obj | undefined
    if (!op?.[r.method.toLowerCase()]) faltan.add(`${r.method} ${p}`)
  }
  return [...faltan]
}
