let secciones = [];        // arreglo global
let paginaActual = 1;
const registrosPorPagina = 15;

async function cargarSecciones() {
  const filtro = document.getElementById('filtro').value;
  secciones = await window.api.getSecciones(filtro); // guardamos en global
  mostrarPagina(1); // mostramos la primera página
}

function mostrarPagina(pagina) {
  paginaActual = pagina;
  const inicio = (pagina - 1) * registrosPorPagina;
  const fin = inicio + registrosPorPagina;
  const datos = secciones.slice(inicio, fin);

  // Obtener claves de partidos únicas (preservando orden de aparición)
  const partyKeys = [];
  const seen = new Set();
  datos.forEach(s => {
    if (s.PARTIDOS) {
      Object.keys(s.PARTIDOS).forEach(k => {
        if (!seen.has(k)) { seen.add(k); partyKeys.push(k); }
      });
    }
  });

  // Generar thead dinámico
  document.getElementById('thead-secciones').innerHTML = `<tr>
    <th>SECCION</th>
    <th>TIPO</th>
    <th>LN</th>
    ${partyKeys.map(k => `<th>${k}</th>`).join('')}
    <th>UBICACION</th>
    <th>SECTOR</th>
  </tr>`;

  // Generar tbody dinámico
  const tbody = document.getElementById('tabla-secciones');
  tbody.innerHTML = datos.map(s => `
    <tr>
      <td>${s.SECCION}</td>
      <td>${s.TIPO}</td>
      <td>${s.LN}</td>
      ${partyKeys.map(k => `<td>${(s.PARTIDOS && s.PARTIDOS[k]) || ''}</td>`).join('')}
      <td>${s.UBICACION}</td>
      <td>${s.SECTOR}</td>
    </tr>`).join("");

  renderPaginacion();
}

function renderPaginacion() {
  const totalPaginas = Math.ceil(secciones.length / registrosPorPagina);
  const paginacion = document.getElementById("paginacion");
  paginacion.innerHTML = "";

  // Botón "Anterior"
  if (paginaActual > 1) {
    paginacion.innerHTML += `
      <li class="page-item">
        <a class="page-link" href="#" onclick="mostrarPagina(${paginaActual - 1})">Anterior</a>
      </li>`;
  }

  const rango = 3; // páginas visibles a cada lado
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
cargarSecciones();
