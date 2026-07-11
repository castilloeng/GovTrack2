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

// Cargar lista de secciones desde Colonias filtradas por municipio
async function cargarSecciones() {
  const municipio = document.getElementById('municipio').value;
  const secciones = await window.api.getSeccionesPorMunicipio(municipio);
  const select = document.getElementById('seccion');
  select.innerHTML = '';

  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = '-- Seleccionar --';
  select.appendChild(opcionVacia);

  secciones.forEach(s => {
    const option = document.createElement('option');
    option.value = s.SECCION;
    option.textContent = s.SECCION;
    select.appendChild(option);
  });

  document.getElementById('lista-secciones').innerHTML = '';
  document.getElementById('lista-colonias').innerHTML = '';
  document.getElementById('lista-lideres').innerHTML = '';
}

// Cargar datos de la seccion seleccionada
async function cargarDatosSeccion() {
  const filtro = document.getElementById('seccion').value;
  const municipio = document.getElementById('municipio').value;
  if (!filtro) return;

  const secciones = await window.api.getSecciones(filtro);
  const contenedor = document.getElementById('lista-secciones');
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

  const colonias = await window.api.getColonias({ filtro, municipio });
  const contenedorColonias = document.getElementById('lista-colonias');
  contenedorColonias.innerHTML = '<h5>Colonias:</h5>';

  colonias.forEach(c => {
    const div = document.createElement('div');
    div.classList.add('list-group-item','list-group-item-action','item-colonia');
    div.innerHTML = `<p>${c.NOMBRE_COLONIA}</p>`;
    div.onclick = () => {
      document.querySelectorAll('.item-colonia').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      cargarLideres(c.NOMBRE_COLONIA);
    };
    contenedorColonias.appendChild(div);
  });
}

// Cargar líderes de una colonia
async function cargarLideres(idColonia) {
  const municipio = document.getElementById('municipio').value;
  const lideres = await window.api.getLideres({ filtro: idColonia, municipio });
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
cargarSecciones();