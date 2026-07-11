const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../db/GovTrackDB.db');
const db = new Database(dbPath);

db.prepare(`
  CREATE TABLE IF NOT EXISTS Contacto (
    NOMBRE TEXT,
    TELEFONO TEXT UNIQUE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS Seccion2 (
    SECCION TEXT,
    TIPO TEXT,
    LN TEXT,
    PARTIDOS TEXT,
    UBICACION TEXT,
    SECTOR TEXT
  )
`).run();

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
    TELEFONO2 TEXT
  )
`).run();


module.exports = db;