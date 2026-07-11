// Cargar municipios
async function cargarMunicipios() {
  const municipios = await window.api.getColoniasMunicipios();
  const select = document.getElementById('municipio');
  municipios.forEach(m => {
    const option = document.createElement('option');
    option.value = m.MUNICIPIO;
    option.textContent = m.MUNICIPIO;
    select.appendChild(option);
  });
}

// Cargar lista de colonias en el <select> filtradas por municipio
async function cargarColonias() {
  const municipio = document.getElementById('municipio').value;
  const colonias = await window.api.getColonias({ municipio });

  // Filtrar colonias únicas por combinación "NOMBRE_COLONIA - SECCION"
  const coloniasUnicas = [];
  const claves = new Set();

  colonias.forEach(col => {
    const clave = `${col.NOMBRE_COLONIA} - ${col.SECCION}`;
    if (!claves.has(clave)) {
      claves.add(clave);
      coloniasUnicas.push({
        nombre: col.NOMBRE_COLONIA,
        seccion: col.SECCION
      });
    }
  });

  // Ordenar por nombre de colonia (alfabético)
  coloniasUnicas.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const select = document.getElementById("colonia");
  select.innerHTML = "<option value=''>-- Selecciona --</option>";

  coloniasUnicas.forEach(col => {
    const opt = document.createElement("option");
    opt.value = col.seccion;                        // ✅ value = SECCION
    opt.textContent = `${col.nombre} - ${col.seccion}`; // texto visible = "Colonia - Sección"
    select.appendChild(opt);
  });

  document.getElementById('datos-seccion').innerHTML = '';
  document.getElementById('lista-lideres').innerHTML = '';
}





// Al seleccionar una colonia (por su sección)
async function seleccionarColonia() {
  const select = document.getElementById('colonia');

  const seccionSeleccionada = select.value; // value = SECCION
  const coloniaSeleccionadaTexto = select.options[select.selectedIndex].text; 
  // texto visible = "Colonia - Sección"

  if (seccionSeleccionada === "") return;

  // Dividir el texto en "Colonia - Sección"
  const partes = coloniaSeleccionadaTexto.split(" - ");
  const coloniaNombre = partes[0].trim(); // primera parte = nombre de la colonia

  // Obtener datos de la sección (extraer solo la parte numérica para secciones compuestas)
  const seccionBase = seccionSeleccionada.match(/^\d+/)?.[0] || seccionSeleccionada;
  const secciones = await window.api.getSecciones(seccionBase);
  const contenedor = document.getElementById('datos-seccion');
  contenedor.innerHTML = '';

  secciones.forEach(s => {
    const div = document.createElement('div');
    div.classList.add('mb-2', 'p-2', 'border', 'rounded', 'bg-light');
    div.innerHTML = `
      <p><strong>Ubicación:</strong> ${s.UBICACION}</p>
      <p><strong>=== RESULTADOS ===</strong></p>    
      ${Object.entries(s.PARTIDOS || {}).map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`).join('')}
      <p><strong>Sección:</strong> ${s.SECCION}</p>
      <p><strong>Tipo:</strong> ${s.TIPO}</p>
      <p><strong>LN:</strong> ${s.LN}</p>
      <p><strong>Sector:</strong> ${s.SECTOR}</p>
    `;
    contenedor.appendChild(div);
  });

  // Pasar solo el nombre de la colonia a cargarLideres
  cargarLideres(coloniaNombre, seccionSeleccionada);
}



async function cargarLideres(Seccion, Colonia) {
  const lideres = await window.api.getLideres2(Seccion, Colonia);
  const contenedorLideres = document.getElementById('lista-lideres');
  contenedorLideres.innerHTML = '<h5>Líderes:</h5>';

  lideres.forEach(l => {
    const div = document.createElement('div');
    div.classList.add('mb-2', 'p-2', 'border', 'rounded', 'bg-light', 'item-lider');
    div.innerHTML = `
      <p><strong>Líder:</strong> ${l.NOMBRE} - Tel: ${l.TELEFONO}</p>
      <p><strong>Operadores:</strong> ${l.OPERADOR_ENLACE1} - Tel: ${l.TELEFONO1}, ${l.OPERADOR_ENLACE2} - Tel: ${l.TELEFONO2}</p>
    `;
    contenedorLideres.appendChild(div);
  });
}

// Inicializar
cargarMunicipios();
cargarColonias();
