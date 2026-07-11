-- ============================================================================
-- Script: actualizar_colonias.sql
-- Proposito: Agrega el campo MUNICIPIO a la tabla Colonias SOLO si no
--            existe, asigna "TAPACHULA" a todos los registros existentes,
--            y elimina el DEFAULT para que nuevos inserts requieran
--            valor explicito.
-- Base de datos: GovTrackDB.db
-- Fecha: 2026-07-10
--
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
--
-- Como ejecutar:
--   Windows (cmd):
--     sqlite3 "db\GovTrackDB.db" < "db\scripts\actualizar_colonias.sql"
--
--   macOS / Linux:
--     sqlite3 db/GovTrackDB.db < db/scripts/actualizar_colonias.sql
--
-- Nota: En Windows PowerShell NO funciona el operador "<".
--       Use cmd.exe o el comando:
--         Get-Content "db\scripts\actualizar_colonias.sql" | sqlite3 "db\GovTrackDB.db"
--
-- Verificacion posterior:
--   sqlite3 "db\GovTrackDB.db" "SELECT MUNICIPIO, COUNT(*) FROM Colonias GROUP BY MUNICIPIO;"
--   Debe devolver: TAPACHULA | 1359
-- ============================================================================

.output _tmp_migrate.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Colonias') WHERE name='MUNICIPIO') = 0
    THEN 'ALTER TABLE Colonias ADD COLUMN MUNICIPIO TEXT NOT NULL DEFAULT ''TAPACHULA'';

CREATE TABLE Colonias_new (
    SECCION       TEXT,
    TIPO_SECCION  TEXT,
    TIPO_COLONIA  TEXT,
    NOMBRE_COLONIA TEXT,
    CP            TEXT,
    MUNICIPIO     TEXT NOT NULL
);

INSERT INTO Colonias_new SELECT * FROM Colonias;

DROP TABLE Colonias;

ALTER TABLE Colonias_new RENAME TO Colonias;'
    ELSE 'SELECT ''La columna MUNICIPIO ya existe. No se requiere accion.'' AS mensaje;'
END;
.output stdout
.read _tmp_migrate.sql
