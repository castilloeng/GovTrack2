-- ============================================================================
-- Script: migrar_partidos.sql
-- Proposito: Agrega el campo PARTIDOS (TEXT, JSON) a la tabla Seccion2
--            SOLO si no existe, y migra los datos de las columnas
--            individuales (PAN, PRI, PVEM, MORENA, PES) al nuevo campo.
-- Base de datos: GovTrackDB.db
-- Fecha: 2026-07-10
--
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
--
-- Como ejecutar:
--   Windows (cmd):
--     sqlite3 "db\GovTrackDB.db" < "db\scripts\migrar_partidos.sql"
--
--   macOS / Linux:
--     sqlite3 db/GovTrackDB.db < db/scripts/migrar_partidos.sql
--
--   En Windows PowerShell NO funciona el operador "<".
--   Use cmd.exe o:
--     Get-Content "db\scripts\migrar_partidos.sql" | sqlite3 "db\GovTrackDB.db"
--
-- Verificacion posterior:
--   sqlite3 "db\GovTrackDB.db" "SELECT COUNT(*) AS migrados FROM Seccion2 WHERE PARTIDOS IS NOT NULL;"
--   Debe devolver la cantidad de registros con datos de partidos.
-- ============================================================================

.output _tmp_migrate.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Seccion2') WHERE name='PARTIDOS') = 0
    THEN 'ALTER TABLE Seccion2 ADD COLUMN PARTIDOS TEXT;

UPDATE Seccion2 SET PARTIDOS = json_object(
    ''PAN'', PAN,
    ''PRI'', PRI,
    ''PVEM'', PVEM,
    ''MORENA'', MORENA,
    ''PES'', PES
) WHERE PAN IS NOT NULL OR PRI IS NOT NULL OR PVEM IS NOT NULL OR MORENA IS NOT NULL OR PES IS NOT NULL;'
    ELSE 'SELECT ''La columna PARTIDOS ya existe. No se requiere accion.'' AS mensaje;'
END;
.output stdout
.read _tmp_migrate.sql
