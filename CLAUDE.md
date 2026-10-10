# GovTrack

Sistema para gestionar la estructura territorial de operadores y enlaces por municipio, sección electoral y colonia, junto con los resultados electorales por casilla.

El repositorio contiene:

- **`desktop/`**: la app de escritorio actual (Electron + better-sqlite3). Es la versión en uso.
- **`web/`**: el rediseño para la nueva **versión web**. Está en construcción y todavía no reemplaza a la app de escritorio.
- **`diseno/`**: la guía de diseño de la versión web (`DISENO.md`) y el respaldo de las pantallas aprobadas. Está fuera de `web/` para que modificarla no dispare un deploy en Cloudflare.

## App de escritorio (`desktop/`)

- Es un proyecto independiente con su propio `package.json` y `node_modules`. Se ejecuta con `cd desktop && npm start`. La entrada es `desktop/main.js`, las vistas están en `desktop/view/*.html` y la lógica en `desktop/js/*.js`.
- `desktop/Update.sh` hace `git pull` y `npm install` dentro de `desktop/`.
- Acceso a datos: `desktop/js/ipcHandlers.js` (handlers IPC) y `desktop/js/db.js` (crea las tablas y aplica migraciones simples al arrancar).
- La base es `desktop/db/GovTrackDB.db` (SQLite). No se versiona y **sus datos son de prueba**.
- `better-sqlite3` está compilado para la ABI de Electron, así que no se puede cargar con `node` directamente. Para inspeccionar la BD usa Python (`sqlite3`) o el CLI `sqlite3`.
- Las tablas actuales y su significado real (los nombres son engañosos):

  | Tabla | Qué es realmente |
  |---|---|
  | `Contacto` | Padrón de personas (operadores **y** enlaces). |
  | `ContactoDet` | **Asignación de un operador** a una sección + colonia. `NUM_PERSONAS` son las personas que moviliza en esa colonia. `OPERADOR_ENLACE1/2` son sus **enlaces** (no operadores). Si enlace1 = enlace2, significa que tiene un solo enlace. |
  | `Seccion2` | En realidad son **casillas**: una fila por casilla (B, C1, E1…), con su lista nominal (`LN`) y los votos por partido en JSON (`PARTIDOS`). |
  | `Colonias` | Relación colonia ↔ sección. Una colonia puede repetirse en varias secciones. |

## `web/`: nueva versión web (rediseño)

### En qué consiste

Se va a pasar de la app de escritorio a una **aplicación web multiusuario** sobre **Cloudflare (Workers + D1)**. El primer paso es rediseñar el modelo de datos, porque el actual tiene estos problemas:

- No tiene llaves primarias ni foráneas; las tablas se relacionan por texto libre.
- Los datos están duplicados (nombre y teléfono de los enlaces se copian en cada asignación).
- Los números se guardan como texto, y los votos van en JSON con partidos fijos.
- Solo admite una elección.
- `MUNICIPIO` se guarda como texto en cada tabla, con `TAPACHULA` fijo en el código.

### Estructura del directorio

`web/` es un proyecto independiente (su propio `package.json` y `node_modules`) y es **la raíz del despliegue en Cloudflare**; no depende de nada del resto del repo.

```
web/
├── src/                 # Frontend React (TypeScript)
├── worker/             # Worker: API con Hono bajo /api/* (index.ts, auth.ts, comun.ts, geografia.ts, openapi.ts)
├── scripts/            # Utilidades locales (p. ej. seed_desde_desktop.py)
├── migrations/          # Migraciones D1 (0001_esquema_inicial.sql = esquema completo)
├── index.html           # Entrada de Vite
├── vite.config.ts       # Vite + @cloudflare/vite-plugin (dev local con runtime de Workers)
├── wrangler.jsonc       # Config del Worker: assets SPA, binding D1 "DB"
└── tsconfig.json
```

Stack: **React + Vite + TypeScript** en el frontend; **Hono** en el Worker; **D1** como BD. Un solo Worker sirve el build de React (assets estáticos, modo SPA) y la API (`run_worker_first: ["/api/*"]`), así que no hay CORS ni dominios separados.

### Diseño de la interfaz

- **Toda interfaz web nueva debe seguir [`diseno/DISENO.md`](diseno/DISENO.md)**: layout, tokens, componentes, consideraciones por pantalla, tema configurable (azul, verde, naranja o guinda) y soporte para celular y iPad.
- Los diseños aprobados están en `diseno/pantallas/*.dc.html`. Son maquetas HTML de referencia, no código que se importe. El lienzo original es https://claude.ai/artifact/NCEy3bEPtkJDFBemoG8SJs
- Los diseños aprobados no se modifican. Si hace falta un patrón nuevo, se documenta primero en `DISENO.md`.

### Comandos (ejecutar dentro de `web/`)

```bash
npm install
npm run db:migrate:local    # aplica migrations/ a la D1 local (.wrangler/)
npm run dev                 # http://localhost:5173 (React + Worker + D1 local)
npm run build               # tsc + vite build
npm run deploy              # build + wrangler deploy (publica en Cloudflare)
```

- `migrations/` sigue la convención de `wrangler d1 migrations`. Los archivos se numeran (`NNNN_descripcion.sql`) y **no se editan una vez aplicados en D1 remoto**: cualquier cambio va en una migración nueva.
- Los datos de prueba locales se cargan con `npx wrangler d1 execute govtrack --local --command "..."`, no como migraciones.
- Para cargar en la D1 local los datos de la app de escritorio (secciones, colonias, casillas, resultados, personas, enlaces y asignaciones):
  ```bash
  python scripts/seed_desde_desktop.py > .wrangler/seed.sql
  npx wrangler d1 execute govtrack --local --file .wrangler/seed.sql
  ```
  El SQL borra antes esas tablas (no toca `usuario` ni `configuracion`). Crea el proceso 2024 con la elección de Ayuntamiento.
- La BD remota `govtrack` ya existe en Cloudflare (su `database_id` está en `wrangler.jsonc`). El binding se llama `DB` (el Worker usa `c.env.DB`); no cambiarlo aunque `wrangler d1 create` sugiera otro nombre.
- `.claude/launch.json` (en la raíz del repo) define el servidor `govtrack-web` para la vista previa.

### Publicación en Cloudflare

- **URL de producción**: https://govtrack.rosain.workers.dev/ (verificado el 2026-10-09: `/`, `/api/health` y `/api/municipios` responden 200).
- **Tipo de proyecto**: **Worker** con assets estáticos (Workers Builds conectado a GitHub). **No usar Cloudflare Pages**:
  - Pages no ejecuta `worker/index.ts`.
  - `vite build` deja el frontend en `dist/client/` y el Worker en `dist/govtrack/`.
  - Un intento previo en `govtrack.pages.dev` daba 404 por ambas razones.
- **Configuración en el panel** (Workers & Pages → govtrack → Settings → Build):
  | Campo | Valor |
  |---|---|
  | Repositorio / rama | `castilloeng/GovTrack2` / `main` |
  | Worker name | `govtrack` (debe coincidir con `name` en `wrangler.jsonc`) |
  | Root directory (Path) | `web` |
  | Build command | `npm run build` |
  | Deploy command | `npx wrangler deploy` |
  | Non-production deploy command | `npx wrangler versions upload` |
  | Build watch paths | Include: `web/*` · Exclude (recomendado): `web/**/*.md` |
- **Flujo**: cada push a `main` que toque `web/` dispara build y deploy automáticos. Los cambios en `desktop/`, `diseno/` o `CLAUDE.md` no publican nada. Alternativa manual: `npm run deploy` desde `web/`.
- **Base de datos**: el binding de D1 (`DB` → `govtrack`) se toma de `wrangler.jsonc`, no se configura en el panel.
- **Migraciones**: **no** se aplican en el deploy. Tras agregar una migración nueva, correr `npm run db:migrate:remote` desde `web/`.
  - La BD remota tiene aplicada la `0001` y contiene los municipios de prueba TAPACHULA y CACAHOATAN. También tiene aplicada la `0002_configuracion.sql` (tema `verde`). El 2026-10-09 se cargaron los catálogos de prueba de la app de escritorio con `seed_desde_desktop.py --solo-catalogos` (209 secciones, 1,116 colonias, 290 casillas con resultados, proceso 2024 / Ayuntamiento); no tiene personas ni asignaciones.
- **Secretos del Worker** (`npx wrangler secret put <NOMBRE>`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `SESSION_SECRET` (cadena aleatoria larga que firma las cookies de sesión; cambiarla cierra todas las sesiones). Si falta alguno, el login redirige a `/login?error=config`.
- **Seguridad**: toda la API exige sesión salvo `/api/health`, `GET /api/configuracion` y `/api/auth/*`.

### Modelo de datos (resumen)

- **Geografía**: `municipio`, `seccion`, `colonia` y `seccion_colonia` (relación N:M).
- **Electoral**: `proceso_electoral` → `eleccion` (cargo). Las casillas y la lista nominal pertenecen al proceso (las elecciones concurrentes comparten casillas). Los votos se guardan en `resultado (casilla, eleccion, partido)` y se admiten varias elecciones.
- **Estructura territorial**:
  - `persona`: padrón único. El rol no se guarda; se deduce de las relaciones, y una persona puede ser operador y enlace a la vez.
  - `operador_enlace`: cada **operador** tiene **1 o 2 enlaces**. Los enlaces son **del operador**, los mismos en todas sus asignaciones.
  - `operador_asignacion`: el operador es responsable de una (sección, colonia), con `num_personas`. La FK compuesta a `seccion_colonia` garantiza que la colonia pertenezca a la sección.
- **Acceso**: `usuario` con roles `ADMIN`, `CAPTURISTA` y `CONSULTA`. `usuario_municipio` limita qué municipios ve cada usuario (ADMIN ve todos). `importacion` es la bitácora de cargas desde Excel.
- **Configuración**: `configuracion (clave, valor)` guarda ajustes globales del sitio, como el tema de color (migración `0002`).
- **Vistas**: `v_asignacion` (equivale a la antigua `ContactoDet`) y `v_votos_seccion`.

### Decisiones tomadas

- **Motor**: Cloudflare D1 (dialecto SQLite). No hay ENUM; los catálogos cerrados se validan con `CHECK`. Las fechas se guardan como texto ISO-8601 UTC. D1 aplica las FK por defecto.
- **Autenticación**: con **Google** (OpenID Connect).
  1. El ADMIN da de alta al usuario por email.
  2. En el primer login se guarda `google_sub` y a partir de entonces se identifica por ese valor.
  3. Solo entra quien esté dado de alta y activo, y con el email verificado por Google.
  4. No se guardan contraseñas.
- **Borrado lógico** (`deleted_at`) en `persona` y `operador_asignacion`. Las unicidades (teléfono, asignación) solo aplican a los registros activos.
- **Fuera de alcance**: coaliciones, candidaturas comunes, votos nulos y candidatos no registrados.
- **Datos actuales**: son de prueba, así que no hace falta una migración cuidadosa de `ContactoDet` y `Contacto`. Los catálogos (secciones, colonias, casillas) sí pueden cargarse desde el SQLite actual o desde Excel.

### Login con Google (`web/worker/auth.ts`)

- Flujo OpenID Connect "authorization code": `GET /api/auth/login?volver=` → Google → `GET /api/auth/callback` → cookie de sesión `gt_sesion` (JWT HS256 firmado con `SESSION_SECRET`, HttpOnly, 7 días) → redirige a `volver`. `POST /api/auth/logout` la borra.
- El callback valida `state` y `nonce` (cookie `gt_oauth`), `aud`, `iss`, `exp` y `email_verified`. Busca al usuario por `google_sub` o, en el primer login, por email (y guarda `google_sub`). Si falla redirige a `/login?error=` (`sin-acceso`, `inactivo`, `no-verificado`, `cancelado`, `estado`, `google`, `config`) y la pantalla muestra el mensaje.
- `usuarioActual()` (`web/worker/comun.ts`) lee la cookie y vuelve a consultar `usuario` (solo activos) en cada petición. En local, si no hay sesión, usa `USUARIO_PRUEBA_EMAIL` de `web/.dev.vars` (comentarlo para probar el login real). Ya **no** se acepta el header `Cf-Access-Authenticated-User-Email`.
- Frontend: cualquier 401 de `api()` lleva a `/login?volver=…`; el avatar cierra sesión.
- Credenciales OAuth (Google Cloud Console, tipo "Aplicación web"):
  - **Client ID** (público): `724223285890-cvqfva03vnt7ukgel0ak3taja7tj6d15.apps.googleusercontent.com`
  - **Client secret**: **no se versiona**. En local está en `web/.dev.vars` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`); en producción, como secretos del Worker.
  - **URIs de redireccionamiento autorizados**: `https://govtrack.rosain.workers.dev/api/auth/callback` y `http://localhost:5173/api/auth/callback` (el puerto local debe coincidir).

### Pendiente

- Carga de catálogos desde Excel (desde el SQLite de escritorio ya existe `web/scripts/seed_desde_desktop.py`).
- Conectar el resto del frontend a la API. **Secciones y colonias** (`/secciones`, `/colonias`, `/secciones/:numero`), **Operadores y enlaces** (`/operadores`, `/operadores/:id`) **Panel** (`/`) y los selectores de municipio y proceso ya usan la API; Importar sigue con los datos de ejemplo de `web/src/datos.ts`. El ruteo es un router mínimo propio (`web/src/router.tsx`) sobre la History API.
- Diseñar e implementar Asignaciones y Usuarios (hoy muestran "pendiente de diseño").

### Documentación de la API (OpenAPI)

- **Toda ruta de la API que se cree o modifique se documenta en `web/worker/openapi.ts` en el mismo cambio**: ruta, método, parámetros, cuerpo, respuestas (incluidos los errores) y esquemas. Si se elimina una ruta, se quita también de la especificación.
- La especificación (OpenAPI 3.1) se sirve en `GET /api/openapi.json` y se consulta en **Administración → API** (`/api-docs`, solo ADMIN), que permite descargarla.
- `/api/openapi.json` compara la especificación con las rutas registradas en el Worker (`app.routes`) y lista las que faltan en `x-sin-documentar`; la pantalla las muestra como alerta. Antes de terminar un cambio a la API, verifica que esa lista esté vacía.
- Para validarla: `npx @redocly/cli lint http://localhost:5173/api/openapi.json` (o sobre un archivo descargado).

### API de operadores y enlaces (`web/worker/estructura.ts`)

- Lecturas: `GET /api/municipios/:mid/operadores` (paginado; `?q=`, `?seccion=` número, `?enlace=` id), `GET /api/municipios/:mid/enlaces` (sin paginar; `?q=`, `?seccion=`), `GET /api/municipios/:mid/personas?q=` (buscador del padrón, máx. 20) y `GET /api/personas/:id` (enlaces, asignaciones vigentes y "enlace de").
- Escrituras (ADMIN o CAPTURISTA): `POST /api/municipios/:mid/personas` (con `enlaces` crea un operador), `PATCH /api/personas/:id`, `PUT /api/personas/:id/enlaces`, `DELETE /api/personas/:id` (baja lógica de la persona y sus asignaciones; no si es enlace de operadores activos), `POST /api/personas/:id/asignaciones`, `PATCH` y `DELETE /api/asignaciones/:id` (baja lógica).
- Es operador quien tiene asignaciones vigentes o enlaces; es enlace quien aparece en `operador_enlace` de un operador activo. El detalle de cada ruta está en la especificación OpenAPI.

### API del panel (`web/worker/panel.ts`)

- `GET /api/municipios/:mid/panel?proceso=`: KPI (secciones y secciones cubiertas, operadores, colonias cubiertas, enlaces, personas y lista nominal) y la votación total de cada elección del proceso. El panel muestra Ayuntamiento (o la primera elección con votos), los 3 partidos más votados más "Otros", y la participación sobre la lista nominal de las casillas con resultados.
- `GET /api/municipios/:mid/actividad?limite=`: altas y bajas de asignaciones e importaciones, la más reciente primero. Las bajas traen `sin_operador` si la sección se quedó sin operadores.
- La tabla "Cobertura por sección" usa `GET /api/municipios/:mid/secciones` con `?filtro=baja-cobertura&umbral=` (por omisión 3 %; en el frontend, `UMBRAL_BAJA_COBERTURA` de `web/src/datos.ts`).

### API de secciones y colonias (`web/worker/geografia.ts`)

| Método y ruta | Qué hace |
|---|---|
| `GET /api/procesos` | Procesos con sus elecciones (el más reciente primero). |
| `GET /api/municipios/:mid/secciones` | Lista paginada con cobertura. `?q=` (número), `?filtro=sin-operador\|huecos\|baja-cobertura` (con `?umbral=`), `?proceso=`, `?pagina=`, `?limite=` (máx. 100). Devuelve `{ total, filas }`. |
| `GET /api/municipios/:mid/secciones/:numero` | Detalle por número, con casillas y resultados por elección del proceso. |
| `GET /api/secciones/:id/colonias` | Colonias de la sección con operadores, personas, enlaces y otras secciones. |
| `GET /api/secciones/:id/historial` | Altas y bajas de asignaciones en la sección. |
| `GET /api/municipios/:mid/colonias` | Lista paginada. `?q=` (nombre, CP o número de sección), `?filtro=sin-operador`. |
| `POST /api/municipios/:mid/secciones` | Alta `{ numero, tipo?, sector? }`. |
| `PATCH /api/secciones/:id` | Cambia `tipo` y `sector`. |
| `POST /api/municipios/:mid/colonias` | Alta `{ nombre, tipo_asentamiento?, cp?, secciones?: number[] }` (números de sección). |
| `PATCH /api/colonias/:id` | Cambia `nombre`, `tipo_asentamiento` y `cp`. |
| `PUT` / `DELETE /api/secciones/:id/colonias/:cid` | Agrega o quita la colonia de la sección (no se quita si tiene asignaciones, aunque estén dadas de baja). |

- Acceso (`accesoMunicipio()` en `worker/comun.ts`): las escrituras exigen ADMIN o CAPTURISTA; un usuario que no es ADMIN solo accede a sus municipios (`usuario_municipio`).
- Los errores de la API responden `{ error }` con su código HTTP (`ErrorApi`).
