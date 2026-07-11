-- ============================================================================
-- Script: actualizar_seccion.sql
-- Proposito: Estandariza la tabla Seccion2:
--   - Agrega columna PARTIDOS si no existe (JSON)
--   - Migra datos de columnas individuales (PAN,PRI,PVEM,MORENA,PES) a PARTIDOS
--   - Elimina las columnas individuales de partidos
-- Compatibilidad: Windows (cmd.exe), macOS y Linux
-- ============================================================================

.output _tmp_seccion.sql
SELECT CASE
    WHEN (SELECT COUNT(*) FROM pragma_table_info('Seccion2') WHERE name='PARTIDOS') = 0
    THEN 'ALTER TABLE Seccion2 ADD COLUMN PARTIDOS TEXT;'
    ELSE 'SELECT ''PARTIDOS ya existe.'';'
END;
.output stdout
.read _tmp_seccion.sql

-- Migrar datos de columnas individuales a PARTIDOS (solo donde falte)
UPDATE Seccion2 SET PARTIDOS = json_object(
    'PAN',    COALESCE(NULLIF(PAN, ''), '0'),
    'PRI',    COALESCE(NULLIF(PRI, ''), '0'),
    'PVEM',   COALESCE(NULLIF(PVEM, ''), '0'),
    'MORENA', COALESCE(NULLIF(MORENA, ''), '0'),
    'PES',    COALESCE(NULLIF(PES, ''), '0')
)
WHERE (PARTIDOS IS NULL OR PARTIDOS = '')
  AND (COALESCE(PAN, '') != '' OR COALESCE(PRI, '') != '' OR COALESCE(PVEM, '') != ''
       OR COALESCE(MORENA, '') != '' OR COALESCE(PES, '') != '');

-- Recrear tabla sin columnas individuales de partidos
CREATE TABLE Seccion2_new (
    SECCION   TEXT,
    TIPO      TEXT,
    LN        TEXT,
    PARTIDOS  TEXT,
    UBICACION TEXT,
    SECTOR    TEXT
);

INSERT INTO Seccion2_new (SECCION, TIPO, LN, PARTIDOS, UBICACION, SECTOR)
SELECT SECCION, TIPO, LN, PARTIDOS, UBICACION, SECTOR FROM Seccion2;

DROP TABLE Seccion2;
ALTER TABLE Seccion2_new RENAME TO Seccion2;

SELECT 'Migracion completada.' AS resultado;
SELECT COUNT(*) AS registros FROM Seccion2;
