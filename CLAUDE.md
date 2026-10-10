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
├── worker/index.ts      # Worker: API con Hono bajo /api/*
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
  - La BD remota tiene aplicada la `0001` y contiene los municipios de prueba TAPACHULA y CACAHOATAN. También tiene aplicada la `0002_configuracion.sql` (tema `verde`).
- **Seguridad**: sin login, la URL pública expone la API. No cargar datos reales hasta tener autenticación, o proteger la URL con Cloudflare Access.

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

### Pendiente

- Login con Google y control de acceso por rol/municipio en la API. Hoy existen `/api/health`, `/api/municipios`, `GET /api/me`, `GET /api/configuracion` y `PUT /api/configuracion/tema` (solo ADMIN). Mientras no haya login, `usuarioActual()` (`web/worker/index.ts`) identifica al usuario por el header de Cloudflare Access `Cf-Access-Authenticated-User-Email` o, en local, por `USUARIO_PRUEBA_EMAIL` en `web/.dev.vars` (no se versiona). Ese usuario debe existir y estar activo en la tabla `usuario`.
- Script de carga de catálogos desde `desktop/db/GovTrackDB.db` o Excel.
- Conectar el frontend a la API. Las pantallas de `diseno/pantallas/` (más Configuración) ya están maquetadas en `web/src/paginas/`, pero usan los datos de ejemplo de `web/src/datos.ts`. El ruteo es un router mínimo propio (`web/src/router.tsx`) sobre la History API.
- Diseñar e implementar Asignaciones y Usuarios (hoy muestran "pendiente de diseño").
