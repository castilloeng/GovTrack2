-- ============================================================================
-- GovTrack Web - Esquema inicial
-- Motor: Cloudflare D1 (SQLite)
--
-- Aplicar:
--   npx wrangler d1 migrations apply <nombre-bd> --local
--   npx wrangler d1 migrations apply <nombre-bd> --remote
--
-- Notas D1:
--   - D1 aplica llaves foraneas por defecto (no hace falta PRAGMA foreign_keys).
--   - No hay ENUM: los catalogos cerrados se validan con CHECK.
--   - Fechas en texto ISO-8601 UTC (strftime('%Y-%m-%dT%H:%M:%SZ','now')).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. GEOGRAFIA
-- ----------------------------------------------------------------------------

CREATE TABLE municipio (
  id          INTEGER PRIMARY KEY,
  clave_ine   INTEGER UNIQUE,
  nombre      TEXT    NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE seccion (
  id            INTEGER PRIMARY KEY,
  municipio_id  INTEGER NOT NULL REFERENCES municipio(id),
  numero        INTEGER NOT NULL,
  tipo          TEXT    CHECK (tipo IN ('URBANA', 'RURAL', 'MIXTA')),
  sector        TEXT,
  UNIQUE (municipio_id, numero)
);

CREATE TABLE colonia (
  id                 INTEGER PRIMARY KEY,
  municipio_id       INTEGER NOT NULL REFERENCES municipio(id),
  nombre             TEXT    NOT NULL COLLATE NOCASE,
  tipo_asentamiento  TEXT,   -- COLONIA, FRACCIONAMIENTO, EJIDO, BARRIO, ...
  cp                 TEXT    CHECK (cp IS NULL OR (length(cp) = 5 AND cp NOT GLOB '*[^0-9]*')),
  UNIQUE (municipio_id, nombre, cp)
);
CREATE INDEX ix_colonia_nombre ON colonia (municipio_id, nombre);

-- Una colonia puede abarcar varias secciones y una seccion varias colonias.
CREATE TABLE seccion_colonia (
  seccion_id  INTEGER NOT NULL REFERENCES seccion(id),
  colonia_id  INTEGER NOT NULL REFERENCES colonia(id),
  PRIMARY KEY (seccion_id, colonia_id)
) WITHOUT ROWID;
CREATE INDEX ix_seccion_colonia_colonia ON seccion_colonia (colonia_id);


-- ----------------------------------------------------------------------------
-- 2. ELECTORAL
--    Un proceso electoral (p.ej. 2024) instala casillas; en ese proceso puede
--    haber varias elecciones concurrentes (ayuntamiento, diputacion, ...)
--    que comparten las mismas casillas y lista nominal.
-- ----------------------------------------------------------------------------

CREATE TABLE proceso_electoral (
  id      INTEGER PRIMARY KEY,
  anio    INTEGER NOT NULL,
  nombre  TEXT    NOT NULL,           -- "Proceso Electoral Local 2024"
  UNIQUE (anio, nombre)
);

CREATE TABLE eleccion (
  id          INTEGER PRIMARY KEY,
  proceso_id  INTEGER NOT NULL REFERENCES proceso_electoral(id),
  cargo       TEXT    NOT NULL CHECK (cargo IN (
                'PRESIDENCIA', 'SENADURIA', 'DIPUTACION_FEDERAL',
                'GUBERNATURA', 'DIPUTACION_LOCAL', 'AYUNTAMIENTO')),
  UNIQUE (proceso_id, cargo)
);

CREATE TABLE partido (
  id      INTEGER PRIMARY KEY,
  siglas  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre  TEXT,
  color   TEXT CHECK (color IS NULL OR color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]')
);

CREATE TABLE casilla (
  id             INTEGER PRIMARY KEY,
  proceso_id     INTEGER NOT NULL REFERENCES proceso_electoral(id),
  seccion_id     INTEGER NOT NULL REFERENCES seccion(id),
  tipo           TEXT    NOT NULL,   -- B, C1, C2, E1, E1C1, S ... (sin espacios)
  lista_nominal  INTEGER CHECK (lista_nominal >= 0),
  ubicacion      TEXT,
  CHECK (tipo NOT GLOB '* *'),
  UNIQUE (proceso_id, seccion_id, tipo)
);
CREATE INDEX ix_casilla_seccion ON casilla (seccion_id);

CREATE TABLE resultado (
  casilla_id   INTEGER NOT NULL REFERENCES casilla(id) ON DELETE CASCADE,
  eleccion_id  INTEGER NOT NULL REFERENCES eleccion(id),
  partido_id   INTEGER NOT NULL REFERENCES partido(id),
  votos        INTEGER NOT NULL CHECK (votos >= 0),
  PRIMARY KEY (casilla_id, eleccion_id, partido_id)
) WITHOUT ROWID;
CREATE INDEX ix_resultado_eleccion ON resultado (eleccion_id, partido_id);


-- ----------------------------------------------------------------------------
-- 3. ESTRUCTURA TERRITORIAL
--    persona: padron unico (operadores y enlaces).
--    Un OPERADOR es responsable de una o mas (seccion, colonia) y tiene 1 o 2
--    ENLACES, que son los mismos en todas sus asignaciones.
--    El rol se deduce de las relaciones; una persona puede tener ambos.
-- ----------------------------------------------------------------------------

CREATE TABLE persona (
  id            INTEGER PRIMARY KEY,
  nombre        TEXT    NOT NULL COLLATE NOCASE,
  telefono      TEXT    CHECK (telefono IS NULL OR (length(telefono) = 10 AND telefono NOT GLOB '*[^0-9]*')),
  municipio_id  INTEGER NOT NULL REFERENCES municipio(id),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_by    INTEGER REFERENCES usuario(id),
  deleted_at    TEXT
);
-- Telefono unico solo entre personas activas (permite reutilizar tras baja).
CREATE UNIQUE INDEX ux_persona_telefono ON persona (telefono) WHERE deleted_at IS NULL;
CREATE INDEX ix_persona_municipio ON persona (municipio_id, nombre);

CREATE TABLE operador_enlace (
  operador_id  INTEGER  NOT NULL REFERENCES persona(id),
  orden        INTEGER  NOT NULL CHECK (orden IN (1, 2)),
  enlace_id    INTEGER  NOT NULL REFERENCES persona(id),
  PRIMARY KEY (operador_id, orden),
  UNIQUE (operador_id, enlace_id),
  CHECK (operador_id <> enlace_id)
) WITHOUT ROWID;
CREATE INDEX ix_operador_enlace_enlace ON operador_enlace (enlace_id);

-- La FK compuesta garantiza que la colonia pertenezca a la seccion.
CREATE TABLE operador_asignacion (
  id             INTEGER PRIMARY KEY,
  operador_id    INTEGER NOT NULL REFERENCES persona(id),
  seccion_id     INTEGER NOT NULL,
  colonia_id     INTEGER NOT NULL,
  num_personas   INTEGER NOT NULL DEFAULT 0 CHECK (num_personas >= 0),  -- personas que moviliza en esa colonia
  observaciones  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  created_by     INTEGER REFERENCES usuario(id),
  deleted_at     TEXT,
  FOREIGN KEY (seccion_id, colonia_id) REFERENCES seccion_colonia (seccion_id, colonia_id)
);
CREATE UNIQUE INDEX ux_asignacion ON operador_asignacion (operador_id, seccion_id, colonia_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_asignacion_seccion ON operador_asignacion (seccion_id);
CREATE INDEX ix_asignacion_colonia ON operador_asignacion (colonia_id);


-- ----------------------------------------------------------------------------
-- 4. USUARIOS Y ACCESO
--    Autenticacion con Google (OpenID Connect). El ADMIN da de alta al usuario
--    por email; en su primer inicio de sesion se guarda google_sub (id estable
--    de Google) y a partir de ahi se identifica por ese valor.
--    Quien no este dado de alta (o este inactivo) no puede entrar.
-- ----------------------------------------------------------------------------

CREATE TABLE usuario (
  id             INTEGER PRIMARY KEY,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  google_sub     TEXT    UNIQUE,     -- claim "sub" del ID token; NULL hasta el primer login
  nombre         TEXT    NOT NULL,
  rol            TEXT    NOT NULL CHECK (rol IN ('ADMIN', 'CAPTURISTA', 'CONSULTA')),
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  ultimo_acceso  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Municipios que puede ver/capturar cada usuario (ADMIN ve todos).
CREATE TABLE usuario_municipio (
  usuario_id    INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  municipio_id  INTEGER NOT NULL REFERENCES municipio(id),
  PRIMARY KEY (usuario_id, municipio_id)
) WITHOUT ROWID;

CREATE TABLE importacion (
  id             INTEGER PRIMARY KEY,
  usuario_id     INTEGER NOT NULL REFERENCES usuario(id),
  archivo        TEXT    NOT NULL,
  destino        TEXT    NOT NULL,   -- 'colonia', 'casilla', 'resultado', ...
  municipio_id   INTEGER REFERENCES municipio(id),
  filas_ok       INTEGER NOT NULL DEFAULT 0,
  filas_error    INTEGER NOT NULL DEFAULT 0,
  detalle        TEXT,               -- JSON con errores por fila
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);


-- ----------------------------------------------------------------------------
-- 5. VISTAS DE CONSULTA
-- ----------------------------------------------------------------------------

-- Equivalente a la antigua tabla ContactoDet.
CREATE VIEW v_asignacion AS
SELECT a.id,
       m.id         AS municipio_id,
       m.nombre     AS municipio,
       s.numero     AS seccion,
       c.nombre     AS colonia,
       o.id         AS operador_id,
       o.nombre     AS operador,
       o.telefono   AS operador_telefono,
       a.num_personas,
       a.observaciones,
       e1.nombre    AS enlace1,
       e1.telefono  AS enlace1_telefono,
       e2.nombre    AS enlace2,
       e2.telefono  AS enlace2_telefono
FROM operador_asignacion a
JOIN persona   o ON o.id = a.operador_id
JOIN seccion   s ON s.id = a.seccion_id
JOIN municipio m ON m.id = s.municipio_id
JOIN colonia   c ON c.id = a.colonia_id
LEFT JOIN operador_enlace oe1 ON oe1.operador_id = o.id AND oe1.orden = 1
LEFT JOIN persona         e1  ON e1.id = oe1.enlace_id
LEFT JOIN operador_enlace oe2 ON oe2.operador_id = o.id AND oe2.orden = 2
LEFT JOIN persona         e2  ON e2.id = oe2.enlace_id
WHERE a.deleted_at IS NULL
  AND o.deleted_at IS NULL;

-- Votos por seccion, eleccion y partido.
CREATE VIEW v_votos_seccion AS
SELECT s.municipio_id,
       s.id         AS seccion_id,
       s.numero     AS seccion,
       r.eleccion_id,
       p.siglas     AS partido,
       SUM(r.votos) AS votos
FROM resultado r
JOIN casilla  k ON k.id = r.casilla_id
JOIN seccion  s ON s.id = k.seccion_id
JOIN partido  p ON p.id = r.partido_id
GROUP BY s.id, r.eleccion_id, p.id;
