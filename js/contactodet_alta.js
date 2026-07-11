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

// Cargar lista de nombres desde Contacto
async function cargarNombres() {
  const contactos = await window.api.getContactos("");

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

// Al seleccionar sección, cargar colonias
async function cargarColonias() {
  const seccion = document.getElementById('seccion').value;
  const colonias = await window.api.getColonias(seccion);
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
  await cargarSecciones();

  // Limpiar campos dependientes
  document.getElementById('telefono').value = "";
  document.getElementById('telefono1').value = "";
  document.getElementById('telefono2').value = "";
  document.getElementById('colonia').innerHTML = "";
}

// Inicializar
cargarNombres();
cargarSecciones();
