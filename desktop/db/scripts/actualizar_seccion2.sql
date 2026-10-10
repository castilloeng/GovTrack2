-- ============================================================================
-- Script: actualizar_seccion2.sql
-- Proposito: Agrega el campo MUNICIPIO a la tabla Seccion2 SOLO si no
--            existe, y asigna los valores segun la seccion:
--            SECCION >= 1000 -> TAPACHULA
--            SECCION < 1000  -> CACAHOATAN
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
--   sqlite3 "db\GovTrackDB.db" "SELECT MUNICIPIO, COUNT(*) FROM Seccion2 GROUP BY MUNICIPIO;"
-- ============================================================================

.output _tmp_migrate_seccion2.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Seccion2') WHERE name='MUNICIPIO') = 0
    THEN 'ALTER TABLE Seccion2 ADD COLUMN MUNICIPIO TEXT;'
    ELSE 'SELECT ''La columna MUNICIPIO ya existe en Seccion2. No se requiere accion.'' AS mensaje;'
END;
.output stdout
.read _tmp_migrate_seccion2.sql

UPDATE Seccion2 SET MUNICIPIO = 'TAPACHULA' WHERE CAST(SECCION AS INTEGER) >= 1000 AND (MUNICIPIO IS NULL OR MUNICIPIO = '');
UPDATE Seccion2 SET MUNICIPIO = 'CACAHOATAN' WHERE CAST(SECCION AS INTEGER) < 1000 AND (MUNICIPIO IS NULL OR MUNICIPIO = '');

SELECT 'Actualizacion completada.' AS mensaje;
SELECT MUNICIPIO, COUNT(*) AS registros FROM Seccion2 GROUP BY MUNICIPIO;
