// Cargar lista de enlaces desde tabla Contacto
async function cargarEnlaces() {

  const contactos = await window.api.getContactos(""); // trae todos de Contacto
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
}

// Mostrar colonias asociadas al enlace seleccionado
async function cargarColoniasPorEnlace() {
  const enlace = document.getElementById('enlace').value;
  if (!enlace) return;

  const contactosDet = await window.api.getContactosDet(""); // trae todos de ContactoDet
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
cargarEnlaces();
