// Variables globales
let currentUser = null;
let cotizacionesGuardadas = [];
let cotizacionEditando = null;
let platosDisponibles = [];
const modalEditar = document.getElementById('modalEditar');

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  await verificarSesion();
  await cargarPlatos(); // Cargar platos disponibles primero
  await cargarCotizacionesEnProceso();
  configurarEventos();
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

// Función para cargar platos disponibles
async function cargarPlatos() {
  try {
    const response = await fetch('/api/platos');
    const data = await response.json();
    platosDisponibles = data.platos || [];
    
    // Llenar la lista de platos en el modal de edición
    const platosList = document.getElementById('editPlatosList');
    platosList.innerHTML = '';
    
    platosDisponibles.forEach(plato => {
      const platoItem = document.createElement('div');
      platoItem.className = 'plato-item';
      platoItem.innerHTML = `
        <input type="checkbox" id="edit-plato-${plato._id}" 
               data-id="${plato._id}" 
               data-nombre="${plato.nombre}" 
               data-precio="${plato.precio_por_persona}"
               data-cantidad="1">
        <label for="edit-plato-${plato._id}">${plato.nombre} - $${plato.precio_por_persona.toFixed(2)}/persona</label>
      `;
      platosList.appendChild(platoItem);
    });
  } catch (error) {
    console.error('Error al cargar platos:', error);
  }
}

// Función para cargar cotizaciones en proceso
async function cargarCotizacionesEnProceso() {
  mostrarLoading('Cargando cotizaciones...');
  
  try {
    const response = await fetch('/api/cotizaciones');
    const data = await response.json();
    cotizacionesGuardadas = data.cotizaciones || [];
    
    const cotizacionesEnProceso = cotizacionesGuardadas.filter(c => c.status === 'en_proceso');
    actualizarListaCotizaciones(cotizacionesEnProceso);
    document.getElementById('badgeEnProceso').textContent = cotizacionesEnProceso.length;
  } catch (error) {
    console.error('Error al cargar cotizaciones:', error);
    alert('Error al cargar las cotizaciones');
  } finally {
    ocultarLoading();
  }
}

// Función para actualizar la lista de cotizaciones
function actualizarListaCotizaciones(cotizaciones) {
  const container = document.getElementById('cotizacionesEnProceso');
  container.innerHTML = '';
  
  if (cotizaciones.length === 0) {
    container.innerHTML = '<p>No hay cotizaciones en proceso.</p>';
    return;
  }
  
  cotizaciones.forEach(cotizacion => {
    const card = document.createElement('div');
    card.className = 'cotizacion-card';
    
    const fecha = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString() : 'No especificada';
    
    card.innerHTML = `
      <div class="cotizacion-header">
        <div class="cotizacion-cliente">${cotizacion.cliente || 'Sin nombre'}</div>
        <div class="cotizacion-status status-en_proceso">
          En Proceso
        </div>
      </div>
      <div class="cotizacion-details">
        <div class="cotizacion-detail">
          <strong>Fecha</strong>
          ${fecha}
        </div>
        <div class="cotizacion-detail">
          <strong>Servicio</strong>
          ${cotizacion.servicio || 'No especificado'}
        </div>
        <div class="cotizacion-detail">
          <strong>Personas</strong>
          ${cotizacion.numeroPersonas || '0'}
        </div>
        <div class="cotizacion-detail">
          <strong>Precio</strong>
          $${cotizacion.precioTotal?.toFixed(2) || '0.00'}
        </div>
      </div>
      <div class="cotizacion-actions">
        <button class="btn btn-info btn-sm ver-detalle" data-id="${cotizacion._id}">
          <i class="fas fa-eye"></i> Ver
        </button>
        <button class="btn btn-primary btn-sm cargar-cotizacion" data-id="${cotizacion._id}">
          <i class="fas fa-edit"></i> Editar
        </button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Función para mostrar modal de edición
function mostrarModalEdicion(cotizacion) {
  cotizacionEditando = cotizacion;
  
  // Llenar campos básicos
  document.getElementById('editStatus').value = cotizacion.status || 'en_proceso';
  document.getElementById('editFecha').value = cotizacion.fecha ? 
    new Date(cotizacion.fecha).toISOString().split('T')[0] : '';
  document.getElementById('editCliente').value = cotizacion.cliente || '';
  document.getElementById('editNumero').value = cotizacion.numero || '';
  document.getElementById('editHoraEvento').value = cotizacion.hora_evento || '';
  document.getElementById('editHoraServir').value = cotizacion.hora_servir || '';
  document.getElementById('editHoraSalida').value = cotizacion.hora_salida || '';
  document.getElementById('editServicio').value = cotizacion.servicio || '';
  document.getElementById('editUbicacion').value = cotizacion.ubicacion || '';
  document.getElementById('editContacto').value = cotizacion.contacto || '';
  document.getElementById('editNumeroPersonas').value = cotizacion.numeroPersonas || 1;
  
// Llenar platos desechables
  const platosDesechables = cotizacion.platosDesechables || false;
  document.getElementById('editPlatosDesechables').checked = platosDesechables;
  document.getElementById('editPlatosDesechablesText').textContent = platosDesechables ? 'Sí' : 'No';
  // Llenar tipo de platos si no son desechables
  if (!platosDesechables) {
    document.getElementById('editTipoPlatos').value = cotizacion.tipoPlatos || '';
  }
  // Notas
  const notasElement = document.getElementById('editNotas');
  notasElement.innerHTML = cotizacion.notas || '';
  
 // Llenar platos seleccionados (versión corregida)
  if (cotizacion.platosSeleccionados && cotizacion.platosSeleccionados.length > 0) {
    const checkboxes = document.querySelectorAll('#editPlatosList input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      const platoId = checkbox.getAttribute('data-id');
      const platoEnCotizacion = cotizacion.platosSeleccionados.find(p => {
        // Comparación más flexible de IDs
        return p.id === platoId || p._id === platoId || 
               (p.plato && (p.plato._id === platoId || p.plato.id === platoId));
      });
      
      if (platoEnCotizacion) {
        checkbox.checked = true;
        // Actualizar cantidad
        const cantidad = platoEnCotizacion.cantidad || 
                        cotizacion.numeroPersonas || 
                        1;
        checkbox.setAttribute('data-cantidad', cantidad);
      }
    });
    
    // Forzar actualización del resumen
    actualizarResumenPlatosEdit(cotizacion);
  }

  // Mostrar modal
  modalEditar.style.display = 'block';
}

// Función para actualizar el resumen de platos en edición
function actualizarResumenPlatosEdit(cotizacion) {
  const resumenContainer = document.getElementById('editResumenPlatos');
  const listaResumen = document.getElementById('editListaResumen');
  
  // Si se pasa la cotización completa (primera carga)
  if (cotizacion && cotizacion.platosSeleccionados) {
    listaResumen.innerHTML = '';
    
    // Agregar platos al resumen
    cotizacion.platosSeleccionados.forEach(plato => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="plato-nombre">${plato.nombre}</span>
        <span class="plato-precio">$${plato.precio_total?.toFixed(2) || '0.00'}</span>
        <span class="plato-cantidad">x${plato.cantidad || 1}</span>
      `;
      listaResumen.appendChild(li);
    });
    
    // Actualizar totales
    document.getElementById('editSubtotalResumen').textContent = cotizacion.subtotal?.toFixed(2) || '0.00';
    document.getElementById('editTaxResumen').textContent = cotizacion.tax?.toFixed(2) || '0.00';
    document.getElementById('editGratuityResumen').textContent = cotizacion.gratuity?.toFixed(2) || '0.00';
    document.getElementById('editDeliveryResumen').textContent = cotizacion.deliveryFee?.toFixed(2) || '0.00';
    document.getElementById('editTotalResumen').textContent = cotizacion.precioTotal?.toFixed(2) || '0.00';
    
    // Configurar porcentajes
    if (cotizacion.gratuityPercentage) {
      document.getElementById('editGratuityPercentage').value = cotizacion.gratuityPercentage;
    }
    
    if (cotizacion.deliveryFee) {
      document.getElementById('editDeliveryFee').value = cotizacion.deliveryFee;
    }
    
    resumenContainer.style.display = 'block';
    return;
  }
  
  // Cálculo dinámico cuando cambian los valores
  const checkboxes = document.querySelectorAll('#editPlatosList input[type="checkbox"]:checked');
  const numPersonas = parseInt(document.getElementById('editNumeroPersonas').value) || 1;
  
  if (checkboxes.length === 0) {
    resumenContainer.style.display = 'none';
    return;
  }
  
  listaResumen.innerHTML = '';
  let subtotal = 0;
  
  checkboxes.forEach(checkbox => {
    const nombre = checkbox.getAttribute('data-nombre');
    const precioPorPersona = parseFloat(checkbox.getAttribute('data-precio'));
    const cantidad = parseInt(checkbox.getAttribute('data-cantidad')) || numPersonas;
    const precioTotal = precioPorPersona * cantidad;
    
    subtotal += precioTotal;
    
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="plato-nombre">${nombre}</span>
      <span class="plato-precio">$${precioTotal.toFixed(2)}</span>
      <span class="plato-cantidad">x${cantidad}</span>
    `;
    listaResumen.appendChild(li);
  });
  
  // Calcular valores
  const tax = subtotal * 0.08;
  const gratuityPercentage = parseFloat(document.getElementById('editGratuityPercentage').value) || 20;
  const gratuity = subtotal * (gratuityPercentage / 100);
  const deliveryFee = parseFloat(document.getElementById('editDeliveryFee').value) || 0;
  const total = subtotal + tax + gratuity + deliveryFee;
  
  // Actualizar valores
  document.getElementById('editSubtotalResumen').textContent = subtotal.toFixed(2);
  document.getElementById('editTaxResumen').textContent = tax.toFixed(2);
  document.getElementById('editGratuityResumen').textContent = gratuity.toFixed(2);
  document.getElementById('editDeliveryResumen').textContent = deliveryFee.toFixed(2);
  document.getElementById('editTotalResumen').textContent = total.toFixed(2);
  
  resumenContainer.style.display = 'block';
}

// Función para mostrar/ocultar sección de delivery en edición
function toggleDeliverySectionEdit() {
  const servicio = document.getElementById('editServicio').value;
  const deliveryContainer = document.getElementById('editDeliveryContainer');
  
  if (servicio === 'Delivery Catering' || servicio === 'Pick Up') {
    deliveryContainer.style.display = 'flex';
  } else {
    deliveryContainer.style.display = 'none';
  }
}

// Función para guardar cambios al editar
async function guardarCambios() {
  if (!cotizacionEditando) return;

  // Validar formulario
  const form = document.getElementById('formEditar');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  
  // Obtener valores editados
  const editedData = {
    status: document.getElementById('editStatus').value,
    fecha: document.getElementById('editFecha').value,
    cliente: document.getElementById('editCliente').value,
    numero: document.getElementById('editNumero').value,
    hora_evento: document.getElementById('editHoraEvento').value,
    hora_servir: document.getElementById('editHoraServir').value,
    hora_salida: document.getElementById('editHoraSalida').value,
    servicio: document.getElementById('editServicio').value,
    ubicacion: document.getElementById('editUbicacion').value,
    contacto: document.getElementById('editContacto').value,
    numeroPersonas: parseInt(document.getElementById('editNumeroPersonas').value) || 1,
    platosDesechables: document.getElementById('editPlatosDesechables').checked ? 'Sí' : 'No',
    tipoPlatos: document.getElementById('editTipoPlatos').value,
    notas: document.getElementById('editNotas').innerText,
    // Obtener platos seleccionados
    platosSeleccionados: [],
    subtotal: parseFloat(document.getElementById('editSubtotalResumen').textContent) || 0,
    tax: parseFloat(document.getElementById('editTaxResumen').textContent) || 0,
    gratuity: parseFloat(document.getElementById('editGratuityResumen').textContent) || 0,
    gratuityPercentage: parseFloat(document.getElementById('editGratuityPercentage').value) || 20,
    deliveryFee: parseFloat(document.getElementById('editDeliveryFee').value) || 0,
    precioTotal: parseFloat(document.getElementById('editTotalResumen').textContent) || 0
  };
  
  // Agregar platos seleccionados
    const platosSeleccionados = [];
    document.querySelectorAll('#editPlatosList input[type="checkbox"]:checked').forEach(checkbox => {
        platosSeleccionados.push({
            id: checkbox.getAttribute('data-id'),
            nombre: checkbox.getAttribute('data-nombre'),
            precio_por_persona: parseFloat(checkbox.getAttribute('data-precio')),
            cantidad: parseInt(checkbox.getAttribute('data-cantidad')) || 
                     parseInt(document.getElementById('editNumeroPersonas').value) || 1,
            precio_total: parseFloat(checkbox.getAttribute('data-precio')) * 
                        (parseInt(checkbox.getAttribute('data-cantidad')) || 
                        parseInt(document.getElementById('editNumeroPersonas').value) || 1)
        });
    });
    editedData.platosSeleccionados = platosSeleccionados;

    mostrarLoading('Guardando cambios...');

    try {
        const response = await fetch(`/api/cotizaciones/${cotizacionEditando._id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(editedData)
        });

        // Verifica si la respuesta es JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Respuesta no JSON: ${text}`);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al guardar cambios');
        }

        alert('Cambios guardados exitosamente');
        cerrarModalEdicion();
        await cargarCotizacionesEnProceso();
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        alert(`Error: ${error.message}`);
    } finally {
        ocultarLoading();
    }
}

// Función para mostrar el detalle completo de la cotización
function mostrarDetalleCotizacion(cotizacion) {
  const modal = document.getElementById('cotizacionModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  
  const fecha = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString() : 'No especificada';
  const createdAt = cotizacion.createdAt ? new Date(cotizacion.createdAt).toLocaleString() : 'No especificada';

 modalTitle.textContent = `Cotización: ${cotizacion.cliente || 'Sin nombre'}`;

// Generar HTML de platos
let platosHTML = '';
if (cotizacion.platos && cotizacion.platos.length > 0) {
  platosHTML = cotizacion.platos.map(plato => `
    <tr>
      <td>${plato.nombre}</td>
      <td style="text-align: center;">${plato.cantidad}</td>
      <td style="text-align: right;">$${plato.precio_total?.toFixed(2) || '0.00'}</td>
    </tr>
  `).join('');
} else {
  platosHTML = '<tr><td colspan="3">No hay platos registrados</td></tr>';
}

// HTML principal
modalContent.innerHTML = `
  <div style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 900px; margin: auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 2.5rem; position: relative;">

    <!-- Fecha y usuario -->
    <div style="position: absolute; top: 2rem; right: 2rem; text-align: right; font-size: 0.9rem; color: #777;">
      <div><strong>Creado el:</strong> ${createdAt}</div>
      <div><strong>Por:</strong> ${cotizacion.creadoPor || 'Desconocido'}</div>
    </div>

    <!-- Logo -->
    <div style="text-align: center; margin-bottom: 2rem;">
      <img src="/img/logo-casa-mexico.png" alt="Logo Casa México" style="max-height: 100px; margin-bottom: 0.5rem;">
      <h2 style="margin: 0; color: #444; letter-spacing: 1px;">CASA MÉXICO CATERING</h2>
    </div>

    <!-- Información -->
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; font-size: 0.95rem;">
      <div><strong>Fecha Cotización:</strong> ${fecha}</div>
      <div><strong>Cliente:</strong> ${cotizacion.cliente || 'No especificado'}</div>
      <div><strong>Teléfono:</strong> ${cotizacion.numero || 'No especificado'}</div>
      <div><strong>Servicio:</strong> ${cotizacion.servicio || 'No especificado'}</div>
      <div><strong>Ubicación:</strong> ${cotizacion.ubicacion || 'No especificado'}</div>
      <div><strong>Hora Evento:</strong> ${cotizacion.hora_evento || 'No especificado'}</div>
      <div><strong>Hora Servir:</strong> ${cotizacion.hora_servir || 'No especificado'}</div>
      <div><strong>Hora Salida:</strong> ${cotizacion.hora_salida || 'No especificado'}</div>
      <div><strong>Contacto:</strong> ${cotizacion.contacto || 'No especificado'}</div>
      <div><strong>Personas:</strong> ${cotizacion.numeroPersonas || '0'}</div>
      <div><strong>Platos Desechables:</strong> ${cotizacion.platosDesechables ? 'Sí' : 'No'}</div>
      ${!cotizacion.platosDesechables ? `<div><strong>Tipo de Platos:</strong> ${cotizacion.tipoPlatos || 'No especificado'}</div>` : ''}
    </div>

    <!-- Detalle de platos -->
    <div>
      <h3 style="border-bottom: 2px solid #ccc; padding-bottom: 0.5rem; color: #444;">Detalle de Platos</h3>
      <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="text-align: left; padding: 0.75rem;">Nombre</th>
            <th style="text-align: center; padding: 0.75rem;">Cantidad</th>
            <th style="text-align: right; padding: 0.75rem;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${platosHTML}
        </tbody>
      </table>
    </div>

    <!-- Resumen de precios -->
    <div style="margin-top: 2rem; display: flex; justify-content: flex-end;">
      <table style="width: 100%; max-width: 400px; border-collapse: collapse; font-size: 1rem;">
        <tr>
          <td style="padding: 8px;">Subtotal:</td>
          <td style="text-align: right; padding: 8px;">$${cotizacion.subtotal?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Tax:</td>
          <td style="text-align: right; padding: 8px;">$${cotizacion.tax?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Propina (Gratuity):</td>
          <td style="text-align: right; padding: 8px;">$${cotizacion.gratuity?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td style="padding: 8px;">Delivery Fee:</td>
          <td style="text-align: right; padding: 8px;">$${cotizacion.deliveryFee?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr style="background-color: #f8f8f8; font-weight: bold;">
          <td style="padding: 10px; font-size: 1.1rem;">Total a Pagar:</td>
          <td style="text-align: right; padding: 10px; font-size: 1.1rem;">$${cotizacion.precioTotal?.toFixed(2) || '0.00'}</td>
        </tr>
      </table>
    </div>

    <!-- Notas -->
    <div style="margin-top: 2rem;">
      <h4 style="margin-bottom: 0.5rem; color: #444;">Notas</h4>
      <div style="background: #f1f1f1; border-left: 4px solid #ff9800; padding: 1rem; border-radius: 6px; color: #555;">
        ${cotizacion.notas || 'Ninguna'}
      </div>
    </div>

    <!-- Botones -->
    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
      <button class="btn btn-primary" id="imprimirPDFCliente">
        <i class="fas fa-print"></i> Imprimir PDF Cliente
      </button>
      <button class="btn btn-warning" id="imprimirPDFCocina">
        <i class="fas fa-print"></i> Imprimir PDF Cocina
      </button>
    </div>
  </div>
`;

  
  // Configurar eventos para los botones del modal
  document.getElementById('imprimirPDFCliente').addEventListener('click', () => {
  imprimirPDF('cliente');
});

document.getElementById('imprimirPDFCocina').addEventListener('click', () => {
  imprimirPDF('cocina');
});

function imprimirPDF(tipo) {
  // Clonamos el contenido del modal para no afectar el original
  const content = document.getElementById('modalContent').cloneNode(true);
  
  // Eliminamos los botones para que no aparezcan en el PDF
  const buttons = content.querySelectorAll('button');
  buttons.forEach(btn => btn.remove());
  
  // Añadimos estilos adicionales para la impresión
  const style = document.createElement('style');
  style.innerHTML = `
    @media print {
      body { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important;
      }
      * {
        box-sizing: border-box;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      .plato-nombre {
        font-weight: bold;
      }
      .plato-precio {
        color: #2e7d32;
      }
    }
  `;
  
  // Creamos un contenedor temporal para el PDF
  const pdfContainer = document.createElement('div');
  pdfContainer.appendChild(style);
  pdfContainer.appendChild(content);
  
  // Configuramos las opciones de html2pdf
  const options = {
    margin: 10,
    filename: `Cotizacion_${cotizacion.cliente || 'cotizacion'}_${tipo}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: true,
      letterRendering: true
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };
  
  // Generamos el PDF
  html2pdf()
    .set(options)
    .from(pdfContainer)
    .save()
    .then(() => {
      // Limpieza después de generar el PDF
      pdfContainer.remove();
    });
}

  
  modal.style.display = 'flex';
}

// Función para configurar eventos
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
  
  // Cerrar modal de detalle
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('cotizacionModal').style.display = 'none';
  });
  
  // Cerrar modal de edición
  document.querySelector('.close-modal-editar').addEventListener('click', cerrarModalEdicion);
  document.querySelector('.cerrar-modal-editar').addEventListener('click', cerrarModalEdicion);
  
  // Eventos para edición
  document.getElementById('editServicio').addEventListener('change', toggleDeliverySectionEdit);
  document.getElementById('editPlatosDesechables').addEventListener('change', function() {
    const isChecked = this.checked;
    document.getElementById('editPlatosDesechablesText').textContent = isChecked ? 'Sí' : 'No';
    document.getElementById('editTipoPlatosContainer').style.display = isChecked ? 'none' : 'block';
  });
  document.getElementById('editGratuityPercentage').addEventListener('change', () => actualizarResumenPlatosEdit());
  document.getElementById('editDeliveryFee').addEventListener('change', () => actualizarResumenPlatosEdit());
  document.getElementById('editNumeroPersonas').addEventListener('change', () => actualizarResumenPlatosEdit());
  
  // Botón de guardar cambios
  document.getElementById('guardarCambios').addEventListener('click', guardarCambios);
  
  // Delegación de eventos para botones de cotizaciones
  document.getElementById('cotizacionesEnProceso').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    
    const id = btn.getAttribute('data-id');
    const cotizacion = cotizacionesGuardadas.find(c => c._id === id);
    
    if (btn.classList.contains('ver-detalle')) {
      mostrarDetalleCotizacion(cotizacion);
    } else if (btn.classList.contains('cargar-cotizacion')) {
      mostrarModalEdicion(cotizacion);
    }
  });
}

// Función para cerrar modal de edición
function cerrarModalEdicion() {
  modalEditar.style.display = 'none';
  cotizacionEditando = null;
}

// Función para generar PDF (simulada)const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// Esta función genera el PDF con todos los datos y diseño que ya mostraste
function generarPDF(datos, tipo = 'cliente') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const nombreArchivo = `cotizacion_${tipo}_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, 'pdfs', nombreArchivo);

    // Asegura que el directorio exista
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Logo
    const logoPath = path.join(__dirname, 'public', 'img', 'logo-casa-mexico.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }

    // Encabezado
    doc.fontSize(20).text('CASA MÉXICO CATERING', { align: 'center', underline: true });
    doc.fontSize(14).text(tipo === 'cliente' ? 'QUOTATION' : 'ORDEN DE COCINA', {
      align: 'center',
      paragraphGap: 20
    });

    const infoX = 50;
    let currentY = 150;

    if (tipo === 'cliente') {
      // ENCABEZADO EN INGLÉS
      doc.fontSize(12)
        .text(`Date: ${datos.fecha}`, infoX, currentY)
        .text(`Quotation #: ${datos.numero}`, 300, currentY);
      currentY += 20;

      doc.text(`Client: ${datos.cliente}`, infoX, currentY)
        .text(`Service: ${datos.servicio}`, 300, currentY);
      currentY += 20;

      doc.text(`Location: ${datos.ubicacion}`, infoX, currentY)
        .text(`Guests: ${datos.numeroPersonas}`, 300, currentY);
      currentY += 30;

      doc.font('Helvetica-Bold').text('DETAILS', infoX, currentY);
      currentY += 20;

      doc.font('Helvetica')
        .text('Item', infoX, currentY)
        .text('Price per person', 200, currentY)
        .text('Quantity', 350, currentY)
        .text('Total', 450, currentY);
      currentY += 15;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      datos.platosSeleccionados.forEach(plato => {
        doc.text(plato.nombre, infoX, currentY)
          .text(`$${plato.precio_por_persona.toFixed(2)}`, 200, currentY)
          .text(plato.cantidad, 350, currentY)
          .text(`$${plato.precio_total.toFixed(2)}`, 450, currentY);
        currentY += 20;
      });

      currentY += 20;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 20;

      doc.font('Helvetica-Bold').text('PAYMENT SUMMARY', infoX, currentY);
      currentY += 20;

      doc.font('Helvetica')
        .text('Subtotal:', infoX, currentY)
        .text(`$${datos.subtotal.toFixed(2)}`, 450, currentY);
      currentY += 20;

      doc.text('Tax (8%):', infoX, currentY)
        .text(`$${datos.tax.toFixed(2)}`, 450, currentY);
      currentY += 20;

      doc.text('Gratuity (20%):', infoX, currentY)
        .text(`$${datos.gratuity.toFixed(2)}`, 450, currentY);
      currentY += 20;

      if (datos.deliveryFee > 0) {
        doc.text('Delivery Fee:', infoX, currentY)
          .text(`$${datos.deliveryFee.toFixed(2)}`, 450, currentY);
        currentY += 20;
      }

      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 20;

      doc.font('Helvetica-Bold')
        .text('TOTAL:', infoX, currentY)
        .text(`$${datos.precioTotal.toFixed(2)}`, 450, currentY);
      currentY += 30;

      doc.font('Helvetica')
        .text('Notes:', infoX, currentY)
        .text(datos.notas || 'None', infoX + 50, currentY + 20, { width: 450 });

    } else {
      // ENCABEZADO EN ESPAÑOL PARA COCINA
      doc.fontSize(12)
        .text(`Fecha: ${datos.fecha}`, infoX, currentY)
        .text(`Orden #: ${datos.numero}`, 300, currentY);
      currentY += 20;

      doc.text(`Cliente: ${datos.cliente}`, infoX, currentY)
        .text(`Servicio: ${datos.servicio}`, 300, currentY);
      currentY += 20;

      doc.text(`Ubicación: ${datos.ubicacion}`, infoX, currentY)
        .text(`Personas: ${datos.numeroPersonas}`, 300, currentY);
      currentY += 20;

      doc.text(`Hora de servir: ${datos.hora_servir}`, infoX, currentY)
        .text(`Hora de salida: ${datos.hora_salida}`, 300, currentY);
      currentY += 20;

      doc.text(`Contacto: ${datos.contacto}`, infoX, currentY);
      currentY += 30;

      doc.font('Helvetica-Bold').text('DETALLES DEL EVENTO', infoX, currentY);
      currentY += 20;

      doc.font('Helvetica')
        .text('Plato', infoX, currentY)
        .text('Precio por persona', 200, currentY)
        .text('Cantidad', 350, currentY)
        .text('Total', 450, currentY);
      currentY += 15;

      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      datos.platosSeleccionados.forEach(plato => {
        doc.text(plato.nombre, infoX, currentY)
          .text(`$${plato.precio_por_persona.toFixed(2)}`, 200, currentY)
          .text(plato.cantidad, 350, currentY)
          .text(`$${plato.precio_total.toFixed(2)}`, 450, currentY);
        currentY += 20;
      });

      currentY += 20;

      if (datos.ingredientes && datos.ingredientes.length > 0) {
        doc.font('Helvetica-Bold').text('INGREDIENTES REQUERIDOS:', infoX, currentY);
        currentY += 20;

        datos.ingredientes.forEach(ing => {
          doc.font('Helvetica').text(`• ${ing}`, infoX, currentY);
          currentY += 20;
        });

        currentY += 10;
      }

      doc.font('Helvetica-Bold').text('NOTAS:', infoX, currentY);
      currentY += 20;

      doc.font('Helvetica')
        .text(datos.notas || 'Ninguna', infoX, currentY, { width: 450 });

      doc.fontSize(10)
        .text('¡Gracias por confiar en Casa México Catering!', 50, 700, { align: 'center' });
    }

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}


// Funciones para mostrar/ocultar loading
function mostrarLoading(mensaje) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingText').textContent = mensaje || 'Procesando...';
}

function ocultarLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}