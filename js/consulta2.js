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

// Cargar lista de enlaces desde tabla Contacto filtrados por municipio
async function cargarEnlaces() {
  const municipio = document.getElementById('municipio').value;
  const contactos = await window.api.getContactos({ filtro: '', municipio });
  const select = document.getElementById('enlace');
  select.innerHTML = '';

  // opción vacía
  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = '-- Seleccionar --';
  select.appendChild(opcionVacia);

  // ordenar por nombre
  contactos.sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE));

  contactos.forEach(c => {
    const option = document.createElement('option');
    option.value = c.NOMBRE;
    option.textContent = `${c.NOMBRE} (${c.TELEFONO})`;
    select.appendChild(option);
  });

  document.getElementById('lista-colonias').innerHTML = '';
}

// Mostrar colonias asociadas al enlace seleccionado
async function cargarColoniasPorEnlace() {
  const enlace = document.getElementById('enlace').value;
  const municipio = document.getElementById('municipio').value;
  if (!enlace) return;

  const contactosDet = await window.api.getContactosDet({ filtro: '', municipio });
  const colonias = contactosDet.filter(c => c.OPERADOR_ENLACE1 === enlace || c.OPERADOR_ENLACE2 === enlace);

  const contenedor = document.getElementById('lista-colonias');
  contenedor.innerHTML = '<h5>Colonias:</h5>';

  if (colonias.length === 0) {
    contenedor.innerHTML += `<p>No se encontraron colonias para este enlace.</p>`;
    return;
  }

  colonias.forEach(c => {
    const div = document.createElement('div');
    div.classList.add('list-group-item','list-group-item-action','mb-2','p-2','border','rounded','bg-light');
    div.innerHTML = `<strong>${c.COLONIA}</strong> (Sección ${c.SECCION})`;
    contenedor.appendChild(div);
  });
}

// Inicializar
cargarMunicipios();
cargarEnlaces();