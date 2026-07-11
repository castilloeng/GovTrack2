const DB_COLUMNS = [
  { value: 'SECCION', label: 'SECCION' },
  { value: 'TIPO_SECCION', label: 'TIPO_SECCION' },
  { value: 'TIPO_COLONIA', label: 'TIPO_COLONIA' },
  { value: 'NOMBRE_COLONIA', label: 'NOMBRE_COLONIA' },
  { value: 'CP', label: 'CP' },
  { value: '__ignore__', label: '— No importar —' }
];

let currentHeaders = [];
let currentFilePath = null;
let currentSheetName = null;
let sheetsLoaded = false;

async function seleccionarArchivo() {
  const filePath = await window.api.selectExcelFile();
  if (!filePath) return;

  document.getElementById('archivo-label').textContent = filePath;
  currentFilePath = filePath;
  currentSheetName = null;
  sheetsLoaded = false;

  // Load sheet names
  const sheets = await window.api.getExcelSheets(filePath);
  if (sheets.error) {
    alert('Error: ' + sheets.error);
    return;
  }

  const selector = document.getElementById('sheet-selector');
  selector.innerHTML = '';
  sheets.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (i === 0) opt.selected = true;
    selector.appendChild(opt);
  });

  document.getElementById('sheet-section').style.display = 'block';
  document.getElementById('preview-section').style.display = 'none';

  // Load preview for first sheet
  await cargarPreview(sheets[0]);
}

async function cargarPreview(sheetName) {
  if (!currentFilePath) return;

  currentSheetName = sheetName;
  const result = await window.api.readExcelPreview({
    filePath: currentFilePath,
    sheetName: sheetName
  });

  if (result.error) {
    alert('Error: ' + result.error);
    return;
  }

  currentHeaders = result.headers;
  document.getElementById('total-rows-badge').textContent = result.totalRows + ' filas encontradas';
  mostrarPreview(result.headers, result.previewRows);
  generarMapping(result.headers);
  document.getElementById('preview-section').style.display = 'block';
}

async function cambiarPestana() {
  const selector = document.getElementById('sheet-selector');
  const name = selector.value;
  if (name) {
    await cargarPreview(name);
  }
}

function mostrarPreview(headers, rows) {
  const thead = document.getElementById('preview-headers');
  thead.innerHTML = '<tr>' + headers.map(h => '<th>' + escHtml(h) + '</th>').join('') + '</tr>';

  const tbody = document.getElementById('preview-rows');
  tbody.innerHTML = rows.map(row => {
    return '<tr>' + headers.map(h => '<td>' + escHtml(row[h] || '') + '</td>').join('') + '</tr>';
  }).join('');
}

function generarMapping(excelHeaders) {
  const container = document.getElementById('mapping-container');
  container.innerHTML = '';

  excelHeaders.forEach(h => {
    const div = document.createElement('div');
    div.className = 'mapping-row';

    const label = document.createElement('span');
    label.className = 'badge badge-excel';
    label.textContent = h;
    label.style.padding = '6px 10px';
    label.style.minWidth = '150px';
    label.style.textAlign = 'left';

    const arrow = document.createElement('span');
    arrow.className = 'mapping-arrow';
    arrow.textContent = '→';

    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.dataset.excelCol = h;

    // Auto-detect mapping
    let matched = false;
    DB_COLUMNS.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col.value;
      opt.textContent = col.label;
      if (col.value !== '__ignore__' && h.toUpperCase().replace(/[^A-Z0-9_]/g, '') === col.value) {
        opt.selected = true;
        matched = true;
      }
      select.appendChild(opt);
    });

    if (!matched) {
      // Try partial match
      const hClean = h.toUpperCase().replace(/[^A-Z0-9_ÁÉÍÓÚÑ]/g, '').trim();
      for (const col of DB_COLUMNS) {
        if (col.value === '__ignore__') continue;
        if (hClean.includes(col.value) || col.value.includes(hClean)) {
          select.value = col.value;
          break;
        }
      }
    }

    div.appendChild(label);
    div.appendChild(arrow);
    div.appendChild(select);
    container.appendChild(div);
  });
}

function obtenerMapping() {
  const mapping = {};
  document.querySelectorAll('#mapping-container select').forEach(sel => {
    mapping[sel.dataset.excelCol] = sel.value;
  });
  return mapping;
}

async function importarDatos() {
  if (!currentFilePath) {
    alert('Selecciona un archivo Excel primero.');
    return;
  }

  const mapping = obtenerMapping();
  const mappedFields = Object.values(mapping).filter(v => v !== '__ignore__');
  if (mappedFields.length === 0) {
    alert('Debes mapear al menos un campo antes de importar.');
    return;
  }

  const duplicateAction = document.getElementById('duplicate-action').value;
  const fixedMunicipio = document.getElementById('fixed-municipio').value.trim();

  const btn = document.getElementById('btn-importar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Importando...';

  try {
    const result = await window.api.importExcelData({
      filePath: currentFilePath,
      sheetName: currentSheetName,
      mapping,
      duplicateAction,
      fixedMunicipio
    });

    const section = document.getElementById('result-section');
    section.style.display = 'block';

    if (result.success) {
      section.innerHTML = `
        <div class="alert alert-success">
          <h5><i class="bi bi-check-circle-fill"></i> Importación completada</h5>
          <ul class="mb-0">
            <li><strong>Insertados:</strong> ${result.insertados}</li>
            <li><strong>Duplicados omitidos:</strong> ${result.duplicados}</li>
            <li><strong>Errores:</strong> ${result.errores}</li>
          </ul>
        </div>`;
    } else {
      section.innerHTML = `
        <div class="alert alert-danger">
          <h5><i class="bi bi-x-circle-fill"></i> Error</h5>
          <p class="mb-0">${escHtml(result.error)}</p>
        </div>`;
    }
  } catch (err) {
    document.getElementById('result-section').innerHTML = `
      <div class="alert alert-danger">
        <h5><i class="bi bi-x-circle-fill"></i> Error inesperado</h5>
        <p class="mb-0">${escHtml(err.message)}</p>
      </div>`;
    document.getElementById('result-section').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-upload"></i> Importar datos';
  }
}

function resetear() {
  currentFilePath = null;
  currentHeaders = [];
  currentSheetName = null;
  sheetsLoaded = false;
  document.getElementById('archivo-label').textContent = 'Ningún archivo seleccionado';
  document.getElementById('sheet-section').style.display = 'none';
  document.getElementById('sheet-selector').innerHTML = '<option value="">Cargando pestañas...</option>';
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('preview-headers').innerHTML = '';
  document.getElementById('preview-rows').innerHTML = '';
  document.getElementById('mapping-container').innerHTML = '';
  document.getElementById('fixed-municipio').value = '';
  document.getElementById('result-section').style.display = 'none';
  document.getElementById('result-section').innerHTML = '';
  document.getElementById('btn-importar').disabled = false;
  document.getElementById('btn-importar').innerHTML = '<i class="bi bi-upload"></i> Importar datos';
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
