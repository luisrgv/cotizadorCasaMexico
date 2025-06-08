// Variables globales
let currentUser = null;
let platosDisponibles = [];
let platosSeleccionados = [];
let registroActualIndex = -1;


const platosDesechablesCheckbox = document.getElementById("platosDesechables");
const tipoPlatosSelect = document.getElementById("tipoPlatos");

// Función para actualizar el estado del selector de tipo de platos
function actualizarTipoPlatos() {
  if (platosDesechablesCheckbox.checked) {
    tipoPlatosSelect.disabled = true;
    tipoPlatosSelect.value = ""; // Limpia el valor si es desechable
  } else {
    tipoPlatosSelect.disabled = false;
  }
}

// Ejecuta al cargar la página
actualizarTipoPlatos();

// Ejecuta cada vez que cambia el estado del checkbox
platosDesechablesCheckbox.addEventListener("change", actualizarTipoPlatos);

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  await verificarSesion();
  
  // Cargar datos iniciales
  await cargarPlatos();
  
  
  // Configurar eventos
  configurarEventos();
  
  // Mostrar tipo de platos por defecto (ya que ahora es independiente del switch)
  document.getElementById('tipoPlatosContainer').style.display = 'block';
  
  // Configurar evento para notas adicionales
let encabezadoInsertado = false;
let contenidoOriginal = '';
const notasArea = document.getElementById('notasArea');
const editadoIcono = document.getElementById('editadoIcono');
const guardarBtn = document.getElementById('guardarBtn');

function crearEncabezado() {
  const ahora = new Date();
  const fechaHora = ahora.toLocaleString();
  const encabezado = document.createElement('div');
  encabezado.textContent = `${currentUser.username} - ${fechaHora}`;
  encabezado.style.fontWeight = 'bold';
  encabezado.contentEditable = 'false';
  encabezado.id = 'encabezado';
  return encabezado;
}

function crearCuerpoNota(texto = '') {
  const cuerpoNota = document.createElement('div');
  cuerpoNota.contentEditable = 'true';
  cuerpoNota.id = 'cuerpoNota';
  cuerpoNota.innerText = texto;
  return cuerpoNota;
}

function colocarCursorAlFinal(elemento) {
  const range = document.createRange();
  const sel = window.getSelection();
  range.selectNodeContents(elemento);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertarEncabezadoYNota(textoUsuario) {
  notasArea.innerHTML = '';
  const encabezado = crearEncabezado();
  const cuerpoNota = crearCuerpoNota(textoUsuario);
  notasArea.appendChild(encabezado);
  notasArea.appendChild(cuerpoNota);
  colocarCursorAlFinal(cuerpoNota);
  encabezadoInsertado = true;
  contenidoOriginal = textoUsuario;
}

// Detectar cambios
notasArea.addEventListener('input', () => {
  const cuerpoNota = document.getElementById('cuerpoNota');

  if (!encabezadoInsertado) {
    const textoUsuario = notasArea.innerText.trim();
    if (textoUsuario.length > 0) {
      insertarEncabezadoYNota(textoUsuario);
    }
  } else {
    // Si ya hay encabezado, verificar si se borró todo
    if (cuerpoNota && cuerpoNota.innerText.trim() === '') {
      encabezadoInsertado = false;
      contenidoOriginal = '';
      notasArea.innerHTML = '';
    }
  }
});

// Guardar y mostrar ✏️
guardarBtn.addEventListener('click', () => {
  const cuerpoNota = document.getElementById('cuerpoNota');
  if (!cuerpoNota) return;

  const contenidoActual = cuerpoNota.innerText;
  if (encabezadoInsertado && contenidoOriginal !== contenidoActual) {
    editadoIcono.style.display = 'block';
    contenidoOriginal = contenidoActual;
  }
});

});

// Función para verificar sesión
async function verificarSesion() {
  try {
    const response = await fetch('/api/user-info');
    const data = await response.json();
    
    if (!data.user) {
      window.location.href = '/';
      return;
    }
    
    currentUser = data.user;
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role;
    document.getElementById('userAvatar').textContent = 
      currentUser.username.charAt(0).toUpperCase();
  } catch (error) {
    console.error('Error al verificar sesión:', error);
    window.location.href = '/';
  }
}

// Función para cargar los platos disponibles
async function cargarPlatos() {
  try {
    const response = await fetch('/api/platos');
    const data = await response.json();
    platosDisponibles = data.platos || [];
    
    const platosList = document.getElementById('platosList');
    platosList.innerHTML = '';
    
    platosDisponibles.forEach(plato => {
      const platoItem = document.createElement('div');
      platoItem.className = 'plato-item';
      platoItem.innerHTML = `
        <input type="checkbox" id="plato-${plato.nombre.replace(/\s+/g, '-')}" 
               data-nombre="${plato.nombre}" data-precio="${plato.precio_por_persona}">
        <label for="plato-${plato.nombre.replace(/\s+/g, '-')}">${plato.nombre}</label>
      `;
      platosList.appendChild(platoItem);
      
      // Configurar evento para actualizar cuando se selecciona un plato
      const checkbox = platoItem.querySelector('input[type="checkbox"]');
      
      checkbox.addEventListener('change', () => {
        actualizarResumenPlatos();
      });
    });
  } catch (error) {
    console.error('Error al cargar platos:', error);
  }
}

// Función para actualizar el resumen de platos seleccionados
function actualizarResumenPlatos() {
  const listaResumen = document.getElementById('listaResumen');
  listaResumen.innerHTML = '';
  platosSeleccionados = [];
  let subtotal = 0;
  const numPersonas = parseInt(document.getElementById('numeroPersonas').value) || 1;
  
  // Obtener todos los checkboxes de platos marcados
  document.querySelectorAll('#platosList input[type="checkbox"]:checked').forEach(checkbox => {
    const nombre = checkbox.getAttribute('data-nombre');
    const precioPorPersona = parseFloat(checkbox.getAttribute('data-precio'));
    const precioTotal = precioPorPersona * numPersonas;
    
    // Agregar a la lista de platos seleccionados
    platosSeleccionados.push({
      nombre,
      precio_por_persona: precioPorPersona,
      precio_total: precioTotal
    });
    
    // Agregar al resumen visual (nombre y precio total)
    const item = document.createElement('li');
    item.innerHTML = `
      <span>${nombre} (${numPersonas} pers.)</span>
      <span class="resumen-valor">$${precioTotal.toFixed(2)}</span>
    `;
    listaResumen.appendChild(item);
    
    subtotal += precioTotal;
  });

  // Calcular tax (8%)
  const tax = subtotal * 0.08;
  
  // Obtener porcentaje de gratuity (valor editable, default 20%)
  const gratuityPercentage = parseFloat(document.getElementById('gratuityPercentage').value) || 20;
  const gratuity = subtotal * (gratuityPercentage / 100);
  
  // Verificar si es Delivery Catering y agregar costo si existe
  const servicio = document.getElementById('servicio').value;
  const deliveryFee = servicio === 'Delivery Catering' ? 
    (parseFloat(document.getElementById('deliveryFee').value) || 0) : 0;
  
  const total = subtotal + tax + gratuity + deliveryFee;

  // Actualizar valores en el resumen
  document.getElementById('subtotalResumen').textContent = subtotal.toFixed(2);
  document.getElementById('taxResumen').textContent = tax.toFixed(2);
  document.getElementById('gratuityResumen').textContent = gratuity.toFixed(2);
  document.getElementById('totalResumen').textContent = total.toFixed(2);
  
  // Mostrar delivery fee si aplica
  const deliveryContainer = document.getElementById('deliveryContainer');
  if (servicio === 'Delivery Catering') {
    deliveryContainer.style.display = 'flex';
    document.getElementById('deliveryResumen').textContent = deliveryFee.toFixed(2);
  } else {
    deliveryContainer.style.display = 'none';
  }
  
  // Mostrar u ocultar el resumen según si hay platos seleccionados
  const resumenPlatos = document.getElementById('resumenPlatos');
  resumenPlatos.style.display = platosSeleccionados.length > 0 ? 'block' : 'none';
}


// evitar que se envie formulario a presionar enter
document.getElementById("cotizacionForm").addEventListener("keydown", function(event) {
  // Si se presiona Enter (keyCode 13) y el target no es un textarea ni tiene type="submit"
  if (event.key === "Enter" && event.target.type !== "textarea" && event.target.type !== "submit") {
    event.preventDefault(); // Evita que se envíe el formulario
  }
});


// Función para mostrar el detalle de una cotización en el modal
function mostrarDetalleCotizacion(cotizacion) {
  const modal = document.getElementById('cotizacionModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  
  // Formatear fecha si existe
  const fecha = cotizacion.Fecha ? new Date(cotizacion.Fecha).toLocaleDateString() : 'No especificada';
  
  modalTitle.textContent = `Cotización: ${cotizacion.Cliente || 'Sin nombre'}`;
  
  modalContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div>
        <strong>Fecha:</strong> ${fecha}
      </div>
      <div>
        <strong>Día:</strong> ${cotizacion.Día || 'No especificado'}
      </div>
      <div>
        <strong>Cliente:</strong> ${cotizacion.Cliente || 'No especificado'}
      </div>
      <div>
        <strong>Número:</strong> ${cotizacion.Número || 'No especificado'}
      </div>
      <div>
        <strong>Servicio:</strong> ${cotizacion.Servicio || 'No especificado'}
      </div>
      <div>
        <strong>Ubicación:</strong> ${cotizacion.Ubicación || 'No especificado'}
      </div>
      <div>
        <strong>Hora Evento:</strong> ${cotizacion['Hora del Evento'] || 'No especificado'}
      </div>
      <div>
        <strong>Hora Servir:</strong> ${cotizacion['Hora de Servir'] || 'No especificado'}
      </div>
      <div>
        <strong>Hora Salida:</strong> ${cotizacion['Hora de Salida'] || 'No especificado'}
      </div>
      <div>
        <strong>Contacto:</strong> ${cotizacion['Contacto en el Lugar'] || 'No especificado'}
      </div>
      <div>
        <strong>Personas:</strong> ${cotizacion['Número de Personas'] || '0'}
      </div>
      <div>
        <strong>Precio Total:</strong> $${cotizacion['Precio Total'] || '0'}
      </div>
      <div>
        <strong>Platos Desechables:</strong> ${cotizacion['Platos Desechables'] || 'No'}
      </div>
      ${cotizacion['Platos Desechables'] === 'No' ? `
        <div>
          <strong>Tipo de Platos:</strong> ${cotizacion['Tipo de Platos'] || 'No especificado'}
        </div>
      ` : ''}
      <div style="grid-column: 1 / -1;">
        <strong>Notas:</strong> ${cotizacion.Notas || 'Ninguna'}
      </div>
      <div style="grid-column: 1 / -1;">
        <strong>Creado/Modificado por:</strong> ${cotizacion['Creado/Modificado por'] || 'Desconocido'}
      </div>
    </div>
   
      </button>
    </div>
  `;
  
  // Configurar eventos para los botones del modal
  document.getElementById('imprimirPDFCliente')?.addEventListener('click', () => {
    // Implementar funcionalidad de impresión
    alert('Generando PDF para cliente...');
  });
  
  document.getElementById('imprimirPDFCocina')?.addEventListener('click', () => {
    // Implementar funcionalidad de impresión
    alert('Generando PDF para cocina...');
  });
  
  modal.style.display = 'flex';
}

// Función para configurar los eventos de la UI
function configurarEventos() {
  // Botón de logout
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch('/logout', { method: 'GET' });
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  });
  
  // Botón de guardar
  document.getElementById('guardarBtn').addEventListener('click', guardarCotizacion);
  
  // Botón de ver calendario
  document.getElementById('verCalendarioBtn').addEventListener('click', () => {
    window.location.href = '/calendario';
  });

  // Toggle platos desechables (ahora solo cambia el texto, no afecta al tipo de platos)
  document.getElementById('platosDesechables').addEventListener('change', (e) => {
    const texto = e.target.checked ? 'Sí' : 'No';
    document.getElementById('platosDesechablesText').textContent = texto;
  });
  
  // Cerrar modal
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('cotizacionModal').style.display = 'none';
  });
  
  // Cerrar modal haciendo clic fuera
  window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('cotizacionModal')) {
      document.getElementById('cotizacionModal').style.display = 'none';
    }
  });
  
 
  
  // Actualizar total cuando cambia el número de personas
  document.getElementById('numeroPersonas').addEventListener('change', actualizarResumenPlatos);
  
  // Actualizar cuando cambia el tipo de servicio
  document.getElementById('servicio').addEventListener('change', actualizarResumenPlatos);
  
  }

// Función para guardar una nueva cotización
async function guardarCotizacion() {
  // Validar formulario
  const formulario = document.getElementById('cotizacionForm');
  if (!formulario.checkValidity()) {
    formulario.reportValidity();
    return;
  }
  
  // Validar que se haya seleccionado al menos un plato
  if (platosSeleccionados.length === 0) {
    alert('Por favor seleccione al menos un plato');
    return;
  }
  
  // Validar número de personas
  const numPersonas = parseInt(document.getElementById('numeroPersonas').value);
  if (!numPersonas || numPersonas < 1) {
    alert('Ingrese un número válido de personas');
    return;
  }
  
  // Validar tipo de platos si no son desechables
  const platosDesechables = document.getElementById('platosDesechables').checked;
  const tipoPlatos = document.getElementById('tipoPlatos').value;
  
  if (!platosDesechables && !tipoPlatos) {
    alert('Por favor seleccione el tipo de platos');
    return;
  }
  
  // Calcular subtotal, tax y gratuity
  let subtotal = 0;
  platosSeleccionados.forEach(plato => {
    subtotal += plato.precio_total;
  });
  
  const tax = subtotal * 0.08;
  const gratuityPercentage = parseFloat(document.getElementById('gratuityPercentage').value) || 20;
  const gratuity = subtotal * (gratuityPercentage / 100);
  
  // Verificar si es Delivery Catering y agregar costo si existe
  const servicio = document.getElementById('servicio').value;
  const deliveryFee = servicio === 'Delivery Catering' ? 
    (parseFloat(document.getElementById('deliveryFee').value)) || 0 : 0;
  
  const total = subtotal + tax + gratuity + deliveryFee;
  
  // Obtener el contenido de notas de manera segura
  let notasContent = '';
  const notasElement = document.getElementById('cuerpoNota');
  if (notasElement) {
    notasContent = notasElement.innerText || '';
  } else {
    notasContent = document.getElementById('notasArea').innerText || '';
  }

  // Obtener datos del formulario en el formato que espera el backend
  const datos = {
    
    fecha: document.getElementById('fecha').value,
    cliente: document.getElementById('cliente').value,
    numero: document.getElementById('numero').value,
    hora_evento: document.getElementById('hora_evento').value,
    hora_servir: document.getElementById('hora_servir').value,
    hora_salida: document.getElementById('hora_salida').value,
    servicio: document.getElementById('servicio').value,
    ubicacion: document.getElementById('ubicacion').value,
    contacto: document.getElementById('contacto').value,
    status: document.getElementById('status').value,
    platosSeleccionados: platosSeleccionados.map(p => ({
      nombre: p.nombre,
      precio_por_persona: parseFloat(p.precio_por_persona),
      cantidad: numPersonas,
      precio_total: parseFloat(p.precio_total)
    })),
    numeroPersonas: numPersonas,
    precioTotal: parseFloat(total.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    gratuity: parseFloat(gratuity.toFixed(2)),
    gratuityPercentage: gratuityPercentage,
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    platosDesechables: document.getElementById('platosDesechables').checked ? 'Sí' : 'No',
    tipoPlatos: tipoPlatos,
    notas: notasContent,
    ingredientes: [] // Asegúrate de que este campo esté presente
  };
  
  mostrarLoading('Guardando cotización...');
  
  try {
    const response = await fetch('/api/cotizaciones', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(datos)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al guardar la cotización');
    }
    
    alert('Cotización guardada exitosamente');
    
    // Mostrar los PDFs generados
    if (data.pdfCliente && data.pdfCocina) {
      // Abrir el PDF del cliente en una nueva pestaña
      window.open(data.pdfCliente, '_blank');
      
      //  abrir también el PDF de cocina
      window.open(data.pdfCocina, '_blank');
    }
    
   
    
    // Limpiar formulario
    limpiarFormulario();
    
  } catch (error) {
    console.error('Error al guardar cotización:', error);
    alert(`Error al guardar: ${error.message}`);
  } finally {
    ocultarLoading();
  }
}

// Función para limpiar el formulario
function limpiarFormulario() {
  if (confirm('¿Está seguro que desea limpiar el formulario?')) {
    document.getElementById('cotizacionForm').reset();
    document.getElementById('platosDesechablesText').textContent = 'No';
    document.getElementById('resumenPlatos').style.display = 'none';
    document.querySelectorAll('#platosList input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    platosSeleccionados = [];
    document.getElementById('navegacionRegistros').style.display = 'none';
    registroActualIndex = -1;
    document.getElementById('notasInfo').textContent = '';
  }
}
// Funciones para mostrar/ocultar loading
function mostrarLoading(mensaje) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingText').textContent = mensaje || 'Procesando...';
}
function ocultarLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}