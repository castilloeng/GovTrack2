const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../db/GovTrackDB.db');
const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS Contacto (
    NOMBRE TEXT,
    TELEFONO TEXT UNIQUE,
    MUNICIPIO TEXT
  )
`).run();

// Migracion: agregar columna MUNICIPIO si no existe (bases existentes)
const colMunContacto = db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('Contacto') WHERE name='MUNICIPIO'`).get();
if (colMunContacto.cnt === 0) {
  db.prepare(`ALTER TABLE Contacto ADD COLUMN MUNICIPIO TEXT`).run();
}

db.prepare(`
  CREATE TABLE IF NOT EXISTS Seccion2 (
    SECCION TEXT,
    TIPO TEXT,
    LN TEXT,
    PARTIDOS TEXT,
    UBICACION TEXT,
    SECTOR TEXT,
    MUNICIPIO TEXT
  )
`).run();

// Migracion: agregar columna MUNICIPIO si no existe (bases existentes)
const colMun = db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('Seccion2') WHERE name='MUNICIPIO'`).get();
if (colMun.cnt === 0) {
  db.prepare(`ALTER TABLE Seccion2 ADD COLUMN MUNICIPIO TEXT`).run();
}

// Crear tabla Colonias si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS Colonias (
    SECCION TEXT,
    TIPO_SECCION TEXT,
    TIPO_COLONIA TEXT,
    NOMBRE_COLONIA TEXT,
    CP TEXT,
    MUNICIPIO TEXT
  )
`).run();

// Crear tabla ContactoDet si no existe
db.prepare(`
  CREATE TABLE IF NOT EXISTS ContactoDet (
    NOMBRE TEXT,
    TELEFONO TEXT,
    COLONIA TEXT,
    SECCION TEXT,
    NUM_PERSONAS TEXT,
    OBSERVACIONES TEXT,
    OPERADOR_ENLACE1 TEXT,
    TELEFONO1 TEXT,
    OPERADOR_ENLACE2 TEXT,
    TELEFONO2 TEXT,
    MUNICIPIO TEXT
  )
`).run();

// Migracion: agregar columna MUNICIPIO si no existe (bases existentes)
const colMunContactoDet = db.prepare(`SELECT COUNT(*) AS cnt FROM pragma_table_info('ContactoDet') WHERE name='MUNICIPIO'`).get();
if (colMunContactoDet.cnt === 0) {
  db.prepare(`ALTER TABLE ContactoDet ADD COLUMN MUNICIPIO TEXT`).run();
}


module.exports = db;