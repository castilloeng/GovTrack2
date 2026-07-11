const { ipcMain, dialog } = require('electron');
const path = require('path');
const XLSX = require('xlsx');
const db = require('./db');

function setupIpcHandlers() {
// --- Lectura de Contactos con filtro ---
ipcMain.handle('get-contactos', (event, filtro) => {
  if (filtro && filtro.trim() !== "") {
    return db.prepare('SELECT * FROM Contacto WHERE NOMBRE LIKE ?').all(`%${filtro}%`);
  } else {
    return db.prepare('SELECT * FROM Contacto').all();
  }
});

// --- Lectura de Seccion2 con filtro ---
ipcMain.handle('get-secciones', (event, filtro) => {
  let rows;
  if (filtro && filtro.trim() !== "") {
    rows = db.prepare('SELECT * FROM Seccion2 WHERE SECCION LIKE ?').all(`%${filtro}%`);
  } else {
    rows = db.prepare('SELECT * FROM Seccion2').all();
  }
  return rows.map(r => ({
    ...r,
    PARTIDOS: r.PARTIDOS ? JSON.parse(r.PARTIDOS) : {}
  }));
});

// --- Lectura de Colonias con filtro ---
ipcMain.handle('get-colonias2', (event, filtro) => {
  if (filtro && filtro.trim() !== "") {
    return db.prepare('SELECT * FROM Colonias WHERE NOMBRE_COLONIA LIKE ?').all(`%${filtro}%`);
  } else {
    return db.prepare('SELECT * FROM Colonias').all();
  }
});

// --- Lectura de Colonias con filtro ---
ipcMain.handle('get-colonias', (event, filtro) => {
  if (filtro && filtro.trim() !== "") {
    return db.prepare('SELECT * FROM Colonias WHERE SECCION LIKE ?').all(`%${filtro}%`);
  } else {
    return db.prepare('SELECT * FROM Colonias').all();
  }
});

// --- Lectura de ContactoDet con filtro ---
ipcMain.handle('get-lideres', (event, filtro) => {
  if (filtro && filtro.trim() !== "") {
    return db.prepare('SELECT * FROM ContactoDet WHERE COLONIA LIKE ?').all(`%${filtro}%`);
  } else {
    return db.prepare('SELECT * FROM ContactoDet').all();
  }
});

ipcMain.handle('get-lideres2', (event, { colonia, seccion }) => {
  if (colonia && seccion) {
    return db.prepare('SELECT * FROM ContactoDet WHERE COLONIA LIKE ? AND SECCION LIKE ?')
             .all(`%${colonia}%`, `%${seccion}%`);
  } else if (colonia) {
    return db.prepare('SELECT * FROM ContactoDet WHERE COLONIA LIKE ?')
             .all(`%${colonia}%`);
  } else if (seccion) {
    return db.prepare('SELECT * FROM ContactoDet WHERE SECCION LIKE ?')
             .all(`%${seccion}%`);
  } else {
    return db.prepare('SELECT * FROM ContactoDet').all();
  }
});



// --- Lectura de ContactoDet con filtro ---
ipcMain.handle('get-contactosdet', (event, filtro) => {
  if (filtro && filtro.trim() !== "") {
    return db.prepare('SELECT * FROM ContactoDet WHERE NOMBRE LIKE ?').all(`%${filtro}%`);
  } else {
    return db.prepare('SELECT * FROM ContactoDet').all();
  }
});

ipcMain.handle('insert-contactodet', (event, data) => {
  const stmt = db.prepare(`
    INSERT INTO ContactoDet 
    (NOMBRE, TELEFONO, COLONIA, SECCION, NUM_PERSONAS, OBSERVACIONES, OPERADOR_ENLACE1, TELEFONO1, OPERADOR_ENLACE2, TELEFONO2)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    data.NOMBRE,
    data.TELEFONO,
    data.COLONIA,
    data.SECCION,
    data.NUM_PERSONAS,
    data.OBSERVACIONES,
    data.OPERADOR_ENLACE1,
    data.TELEFONO1,
    data.OPERADOR_ENLACE2,
    data.TELEFONO2
  );
  return true;
});


// --- Insertar nuevo Contacto ---
ipcMain.handle('insert-contacto', (event, data) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO Contacto (NOMBRE, TELEFONO)
      VALUES (?, ?)
    `);
    stmt.run(data.NOMBRE.toUpperCase(), data.TELEFONO); // nombre en mayúsculas
    return { success: true };
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'El teléfono ya está registrado.' };
    }
    return { success: false, error: err.message };
  }
});
}

// --- Importar colonias desde Excel ---

ipcMain.handle('select-excel-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-excel-sheets', (event, filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    return workbook.SheetNames;
  } catch (err) {
    return { error: 'Error al leer el archivo: ' + err.message };
  }
});

ipcMain.handle('read-excel-preview', (event, { filePath, sheetName }) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const name = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length < 2) {
      return { error: 'La pestaña "' + name + '" no tiene suficientes filas (encabezado + datos).' };
    }

    const headers = data[0].map(h => String(h).trim());
    const previewRows = data.slice(1, 11).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
      return obj;
    });

    const totalRows = data.length - 1;
    return { headers, previewRows, totalRows, sheetName: name };
  } catch (err) {
    return { error: 'Error al leer el archivo: ' + err.message };
  }
});

ipcMain.handle('import-excel-data', (event, { filePath, sheetName, mapping, duplicateAction, fixedMunicipio }) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const name = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length < 2) {
      return { success: false, error: 'La pestaña "' + name + '" no tiene datos.' };
    }

    const headers = data[0].map(h => String(h).trim());
    const dbColumns = ['SECCION', 'TIPO_SECCION', 'TIPO_COLONIA', 'NOMBRE_COLONIA', 'CP', 'MUNICIPIO'];

    const insertStmt = db.prepare(`
      INSERT INTO Colonias (SECCION, TIPO_SECCION, TIPO_COLONIA, NOMBRE_COLONIA, CP, MUNICIPIO)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const countStmt = db.prepare(`SELECT COUNT(*) AS cnt FROM Colonias WHERE SECCION=? AND NOMBRE_COLONIA=?`);

    let insertados = 0;
    let duplicados = 0;
    let errores = 0;

    const transaction = db.transaction(() => {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const record = {};

        for (const [excelCol, dbCol] of Object.entries(mapping)) {
          if (dbCol === '__ignore__') continue;
          const colIndex = headers.indexOf(excelCol);
          if (colIndex !== -1) {
            record[dbCol] = row[colIndex] !== undefined ? String(row[colIndex]).trim() : '';
          }
        }

        // Override MUNICIPIO with fixed value if provided
        if (fixedMunicipio && fixedMunicipio.trim() !== '') {
          record.MUNICIPIO = fixedMunicipio.trim().toUpperCase();
        }

        // Ensure all DB columns have a value (default empty string)
        for (const col of dbColumns) {
          if (!record[col]) record[col] = '';
        }

        // Duplicate check
        if (record.SECCION && record.NOMBRE_COLONIA) {
          const existing = countStmt.get(record.SECCION, record.NOMBRE_COLONIA);
          if (existing.cnt > 0) {
            if (duplicateAction === 'skip') { duplicados++; continue; }
            if (duplicateAction === 'replace') {
              db.prepare(`DELETE FROM Colonias WHERE SECCION=? AND NOMBRE_COLONIA=?`)
                .run(record.SECCION, record.NOMBRE_COLONIA);
            }
          }
        }

        try {
          insertStmt.run(record.SECCION, record.TIPO_SECCION, record.TIPO_COLONIA,
                         record.NOMBRE_COLONIA, record.CP, record.MUNICIPIO);
          insertados++;
        } catch (err) {
          errores++;
        }
      }
    });

    transaction();
    return { success: true, insertados, duplicados, errores };
  } catch (err) {
    return { success: false, error: 'Error al importar: ' + err.message };
  }
});

// --- Importar secciones desde Excel ---

ipcMain.handle('import-seccion-data', (event, { filePath, sheetName, mapping, duplicateAction }) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const name = sheetName || workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length < 2) {
      return { success: false, error: 'La pestaña "' + name + '" no tiene datos.' };
    }

    const headers = data[0].map(h => String(h).trim());
    const dbColumns = ['SECCION', 'TIPO', 'LN', 'PARTIDOS', 'UBICACION', 'SECTOR'];

    const insertStmt = db.prepare(`
      INSERT INTO Seccion2 (SECCION, TIPO, LN, PARTIDOS, UBICACION, SECTOR)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const countStmt = db.prepare(`SELECT COUNT(*) AS cnt FROM Seccion2 WHERE SECCION=? AND TIPO=?`);

    let insertados = 0;
    let duplicados = 0;
    let errores = 0;

    const transaction = db.transaction(() => {
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const record = {};
        const partidosAcc = {};

        for (const [excelCol, dbCol] of Object.entries(mapping)) {
          if (dbCol === '__ignore__') continue;
          const colIndex = headers.indexOf(excelCol);
          if (colIndex === -1) continue;
          const val = row[colIndex] !== undefined ? String(row[colIndex]).trim() : '';

          if (dbCol === 'PARTIDOS') {
            partidosAcc[excelCol] = val;
          } else {
            record[dbCol] = val;
          }
        }

        record.PARTIDOS = Object.keys(partidosAcc).length > 0 ? JSON.stringify(partidosAcc) : '{}';

        for (const col of dbColumns) {
          if (!record[col]) record[col] = '';
        }

        if (record.SECCION && record.TIPO) {
          const existing = countStmt.get(record.SECCION, record.TIPO);
          if (existing.cnt > 0) {
            if (duplicateAction === 'skip') { duplicados++; continue; }
            if (duplicateAction === 'replace') {
              db.prepare(`DELETE FROM Seccion2 WHERE SECCION=? AND TIPO=?`)
                .run(record.SECCION, record.TIPO);
            }
          }
        }

        try {
          insertStmt.run(record.SECCION, record.TIPO, record.LN,
                         record.PARTIDOS, record.UBICACION, record.SECTOR);
          insertados++;
        } catch (err) {
          errores++;
        }
      }
    });

    transaction();
    return { success: true, insertados, duplicados, errores };
  } catch (err) {
    return { success: false, error: 'Error al importar: ' + err.message };
  }
});

module.exports = { setupIpcHandlers };