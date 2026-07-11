async function cargarMunicipios() {
  const municipios = await window.api.getColoniasMunicipios();
  const select = document.getElementById('municipio');
  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = '-- Seleccionar --';
  select.appendChild(opcionVacia);
  municipios.forEach(m => {
    const option = document.createElement('option');
    option.value = m.MUNICIPIO;
    option.textContent = m.MUNICIPIO;
    select.appendChild(option);
  });
}

async function guardarOperador() {
  const nombreInput = document.getElementById('nombre');
  const telefonoInput = document.getElementById('telefono');
  const municipio = document.getElementById('municipio').value;
  const mensaje = document.getElementById('mensaje');

  // convertir nombre a mayúsculas
  const nombre = nombreInput.value.trim().toUpperCase();
  const telefono = telefonoInput.value.trim();

  if (!nombre || !telefono || !municipio) {
    mensaje.innerHTML = `<div class="alert alert-warning">Debe llenar todos los campos.</div>`;
    return;
  }

  // validar que el teléfono no exista
  const contactos = await window.api.getContactos(""); // trae todos de Contacto
  const existe = contactos.some(c => c.TELEFONO === telefono);

  if (existe) {
    mensaje.innerHTML = `<div class="alert alert-danger">El teléfono ya está registrado.</div>`;
    return;
  }

  // guardar en la base de datos
  try {
    await window.api.insertContacto({ NOMBRE: nombre, TELEFONO: telefono, MUNICIPIO: municipio });
    mensaje.innerHTML = `<div class="alert alert-success">Operador guardado correctamente.</div>`;
    nombreInput.value = '';
    telefonoInput.value = '';
  } catch (error) {
    mensaje.innerHTML = `<div class="alert alert-danger">Error al guardar: ${error.message}</div>`;
  }
}

// Inicializar
cargarMunicipios();
