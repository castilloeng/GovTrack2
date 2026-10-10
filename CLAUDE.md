# GovTrack

Sistema para gestionar la estructura territorial de operadores y enlaces por municipio, sección electoral y colonia, junto con los resultados electorales por casilla.

El repositorio contiene dos cosas:

- **App de escritorio actual** (raíz del repo): Electron + better-sqlite3. Es la versión en uso.
- **`migracion/`**: el rediseño para la nueva **versión web**. Está en construcción y todavía no reemplaza a la app de escritorio.

## App de escritorio (actual)

- Se ejecuta con `npm start` (Electron). La entrada es `main.js`, las vistas están en `view/*.html` y la lógica en `js/*.js`.
- Acceso a datos: `js/ipcHandlers.js` (handlers IPC) y `js/db.js` (crea las tablas y aplica migraciones simples al arrancar).
- La base es `db/GovTrackDB.db` (SQLite). No se versiona y **sus datos son de prueba**.
- `better-sqlite3` está compilado para la ABI de Electron, así que no se puede cargar con `node` directamente. Para inspeccionar la BD usa Python (`sqlite3`) o el CLI `sqlite3`.
- Las tablas actuales y su significado real (los nombres son engañosos):

  | Tabla | Qué es realmente |
  |---|---|
  | `Contacto` | Padrón de personas (operadores **y** enlaces). |
  | `ContactoDet` | **Asignación de un operador** a una sección + colonia. `NUM_PERSONAS` son las personas que moviliza en esa colonia. `OPERADOR_ENLACE1/2` son sus **enlaces** (no operadores). Si enlace1 = enlace2, significa que tiene un solo enlace. |
  | `Seccion2` | En realidad son **casillas**: una fila por casilla (B, C1, E1…), con su lista nominal (`LN`) y los votos por partido en JSON (`PARTIDOS`). |
  | `Colonias` | Relación colonia ↔ sección. Una colonia puede repetirse en varias secciones. |

## `migracion/`: rediseño para la versión web

### En qué consiste

Se va a pasar de la app de escritorio a una **aplicación web multiusuario** sobre **Cloudflare (Workers + D1)**. El primer paso es rediseñar el modelo de datos, porque el actual tiene estos problemas:

- No tiene llaves primarias ni foráneas; las tablas se relacionan por texto libre.
- Los datos están duplicados (nombre y teléfono de los enlaces se copian en cada asignación).
- Los números se guardan como texto, y los votos van en JSON con partidos fijos.
- Solo admite una elección.
- `MUNICIPIO` se guarda como texto en cada tabla, con `TAPACHULA` fijo en el código.

### Estructura del directorio

`migracion/` es un proyecto independiente (su propio `package.json` y `node_modules`) y es **la raíz del despliegue en Cloudflare**; no depende de nada del resto del repo.

```
migracion/
├── src/                 # Frontend React (TypeScript)
├── worker/index.ts      # Worker: API con Hono bajo /api/*
├── migrations/          # Migraciones D1 (0001_esquema_inicial.sql = esquema completo)
├── index.html           # Entrada de Vite
├── vite.config.ts       # Vite + @cloudflare/vite-plugin (dev local con runtime de Workers)
├── wrangler.jsonc       # Config del Worker: assets SPA, binding D1 "DB"
└── tsconfig.json
```

Stack: **React + Vite + TypeScript** en el frontend; **Hono** en el Worker; **D1** como BD. Un solo Worker sirve el build de React (assets estáticos, modo SPA) y la API (`run_worker_first: ["/api/*"]`), así que no hay CORS ni dominios separados.

### Comandos (ejecutar dentro de `migracion/`)

```bash
npm install
npm run db:migrate:local    # aplica migrations/ a la D1 local (.wrangler/)
npm run dev                 # http://localhost:5173 (React + Worker + D1 local)
npm run build               # tsc + vite build
npm run deploy              # build + wrangler deploy (publica en Cloudflare)
```

- `migrations/` sigue la convención de `wrangler d1 migrations`. Los archivos se numeran (`NNNN_descripcion.sql`) y **no se editan una vez aplicados en D1 remoto**: cualquier cambio va en una migración nueva.
- Los datos de prueba locales se cargan con `npx wrangler d1 execute govtrack --local --command "..."`, no como migraciones.
- `database_id` en `wrangler.jsonc` es un placeholder. Antes del primer deploy: `npx wrangler d1 create govtrack`, poner el id real y correr `npm run db:migrate:remote`.
- Despliegue: con `wrangler deploy` solo se sube el bundle del Worker y `dist/`. Si se conecta el repo de GitHub a Cloudflare (Workers Builds), configurar **Root directory = `migracion`**.
- `.claude/launch.json` (en la raíz del repo) define el servidor `govtrack-web` para la vista previa.

### Modelo de datos (resumen)

- **Geografía**: `municipio`, `seccion`, `colonia` y `seccion_colonia` (relación N:M).
- **Electoral**: `proceso_electoral` → `eleccion` (cargo). Las casillas y la lista nominal pertenecen al proceso (las elecciones concurrentes comparten casillas). Los votos se guardan en `resultado (casilla, eleccion, partido)` y se admiten varias elecciones.
- **Estructura territorial**:
  - `persona`: padrón único. El rol no se guarda; se deduce de las relaciones, y una persona puede ser operador y enlace a la vez.
  - `operador_enlace`: cada **operador** tiene **1 o 2 enlaces**. Los enlaces son **del operador**, los mismos en todas sus asignaciones.
  - `operador_asignacion`: el operador es responsable de una (sección, colonia), con `num_personas`. La FK compuesta a `seccion_colonia` garantiza que la colonia pertenezca a la sección.
- **Acceso**: `usuario` con roles `ADMIN`, `CAPTURISTA` y `CONSULTA`. `usuario_municipio` limita qué municipios ve cada usuario (ADMIN ve todos). `importacion` es la bitácora de cargas desde Excel.
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

### Pendiente

- Login con Google y control de acceso por rol/municipio en la API (hoy solo existen `/api/health` y `/api/municipios`, sin autenticación).
- Script de carga de catálogos desde `db/GovTrackDB.db` o Excel.
- Frontend web.
