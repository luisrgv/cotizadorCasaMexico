// Variables globales
let currentUser = null;
let cotizacionesGuardadas = [];
// 1. Agregar estas variables globales
let cotizacionEditando = null;
const modalEditar = document.getElementById('modalEditar');
// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar sesión
  await verificarSesion();
    // Cargar cotizaciones impagas
  await cargarCotizacionesImpagas();
    // Configurar eventos
  configurarEventos();
});

// Cerrar modal
  document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('cotizacionModal').style.display = 'none';
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

// Función para cargar cotizaciones impagas
async function cargarCotizacionesImpagas() {
  mostrarLoading('Cargando cotizaciones...');
  
  try {
    const response = await fetch('/api/cotizaciones');
    const data = await response.json();
    cotizacionesGuardadas = data.cotizaciones || [];
    
    // Filtrar cotizaciones impagas (asumiendo que Status es un campo en MongoDB)
    const cotizacionesImpagas = cotizacionesGuardadas.filter(c => c.status === 'impaga');
    actualizarListaCotizaciones(cotizacionesImpagas);
    
    // Actualizar contador
    document.getElementById('badgeImpagas').textContent = cotizacionesImpagas.length;
  } catch (error) {
    console.error('Error al cargar cotizaciones:', error);
    alert('Error al cargar las cotizaciones');
  } finally {
    ocultarLoading();
  }
}

// Función para actualizar la lista de cotizaciones
function actualizarListaCotizaciones(cotizaciones) {
  const container = document.getElementById('cotizacionesImpagas');
  container.innerHTML = '';
  
  if (cotizaciones.length === 0) {
    container.innerHTML = '<p>No hay cotizaciones impagas.</p>';
    return;
  }
  
  cotizaciones.forEach(cotizacion => {
    const card = document.createElement('div');
    card.className = 'cotizacion-card';
    
    // Formatear fecha si existe (ajustado para MongoDB)
    const fecha = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString() : 'No especificada';
    
    card.innerHTML = `
      <div class="cotizacion-header">
        <div class="cotizacion-cliente">${cotizacion.cliente || 'Sin nombre'}</div>
        <div class="cotizacion-status status-impaga">
          Impaga
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
          $${cotizacion.precioTotal || '0'}
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
  
  // Configurar eventos para los botones de ver detalle
  document.querySelectorAll('.ver-detalle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const cotizacion = cotizaciones.find(c => c._id === id);
      mostrarDetalleCotizacion(cotizacion);
    });
  });

  
  
// Eventos para el modal de edición
  document.getElementById('guardarCambios').addEventListener('click', guardarCambios);
  document.querySelector('.cerrar-modal-editar').addEventListener('click', cerrarModalEdicion);


}
// 3. Nueva función para mostrar modal de edición
function mostrarModalEdicion(cotizacion) {
  // Llenar formulario con datos existentes
  document.getElementById('editCliente').value = cotizacion.cliente || '';
  document.getElementById('editNumero').value = cotizacion.numero || '';
  document.getElementById('editServicio').value = cotizacion.servicio || '';
  document.getElementById('editUbicacion').value = cotizacion.ubicacion || '';
  document.getElementById('editPersonas').value = cotizacion.numeroPersonas || '';
  document.getElementById('editNotas').value = cotizacion.notas || '';
  
  // Mostrar modal
  modalEditar.style.display = 'block';
}

// 4. Función para guardar cambios
async function guardarCambios() {
  mostrarLoading('Guardando cambios...');
  
  try {
    const datosActualizados = {
      cliente: document.getElementById('editCliente').value,
      numero: document.getElementById('editNumero').value,
      servicio: document.getElementById('editServicio').value,
      ubicacion: document.getElementById('editUbicacion').value,
      numeroPersonas: document.getElementById('editPersonas').value,
      notas: document.getElementById('editNotas').value
    };

    const response = await fetch(`/api/cotizaciones/${cotizacionEditando._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datosActualizados)
    });

    if (!response.ok) throw new Error('Error al guardar cambios');
    
    // Actualizar lista local y UI
    const index = cotizacionesGuardadas.findIndex(c => c._id === cotizacionEditando._id);
    cotizacionesGuardadas[index] = {...cotizacionesGuardadas[index], ...datosActualizados};
    
    actualizarListaCotizaciones(cotizacionesGuardadas.filter(c => c.status === 'en_proceso'));
    cerrarModalEdicion();
    alert('Cambios guardados exitosamente');
    
  } catch (error) {
    console.error('Error:', error);
    alert(`Error al guardar: ${error.message}`);
  } finally {
    ocultarLoading();
  }
}

// 5. Función para cerrar modal
function cerrarModalEdicion() {
  modalEditar.style.display = 'none';
  cotizacionEditando = null;
}


// Función para mostrar el detalle completo de la cotización
function mostrarDetalleCotizacion(cotizacion) {
  const modal = document.getElementById('cotizacionModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  
  const fecha = cotizacion.fecha ? new Date(cotizacion.fecha).toLocaleDateString() : 'No especificada';
  const createdAt = cotizacion.createdAt ? new Date(cotizacion.createdAt).toLocaleString() : 'No especificada';

  // Generar HTML para los platos
  let platosHTML = '';
  if (cotizacion.platos && cotizacion.platos.length > 0) {
    platosHTML = cotizacion.platos.map(plato => `
      <div style="border-bottom: 1px solid #eee; padding: 8px 0;">
        <strong>${plato.nombre}</strong><br>
        Precio por persona: $${plato.precio_por_persona?.toFixed(2) || '0.00'}<br>
        Cantidad: ${plato.cantidad}<br>
        Total: $${plato.precio_total?.toFixed(2) || '0.00'}
      </div>
    `).join('');
  } else {
    platosHTML = '<p>No hay platos registrados</p>';
  }

  modalTitle.textContent = `Cotización: ${cotizacion.cliente || 'Sin nombre'}`;
  
  modalContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div><strong>Fecha Cotización:</strong> ${fecha}</div>
      <div><strong>Creado el:</strong> ${createdAt}</div>
      <div><strong>Cliente:</strong> ${cotizacion.cliente || 'No especificado'}</div>
      <div><strong>Teléfono:</strong> ${cotizacion.numero || 'No especificado'}</div>
      <div><strong>Servicio:</strong> ${cotizacion.servicio || 'No especificado'}</div>
      <div><strong>Ubicación:</strong> ${cotizacion.ubicacion || 'No especificado'}</div>
      <div><strong>Hora Evento:</strong> ${cotizacion.hora_evento || 'No especificado'}</div>
      <div><strong>Hora Servir:</strong> ${cotizacion.hora_servir || 'No especificado'}</div>
      <div><strong>Hora Salida:</strong> ${cotizacion.hora_salida || 'No especificado'}</div>
      <div><strong>Contacto:</strong> ${cotizacion.contacto || 'No especificado'}</div>
      <div><strong>Personas:</strong> ${cotizacion.numeroPersonas || '0'}</div>
      <div><strong>Subtotal:</strong> $${cotizacion.subtotal?.toFixed(2) || '0.00'}</div>
      <div><strong>Impuestos:</strong> $${cotizacion.tax?.toFixed(2) || '0.00'}</div>
      <div><strong>Propina:</strong> $${cotizacion.gratuity?.toFixed(2) || '0.00'}</div>
      <div><strong>Delivery Fee:</strong> $${cotizacion.deliveryFee?.toFixed(2) || '0.00'}</div>
      <div><strong>Precio Total:</strong> $${cotizacion.precioTotal?.toFixed(2) || '0.00'}</div>
      <div><strong>Platos Desechables:</strong> ${cotizacion.platosDesechables ? 'Sí' : 'No'}</div>
      ${!cotizacion.platosDesechables ? `<div><strong>Tipo de Platos:</strong> ${cotizacion.tipoPlatos || 'No especificado'}</div>` : ''}
      <div style="grid-column: 1 / -1;"><strong>Notas:</strong> ${cotizacion.notas || 'Ninguna'}</div>
      <div style="grid-column: 1 / -1;"><strong>Creado por:</strong> ${cotizacion.creadoPor || 'Desconocido'}</div>
      
      <div style="grid-column: 1 / -1;">
        <h4 style="margin-bottom: 8px;">Platos:</h4>
        ${platosHTML}
      </div>
    </div>
    <div style="display: flex; gap: 1rem; justify-content: flex-end;">
      <button class="btn btn-primary" id="imprimirPDFCliente">
        <i class="fas fa-print"></i> Imprimir PDF Cliente
      </button>
      <button class="btn btn-warning" id="imprimirPDFCocina">
        <i class="fas fa-print"></i> Imprimir PDF Cocina
      </button>
    </div>
  `;
  
  // Configurar eventos para los botones del modal
  document.getElementById('imprimirPDFCliente')?.addEventListener('click', () => {
    alert('Generando PDF para cliente...');
  });
  
  document.getElementById('imprimirPDFCocina')?.addEventListener('click', () => {
    alert('Generando PDF para cocina...');
  });
  
  modal.style.display = 'flex';
}

// 2. Función para configurar eventos
function configurarEventos() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await fetch('/logout', { method: 'GET' });
      window.location.href = '/';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  });
  
  // Delegación de eventos para botón editar
  document.getElementById('cotizacionesImpagas').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const cotizacion = cotizacionesGuardadas.find(c => c._id === id);
    
    if (btn.classList.contains('cargar-cotizacion')) {
      cotizacionEditando = cotizacion;
      mostrarModalEdicion(cotizacion);
    }
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

// Función para generar PDF (simulada)
function generarPDF(cotizacion, tipo) {
  alert(`Generando PDF para ${tipo}...`);
  // Aquí implementarías la lógica real para generar PDFs
}