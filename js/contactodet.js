let contactosDet = [];
let paginaActual = 1;
const registrosPorPagina = 10;

async function cargarContactosDet() {
  const filtro = document.getElementById('filtro').value;
  contactosDet = await window.api.getContactosDet(filtro); // datos reales
  mostrarPagina(1);
}

function mostrarPagina(pagina) {
  paginaActual = pagina;
  const inicio = (pagina - 1) * registrosPorPagina;
  const fin = inicio + registrosPorPagina;
  const datos = contactosDet.slice(inicio, fin);

  const tbody = document.getElementById('tabla-contactosdet');
  tbody.innerHTML = datos.map(c => `
    <tr>
      <td>${c.NOMBRE}</td>
      <td>${c.TELEFONO}</td>
      <td>${c.COLONIA}</td>
      <td>${c.SECCION}</td>
      <td>${c.NUM_PERSONAS}</td>
      <td>${c.OBSERVACIONES}</td>
      <td>${c.OPERADOR_ENLACE1}</td>
      <td>${c.TELEFONO1}</td>
      <td>${c.OPERADOR_ENLACE2}</td>
      <td>${c.TELEFONO2}</td>
    </tr>`).join("");

  renderPaginacion();
}

function renderPaginacion() {
  const totalPaginas = Math.ceil(contactosDet.length / registrosPorPagina);
  const paginacion = document.getElementById("paginacion");
  paginacion.innerHTML = "";

  // Botón "Anterior"
  if (paginaActual > 1) {
    paginacion.innerHTML += `
      <li class="page-item">
        <a class="page-link" href="#" onclick="mostrarPagina(${paginaActual - 1})">Anterior</a>
      </li>`;
  }

  const rango = 2; // páginas visibles a cada lado
  const inicio = Math.max(1, paginaActual - rango);
  const fin = Math.min(totalPaginas, paginaActual + rango);

  if (inicio > 1) {
    paginacion.innerHTML += `<li class="page-item"><a class="page-link" href="#" onclick="mostrarPagina(1)">1</a></li>`;
    if (inicio > 2) {
      paginacion.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
  }

  for (let i = inicio; i <= fin; i++) {
    paginacion.innerHTML += `
      <li class="page-item ${i === paginaActual ? 'active' : ''}">
        <a class="page-link" href="#" onclick="mostrarPagina(${i})">${i}</a>
      </li>`;
  }

  if (fin < totalPaginas) {
    if (fin < totalPaginas - 1) {
      paginacion.innerHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }
    paginacion.innerHTML += `<li class="page-item"><a class="page-link" href="#" onclick="mostrarPagina(${totalPaginas})">${totalPaginas}</a></li>`;
  }

  // Botón "Siguiente"
  if (paginaActual < totalPaginas) {
    paginacion.innerHTML += `
      <li class="page-item">
        <a class="page-link" href="#" onclick="mostrarPagina(${paginaActual + 1})">Siguiente</a>
      </li>`;
  }
}

// cargar todos al inicio
cargarContactosDet();
