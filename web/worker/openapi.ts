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
const PID = path('id', 'Id de la persona.')
const AID = path('id', 'Id de la asignación.')
const FILTROS_PERSONA = [
  query('q', 'Parte del nombre o del teléfono (desde 3 dígitos).'),
  query('seccion', 'Número de sección.', { type: 'integer' }),
]
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
const LECTURA_MUNICIPIO = { '401': err('No autenticado.'), '403': err('El usuario no tiene acceso al municipio.') }
const SIN_SESION = { '401': err('No autenticado.') }
const redireccion = (description: string) => ({ description, headers: { Location: { schema: { type: 'string' } } } })

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
      '**Autenticación:** login con Google (`/auth/login`). La sesión es la cookie HttpOnly `gt_sesion` (7 días); en local, `USUARIO_PRUEBA_EMAIL` ' +
      'entra sin Google. El usuario debe estar dado de alta y activo en la tabla `usuario`. Todas las rutas exigen sesión salvo `/health`, ' +
      '`/configuracion` (GET) y `/auth/*`. Las escrituras exigen ADMIN o CAPTURISTA (el tema, solo ADMIN); un usuario que no es ADMIN solo accede a sus municipios.',
  },
  servers: [{ url: '/api' }],
  // Todas las rutas exigen la cookie de sesión salvo las que declaran `security: []`.
  security: [{ sesion: [] }],
  tags: [
    { name: 'General', description: 'Estado del servicio, usuario y catálogos.' },
    { name: 'Autenticación', description: 'Login con Google (OpenID Connect) y cierre de sesión.' },
    { name: 'Configuración', description: 'Ajustes globales del sitio.' },
    { name: 'Secciones', description: 'Secciones electorales, casillas y resultados.' },
    { name: 'Colonias', description: 'Colonias y su relación con las secciones.' },
    { name: 'Estructura', description: 'Personas (padrón), operadores, enlaces y asignaciones. El rol se deduce de las relaciones.' },
  ],
  components: {
    securitySchemes: {
      sesion: { type: 'apiKey', in: 'cookie', name: 'gt_sesion', description: 'Cookie de sesión que crea `/auth/callback` tras el login con Google.' },
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
      PersonaBreve: {
        type: 'object',
        properties: { id: int, nombre: { type: 'string' }, telefono: nullable('string', { pattern: '^\\d{10}$' }) },
      },
      OperadorFila: {
        type: 'object',
        properties: {
          id: int,
          nombre: { type: 'string' },
          telefono: nullable('string'),
          enlaces: { type: 'array', items: ref('PersonaBreve'), description: '1 o 2, en orden.' },
          colonias: { ...int, description: 'Asignaciones vigentes (sección + colonia).' },
          personas: { ...int, description: 'Personas movilizadas en total.' },
          enlace_de: { ...int, description: 'Operadores activos de los que también es enlace.' },
        },
      },
      EnlaceFila: {
        type: 'object',
        properties: {
          id: int,
          nombre: { type: 'string' },
          telefono: nullable('string'),
          operadores: int,
          colonias: { ...int, description: 'Pares sección + colonia distintos de sus operadores.' },
          personas: int,
        },
      },
      Asignacion: {
        type: 'object',
        properties: {
          id: int,
          seccion_id: int,
          seccion: { ...int, description: 'Número de sección.' },
          colonia_id: int,
          colonia: { type: 'string' },
          num_personas: int,
          observaciones: nullable('string'),
        },
      },
      PersonaDetalle: {
        type: 'object',
        properties: {
          id: int,
          nombre: { type: 'string' },
          telefono: nullable('string'),
          municipio_id: int,
          deleted_at: nullable('string', { format: 'date-time' }),
          enlaces: { type: 'array', items: ref('PersonaBreve') },
          asignaciones: { type: 'array', items: ref('Asignacion'), description: 'Solo las vigentes.' },
          enlace_de: { type: 'array', items: { type: 'object', properties: { id: int, nombre: { type: 'string' } } }, description: 'Operadores activos de los que es enlace.' },
        },
      },
      PersonaEntrada: {
        type: 'object',
        description: 'El nombre se guarda en mayúsculas; el teléfono, como 10 dígitos (se ignoran espacios y guiones) y es único entre personas activas.',
        properties: { nombre: { type: 'string' }, telefono: nullable('string', { examples: ['962 118 4402'] }) },
      },
      Enlaces: {
        type: 'array',
        items: int,
        minItems: 1,
        maxItems: 2,
        description: 'Ids de personas activas del mismo municipio, distintas del operador. El orden define enlace 1 y 2.',
      },
    },
  },
  paths: {
    '/health': {
      get: { tags: ['General'], summary: 'Estado del servicio', security: [], responses: { '200': json({ type: 'object', properties: { ok: { type: 'boolean' } } }) } },
    },
    '/auth/login': {
      get: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión con Google',
        description: 'Redirige a Google. Se abre como navegación del navegador, no con `fetch`.',
        security: [],
        parameters: [query('volver', 'Ruta local a la que volver tras el login.', { type: 'string', default: '/' })],
        responses: { '302': redireccion('A Google, o a `/login?error=config` si faltan los secretos.') },
      },
    },
    '/auth/callback': {
      get: {
        tags: ['Autenticación'],
        summary: 'Regreso de Google',
        description:
          'Valida `state` y el ID token, busca al usuario por `google_sub` o (primer login) por email, y crea la cookie `gt_sesion`. ' +
          'Si falla redirige a `/login?error=` con `cancelado`, `estado`, `google`, `no-verificado`, `sin-acceso`, `inactivo` o `config`.',
        security: [],
        parameters: [query('code', 'Código de autorización.'), query('state', 'Valor anti-CSRF.'), query('error', 'Error devuelto por Google.')],
        responses: { '302': redireccion('A la ruta `volver` con sesión, o a `/login?error=…`.') },
      },
    },
    '/auth/logout': {
      post: { tags: ['Autenticación'], summary: 'Cerrar sesión', description: 'Borra la cookie de sesión.', security: [], responses: { '204': { description: 'Sesión cerrada.' } } },
    },
    '/openapi.json': {
      get: {
        tags: ['General'],
        summary: 'Esta especificación',
        description: 'Incluye `x-sin-documentar` con las rutas del Worker que aún no están en la especificación.',
        responses: { '200': json({ type: 'object' }), ...SIN_SESION },
      },
    },
    '/me': {
      get: {
        tags: ['General'],
        summary: 'Usuario actual',
        responses: { '200': json(ref('Usuario')), '401': err('No autenticado.') },
      },
    },
    '/municipios': {
      get: { tags: ['General'], summary: 'Municipios', responses: { '200': json({ type: 'array', items: ref('Municipio') }), ...SIN_SESION } },
    },
    '/procesos': {
      get: {
        tags: ['General'],
        summary: 'Procesos electorales con sus elecciones',
        description: 'El más reciente primero.',
        responses: { '200': json({ type: 'array', items: ref('Proceso') }), ...SIN_SESION },
      },
    },
    '/configuracion': {
      get: {
        tags: ['Configuración'],
        summary: 'Ajustes globales',
        security: [],
        responses: { '200': json({ type: 'object', additionalProperties: { type: 'string' }, examples: [{ tema: 'verde' }] }) },
      },
    },
    '/configuracion/tema': {
      put: {
        tags: ['Configuración'],
        summary: 'Cambiar el tema del sitio',
        description: 'Solo ADMIN.',
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
        parameters: [SID, path('cid', 'Id de la colonia.')],
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La sección o la colonia no existen.') },
      },
      delete: {
        tags: ['Colonias'],
        summary: 'Quitar colonia de la sección',
        description: 'No se permite si la colonia tiene asignaciones en la sección, aunque estén dadas de baja.',
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
        parameters: [path('id', 'Id de la colonia.')],
        requestBody: cuerpo(ref('ColoniaEntrada')),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La colonia no existe.'), '409': err('Ya existe una colonia con ese nombre y CP.') },
      },
    },
    '/municipios/{mid}/operadores': {
      get: {
        tags: ['Estructura'],
        summary: 'Operadores del municipio',
        description: 'Personas activas con asignaciones vigentes o con enlaces, ordenadas por nombre.',
        parameters: [MID, ...FILTROS_PERSONA, query('enlace', 'Solo operadores con este enlace (id).', { type: 'integer' }), ...PAGINA],
        responses: {
          '200': json({ type: 'object', properties: { total: int, filas: { type: 'array', items: ref('OperadorFila') } } }),
          ...LECTURA_MUNICIPIO,
        },
      },
    },
    '/municipios/{mid}/enlaces': {
      get: {
        tags: ['Estructura'],
        summary: 'Enlaces del municipio (vista por enlace)',
        description: 'Personas que son enlace de al menos un operador activo, con sus totales. No se pagina. Con `seccion` solo cuentan las asignaciones de esa sección.',
        parameters: [MID, ...FILTROS_PERSONA],
        responses: { '200': json({ type: 'array', items: ref('EnlaceFila') }), ...LECTURA_MUNICIPIO },
      },
    },
    '/municipios/{mid}/personas': {
      get: {
        tags: ['Estructura'],
        summary: 'Buscar en el padrón',
        description: 'Personas activas del municipio (para elegir enlaces). Máximo 20.',
        parameters: [MID, query('q', 'Parte del nombre o del teléfono.')],
        responses: { '200': json({ type: 'array', items: ref('PersonaBreve') }), ...LECTURA_MUNICIPIO },
      },
      post: {
        tags: ['Estructura'],
        summary: 'Alta de persona u operador',
        description: 'Con `enlaces` queda como operador con sus 1 o 2 enlaces.',
        parameters: [MID],
        requestBody: cuerpo({ allOf: [ref('PersonaEntrada'), { type: 'object', required: ['nombre'], properties: { enlaces: ref('Enlaces') } }] }),
        responses: { '201': json({ type: 'object', properties: { id: int } }, 'Creada'), ...ESCRITURA, '409': err('El teléfono ya está registrado.') },
      },
    },
    '/personas/{id}': {
      get: {
        tags: ['Estructura'],
        summary: 'Detalle de persona',
        description: 'Enlaces, asignaciones vigentes y operadores de los que es enlace.',
        parameters: [PID],
        responses: { '200': json(ref('PersonaDetalle')), '404': err('La persona no existe.'), ...LECTURA_MUNICIPIO },
      },
      patch: {
        tags: ['Estructura'],
        summary: 'Editar nombre y teléfono',
        description: 'Solo cambia los campos presentes en el cuerpo.',
        parameters: [PID],
        requestBody: cuerpo(ref('PersonaEntrada')),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La persona no existe.'), '409': err('Dada de baja o teléfono ya registrado.') },
      },
      delete: {
        tags: ['Estructura'],
        summary: 'Dar de baja',
        description: 'Baja lógica (`deleted_at`) de la persona y de sus asignaciones vigentes. No se permite si es enlace de operadores activos.',
        parameters: [PID],
        responses: {
          '200': json({ type: 'object', properties: { ok: { type: 'boolean' }, asignaciones: { ...int, description: 'Asignaciones dadas de baja.' } } }),
          ...ESCRITURA,
          '404': err('La persona no existe.'),
          '409': err('Ya está dada de baja o es enlace de operadores activos.'),
        },
      },
    },
    '/personas/{id}/enlaces': {
      put: {
        tags: ['Estructura'],
        summary: 'Cambiar los enlaces del operador',
        description: 'Reemplaza los enlaces; aplican a todas las asignaciones del operador.',
        parameters: [PID],
        requestBody: cuerpo({ type: 'object', required: ['enlaces'], properties: { enlaces: ref('Enlaces') } }),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('La persona no existe.'), '409': err('La persona está dada de baja.') },
      },
    },
    '/personas/{id}/asignaciones': {
      post: {
        tags: ['Estructura'],
        summary: 'Asignar el operador a una colonia',
        description: 'La colonia debe pertenecer a la sección y la sección al municipio del operador.',
        parameters: [PID],
        requestBody: cuerpo({
          type: 'object',
          required: ['seccion_id', 'colonia_id'],
          properties: { seccion_id: int, colonia_id: int, num_personas: { type: 'integer', minimum: 0, default: 0 }, observaciones: nullable('string') },
        }),
        responses: {
          '201': json({ type: 'object', properties: { id: int } }, 'Creada'),
          ...ESCRITURA,
          '404': err('La persona no existe.'),
          '409': err('Ya está asignado a esa colonia en esa sección, o la persona está dada de baja.'),
        },
      },
    },
    '/asignaciones/{id}': {
      patch: {
        tags: ['Estructura'],
        summary: 'Editar personas y observaciones',
        parameters: [AID],
        requestBody: cuerpo({ type: 'object', properties: { num_personas: { type: 'integer', minimum: 0 }, observaciones: nullable('string') } }),
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('No existe o ya fue dada de baja.') },
      },
      delete: {
        tags: ['Estructura'],
        summary: 'Quitar asignación',
        description: 'Baja lógica; queda en el historial de la sección.',
        parameters: [AID],
        responses: { '200': json(Ok), ...ESCRITURA, '404': err('No existe o ya fue dada de baja.') },
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
