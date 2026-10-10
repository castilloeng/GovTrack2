# Guía de diseño — GovTrack Web

Esta es la **referencia obligatoria** para construir cualquier interfaz de la versión web (`web/src/`). Toda pantalla nueva debe partir de estas reglas y de los diseños de `pantallas/`. Si una pantalla necesita algo que la guía no cubre, primero se agrega aquí y después se implementa.

- **Lienzo de diseño (original)**: https://claude.ai/artifact/NCEy3bEPtkJDFBemoG8SJs
- **Respaldo local**: `pantallas/*.dc.html` es el código de cada pantalla y `pantallas/canvas.json` el acomodo en el lienzo. Son maquetas estáticas en HTML con estilos en línea: sirven para copiar medidas, colores y estructura, no se importan en React.
- Los diseños aprobados **no se modifican**. Los cambios de estilo se hacen mediante los tokens de tema (ver "Tema configurable").

| Archivo | Pantalla |
|---|---|
| `pantallas/Login.dc.html` | Acceso con Google |
| `pantallas/Main.dc.html` | Panel del municipio |
| `pantallas/Operadores.dc.html` | Operadores y enlaces |
| `pantallas/Seccion.dc.html` | Detalle de sección (resultados y estructura) |
| `pantallas/Importar.dc.html` | Importar desde Excel |

`propuestas/*.html` son maquetas de pantallas nuevas en revisión; se documentan en §5 cuando se aprueban.

---

## 1. Principios generales

1. **Herramienta de trabajo, no folleto.** La información va primero: tablas densas pero legibles, pocos adornos, sin degradados ni ilustraciones.
2. **Siempre en contexto.** El usuario siempre ve en qué **municipio** y en qué **proceso electoral** está (barra superior). Todo dato mostrado se filtra por esos dos selectores.
3. **El vocabulario es el del dominio**: operador, enlace, sección, colonia, casilla, lista nominal, asignación y personas movilizadas. Nunca se usan los nombres de las tablas antiguas (`ContactoDet`, `Seccion2`).
4. **Los huecos se marcan.** Las secciones o colonias sin operador siempre se resaltan con la etiqueta de alerta ("Sin operador").
5. **Cifras de ejemplo.** Los diseños usan datos inventados; en la implementación todo sale de la API.

## 2. Estructura de página (layout)

- **Barra lateral** a la izquierda (`flex: 1 1 220px`, fondo `--side-bg`), con el logo "G" y estos grupos:
  - **General**: Panel
  - **Estructura**: Operadores y enlaces · Asignaciones
  - **Geografía y elección**: Secciones y colonias · Resultados · Prioridad
  - **Administración**: Importaciones · Usuarios · **Configuración** (ver §6) · API
  - Las opciones se muestran según el rol: `CONSULTA` no ve Administración ni los botones de alta/edición; `CAPTURISTA` no ve Usuarios ni Configuración.
- **Barra superior** blanca: selector de municipio, selector de proceso, búsqueda global (en el Panel) y, a la derecha, el usuario con su rol.
- **Contenido** (`flex: 999 1 560px`, `max-width` de 1200–1280 px, `padding: 28px`). La pantalla empieza con un título h1 y una descripción corta, y las acciones van a la derecha (la acción principal es el botón relleno).
- **Responsivo**: el sitio debe funcionar en celular, iPad y escritorio. Las reglas completas están en §8. En las maquetas, la barra lateral se apila arriba al angostar la pantalla; en la implementación se reemplaza por el menú de §8.
- **Patrón lista + detalle** (Operadores): la tabla a la izquierda (`flex: 999 1 480px`) y el panel de detalle a la derecha (`flex: 1 1 360px`). En pantallas angostas el detalle baja debajo de la tabla.

## 3. Tokens de diseño

Se implementan como variables CSS en `:root`. Los valores de color dependen del tema (§6); los demás son fijos.

### Neutros (fijos en todos los temas)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F4F5F2` | Fondo de la página |
| `--surface` | `#FFFFFF` | Tarjetas, barra superior |
| `--ink` | `#17201D` | Texto principal |
| `--muted` | `#55605B` | Texto secundario, encabezados de tabla (contraste ≥ 4.5:1 sobre blanco) |
| `--line` | `#DDE1DC` | Bordes de tarjetas y botones |
| `--line-soft` | `#EDF0EC` | Separadores de filas, fondo de barras de progreso |
| `--th-bg` | `#FAFBF9` | Fondo de encabezados y totales de tabla |
| `--input-border` | `#C9CFC9` | Bordes de inputs y botones secundarios |

### Estado (fijos)

| Token | Valor | Uso |
|---|---|---|
| `--ok-bg` / `--ok-fg` | = `--accent-soft` / `--accent` | Etiquetas "Cubierta", "Completada" |
| `--warn-bg` / `--warn-fg` | `#FBEADF` / `#8A3D12` | "Sin operador", "Falló", baja cobertura. En el tema **naranja** cambia a `#F8E3E6` / `#9B1C31` para no confundirse con el color principal. |

### Tipografía

- **Public Sans** (400, 500, 600, 700) para toda la interfaz.
- **IBM Plex Mono** (400, 500) con `font-variant-numeric: tabular-nums` para **toda cifra**: votos, lista nominal, teléfonos, números de sección y casillas. Las cifras van alineadas a la derecha en las tablas.
- Escala: h1 28–30 px/700 · h2 de tarjeta 17 px/700 · cuerpo 14 px · secundario 13 px · etiquetas y encabezados de tabla 12 px en MAYÚSCULAS con `letter-spacing: .05em` · KPI 30 px mono.
- Las cifras usan el formato de México: coma para miles y punto para decimales (`2,980`, `55.3 %`).

### Forma y espaciado

- Radios: tarjetas 10 px, botones e inputs 8 px, etiquetas 999 px (píldora).
- Separación de 16–24 px entre bloques y de 10–12 px entre controles. Celdas de tabla con `11px 14px`.
- Los objetivos táctiles miden **≥ 44 px** de alto (botones, inputs, pestañas); los botones compactos de filtro, 36–38 px.

## 4. Componentes

| Componente | Reglas |
|---|---|
| **Botón principal** | Fondo `--accent` con texto blanco. Hay uno por pantalla (o por tarjeta). |
| **Botón secundario** | Fondo blanco con borde `--input-border`. Una acción destructiva ("Dar de baja") usa texto `--warn-fg`, nunca un fondo rojo. |
| **Filtro / segmento** | Botones de 36–38 px; el activo va relleno con `--ink` y texto blanco, con `aria-pressed`. |
| **Tarjeta** | Fondo `--surface`, borde `--line` y radio de 10 px. El título h2 va arriba a la izquierda y las acciones a la derecha. |
| **KPI** | Tarjeta con etiqueta (13 px, muted), cifra mono de 30 px y una línea de contexto o una barra de progreso de 6 px. |
| **Tabla** | Encabezado en `--th-bg`, filas separadas por `--line-soft`, fila seleccionada con `--accent-soft`, pie con el texto "Mostrando X de Y" y paginación. |
| **Barra de cobertura/porcentaje** | Pista `--line-soft` y relleno `--accent` (o `--warn-fg` si está por debajo del umbral), siempre con su cifra al lado. |
| **Barras de resultados por partido** | Escala del color de acento a neutros (`--accent`, `--accent-2`, `--accent-3`, `--accent-4`), ordenadas de mayor a menor. Llevan el nombre y el porcentaje. No se usan los colores oficiales de cada partido para no sesgar la lectura. |
| **Etiqueta (tag)** | Píldora de 12 px/600: ok, alerta o gris. |
| **Pestañas** | Botones con `role="tab"` y subrayado de 2 px en `--accent` para la activa. |
| **Pasos (stepper)** | Una `<ol>` con `aria-current="step"`; los pasos hechos llevan una palomita en un círculo `--accent` y el actual va con fondo `--accent-soft`. |
| **Opciones con descripción** | Para elegir entre pocas opciones que necesitan explicación (rol de usuario). Un `<fieldset>` con `<legend>` y una fila por opción: `<input type="radio">` o `checkbox` nativo (20 px, `accent-color: var(--accent)`) más el nombre en 14 px/600 y la descripción en `nota`. Cada fila mide ≥ 44 px, tiene borde `--line` y radio de 8 px; la elegida lleva borde `--accent` y fondo `--accent-soft`. Toda la fila es el `<label>`. |
| **Matriz (celdas que filtran)** | Rejilla de tarjetas pequeñas (fondo `--surface`, borde `--line`, radio 8 px, ≥ 44 px de alto) con encabezados de fila y de columna en 12 px MAYÚSCULAS. Cada celda es un `<button aria-pressed>` con el nombre, la cifra principal en mono y una línea `nota`; la elegida lleva borde `--accent` y fondo `--accent-soft`, y filtra la tabla de abajo. La celda que pide acción lleva la etiqueta de alerta. Se mantiene como rejilla también en celular (las celdas se compactan). |
| **Íconos** | SVG de trazo de 1.8–2 px, 16–18 px y `currentColor`, con `aria-hidden`. Sin emoji. |

### Accesibilidad

- Se usan los elementos reales `<button>`, `<a href>`, `<input>` con `<label>` o `aria-label`, y `<nav aria-label>`.
- El texto tiene un contraste de al menos 4.5:1. Verificarlo en **cada** tema, sobre todo en el texto blanco sobre `--accent` y en el texto de la barra lateral.
- El estado no se comunica solo con color: siempre hay una etiqueta o una cifra.

## 5. Consideraciones por pantalla

### Acceso con Google (`Login.dc.html`)
- Se divide en dos columnas: a la izquierda la marca y la propuesta de valor sobre `--side-bg`, y a la derecha el formulario. En celular se apilan.
- Tiene una sola acción, "Continuar con Google". **No** hay campos de usuario ni contraseña.
- Muestra un aviso fijo: solo entran usuarios dados de alta, activos y con el correo verificado. Si el login falla porque el usuario no existe o está inactivo, se muestra un mensaje claro en el mismo lugar y no se crea cuenta.
- La marca del botón de Google debe seguir sus lineamientos oficiales al implementarse; el diseño usa un ícono genérico.

### Panel del municipio (`Main.dc.html`)
- Tiene 4 KPI: secciones cubiertas (con barra), operadores activos, enlaces y personas movilizadas (con su % de la lista nominal).
- La tabla "Cobertura por sección" tiene los filtros Todas, Sin operador y Baja cobertura. El número de sección enlaza al detalle de la sección. El umbral de "baja cobertura" debe ser configurable (en el diseño, < 3 %).
- En la columna lateral van el resumen del resultado de la elección principal del proceso y la actividad reciente (bitácora de altas, bajas e importaciones).
- La acción principal es "Nueva asignación"; la secundaria, "Exportar a Excel".

### Operadores y enlaces (`Operadores.dc.html`)
- Usa el patrón lista + detalle. Se puede filtrar por sección y por enlace, y hay una vista alterna "por enlace" (equivale a la antigua *Consulta de colonias por enlace*).
- La lista muestra los enlaces abreviados (inicial y apellido) y el total de colonias y personas por operador.
- En el detalle:
  - Los enlaces (1 o 2) aparecen como tarjetas, con la nota de que aplican a **todas** las asignaciones del operador.
  - Las asignaciones (sección + colonia + personas) llevan la acción "+ Agregar".
  - Si la persona también es enlace de otros, se indica con una etiqueta gris (el rol se deduce, no se guarda).
- "Dar de baja" hace un borrado lógico (`deleted_at`) y pide confirmación.
- Los formularios de alta y edición deben validar que la colonia pertenezca a la sección y que el teléfono sea único entre las personas activas.
- Implementación con datos reales:
  - El filtro de sección es un campo numérico (hay cientos de secciones); el de enlace es un selector con todos los enlaces del municipio.
  - En la vista "por enlace", cada fila abre el detalle del enlace (`/operadores/:id` sirve para cualquier persona). El detalle de un enlace lista "Enlace de" con sus operadores.
  - Los enlaces se cambian con "Cambiar" junto al título (buscador del padrón, 1 o 2 enlaces). Cada asignación tiene "Editar" (personas, observaciones y "Quitar asignación", con confirmación).
  - "Nuevo operador" pide nombre, teléfono y, opcionalmente, 1 o 2 enlaces (se pueden completar después con "+ Agregar"). Un operador sin enlaces lleva la etiqueta de alerta "Sin enlace". El alta de asignación pide la sección por número y la colonia se elige entre las de esa sección.
  - "Registrar persona" (botón secundario junto a "Nuevo operador") usa el mismo formulario que en Asignaciones (ver abajo).
  - No se puede dar de baja a quien es enlace de operadores activos; el mensaje lo explica en la misma hoja.
  - Los nombres se guardan en mayúsculas y se muestran con mayúscula inicial; las abreviaturas usan el primer apellido ("José Luis de la Torre Pérez" → "J. de la Torre").

### Detalle de sección (`Seccion.dc.html`)
- Arriba van la ruta de navegación (Secciones / 0812), el tipo de sección y el resumen: casillas, colonias y lista nominal.
- Tiene las pestañas Resultados, Estructura, Colonias e Historial.
- El selector de elección del proceso (Ayuntamiento, Diputación local, Gubernatura) cambia la tabla de votos y la distribución.
- La tabla de votos por casilla tiene **columnas dinámicas**: una por cada partido de la elección, más Total y Participación, y un pie de totales.
- La distribución muestra las barras por partido, la ventaja del primero sobre el segundo y las personas movilizadas en la sección.
- La tabla "Estructura en la sección" lista las colonias con sus operadores, personas y enlaces, y marca las colonias sin operador.

- La URL lleva el número de sección (`/secciones/1265`) y se resuelve dentro del municipio elegido en la barra superior. Si la sección no existe en ese municipio, se muestra un aviso con enlace a la lista.
- La pestaña Colonias muestra, por colonia, el CP y las otras secciones a las que pertenece ("También en"). ADMIN y CAPTURISTA ven "+ Agregar colonia" (busca en el catálogo del municipio o crea una nueva) y "Quitar" por fila; no se puede quitar una colonia que tenga asignaciones en la sección.
- "Editar" junto al título cambia el tipo y el sector de la sección.

### Secciones y colonias (sin maqueta; compuesta con §2–§4)
- Pantalla de catálogo con dos pestañas, cada una con su URL: **Secciones** (`/secciones`) y **Colonias** (`/colonias`).
- Encima de la tabla van la búsqueda y los segmentos de filtro. Secciones: Todas · Sin operador · Con colonias sin operador; se busca por número. Colonias: Todas · Sin operador; se busca por nombre, CP o número de sección.
- Tabla de secciones: Sección (enlace al detalle), Tipo, Colonias (cubiertas / total), Operadores, Personas, Casillas, Lista nominal y Estado. El estado es "Cubierta", "Sin operador" o "*n* sin operador" (colonias sin cubrir), siempre con etiqueta.
- Tabla de colonias: Colonia (con su tipo de asentamiento debajo), CP, Secciones (enlaces), Operadores, Personas, Estado y la acción "Editar" para ADMIN y CAPTURISTA.
- La acción principal es "Nueva sección" o "Nueva colonia" según la pestaña; los formularios se abren en una hoja (diálogo en iPad y escritorio).
- Las tablas se paginan desde la API (25 filas en celular, 50 desde iPad) con "Anterior / Siguiente" en el pie.
- Los nombres de colonias se guardan y muestran en mayúsculas, como el catálogo del INE; municipios y tipos se muestran con mayúscula inicial.

### API (Administración, sin maqueta)
- Solo ADMIN. Muestra la especificación OpenAPI de `/api/openapi.json` con los componentes del sitio (no Swagger UI), para respetar los tokens y el tema.
- Encabezado con la versión y la acción "Descargar OpenAPI". Si hay rutas sin documentar, se muestra una alerta con la lista.
- Búsqueda por ruta, método o descripción; una tarjeta por grupo (tag) y cada ruta como fila desplegable con el método en etiqueta (GET normal, DELETE de alerta, el resto gris), la ruta en mono y el resumen.
- Al desplegar: descripción, parámetros, cuerpo y respuestas; los esquemas se listan al final y los tipos enlazan a ellos.

### Importar desde Excel (`Importar.dc.html`)
- Es un asistente de 4 pasos: **Archivo → Columnas → Validación → Confirmar**. Los tipos de carga son secciones, colonias, casillas con lista nominal y resultados por casilla.
- En el paso de validación se ven el resumen (filas, válidas, con error) y la tabla de errores con fila, sección, casilla y un problema explicado en lenguaje claro. Los errores se pueden descargar.
- Las filas con error **no** se importan, y el botón principal dice cuántas sí se importarán ("Importar 1,180 filas").
- A un lado va la bitácora (tabla `importacion`) con el estado Completada o Falló.
- Solo entran ADMIN y CAPTURISTA.

### Usuarios (Administración, sin maqueta; compuesta con §2–§4)
- Solo ADMIN (`/usuarios`). Otro rol que llegue por URL ve un aviso "Solo el administrador puede administrar usuarios".
- Encabezado "Usuarios" con la descripción "Quién puede entrar al sitio. Cada persona entra con su cuenta de Google." y la acción principal "Nuevo usuario".
- Filtros: búsqueda por nombre o email y los segmentos Todos · Activos · Inactivos. La lista no se pagina (son pocos usuarios); el pie dice "*n* usuarios".
- Tabla (tarjetas apiladas en celular): **Usuario** (nombre en negrita y email debajo en `nota`), **Rol** (etiqueta gris), **Municipios** ("Todos" para ADMIN; si no, los nombres separados por coma, o la etiqueta de alerta "Sin municipios"), **Último acceso** (`Hoy, 09:15`, `6 oct 2026` o "Aún no entra" si nunca ha iniciado sesión), **Estado** (etiqueta ok "Activo" o gris "Inactivo") y la acción "Editar". La fila del usuario actual lleva la etiqueta gris "Tú".
- El formulario (Hoja) tiene:
  - **Nombre** y **Email** (`type="email"`). El email solo se puede cambiar mientras el usuario no haya entrado; después queda de solo lectura con la nota "Ya entró con esta cuenta de Google".
  - **Rol** como opciones con descripción (ver "Opciones con descripción" en §4): Administrador (todo, incluidos usuarios y configuración), Capturista (captura y consulta en sus municipios), Consulta (solo consulta en sus municipios).
  - **Municipios permitidos** como casillas de verificación, obligatorio al menos uno salvo para ADMIN; con ADMIN se ocultan y se muestra la nota "El administrador ve todos los municipios".
  - **Activo** (casilla) solo al editar. Un usuario inactivo no puede entrar y su sesión abierta deja de funcionar en la siguiente petición.
- Los usuarios **no se borran** (las bitácoras los referencian): se desactivan.
- Protecciones: el ADMIN no puede cambiar su propio rol ni desactivarse, y siempre debe quedar al menos un ADMIN activo. El formulario lo explica en lugar de mostrar los controles deshabilitados sin razón.
- El selector de municipio de la barra superior solo lista los municipios permitidos del usuario (ADMIN ve todos).

### Asignaciones (sin maqueta aprobada; propuesta en `propuestas/Asignaciones.html`)
- Vista transversal de la estructura (`/asignaciones`): todas las asignaciones del municipio en una tabla plana, sin entrar operador por operador.
- Encabezado "Asignaciones" con la descripción "Qué operador cubre cada colonia de cada sección y cuántas personas moviliza." Acciones: "Exportar a Excel" (descarga exactamente lo filtrado), "Registrar persona" (secundaria) y "+ Nueva asignación" (principal). CONSULTA solo ve "Exportar a Excel".
- Filtros: búsqueda (operador o colonia), número de sección y enlace. Segmentos: **Vigentes · Dadas de baja · Colonias sin operador · Personas sin asignar (n)**.
- Tabla de asignaciones: Sección (enlace al detalle), Colonia, Operador (enlace a `/operadores/:id`), Enlaces abreviados (o "Sin enlace" de alerta), Personas, Alta (o Baja) y "Editar". El pie suma lo filtrado (asignaciones, operadores y personas) además de "Mostrando X de Y".
- "Colonias sin operador": pares sección + colonia sin asignación vigente, con la etiqueta "Sin operador" y la acción "Asignar", que abre la nueva asignación con la sección y la colonia ya elegidas.
- "Personas sin asignar": personas del padrón sin asignaciones, sin enlaces y que no son enlace de nadie. Columnas: Persona, Celular, Registrada y las acciones "Asignar" (nueva asignación con la persona ya elegida) y "Editar". En cuanto la persona tiene un rol, sale de esta lista. Se vuelve enlace al elegirla como enlace de un operador.
- **Nueva asignación** (Hoja), en el orden sección → colonia → operador:
  1. Sección por número, con su resumen (colonias y cuántas sin operador).
  2. Colonia como opciones con descripción (§4): las sin operador primero con su etiqueta; las demás con sus operadores y personas.
  3. Operador: buscador del padrón; también ofrece "+ Registrar persona nueva" (nombre y celular) sin salir del formulario.
  4. Personas y observaciones.
  - Los enlaces **no** se piden: se pueden completar después en el detalle del operador.
  - Antes de guardar se muestra el resumen en una frase. La casilla "Guardar y agregar otra en la misma sección" deja el formulario abierto con la sección.
- **Registrar persona** (Hoja): solo nombre completo y celular. Si el celular ya está registrado, se avisa al escribirlo, con enlace a esa persona. Botones "Guardar" y "Guardar y asignar" (pasa a la nueva asignación con la persona elegida). Está en Asignaciones y en Operadores y enlaces.
- En celular la tabla se apila como tarjetas y los filtros siguen §8.

### Prioridad (sin maqueta; compuesta con §2–§4)
- Pantalla `/prioridad` en **Geografía y elección**. La ven todos los roles. Cruza el resultado de una elección con la estructura para decidir **dónde trabajar**.
- Encabezado "Prioridad por sección" con la descripción "Cruza el resultado de *partido propio* con la estructura de cada sección." A la derecha, el selector de elección del proceso (solo las que tienen votos; por omisión Ayuntamiento).
- Depende del **partido propio** (Configuración, §6). Si no está elegido, la pantalla muestra un aviso en lugar de la matriz: el ADMIN ve el enlace "Elegir partido propio" y los demás, "Pide al administrador que elija el partido propio".
- Cálculos por sección (solo las casillas con resultados de la elección):
  - **Margen** = (votos del partido propio − votos del rival principal) / votos totales, en puntos. El rival principal es el partido más votado distinto del propio. Se muestra con signo: `+4.2`, `−3.1`.
  - **Diferencia** en votos: "Gana por 32" o "Pierde por 15".
  - **Cobertura** = personas movilizadas / lista nominal (igual que en el Panel).
- Clasificación: el margen se divide en **Ganada** (> +10 puntos), **Competida** (entre −10 y +10) y **Perdida** (< −10); la cobertura, en **con estructura** (≥ umbral de baja cobertura, 3 %) y **sin estructura**. Resultan 6 categorías, en este orden de prioridad:

  | Categoría | Etiqueta | Lectura |
  |---|---|---|
  | Competida sin estructura | alerta "Prioridad" | Se decide aquí y no hay quién trabaje. |
  | Competida con estructura | ok "Sostener" | Hay estructura; mantenerla. |
  | Ganada sin estructura | gris "Reforzar" | Bastión débil. |
  | Perdida con estructura | gris "Revisar" | La estructura no se refleja en votos. |
  | Perdida sin estructura | gris "Abrir" | Terreno por abrir. |
  | Ganada con estructura | ok "Bastión" | Sin acción inmediata. |

- Arriba van 4 KPI: **Secciones prioritarias** (de cuántas con resultados), **Secciones competidas** (margen de ±10 puntos), **Ventaja en el municipio** (puntos del propio sobre el rival principal, con las siglas y porcentajes de ambos) y **Lista nominal en prioridad** (con su % del municipio).
- **Matriz** (componente de §4): 3 filas (Ganada, Competida, Perdida) × 2 columnas (Sin estructura, Con estructura). Cada celda muestra la etiqueta, el número de secciones y su lista nominal. Al tocarla filtra la tabla; al tocarla otra vez se quita el filtro. Debajo, una `nota` explica los umbrales y cuántas secciones no tienen resultados (no entran en la matriz).
- Tabla (paginada desde la API, ordenada por prioridad y, dentro de cada categoría, por el margen más cerrado): Sección (enlace al detalle), Categoría (etiqueta), Margen, Diferencia, Rival, Personas, Cobertura (barra) y Lista nominal. En iPad se ocultan Rival y Lista nominal; en celular, tarjetas apiladas.
- No se usan los colores de los partidos (§4, "Barras de resultados por partido"); las categorías se distinguen por etiqueta y texto, no solo por color.

### Pantallas pendientes de diseñar
Se construyen con los mismos componentes y layout:
- **Configuración** (ADMIN): ver §6.

## 6. Tema configurable (Administración → Configuración)

En **Administración** hay una opción **Configuración**, visible solo para ADMIN, donde se elige el color que define el *look & feel* del sitio. Los temas se basan en los colores que identifican a los partidos políticos: **azul, verde, naranja y guinda**.

**Comportamiento**
- El selector muestra 4 muestras grandes (tarjeta con nombre y una vista previa de botón, barra lateral y etiqueta) y un botón "Guardar". La vista previa se aplica al pasar o seleccionar, antes de guardar.
- Cada tarjeta de Configuración tiene su propio botón "Guardar" (principal) al pie: **Tema del sitio** y **Partido propio**.
- El tema es **global del sitio**: lo elige el ADMIN y lo ven todos los usuarios. Se guarda en D1, en la tabla `configuracion (clave, valor)` (migración `0002_configuracion.sql`), con la clave `tema` y los valores `azul | verde | naranja | guinda`. El valor predeterminado es `verde`, el del diseño original.
- La API expone `GET /api/configuracion` (todas las claves, p. ej. `{ "tema": "verde" }`) y `PUT /api/configuracion/tema` con `{ "tema": "azul" }`, que solo acepta ADMIN.
- En el frontend se aplica con `document.documentElement.dataset.tema = valor`. Solo cambian las variables de color del tema; el layout, la tipografía y los neutros quedan igual.
- Al cargar, el valor se copia en `localStorage` para pintar el color correcto antes de que responda la API (sin parpadeo), pero la fuente de verdad es la BD.

**Partido propio**
- Segunda tarjeta de Configuración: un selector con los partidos del catálogo (siglas y nombre) más la opción "Sin elegir", y la nota "Se usa en Prioridad para calcular el margen de cada sección."
- Se guarda en `configuracion` con la clave `partido_propio` (las siglas). `PUT /api/configuracion/partido_propio` con `{ "partido_propio": "MORENA" }` o `null` para quitarlo; solo ADMIN. `GET /api/configuracion` solo lo devuelve con sesión (sin sesión, solo el tema).
- Es independiente del tema: elegir un partido no cambia el color del sitio.

**Tokens por tema**

| Token | Verde (predeterminado) | Azul | Naranja | Guinda |
|---|---|---|---|---|
| `--accent` (botones, enlaces, barras) | `#0E5A4A` | `#1D4E89` | `#B3470F` | `#7A1F3D` |
| `--accent-hover` | `#09392F` | `#133663` | `#8A360B` | `#5A162D` |
| `--accent-soft` (fondos suaves, fila seleccionada, etiqueta ok) | `#E3EFEA` | `#E4ECF6` | `#FBEBDD` | `#F5E4EA` |
| `--accent-2` (2.º lugar en barras) | `#5E7F75` | `#5A7799` | `#A7724F` | `#8E5A6B` |
| `--accent-3` | `#8FA59C` | `#8FA2BA` | `#C49F86` | `#B38C99` |
| `--accent-4` | `#BFCBC5` | `#C0CBD9` | `#DDC7B8` | `#D5BEC6` |
| `--side-bg` (barra lateral, panel del login) | `#13231E` | `#111C2B` | `#2A1A10` | `#24121A` |
| `--side-hover` | `#1E3530` | `#1B2A3F` | `#3A2618` | `#351C27` |
| `--side-active` | `#24423A` | `#233752` | `#4A3020` | `#462534` |
| `--side-text` | `#C9D6D0` | `#C8D3E2` | `#E6D3C5` | `#E3CBD4` |
| `--side-label` (títulos de grupo) | `#93A9A0` | `#91A1B8` | `#B89C88` | `#B5939F` |
| `--logo-bg` | `#2F7A66` | `#2F63A3` | `#D0611F` | `#9E3456` |
| `--warn-bg` / `--warn-fg` | `#FBEADF` / `#8A3D12` | `#FBEADF` / `#8A3D12` | `#F8E3E6` / `#9B1C31` | `#FBEADF` / `#8A3D12` |

**Reglas**
- Ningún componente usa un hex de color directamente: todo pasa por los tokens, para que el cambio de tema funcione en todas las pantallas.
- Antes de agregar un tema nuevo hay que verificar el contraste: el texto blanco sobre `--accent` debe ser ≥ 4.5:1, `--side-text` sobre `--side-bg` también ≥ 4.5:1, y `--accent` sobre `--accent-soft` también ≥ 4.5:1.
- El tema cambia la identidad visual, **no** los colores con los que se representa a cada partido en los resultados (ver "Barras de resultados por partido").

## 7. Al crear una interfaz nueva

1. Busca la pantalla en `pantallas/`. Si existe, replícala: estructura, textos, orden de columnas y acciones.
2. Si no existe, compón la pantalla con el layout (§2), los componentes (§4) y los tokens (§3, §6).
3. Usa solo variables CSS de tema; no pongas colores fijos.
4. Revisa la pantalla en celular (375 px), en iPad vertical (768 px) y horizontal (1024 px), en escritorio (≥ 1280 px) y con los 4 temas.
5. Si introduces un patrón nuevo, documéntalo en esta guía en el mismo cambio.

## 8. Celular y iPad

El sitio es **responsivo y táctil** y debe poder usarse completo en celular y en iPad (sobre todo para capturar en campo y para consultar), no solo en escritorio. Se diseña *mobile-first*: los estilos base son para celular y se amplían con `min-width`.

### Puntos de quiebre

| Rango | Dispositivo | Navegación | Contenido |
|---|---|---|---|
| < 768 px | Celular | Barra superior con botón ☰ (ícono SVG) que abre la barra lateral como **cajón** (drawer) superpuesto, con fondo oscurecido; se cierra al elegir una opción o tocar fuera. | Una columna y `padding: 16px`. |
| 768–1199 px | iPad (vertical y horizontal) | Barra lateral **colapsada a íconos** (riel de 72 px con `aria-label` y tooltip). El botón ☰ la expande sobre el contenido. | Dos columnas solo si cada una cabe con ≥ 360 px; si no, una. `padding: 20–24px`. |
| ≥ 1200 px | Escritorio | Barra lateral completa (como en los diseños). | Layout de los diseños, con `max-width` de 1200–1280 px. |

### Reglas por elemento

- **Barra superior en celular**: ☰, nombre del municipio actual (al tocarlo abre el selector de municipio y proceso en una hoja inferior) y avatar. La búsqueda se vuelve un ícono que abre un campo a pantalla completa.
- **KPI**: 2 columnas en celular, 4 en iPad horizontal y escritorio (`grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))`).
- **Tablas**:
  - Celular: las listas principales (cobertura por sección, operadores, colonias de la sección, errores de importación) se muestran como **tarjetas apiladas**. Cada tarjeta lleva el dato principal en negrita, 2–3 datos secundarios y las cifras mono a la derecha.
  - La tabla de votos por casilla se queda como tabla, con scroll horizontal y la columna "Casilla" fija (`position: sticky; left: 0`).
  - iPad: tablas normales dentro de `overflow-x: auto`; se ocultan las columnas secundarias (p. ej. Teléfono o Enlaces), que pasan al detalle.
- **Lista + detalle** (Operadores):
  - Celular: el detalle se abre como pantalla propia con botón "← Volver" y su propia URL (`/operadores/:id`), para que funcione el botón atrás del sistema.
  - iPad horizontal: lado a lado. iPad vertical: el detalle se abre como panel deslizante desde la derecha.
- **Filtros**: en celular se agrupan en un botón "Filtros (n)" que abre una **hoja inferior**; los segmentos (Todas / Sin operador / Baja cobertura) se mantienen visibles con scroll horizontal.
- **Acción principal**: en celular va fija abajo (barra inferior con `padding-bottom: env(safe-area-inset-bottom)`), con el ancho completo; en iPad y escritorio, en el encabezado como en los diseños.
- **Pestañas** (Detalle de sección): con scroll horizontal y sin cortar texto.
- **Importar**: los pasos se muestran compactos en celular ("Paso 3 de 4 · Validación"). La selección de archivo usa `<input type="file" accept=".xlsx,.xls,.csv">`, que en iPad y celular abre Archivos o iCloud.
- **Formularios** (altas y ediciones):
  - Una columna en celular, dos en iPad o escritorio.
  - Teléfonos con `type="tel"` e `inputmode="tel"`; cifras como personas y votos con `inputmode="numeric"`.
  - Los selectores de sección y colonia son buscables y la colonia se filtra por la sección elegida.
  - Se guarda con el botón fijo inferior.
- **Login**: en celular solo se ve la columna del formulario con el logo arriba; el panel de marca se oculta o se reduce a una franja.

### Reglas táctiles y técnicas

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` en `index.html`. **No** se bloquea el zoom.
- Los objetivos táctiles miden ≥ 44 × 44 px con 8 px de separación; esto aplica también a los íconos del riel y a las acciones de cada fila.
- Los inputs tienen `font-size` de **16 px** como mínimo, para evitar el zoom automático de iOS Safari.
- Nada depende de *hover*: los tooltips y acciones se pueden alcanzar al tocar, y los estados `:hover` van dentro de `@media (hover: hover)`.
- Se respetan las áreas seguras (`env(safe-area-inset-*)`) en el iPhone con muesca y en el iPad.
- Se usa `100dvh` en lugar de `100vh` en las vistas de pantalla completa, por la barra del navegador móvil.
- Hay que soportar la rotación del iPad sin perder el estado (filtros, pestaña o paso abiertos).
- Rendimiento en datos móviles: las tablas grandes se paginan desde la API (25 filas en celular, 50 en escritorio) y no se cargan catálogos completos de golpe.
- Se prueba en Safari de iOS y iPadOS, además de Chrome de Android y de escritorio.
