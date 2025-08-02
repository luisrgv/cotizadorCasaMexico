// Variables globales
let currentUser = null;
let cotizacionesGuardadas = [];
let cotizacionEditando = null;
let platosDisponibles = [];
let platosSeleccionados = [];
let filasManuales = [];
let cambiandoCategoria = false;
let encabezadoInsertado = false;

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  await verificarSesion();
  await cargarcotizacionesPagadas();
  configurarEventos();
  configurarNotasEdicion();
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


// Función para filtar cotizaciones en proceso
async function cargarcotizacionesPagadas() {
  mostrarLoading('Cargando cotizaciones...');
  
  try {
    const response = await fetch('/api/cotizaciones');
    const data = await response.json();
    cotizacionesGuardadas = data.cotizaciones || [];
    
    const cotizacionesPagadas = cotizacionesGuardadas.filter(c => c.status === 'pagado');
    actualizarListaCotizaciones(cotizacionesPagadas);
    document.getElementById('badgeEnProceso').textContent = cotizacionesPagadas.length;
  } catch (error) {
    console.error('Error al cargar cotizaciones:', error);
    alert('Error al cargar las cotizaciones');
  } finally {
    ocultarLoading();
  }
}

// Función para actualizar la lista de cotizaciones
function actualizarListaCotizaciones(cotizaciones) {
  const container = document.getElementById('cotizacionesPagadas');
  container.innerHTML = '';
  
  if (cotizaciones.length === 0) {
    container.innerHTML = '<p>No hay cotizaciones pagadas.</p>';
    return;
  }
  
   cotizaciones.forEach(cotizacion => {
    const card = document.createElement('div');
    card.className = 'cotizacion-card nueva-card-moderna';
    
    // Formatear fechas
   const fechaObj = cotizacion.fecha ? new Date(cotizacion.fecha) : null;
    if (fechaObj) {
      fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
    }
    const fecha = fechaObj ? fechaObj.toLocaleDateString('es-ES') : 'No especificada';
      const createdAt = cotizacion.createdAt ? 
      new Date(cotizacion.createdAt).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) : 'No especificada';
    const status = cotizacion.status || 'pagado';
 
    card.innerHTML = `
      <div class="nueva-cabecera">
        <div class="nueva-invoice">
          <strong>INVOICE #${cotizacion.invoiceNumber}</strong>
        </div>
        <div class="nueva-creado">
          <div><small><strong>Creado el:</strong> ${createdAt}</small></div>
          <div><small><strong>Por:</strong> ${cotizacion.creadoPor || 'Desconocido'}</small></div>
        </div>
      </div>

      <div class="nueva-status ${status}">${status.replace('_', ' ').toUpperCase()}</div>

      <div class="nueva-cuerpo">
        <div class="campo"><i class="fas fa-user"></i> <strong>Cliente:</strong> ${cotizacion.cliente || 'Sin nombre'}</div>
        <div class="campo"><i class="fas fa-calendar-alt"></i> <strong>Fecha:</strong> ${fecha}</div>
        <div class="campo"><i class="fas fa-clock"></i> <strong>Hora:</strong> ${cotizacion.hora_evento || '-'}</div>
        <div class="campo"><i class="fas fa-map-marker-alt"></i> <strong>Lugar:</strong> ${cotizacion.ubicacion || '-'}</div>
        <div class="campo"><i class="fas fa-utensils"></i> <strong>Servicio:</strong> ${cotizacion.servicio || '-'}</div>
        <div class="campo campo-notas"><strong>Observaciones:</strong> ${cotizacion.notas || 'Ninguna'}</div>
      </div>

      <div class="nueva-acciones">
        <button class="btn btn-info btn-sm ver-detalle" data-id="${cotizacion._id}">
          <i class="fas fa-eye"></i> Ver
        </button>
        <button class="btn btn-primary btn-sm cargar-cotizacion" data-id="${cotizacion._id}">
          <i class="fas fa-edit"></i> Editar
        </button>
        ${
          currentUser?.role === 'admin'
            ? `<button class="btn btn-danger btn-sm eliminar-cotizacion" data-id="${cotizacion._id}">
                <i class="fas fa-trash"></i> Eliminar
              </button>`
            : ''
        }
      </div>
    `;
    container.appendChild(card);
  });
}
// redireccionar al calendario
document.getElementById('verCalendarioBtn').addEventListener('click', () => {
      window.location.href = '/calendario';
    });
// Función para mostrar modal de edición
function mostrarModalEdicion(cotizacion) {
  // Redirigir a cotizador.html con el ID de la cotización a editar
  window.location.href = `/cotizador.html?edit=${cotizacion._id}`;
}

// Función para configurar notas en el modal de edición
function configurarNotasEdicion() {
  const notasArea = document.getElementById('editNotas');
  const editadoIcono = document.createElement('div');
  editadoIcono.id = 'editadoIconoNotas';
  editadoIcono.style.position = 'absolute';
  editadoIcono.style.top = '5px';
  editadoIcono.style.right = '10px';
  editadoIcono.style.fontSize = '0.9rem';
  editadoIcono.style.color = '#7f8c8d';
  editadoIcono.style.display = 'none';
  editadoIcono.textContent = '✏️ Editado';
  
  notasArea.parentNode.style.position = 'relative';
  notasArea.parentNode.appendChild(editadoIcono);

  function crearEncabezado() {
    const ahora = new Date();
    const fechaHora = ahora.toLocaleString();
    const encabezado = document.createElement('div');
    encabezado.textContent = `${currentUser.username} - ${fechaHora}`;
    encabezado.style.fontWeight = 'bold';
    encabezado.contentEditable = 'false';
    encabezado.id = 'encabezadoNotas';
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

  // Inicializar notas si hay contenido
  if (notasArea.innerText.trim() !== '') {
    const textoExistente = notasArea.innerText;
    notasArea.innerHTML = '';
    notasArea.appendChild(crearEncabezado());
    notasArea.appendChild(crearCuerpoNota(textoExistente));
  }

  // Detectar cambios
  notasArea.addEventListener('input', () => {
    const cuerpoNota = document.getElementById('cuerpoNota');
    
    if (!document.getElementById('encabezadoNotas')) {
      const textoUsuario = notasArea.innerText.trim();
      if (textoUsuario.length > 0) {
        notasArea.innerHTML = '';
        const encabezado = crearEncabezado();
        const cuerpoNota = crearCuerpoNota(textoUsuario);
        notasArea.appendChild(encabezado);
        notasArea.appendChild(cuerpoNota);
        colocarCursorAlFinal(cuerpoNota);
        editadoIcono.style.display = 'block';
      }
    } else {
      editadoIcono.style.display = 'block';
    }
  });

  // Escuchar Enter para agregar nueva nota
  notasArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const ahora = new Date();
      const fecha = ahora.toLocaleDateString('es-ES');
      const hora = ahora.toLocaleTimeString('es-ES', { hour12: false });
      const username = currentUser?.username || 'Usuario';

      const encabezado = document.createElement('div');
      encabezado.textContent = `${username} - ${fecha}, ${hora}`;
      encabezado.style.fontWeight = 'bold';
      encabezado.contentEditable = 'false';
      encabezado.className = 'encabezado';

      const cuerpoNota = document.createElement('div');
      cuerpoNota.contentEditable = 'true';
      cuerpoNota.className = 'cuerpoNota';
      cuerpoNota.innerHTML = '&nbsp;';

      notasArea.appendChild(encabezado);
      notasArea.appendChild(cuerpoNota);

      setTimeout(() => {
        colocarCursorAlFinal(cuerpoNota);
      }, 0);
    }
  });
}

// Función para filtrar platos por categoría
function filtrarPlatosPorCategoria(categoria) {
  cambiandoCategoria = true;
  
  document.querySelectorAll('#editCategoriasMenu .categoria-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.categoria === categoria) {
      btn.classList.add('active');
    }
  });
  
  document.querySelectorAll('#editPlatosList .plato-item').forEach(plato => {
    if (plato.dataset.categoria === categoria) {
      plato.style.display = 'block';
    } else {
      plato.style.display = 'none';
    }
  });
  
  setTimeout(() => {
    cambiandoCategoria = false;
  }, 100);
}

// Función para agregar fila manualmente
function agregarFilaManual(plato = null) {
  const tbody = document.getElementById('editListaResumen');
  const tr = document.createElement('tr');
  tr.className = 'fila-manual';
  
  tr.innerHTML = `
    <td style="padding: 5px;"><input type="text" class="form-control" style="width: 60px;" placeholder="1T" value="${plato?.cantidadTexto || '1T'}"></td>
    <td style="padding: 5px;"><input type="text" class="form-control" placeholder="Nombre del producto" value="${plato?.nombre || ''}"></td>
    <td style="padding: 5px; text-align: right;">
      <input type="number" class="form-control" style="width: 100px; text-align: right;" placeholder="0.00" step="0.01" min="0" value="${plato?.precio_total?.toFixed(2) || '0.00'}">
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn-eliminar-fila">
        <i class="fas fa-times"></i>
      </button>
    </td>
  `;
  
  tbody.appendChild(tr);
  filasManuales.push(tr);
  
  tr.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', actualizarResumenPlatos);
  });
  
  tr.querySelector('.btn-eliminar-fila').addEventListener('click', () => {
    tr.remove();
    filasManuales = filasManuales.filter(fila => fila !== tr);
    actualizarResumenPlatos();
  });
  
  actualizarResumenPlatos();
}

// Función para agregar inputs de pago
function agregarPagoInput(pago = {}) {
  const container = document.getElementById('editPagosContainer');
  const div = document.createElement('div');
  div.className = 'pago-item';
  div.innerHTML = `
    <div class="pago-fila">
      <input type="date" class="pago-fecha form-control" value="${pago.fecha || new Date().toISOString().split('T')[0]}">
      <input type="number" class="pago-monto form-control" placeholder="Monto" 
             value="${pago.monto || ''}" step="0.01" min="0">
      <select class="pago-metodo form-control">
        <option value="square" ${pago.metodo === 'square' ? 'selected' : ''}>Square</option>
        <option value="venmo" ${pago.metodo === 'venmo' ? 'selected' : ''}>Venmo</option>
        <option value="toast" ${pago.metodo === 'toast' ? 'selected' : ''}>Toast</option>
        <option value="cash" ${pago.metodo === 'cash' ? 'selected' : ''}>Cash</option>
        <option value="PO" ${pago.metodo === 'PO' ? 'selected' : ''}>PO</option>
        <option value="Zelle" ${pago.metodo === 'Zelle' ? 'selected' : ''}>Zelle</option>
        <option value="otro" ${pago.metodo === 'otro' ? 'selected' : ''}>Otro</option>
      </select>
      <input type="text" class="pago-notas form-control" placeholder="Notas" 
             value="${pago.notas || ''}">
      <button type="button" class="btn btn-danger btn-eliminar-pago">
        <i class="fas fa-trash"></i>
      </button>
    </div>
  `;
  container.appendChild(div);
  
  div.querySelector('.btn-eliminar-pago').addEventListener('click', () => {
    div.remove();
  });
  
  div.querySelector('.pago-monto').addEventListener('change', actualizarResumenPlatos);
}

// Función para actualizar el resumen de platos
function actualizarResumenPlatos() {
  if (cambiandoCategoria) return;
  
  const tbody = document.getElementById('editListaResumen');
  const filasAutomaticas = Array.from(tbody.querySelectorAll('tr')).filter(tr => 
    !tr.classList.contains('fila-manual')
  );
  filasAutomaticas.forEach(tr => tr.remove());
  
  platosSeleccionados = [];
  
  document.querySelectorAll('#editPlatosList input[type="checkbox"]:checked').forEach(checkbox => {
    const platoItem = checkbox.closest('.plato-item');
    const nombre = checkbox.getAttribute('data-nombre');
    const precioBase = parseFloat(checkbox.getAttribute('data-precio'));
    const cantidadInput = platoItem.querySelector('.cantidad-plato');
    const cantidad = parseInt(cantidadInput.value) || 1;
    const precioTotal = precioBase * cantidad;
    
    platosSeleccionados.push({
      id: checkbox.getAttribute('data-id'),
      nombre,
      precio_por_persona: precioBase,
      cantidad,
      precio_total: precioTotal
    });
    
    const tr = document.createElement('tr');
    tr.className = 'fila-automatica';
    tr.innerHTML = `
      <td style="padding: 5px;">${cantidad}</td>
      <td style="padding: 5px;">${nombre}</td>
      <td style="padding: 5px; text-align: right;">$${precioTotal.toFixed(2)}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-eliminar-fila">
          <i class="fas fa-times"></i>
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
    
    tr.querySelector('.btn-eliminar-fila').addEventListener('click', () => {
      checkbox.checked = false;
      tr.remove();
      actualizarResumenPlatos();
    });
  });
  
  // Calcular totales
  let subtotal = platosSeleccionados.reduce((sum, p) => sum + p.precio_total, 0);
  
  // Sumar filas manuales
  filasManuales.forEach(tr => {
    const precioInput = tr.querySelector('input[type="number"]');
    const precio = parseFloat(precioInput.value) || 0;
    subtotal += precio;
  });
  
  const taxPercentage = parseFloat(document.getElementById('editTaxPercentage').value) || 8;
  const tax = subtotal * (taxPercentage / 100);
  
  const gratuityPercentage = parseFloat(document.getElementById('editGratuityPercentage').value) || 20;
  const gratuity = subtotal * (gratuityPercentage / 100);
  
  const servicio = document.getElementById('editServicio').value;
  const deliveryFee = servicio === 'Delivery Catering' ? 
    (parseFloat(document.getElementById('editDeliveryFee').value) || 0) : 0;
  
  const total = subtotal + tax + gratuity + deliveryFee;
  
  document.getElementById('editSubtotalResumen').textContent = subtotal.toFixed(2);
  document.getElementById('editTaxResumen').textContent = tax.toFixed(2);
  document.getElementById('editGratuityResumen').textContent = gratuity.toFixed(2);
  document.getElementById('editDeliveryResumen').textContent = deliveryFee.toFixed(2);
  document.getElementById('editTotalResumen').textContent = total.toFixed(2);
  
  document.getElementById('editResumenPlatos').style.display = 
    (platosSeleccionados.length > 0 || filasManuales.length > 0) ? 'block' : 'none';
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

  // Validar que haya al menos un plato o fila manual
  if (platosSeleccionados.length === 0 && filasManuales.length === 0) {
    alert('Por favor seleccione al menos un plato o agregue productos manualmente');
    return;
  }

  mostrarLoading('Guardando cambios...');
  
  try {
    // Obtener valores editados
    const editedData = {
      invoiceNumber: document.getElementById('editInvoiceNumber').value,
      status: document.getElementById('editStatus').value,
      fecha: document.getElementById('editFecha').value,
      dia: document.getElementById('editDia').value,
      cliente: document.getElementById('editCliente').value,
      numero: document.getElementById('editNumero').value,
      servicio: document.getElementById('editServicio').value,
      ubicacion: document.getElementById('editUbicacion').value,
      contacto: document.getElementById('editContacto').value,
      hora_evento: document.getElementById('editHoraEvento').value,
      hora_servir: document.getElementById('editHoraServir').value,
      hora_salida: document.getElementById('editHoraSalida').value,
      taxPercentage: parseFloat(document.getElementById('editTaxPercentage').value) || 8,
      gratuityPercentage: parseFloat(document.getElementById('editGratuityPercentage').value) || 20,
      deliveryFee: document.getElementById('editServicio').value === 'Delivery Catering' ? 
        parseFloat(document.getElementById('editDeliveryFee').value) || 0 : 0,
      notas: document.getElementById('editNotas').innerText,
      notasCocina: document.getElementById('editNotasCocina').value,
      platos: [],
      pagos: []
    };
    
    // Agregar platos seleccionados
    platosSeleccionados.forEach(plato => {
      editedData.platos.push({
        id: plato.id,
        nombre: plato.nombre,
        precio_por_persona: plato.precio_por_persona,
        cantidad: plato.cantidad,
        precio_total: plato.precio_total
      });
    });
    
    // Agregar filas manuales
    filasManuales.forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      editedData.platos.push({
        nombre: inputs[1]?.value || 'Producto manual',
        precio_por_persona: parseFloat(inputs[2]?.value) || 0,
        cantidad: 1,
        precio_total: parseFloat(inputs[2]?.value) || 0
      });
    });
    
    // Calcular totales
    editedData.subtotal = editedData.platos.reduce((sum, p) => sum + (p.precio_total || 0), 0);
    editedData.tax = editedData.subtotal * (editedData.taxPercentage / 100);
    editedData.gratuity = editedData.subtotal * (editedData.gratuityPercentage / 100);
    editedData.precioTotal = editedData.subtotal + editedData.tax + editedData.gratuity + editedData.deliveryFee;
    
    // Agregar pagos
    Array.from(document.querySelectorAll('.pago-item')).forEach(item => {
      editedData.pagos.push({
        fecha: item.querySelector('.pago-fecha')?.value || new Date().toISOString().split('T')[0],
        monto: parseFloat(item.querySelector('.pago-monto')?.value) || 0,
        metodo: item.querySelector('.pago-metodo')?.value || 'cash',
        notas: item.querySelector('.pago-notas')?.value || ''
      });
    });
    
    const response = await fetch(`/api/cotizaciones/${cotizacionEditando._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al guardar cambios');
    }
    
    const data = await response.json();
    alert('Cambios guardados exitosamente');
    
    // Cerrar modal y recargar lista
    document.getElementById('modalEditar').style.display = 'none';
    await cargarcotizacionesPagadas();
    
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
  
 const fechaObj = cotizacion.fecha ? new Date(cotizacion.fecha) : null;
    if (fechaObj) {
      fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
    }
    const fecha = fechaObj ? fechaObj.toLocaleDateString('es-ES') : 'No especificada';
      const createdAt = cotizacion.createdAt ? new Date(cotizacion.createdAt).toLocaleDateString('es-ES') : 'No especificada';
  
  // Generar HTML de platos
  let platosHTML = '';
  if (cotizacion.platos && cotizacion.platos.length > 0) {
    platosHTML = cotizacion.platos.map(plato => `
      <tr>
  <td style="text-align: center;">${plato.cantidadTexto || plato.cantidad || '-'}</td>
  <td>${plato.nombre}</td>
  <td style="text-align: right;">$${plato.precio_total?.toFixed(2) || '0.00'}</td>
</tr>

    `).join('');
  } else {
    platosHTML = '<tr><td colspan="3">No hay platos registrados</td></tr>';
  }
  
  // Generar HTML de pagos
  let pagosHTML = '';
  if (cotizacion.pagos && cotizacion.pagos.length > 0) {
    pagosHTML = cotizacion.pagos.map(pago => `
      <tr>
        <td>${new Date(pago.fecha).toLocaleDateString('es-ES')}</td>
        <td>$${pago.monto?.toFixed(2) || '0.00'}</td>
        <td>${pago.metodo}</td>
        <td>${pago.notas || ''}</td>
      </tr>
    `).join('');
  } else {
    pagosHTML = '<tr><td colspan="4">No hay pagos registrados</td></tr>';
  }
  
//saldos pendientes
const totalPagado = Array.isArray(cotizacion.pagos)
  ? cotizacion.pagos.reduce((suma, pago) => suma + (parseFloat(pago.monto) || 0), 0)
  : 0;
const saldoPendiente = Math.max(0, (cotizacion.precioTotal || 0) - totalPagado);


  // HTML principal
  modalContent.innerHTML = `
    <div style="font-family: 'Poppins', sans-serif; max-width: 800px; margin: auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 2rem; position: relative;">
      <div style="position: absolute; top: 1rem; right: 1rem; text-align: right; font-size: 0.9rem; color: #777;">
        <div><strong>Creado el:</strong> ${createdAt}</div>
        <div><strong>Por:</strong> ${cotizacion.creadoPor || 'Desconocido'}</div>
      </div>

      <div style="text-align: center; margin-bottom: 1.5rem;">
      <!-- Logo -->
         <img src="/img/logo-casa-mexico.png" alt="Logo Casa México" style="max-height: 100px; margin-bottom: 0.5rem;">

        <h2 style="margin: 0; color: var(--dark);">Chef Cristina Martinez Catering</h2>
        <h3 style="margin: 0.5rem 0 1rem; color: var(--primary);">Detalle de Cotización</h3>
        <div style="font-size: 1.1rem; font-weight: 500;">Invoice #${cotizacion.invoiceNumber}</div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h4 style="border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; color: var(--dark);">Información del Evento</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
          <div><strong>Cliente:</strong> ${cotizacion.cliente || 'No especificado'}</div>
          <div><strong>Teléfono:</strong> ${cotizacion.numero || 'No especificado'}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          <div><strong>Día:</strong> ${cotizacion.dia || 'No especificado'}</div>
          <div><strong>Servicio:</strong> ${cotizacion.servicio || 'No especificado'}</div>
          <div><strong>Ubicación:</strong> ${cotizacion.ubicacion || 'No especificado'}</div>
          <div><strong>Contacto:</strong> ${cotizacion.contacto || 'No especificado'}</div>
          <div><strong>Hora Evento:</strong> ${cotizacion.hora_evento || 'No especificado'}</div>
          <div><strong>Hora Servir:</strong> ${cotizacion.hora_servir || 'No especificado'}</div>
          <div><strong>Hora Salida:</strong> ${cotizacion.hora_salida || 'No especificado'}</div>
        </div>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h4 style="border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; color: var(--dark);">Detalle de Platos</h4>
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
          <thead>
            <tr style="background: var(--light-gray);">
              <th style="text-align: center; padding: 0.75rem;">Cantidad</th>
              <th style="text-align: left; padding: 0.75rem;">Nombre</th>
              <th style="text-align: right; padding: 0.75rem;">Costo</th>
            </tr>
          </thead>
          <tbody>
            ${platosHTML}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 1.5rem;">
        <h4 style="border-bottom: 2px solid var(--primary); padding-bottom: 0.5rem; color: var(--dark);">Resumen de Pagos</h4>
        <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
          <thead>
            <tr style="background: var(--light-gray);">
              <th style="text-align: left; padding: 0.75rem;">Fecha</th>
              <th style="text-align: right; padding: 0.75rem;">Monto</th>
              <th style="text-align: left; padding: 0.75rem;">Método</th>
              <th style="text-align: left; padding: 0.75rem;">Notas</th>
            </tr>
          </thead>
          <tbody>
            ${pagosHTML}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: flex-end;">
        <table style="width: 100%; max-width: 400px; border-collapse: collapse; font-size: 1rem;">
          <tr>
            <td style="padding: 8px;">Subtotal:</td>
            <td style="text-align: right; padding: 8px;">$${cotizacion.subtotal?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Tax (${cotizacion.taxPercentage || 8}%):</td>
            <td style="text-align: right; padding: 8px;">$${cotizacion.tax?.toFixed(2) || '0.00'}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Propina (${cotizacion.gratuityPercentage || 20}%):</td>
            <td style="text-align: right; padding: 8px;">$${cotizacion.gratuity?.toFixed(2) || '0.00'}</td>
          </tr>
          ${cotizacion.deliveryFee ? `
          <tr>
            <td style="padding: 8px;">Delivery Fee:</td>
            <td style="text-align: right; padding: 8px;">$${cotizacion.deliveryFee.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="background-color: var(--light-gray); font-weight: bold;">
            <td style="padding: 10px; font-size: 1.1rem;">Total a Pagar:</td>
            <td style="text-align: right; padding: 10px; font-size: 1.1rem;">$${cotizacion.precioTotal?.toFixed(2) || '0.00'}</td>
          </tr>


           ${saldoPendiente > 0 ? `
<tr style="background-color: #ffe5e5; color: #c1121f; font-weight: bold;">
  <td style="padding: 10px; font-size: 1.1rem;">Saldo Pendiente:</td>
  <td style="text-align: right; padding: 10px; font-size: 1.1rem;">$${saldoPendiente.toFixed(2)}</td>
</tr>` : ''}
        </table>
      </div>

      <div style="margin-top: 2rem;">
        <h4 style="margin-bottom: 0.5rem; color: var(--dark);">Notas</h4>
        <div style="background: var(--light-gray); border-left: 4px solid var(--primary); padding: 1rem; border-radius: 6px; color: #555;">
          ${cotizacion.notas || 'Ninguna'}
        </div>
      </div>

      <div style="margin-top: 2rem;">
        <h4 style="margin-bottom: 0.5rem; color: var(--dark);">Notas para Cocina</h4>
        <div style="background: var(--light-gray); border-left: 4px solid var(--primary); padding: 1rem; border-radius: 6px; color: #555;">
          ${cotizacion.notasCocina || 'Ninguna'}
        </div>
      </div>

      <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
        <button class="btn btn-primary" id="imprimirPDFCliente">
          <i class="fas fa-print"></i> PDF Cliente
        </button>
        <button class="btn btn-warning" id="imprimirPDFCocina">
          <i class="fas fa-print"></i> PDF Cocina
        </button>
      </div>
    </div>
  `;
  
  
  // Configurar eventos para los botones del modal
  document.getElementById('imprimirPDFCliente').addEventListener('click', () => {
    generarPDF(cotizacion, 'cliente');
  });
  
  document.getElementById('imprimirPDFCocina').addEventListener('click', () => {
    generarPDF(cotizacion, 'cocina');
  });
  
  modal.style.display = 'flex';
}

// Función para generar PDF
async function generarPDF(cotizacion, tipo) {
  mostrarLoading(`Generando PDF para ${tipo === 'cliente' ? 'cliente' : 'cocina'}...`);
  
  try {
    const response = await fetch('/api/generar-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tipo, 
        datos: cotizacion 
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al generar PDF');
    }
    
    const data = await response.json();
    window.open(data.pdfUrl, '_blank');
    
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert(`Error: ${error.message}`);
  } finally {
    ocultarLoading();
  }
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
  
  // Cerrar modales
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.modal').style.display = 'none';
    });
  });
  
  // Evento para cambiar categorías de platos
  document.querySelectorAll('#editCategoriasMenu .categoria-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const categoria = this.dataset.categoria;
      filtrarPlatosPorCategoria(categoria);
    });
  });
  
  // Evento para cambios en platos
  document.getElementById('editPlatosList').addEventListener('change', function(e) {
    if (e.target.type === 'checkbox' || e.target.classList.contains('cantidad-plato')) {
      actualizarResumenPlatos();
    }
  });
  
  // Evento para agregar fila manual
  document.getElementById('editAgregarFilaBtn').addEventListener('click', agregarFilaManual);
  
  // Evento para agregar pago
  document.getElementById('editAgregarPagoBtn').addEventListener('click', agregarPagoInput);
  
  // Eventos para cambios en porcentajes y delivery
  document.getElementById('editTaxPercentage').addEventListener('change', actualizarResumenPlatos);
  document.getElementById('editGratuityPercentage').addEventListener('change', actualizarResumenPlatos);
  document.getElementById('editDeliveryFee').addEventListener('change', actualizarResumenPlatos);
  
  // Evento para servicio (mostrar/ocultar delivery)
  document.getElementById('editServicio').addEventListener('change', function() {
    const deliveryContainer = document.getElementById('editDeliveryContainer');
    if (this.value === 'Delivery Catering') {
      deliveryContainer.style.display = 'flex';
    } else {
      deliveryContainer.style.display = 'none';
    }
    actualizarResumenPlatos();
  });
  
  // Evento para fecha (actualizar día)
  document.getElementById('editFecha').addEventListener('change', function() {
    if (this.value) {
      const fecha = new Date(this.value);
      fecha.setMinutes(fecha.getMinutes() + fecha.getTimezoneOffset());
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      document.getElementById('editDia').value = days[fecha.getDay()];
    }
  });
  
  // Botón de guardar cambios
  document.getElementById('guardarCambios').addEventListener('click', guardarCambios);
  
  // Botones de generar PDF en modal de edición
  document.getElementById('editGenerarPDFCliente').addEventListener('click', async () => {
    if (!cotizacionEditando) return;
    await generarPDF(cotizacionEditando, 'cliente');
  });
  
  document.getElementById('editGenerarPDFCocina').addEventListener('click', async () => {
    if (!cotizacionEditando) return;
    await generarPDF(cotizacionEditando, 'cocina');
  });
  
  // Delegación de eventos para botones de cotizaciones
  document.getElementById('cotizacionesPagadas').addEventListener('click', (event) => {
    const btn = event.target.closest('button');
    if (!btn) return;
    
    const id = btn.getAttribute('data-id');
    const cotizacion = cotizacionesGuardadas.find(c => c._id === id);
    
    if (!cotizacion) return;
    
    if (btn.classList.contains('ver-detalle')) {
      mostrarDetalleCotizacion(cotizacion);
    } else if (btn.classList.contains('cargar-cotizacion')) {
      mostrarModalEdicion(cotizacion);
    }
  });
}
//Funcion para boton editar
document.addEventListener('click', e => {
  if (e.target.closest('.cargar-cotizacion')) {
    const id = e.target.closest('.cargar-cotizacion').dataset.id;
    window.location.href = `/cotizador.html?edit=${id}`;
  }
});


//funncion para eliminar cotizacion
document.addEventListener('click', async (e) => {
  if (e.target.closest('.eliminar-cotizacion')) {
    const id = e.target.closest('.eliminar-cotizacion').dataset.id;
    
    if (confirm('¿Estás seguro que deseas eliminar esta cotización? Esta acción no se puede deshacer.')) {
      try {
        const res = await fetch(`/api/cotizaciones/${id}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) throw new Error('No se pudo eliminar');

        alert('Cotización eliminada correctamente.');
        await cargarCotizacionesEnProceso(); // refrescar lista
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Ocurrió un error al intentar eliminar.');
      }
    }
  }
});

//numero de cotizaciones 

  async function actualizarBadgeCotizaciones() {
    try {
      const res = await fetch('/api/cotizaciones');
      const data = await res.json();
      const enProceso = data.cotizaciones.filter(c => c.status === 'en_proceso');
      const pagadas = data.cotizaciones.filter(c => c.status === 'pagado');
      const impagas = data.cotizaciones.filter(c => c.status === 'impago');
      const canceladas = data.cotizaciones.filter(c => c.status === 'cancelado');

      document.getElementById('badgeEnProceso').textContent = enProceso.length;
      document.getElementById('badgePagadas') && (document.getElementById('badgePagadas').textContent = pagadas.length);
      document.getElementById('badgeImpagas') && (document.getElementById('badgeImpagas').textContent = impagas.length);
        document.getElementById('badgeCanceladas') && (document.getElementById('badgeCanceladas').textContent = canceladas.length);
    } catch (err) {
      console.error('Error cargando cotizaciones:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    actualizarBadgeCotizaciones();
  });
// Funciones para mostrar/ocultar loading
function mostrarLoading(mensaje) {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.getElementById('loadingText').textContent = mensaje;
}

function ocultarLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
}
