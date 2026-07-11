-- ============================================================================
-- Script: actualizar_seccion2.sql
-- Proposito: Agrega el campo MUNICIPIO a la tabla Seccion2 SOLO si no existe.
-- Base de datos: GovTrackDB.db
-- Fecha: 2026-07-10
--
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
--
-- Como ejecutar:
--   Windows (cmd):
--     sqlite3 "db\GovTrackDB.db" < "db\scripts\actualizar_seccion2.sql"
--
--   macOS / Linux:
--     sqlite3 db/GovTrackDB.db < db/scripts/actualizar_seccion2.sql
--
--   Windows PowerShell:
--     Get-Content "db\scripts\actualizar_seccion2.sql" | sqlite3 "db\GovTrackDB.db"
--
-- Verificacion posterior:
--   sqlite3 "db\GovTrackDB.db" "PRAGMA table_info(Seccion2);"
--   Debe mostrar la columna MUNICIPIO al final.
-- ============================================================================

.output _tmp_migrate_seccion2.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Seccion2') WHERE name='MUNICIPIO') = 0
    THEN 'ALTER TABLE Seccion2 ADD COLUMN MUNICIPIO TEXT;'
    ELSE 'SELECT ''La columna MUNICIPIO ya existe en Seccion2. No se requiere accion.'' AS mensaje;'
END;
.output stdout
.read _tmp_migrate_seccion2.sql
