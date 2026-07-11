-- ============================================================================
-- Script: actualizar_contactos.sql
-- Proposito: Agrega el campo MUNICIPIO a las tablas Contacto y ContactoDet
--            SOLO si no existe, y asigna "TAPACHULA" a los registros
--            existentes.
-- Base de datos: GovTrackDB.db
-- Fecha: 2026-07-10
--
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
--
-- Como ejecutar:
--   Windows (cmd):
--     sqlite3 "db\GovTrackDB.db" < "db\scripts\actualizar_contactos.sql"
--
--   macOS / Linux:
--     sqlite3 db/GovTrackDB.db < db/scripts/actualizar_contactos.sql
--
--   Windows PowerShell:
--     Get-Content "db\scripts\actualizar_contactos.sql" | sqlite3 "db\GovTrackDB.db"
--
-- Verificacion posterior:
--   sqlite3 "db\GovTrackDB.db" "SELECT MUNICIPIO, COUNT(*) FROM Contacto GROUP BY MUNICIPIO;"
--   sqlite3 "db\GovTrackDB.db" "SELECT MUNICIPIO, COUNT(*) FROM ContactoDet GROUP BY MUNICIPIO;"
-- ============================================================================

.output _tmp_migrate_contactos.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Contacto') WHERE name='MUNICIPIO') = 0
    THEN 'ALTER TABLE Contacto ADD COLUMN MUNICIPIO TEXT;'
    ELSE 'SELECT ''La columna MUNICIPIO ya existe en Contacto. No se requiere accion.'' AS mensaje;'
END || '

' || CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('ContactoDet') WHERE name='MUNICIPIO') = 0
    THEN 'ALTER TABLE ContactoDet ADD COLUMN MUNICIPIO TEXT;'
    ELSE 'SELECT ''La columna MUNICIPIO ya existe en ContactoDet. No se requiere accion.'' AS mensaje;'
END;
.output stdout
.read _tmp_migrate_contactos.sql

UPDATE Contacto SET MUNICIPIO = 'TAPACHULA' WHERE MUNICIPIO IS NULL OR MUNICIPIO = '';
UPDATE ContactoDet SET MUNICIPIO = 'TAPACHULA' WHERE MUNICIPIO IS NULL OR MUNICIPIO = '';

SELECT 'Actualizacion completada.' AS mensaje;
SELECT 'Contacto' AS tabla, MUNICIPIO, COUNT(*) AS registros FROM Contacto GROUP BY MUNICIPIO
UNION ALL
SELECT 'ContactoDet', MUNICIPIO, COUNT(*) FROM ContactoDet GROUP BY MUNICIPIO;
