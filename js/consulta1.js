// Cargar lista de secciones desde Colonias
async function cargarSecciones() {
  const colonias = await window.api.getColonias("");
  const select = document.getElementById('seccion');
  const seccionesUnicas = [...new Set(colonias.map(c => c.SECCION))];
  select.innerHTML = '';

  // Nodo vacío al inicio
  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = '-- Seleccionar --';
  select.appendChild(opcionVacia);

  seccionesUnicas.forEach(s => {
    const option = document.createElement('option');
    option.value = s;
    option.textContent = s;
    select.appendChild(option);
  });
}

// Cargar lista de secciones y mostrar en divs
async function cargarDatosSeccion() {
  const filtro = document.getElementById('seccion');
  const secciones = await window.api.getSecciones(filtro.value);
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

  const colonias = await window.api.getColonias(filtro.value);
  const contenedorColonias = document.getElementById('lista-colonias');
  contenedorColonias.innerHTML = '<h5>Colonias:</h5>';

colonias.forEach(c => {
  const div = document.createElement('div');
  div.classList.add('list-group-item','list-group-item-action','item-colonia');
  div.innerHTML = `<p>${c.NOMBRE_COLONIA}</p>`;
  div.onclick = () => {
    // quitar selección previa
    document.querySelectorAll('.item-colonia').forEach(el => el.classList.remove('active'));
    // marcar la colonia actual con Bootstrap
    div.classList.add('active');
    // cargar líderes
    cargarLideres(c.NOMBRE_COLONIA);
  };
  contenedorColonias.appendChild(div);
});

}

// Nueva función para cargar líderes
async function cargarLideres(idColonia) {
  const lideres = await window.api.getLideres(idColonia);
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
cargarSecciones();
