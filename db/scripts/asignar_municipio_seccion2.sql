-- ============================================================================
-- Script: asignar_municipio_seccion2.sql
-- Proposito: Asigna MUNICIPIO a la tabla Seccion2 segun la seccion:
--            SECCION >= 1000 -> TAPACHULA
--            SECCION < 1000  -> CACAHOATAN
-- Base de datos: GovTrackDB.db
-- Fecha: 2026-07-10
--
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
--
-- Como ejecutar:
--   Windows (cmd):
--     sqlite3 "db\GovTrackDB.db" < "db\scripts\asignar_municipio_seccion2.sql"
--
--   macOS / Linux:
--     sqlite3 db/GovTrackDB.db < db/scripts/asignar_municipio_seccion2.sql
--
--   Windows PowerShell:
--     Get-Content "db\scripts\asignar_municipio_seccion2.sql" | sqlite3 "db\GovTrackDB.db"
--
-- Verificacion posterior:
--   sqlite3 "db\GovTrackDB.db" "SELECT MUNICIPIO, COUNT(*) FROM Seccion2 GROUP BY MUNICIPIO;"
-- ============================================================================

UPDATE Seccion2 SET MUNICIPIO = 'TAPACHULA' WHERE CAST(SECCION AS INTEGER) >= 1000;
UPDATE Seccion2 SET MUNICIPIO = 'CACAHOATAN' WHERE CAST(SECCION AS INTEGER) < 1000;

SELECT 'Actualizacion completada.' AS mensaje;
SELECT MUNICIPIO, COUNT(*) AS registros FROM Seccion2 GROUP BY MUNICIPIO;
