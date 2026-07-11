// Función auxiliar para llenar un <select>
function llenarSelect(selectId, contactos) {
  const select = document.getElementById(selectId);
  select.innerHTML = '';

  // Nodo vacío al inicio
  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = '-- Seleccionar --';
  select.appendChild(opcionVacia);

  // Ordenar contactos por nombre
  const contactosOrdenados = contactos.sort((a, b) => 
    a.NOMBRE.localeCompare(b.NOMBRE)
  );

  // Agregar contactos ya ordenados
  contactosOrdenados.forEach(c => {
    const option = document.createElement('option');
    option.value = c.NOMBRE;
    option.textContent = c.NOMBRE;
    option.dataset.telefono = c.TELEFONO;
    select.appendChild(option);
  });
}

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

// Cargar lista de nombres desde Contacto, opcionalmente filtrados por municipio
async function cargarNombres(municipio) {
  const contactos = await window.api.getContactos({ filtro: '', municipio: municipio || '' });

  // Llenar ambos selects reutilizando la misma función
  llenarSelect('nombre', contactos);
  llenarSelect('operador_enlace1', contactos);
  llenarSelect('operador_enlace2', contactos);
}

// Al seleccionar nombre, llenar teléfono
function cargarTelefono() {
  const select = document.getElementById('nombre');
  const telefono = select.options[select.selectedIndex].dataset.telefono;
  document.getElementById('telefono').value = telefono;
}

// Al seleccionar nombre, llenar teléfono
function cargarTelefono1() {
  const select = document.getElementById('operador_enlace1');
  const telefono = select.options[select.selectedIndex].dataset.telefono;
  document.getElementById('telefono1').value = telefono;
}

// Al seleccionar nombre, llenar teléfono
function cargarTelefono2() {
  const select = document.getElementById('operador_enlace2');
  const telefono = select.options[select.selectedIndex].dataset.telefono;
  document.getElementById('telefono2').value = telefono;
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

  document.getElementById('colonia').innerHTML = '';

  // Recargar operadores filtrados por el municipio seleccionado
  await cargarNombres(municipio);
}

// Al seleccionar sección, cargar colonias filtradas por municipio
async function cargarColonias() {
  const seccion = document.getElementById('seccion').value;
  const municipio = document.getElementById('municipio').value;
  const colonias = await window.api.getColonias({ filtro: seccion, municipio });
  const select = document.getElementById('colonia');
  select.innerHTML = '';
  colonias.forEach(c => {
    const option = document.createElement('option');
    option.value = c.NOMBRE_COLONIA;
    option.textContent = c.NOMBRE_COLONIA;
    select.appendChild(option);
  });
}

// Guardar en ContactoDet
async function guardarContactoDet() {
  const data = {
    NOMBRE: document.getElementById('nombre').value,
    TELEFONO: document.getElementById('telefono').value,
    COLONIA: document.getElementById('colonia').value,
    SECCION: document.getElementById('seccion').value,
    MUNICIPIO: document.getElementById('municipio').value,
    NUM_PERSONAS: document.getElementById('num_personas').value,
    OBSERVACIONES: document.getElementById('observaciones').value,
    OPERADOR_ENLACE1: document.getElementById('operador_enlace1').value,
    TELEFONO1: document.getElementById('telefono1').value,
    OPERADOR_ENLACE2: document.getElementById('operador_enlace2').value,
    TELEFONO2: document.getElementById('telefono2').value
  };
  await window.api.insertContactoDet(data);
  alert("Contacto detallado guardado correctamente");

  // 🔄 Limpiar formulario
  document.getElementById('formContactoDet').reset();

  // Reiniciar selects con datos actualizados
  await cargarNombres();
  await cargarMunicipios();
  await cargarSecciones();

  // Limpiar campos dependientes
  document.getElementById('telefono').value = "";
  document.getElementById('telefono1').value = "";
  document.getElementById('telefono2').value = "";
  document.getElementById('colonia').innerHTML = "";
}

// Inicializar
cargarMunicipios();
cargarNombres();
cargarSecciones();