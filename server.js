require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs');



// Configuración de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(express.static("public")); // si tienes tu HTML allí

// Modelos
const User = require('./models/User');
const Plato = require('./models/Plato');
const Cotizacion = require('./models/Cotizacion');



// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(err => console.error('Error de conexión a MongoDB:', err));

// Middlewares
app.use(session({
  secret: process.env.SESSION_SECRET || 'secretoSuperSecreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'lax'
  }
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Ruta de login
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  
  try {
    const user = await User.findOne({ usuario, password });
    
    if (user) {
      req.session.user = {
        username: user.usuario,
        role: user.rol
      };
      res.json({ ok: true, role: user.rol });
    } else {
      res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// Middleware para verificar autenticación
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Ruta de logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Información del usuario
app.get('/api/user-info', (req, res) => {
  res.json({ user: req.session.user || null });
});

// Ruta para obtener eventos del calendario
app.get('/api/eventos', async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const eventos = await Cotizacion.find({
      fecha: { $gte: hoy }
    }).sort({ fecha: 1 });
    
    res.json({ eventos });
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.json({ eventos: [] });
  }
});

// Obtener platos
app.get('/api/platos', async (req, res) => {
  try {
    const platos = await Plato.find().sort({ nombre: 1 });
    res.json({ platos });
  } catch (error) {
    console.error('Error al cargar platos:', error);
    res.status(500).json({ error: 'Error al cargar los platos' });
  }
});

// Calcular proforma automática
app.post('/api/calcular-proforma', requireLogin, async (req, res) => {
  const { numPersonas, platosSeleccionados } = req.body;
  
  try {
    const platosData = await Plato.find();
    let subtotal = 0;
    let ingredientes = [];
    
    platosSeleccionados.forEach(platoSel => {
      const plato = platosData.find(p => p.nombre === platoSel.nombre);
      
      if (plato) {
        subtotal += numPersonas * parseFloat(plato.precio_por_persona);
        
        if (plato.ingredientes && plato.ingredientes.length > 0) {
          plato.ingredientes.forEach(ing => {
            if (ing.trim() !== '') {
              ingredientes.push(`${ing.trim()} (${Math.ceil(numPersonas * 0.2)} ${ing.includes('Tortillas') ? 'piezas' : 'kg'})`);
            }
          });
        }
      }
    });

    const tax = subtotal * 0.08;
    const gratuity = subtotal * 0.20;
    const precioTotal = subtotal + tax + gratuity;

    res.json({
      precioTotal,
      subtotal,
      tax,
      gratuity,
      ingredientes: [...new Set(ingredientes)]
    });
  } catch (error) {
    console.error('Error al calcular proforma:', error);
    res.status(500).json({ error: 'Error al calcular proforma' });
  }
});



// Eliminar cotización por ID
app.delete('/api/cotizaciones/:id', requireLogin, async (req, res) => {
  try {
    const result = await Cotizacion.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar cotización:', error);
    res.status(500).json({ error: 'Error al eliminar cotización' });
  }
});



// Función para generar PDFs
const generarPDF = (tipo, datos) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const nombreArchivo = `${tipo}_${datos.cliente.replace(/\s/g, '_')}_${Date.now()}.pdf`;
    const rutaPDF = path.join(__dirname, 'public', 'pdfs', nombreArchivo);
    const stream = fs.createWriteStream(rutaPDF);
    doc.pipe(stream);

    const totalPagado = (datos.pagos || []).reduce((suma, p) => suma + (p.monto || 0), 0);
    const saldoPendiente = Math.max(0, datos.precioTotal - totalPagado);
    const taxExempt = datos.taxExempt || false;

    // Logo
    const logoPath = path.join(__dirname, 'public', 'img', 'logo-casa-mexico.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 30, 30, { width: 100 });
    }

    // Encabezado
    doc.fillColor('#1d3557')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('Chef Cristina Martinez Catering', {
         align: 'center',
         paragraphGap: 5
       });
    
    doc.fontSize(14)
       .text(`Invoice #: ${datos.invoiceNumber || 'N/A'}`, {
         align: 'center',
         paragraphGap: 20
       });

    // Línea decorativa
    doc.moveTo(50, 120)
       .lineTo(550, 120)
       .lineWidth(2)
       .stroke('#E4007C');

    // Información principal
    const infoX = 50;
    let currentY = 140;

    // Formato de fecha
    const fechaObj = new Date(datos.fecha);
    fechaObj.setMinutes(fechaObj.getMinutes() + fechaObj.getTimezoneOffset());
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES');

    // Agrega fila de texto
    const agregarFila = (label, value, isBold = false) => {
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(10)
         .text(label, infoX, currentY, { width: 150, align: 'left' })
         .text(value, infoX + 160, currentY, { width: 340, align: 'left' });
      currentY += 20;
    };

    // Función para manejar texto largo en filas manuales
    const agregarTextoConSalto = (texto, x, y, maxWidth, maxHeight, lineHeight = 15) => {
      const palabras = texto.split(' ');
      let linea = '';
      let lineas = [];
      
      for (let i = 0; i < palabras.length; i++) {
        const palabra = palabras[i];
        const testLinea = linea + (linea ? ' ' : '') + palabra;
        const testWidth = doc.widthOfString(testLinea);
        
        if (testWidth > maxWidth && i > 0) {
          lineas.push(linea);
          linea = palabra;
        } else {
          linea = testLinea;
        }
      }
      lineas.push(linea);
      
      // Asegurar que no exceda el máximo de líneas permitidas
      if (lineas.length * lineHeight > maxHeight) {
        lineas = lineas.slice(0, Math.floor(maxHeight / lineHeight));
        lineas[lineas.length - 1] += '...';
      }
      
      // Dibujar las líneas
      lineas.forEach((linea, i) => {
        doc.text(linea, x, y + (i * lineHeight), { width: maxWidth });
      });
      
      return lineas.length * lineHeight;
    };

    // Función para asegurar espacio en la página
    const asegurarEspacio = (alturaNecesaria = 100) => {
      if (currentY + alturaNecesaria > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
      }
    };

    // Color de estado
    let statusColor = '#000000';
    if (datos.status === 'pagado') statusColor = '#2a9d8f';
    if (datos.status === 'impago') statusColor = '#e63946';
    if (datos.status === 'en_proceso') statusColor = '#e9c46a';
    if (datos.status === 'cancelado') statusColor = '#f4a261';

    // Información básica común
    agregarFila(tipo === 'cliente' ? 'Date:' : 'Fecha:', fechaFormateada, true);
    agregarFila(tipo === 'cliente' ? 'Day:' : 'Día:', datos.dia);
    agregarFila(tipo === 'cliente' ? 'Client:' : 'Cliente:', datos.cliente, true);
    agregarFila(tipo === 'cliente' ? 'Contact Number:' : 'Número de contacto:', datos.numero);
    agregarFila(tipo === 'cliente' ? 'Event Time:' : 'Hora del evento:', datos.hora_evento);

    if (tipo === 'cliente') {
      // PDF del cliente (inglés) - Versión detallada
      agregarFila('Service:', datos.servicio);
      agregarFila('Location:', datos.ubicacion);
      agregarFila('Serving Time:', datos.hora_servir);
      agregarFila('Status:', datos.status.toUpperCase(), true);
      doc.fillColor(statusColor).text(datos.status.toUpperCase(), infoX + 160, currentY - 20);
      doc.fillColor('#000000');

      currentY += 30;
      doc.font('Helvetica-Bold').text('MENU DETAILS', infoX, currentY);
      currentY += 20;

      // Encabezados de tabla
      doc.font('Helvetica-Bold')
         .text('Quantity', infoX, currentY, { width: 80 })
         .text('Product', infoX + 90, currentY, { width: 250 })
         .text('Cost', 450, currentY, { width: 100, align: 'right' });
      
      currentY += 15;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      
      // Procesar todos los platos
      if (!Array.isArray(datos.platos)) datos.platos = [];
      
      // Agregar filas manuales si existen
      if (datos.filasManuales && Array.isArray(datos.filasManuales)) {
        datos.filasManuales.forEach(fila => {
          datos.platos.push({
            nombre: fila.nombre,
            cantidadTexto: fila.cantidadTexto,
            precio_total: fila.precio_total,
            esManual: true,
            categoria: ''
          });
        });
      }

      // Agrupar por categoría
      const platosPorCategoria = {};
      datos.platos.forEach(plato => {
        if (!platosPorCategoria[plato.categoria]) {
          platosPorCategoria[plato.categoria] = [];
        }
        platosPorCategoria[plato.categoria].push(plato);
      });

      // Procesar cada categoría
      for (const categoria in platosPorCategoria) {
        asegurarEspacio(30);
        
        // Agregar fila de categoría
        doc.font('Helvetica-Bold')
           .text(categoria.toUpperCase(), infoX, currentY);
        currentY += 20;
        
        // Procesar platos de esta categoría
        platosPorCategoria[categoria].forEach(plato => {
          asegurarEspacio(50);
          
          // Estilo diferente para filas manuales
          if (plato.esManual) {
            doc.font('Helvetica-Oblique')
               .fillColor('#555555');
          } else {
            doc.font('Helvetica')
               .fillColor('#000000');
          }

          // Mostrar cantidad
          doc.fontSize(10)
             .text(plato.cantidadTexto || plato.cantidad || '-', infoX, currentY, { width: 80 });
          
          // Mostrar nombre del producto con manejo de texto largo
          const alturaTexto = agregarTextoConSalto(
            plato.nombre, 
            infoX + 90, 
            currentY, 
            250, 
            50, 
            15
          );
          
          // Mostrar precio alineado a la derecha
          doc.text(`$${plato.precio_total.toFixed(2)}`, 450, currentY, { width: 100, align: 'right' });
          
          currentY += Math.max(15, alturaTexto);

          // Mostrar descripción si no es manual
          if (plato.descripcion && !plato.esManual) {
            const descripcionLimpia = (plato.descripcion || '')
              .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚ]+/, '')
              .replace(/[‘’‚‛‟"ʼʽ]/g, "'")
              .replace(/[!¡]/g, '')
              .replace(/[\r\n\t]+/g, ' ')
              .trim();

            const alturaDescripcion = doc.heightOfString(`→ ${descripcionLimpia}`, {
              width: 400,
              align: 'justify',
              lineGap: 2
            });

            asegurarEspacio(alturaDescripcion + 20);
            
            doc.font('Helvetica-Oblique')
               .fontSize(9)
               .fillColor('#555555')
               .text(`→ ${descripcionLimpia}`, infoX + 90, currentY, {
                 width: 400,
                 align: 'justify',
                 lineGap: 2
               });

            currentY += alturaDescripcion + 5;
            doc.fillColor('#000000').fontSize(10);
          } else {
            currentY += 10;
          }
        });
      }

      currentY += 20;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      
      const agregarFilaDerecha = (label, value, isBold = false, color = '#000000') => {
        asegurarEspacio(20);
        doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(color)
          .fontSize(10)
          .text(label, infoX, currentY, { width: 150, align: 'left' })
          .text(value, infoX + 160, currentY, { width: 340, align: 'right' });
        currentY += 20;
        doc.fillColor('#000000');
      };

      asegurarEspacio(80);
      agregarFilaDerecha('Subtotal:', `$${datos.subtotal.toFixed(2)}`);
      asegurarEspacio(60);
      
           // Mostrar Tax Exempt si corresponde
  if (datos.taxExempt) {
    agregarFilaDerecha('TAX EXEMPT:', '$0.00', true, '#e63946');
  } else {
    agregarFilaDerecha(`Tax (${datos.taxPercentage}%):`, `$${datos.tax.toFixed(2)}`);
  }
  
      
      asegurarEspacio(60);
      agregarFilaDerecha(`Gratuity (${datos.gratuityPercentage}%):`, `$${datos.gratuity.toFixed(2)}`);
      
      if (datos.deliveryFee > 0) {
        agregarFilaDerecha('Delivery Fee:', `$${datos.deliveryFee.toFixed(2)}`);
      }

      currentY += 10;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      asegurarEspacio(100);
      
      doc.font('Helvetica-Bold')
         .text('TOTAL:', infoX, currentY, { width: 150, align: 'left' })
         .text(`$${datos.precioTotal.toFixed(2)}`, infoX + 160, currentY, { width: 340, align: 'right' });
      currentY += 20;
   
      if (totalPagado > 0 && saldoPendiente > 0) {
        asegurarEspacio(60);
        doc.font('Helvetica-Bold')
           .fillColor('#e63946')
           .text('OUTSTANDING BALANCE:', infoX, currentY, { width: 150, align: 'left' })
           .text(`$${saldoPendiente.toFixed(2)}`, infoX + 160, currentY, { width: 340, align: 'right' });
        doc.fillColor('#000000');
      }

      // Agregar política de precios
      asegurarEspacio(100);
      currentY += 20;
      doc.font('Helvetica-Bold')
         .text('PRICE POLICY:', infoX, currentY);
      currentY += 20;
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#555555')
         .text('The prices listed in this invoice are valid only during the calendar month in which the menu is consulted or issued. In the case of deposits, reservations, or advance payments, any price changes that occur afterward (due to monthly adjustments, inflation, or other factors) will apply to the outstanding balance or any services not yet rendered, regardless of the date of the initial payment. By proceeding, the customer acknowledges that the prices in effect at the time of service will apply.', 
         infoX, currentY, {
           width: 500,
           align: 'justify',
           lineGap: 3
         });

    } else {
      // PDF Cocina (español) - Versión simplificada
      agregarFila('Servicio:', datos.servicio);
      agregarFila('Ubicación:', datos.ubicacion);
      agregarFila('Contacto en lugar:', datos.contacto);
      agregarFila('Hora de servir:', datos.hora_servir);
      agregarFila('Hora de salida:', datos.hora_salida);
      agregarFila('Estado:', datos.status.toUpperCase(), true);
      doc.fillColor(statusColor).text(datos.status.toUpperCase(), infoX + 160, currentY - 20);
      doc.fillColor('#000000');

      currentY += 30;
      doc.font('Helvetica-Bold').text('DETALLES DEL MENÚ', infoX, currentY);
      currentY += 20;

      doc.font('Helvetica-Bold')
         .text('Cantidad', infoX, currentY, { width: 80 })
         .text('Producto', infoX + 90, currentY, { width: 350 });
      currentY += 15;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      // Procesar todos los platos
      if (!Array.isArray(datos.platos)) datos.platos = [];
      
      // Agrupar por categoría
      const platosPorCategoria = {};
      datos.platos.forEach(plato => {
        if (!platosPorCategoria[plato.categoria]) {
          platosPorCategoria[plato.categoria] = [];
        }
        platosPorCategoria[plato.categoria].push(plato);
      });

      // Procesar cada categoría
      for (const categoria in platosPorCategoria) {
        asegurarEspacio(30);
        
        // Agregar fila de categoría
        doc.font('Helvetica-Bold')
           .text(categoria.toUpperCase(), infoX, currentY);
        currentY += 20;
        
        // Procesar platos de esta categoría
        platosPorCategoria[categoria].forEach(plato => {
          asegurarEspacio(50);
          
          // Estilo diferente para filas manuales
          if (plato.esManual) {
            doc.font('Helvetica-Oblique')
               .fillColor('#555555');
          } else {
            doc.font('Helvetica')
               .fillColor('#000000');
          }

          // Mostrar cantidad
          doc.fontSize(10)
             .text(plato.cantidadTexto || plato.cantidad || '-', infoX, currentY, { width: 80 });
          
          // Mostrar nombre del producto con manejo de texto largo
          const alturaTexto = agregarTextoConSalto(
            plato.nombre, 
            infoX + 90, 
            currentY, 
            350, 
            50, 
            15
          );
          
          currentY += Math.max(15, alturaTexto);

          // Mostrar descripción 
          if (plato.descripcion && !plato.esManual) {
            const descripcionLimpia = (plato.descripcion || '')
              .replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚ]+/, '')
              .replace(/[‘’‚‛‟"ʼʽ]/g, "'")
              .replace(/[!¡]/g, '')
              .replace(/[\r\n\t]+/g, ' ')
              .trim();
            
            const alturaDescripcion = doc.heightOfString(`→ ${descripcionLimpia}`, {
              width: 400,
              align: 'justify'
            });
            
            asegurarEspacio(alturaDescripcion + 20);
            
            doc.font('Helvetica-Oblique')
               .fontSize(9)
               .fillColor('#555555')
               .text(`→ ${descripcionLimpia}`, infoX + 90, currentY, {
                 width: 400,
                 align: 'justify',
                 lineGap: 2
               });
            
            currentY += alturaDescripcion + 5;
            doc.fillColor('#000000').fontSize(10);
          } else {
            currentY += 10;
          }
        });
      }

      asegurarEspacio(80);
      // Saldo pendiente
      if (saldoPendiente > 0) {
        currentY += 20;
        doc.font('Helvetica-Bold')
           .fillColor('#e63946')
           .text('SALDO PENDIENTE:', infoX, currentY)
           .text(`$${saldoPendiente.toFixed(2)}`, 400, currentY);
        doc.fillColor('#000000');
      }

      // Notas para cocina
      if (datos.notasCocina && datos.notasCocina !== 'Ninguna') {
        asegurarEspacio(60);
        currentY += 20;
        doc.font('Helvetica-Bold')
           .text('Notas para cocina:', infoX, currentY);
        currentY += 20;
        doc.font('Helvetica')
           .text(datos.notasCocina, infoX, currentY, { width: 500 });
      }
    }

    // Finalizar PDF
    doc.end();
    stream.on('finish', () => resolve(nombreArchivo));
  });
};


// Crear cotización
app.post('/api/cotizaciones', requireLogin, async (req, res) => {
  const datos = req.body;
  const usuario = req.session.user.username;

  try {
    if (!datos.platos || !Array.isArray(datos.platos)) {
      throw new Error('No se han seleccionado platos');
    }

    // Buscar si ya existe cotización con ese invoiceNumber
    let cotizacion = await Cotizacion.findOne({ invoiceNumber: datos.invoiceNumber });

    const cotizacionData = {
      fecha: datos.fecha,
      dia: datos.dia,
      cliente: datos.cliente,
      numero: datos.numero,
      hora_evento: datos.hora_evento,
      hora_servir: datos.hora_servir,
      hora_salida: datos.hora_salida,
      servicio: datos.servicio,
      ubicacion: datos.ubicacion,
      contacto: datos.contacto,
      status: datos.status || 'impago',
      platos: datos.platos.map(p => ({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      categoria: p.categoria || '',
      precio_por_persona: p.precio_por_persona,
      cantidad_personas: p.cantidad || 1,
      cantidad: p.cantidad || 1,
      cantidadTexto: p.cantidadTexto || (p.cantidad === 0.5 ? '½T' : `${p.cantidad}T`),
      precio_total: p.precio_total
     
})) ,

      numeroPersonas: datos.numeroPersonas || datos.platos.reduce((total, p) => total + (p.cantidad || 0), 0),
      subtotal: datos.subtotal,
        taxExempt: datos.taxExempt || false,
    taxPercentage: datos.taxExempt ? 0 : (datos.taxPercentage || 8),
      tax: datos.tax,
      taxPercentage: datos.taxPercentage ,
      gratuity: datos.gratuity,
      gratuityPercentage: datos.gratuityPercentage ,
      deliveryFee: datos.deliveryFee || 0,
      precioTotal: datos.precioTotal,
      notas: datos.notas || 'Ninguna',
      notasCocina: datos.notasCocina || 'Ninguna',
      creadoPor: cotizacion?.creadoPor || usuario,
  createdAt: cotizacion?.createdAt || new Date(),
       pagos: datos.pagos || [],
      updatedAt: new Date()
    };

    if (cotizacion) {
      // Actualizar la cotización existente
      await Cotizacion.updateOne({ invoiceNumber: datos.invoiceNumber }, cotizacionData);
    } else {
      // Crear nueva cotización
      cotizacion = new Cotizacion({
        invoiceNumber: datos.invoiceNumber,
        ...cotizacionData
      });
      await cotizacion.save();
    }

    // Recargar la cotización completa desde la BD
    const cotizacionActualizada = await Cotizacion.findOne({ invoiceNumber: datos.invoiceNumber });

    // Generar PDFs
    const pdfCliente = await generarPDF('cliente', cotizacionActualizada.toObject());
    const pdfCocina = await generarPDF('cocina', cotizacionActualizada.toObject());

    res.json({
      success: true,
      cotizacion: cotizacionActualizada,
      pdfCliente: `/pdfs/${pdfCliente}`,
      pdfCocina: `/pdfs/${pdfCocina}`
    });

  } catch (error) {
    console.error('Error al guardar cotización:', error);
    res.status(500).json({
      error: error.message || 'Error al guardar cotización',
      detalles: error.stack
    });
  }
});

   

// Obtener cotizaciones
app.get('/api/cotizaciones', requireLogin, async (req, res) => {
  try {
    const cotizaciones = await Cotizacion.find().sort({ createdAt: -1 });
    res.json({ cotizaciones });
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// Obtener último número de invoice
app.get('/api/cotizaciones/ultimo-invoice', requireLogin, async (req, res) => {
  try {
    const ultimaCotizacion = await Cotizacion.findOne().sort('-invoiceNumber');
    res.json({ 
      success: true,
      ultimoInvoice: ultimaCotizacion ? ultimaCotizacion.invoiceNumber : 0 
    });
  } catch (error) {
    console.error('Error al obtener último invoice:', error);
    res.status(500).json({ 
      error: 'Error al obtener último invoice',
      detalles: error.stack
    });
  }
});

// Generar PDF sin guardar
app.post('/api/generar-pdf', requireLogin, async (req, res) => {
  const { tipo, datos } = req.body;
  
  try {
    // Validar datos mínimos
    if (!datos.cliente || !datos.fecha) {
      throw new Error('Se requieren cliente y fecha');
    }

    // Asegurar que platosSeleccionados sea un array
    if (!datos.platosSeleccionados || !Array.isArray(datos.platosSeleccionados)) {
      datos.platosSeleccionados = [];
    }

    // Calcular totales si no están presentes
    if (typeof datos.subtotal === 'undefined') {
      datos.subtotal = datos.platosSeleccionados.reduce((sum, p) => sum + (p.precio_total || 0), 0);
      datos.tax = datos.subtotal * ((datos.taxPercentage || 8) / 100);
      datos.gratuity = datos.subtotal * ((datos.gratuityPercentage || 20) / 100);
      datos.precioTotal = datos.subtotal + datos.tax + datos.gratuity + (datos.deliveryFee || 0);
    }

    // Crear directorio para PDFs si no existe
    if (!fs.existsSync(path.join(__dirname, 'public', 'pdfs'))) {
      fs.mkdirSync(path.join(__dirname, 'public', 'pdfs'));
    }

    // Generar el PDF
    const pdfNombre = await generarPDF(tipo, datos);
    
    res.json({
      success: true,
      pdfUrl: `/pdfs/${pdfNombre}`
    });

  } catch (error) {
    console.error('Error al generar PDF:', error);
    res.status(500).json({ 
      error: error.message || 'Error al generar PDF',
      detalles: error.stack
    });
  }
});

// cargar cotizacion para editar
app.get('/api/cotizaciones/:id', requireLogin, async (req, res) => {
  try {
    const cotizacion = await Cotizacion.findById(req.params.id);
    if (!cotizacion) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json({ cotizacion });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la cotización' });
  }
});

// Rutas estáticas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/cotizador', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cotizador.html'));
});

app.get('/calendario', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'calendario.html'));
});
// Rutas para platos
app.get('/api/platos', async (req, res) => {
  try {
    const platos = await Plato.find().sort({ categoria: 1, nombre: 1 });
    res.json({ platos });
  } catch (error) {
    console.error('Error al obtener platos:', error);
    res.status(500).json({ error: 'Error al obtener platos' });
  }
});

app.post('/api/platos', requireLogin, async (req, res) => {
  try {
    const { nombre, categoria, precio_15, precio_30, precio_full, descripcion } = req.body;
    
    const platoData = {
      nombre,
      categoria,
      descripcion
    };
    
    if (categoria === 'Desserts') {
      platoData.precio_full = precio_full;
    } else {
      platoData.precio_15 = precio_15;
      platoData.precio_30 = precio_30;
    }
    
    const plato = new Plato(platoData);
    await plato.save();
    
    res.json({ success: true, plato });
  } catch (error) {
    console.error('Error al crear plato:', error);
    res.status(500).json({ error: 'Error al crear plato' });
  }
});

app.put('/api/platos/:id', requireLogin, async (req, res) => {
  try {
    const { nombre, categoria, precio_15, precio_30, precio_full, descripcion } = req.body;
    
    const platoData = {
      nombre,
      categoria,
      descripcion
    };
    
    if (categoria === 'Desserts') {
      platoData.precio_full = precio_full;
    } else {
      platoData.precio_15 = precio_15;
      platoData.precio_30 = precio_30;
    }
    
    const plato = await Plato.findByIdAndUpdate(req.params.id, platoData, { new: true });
    
    if (!plato) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
    
    res.json({ success: true, plato });
  } catch (error) {
    console.error('Error al actualizar plato:', error);
    res.status(500).json({ error: 'Error al actualizar plato' });
  }
});

app.delete('/api/platos/:id', requireLogin, async (req, res) => {
  try {
    const plato = await Plato.findByIdAndDelete(req.params.id);
    
    if (!plato) {
      return res.status(404).json({ error: 'Plato no encontrado' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar plato:', error);
    res.status(500).json({ error: 'Error al eliminar plato' });
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
