require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Modelos
const User = require('./models/User');
const Plato = require('./models/Plato');
const Cotizacion = require('./models/Cotizacion');

// Configuración de la aplicación
const app = express();
const PORT = process.env.PORT || 3000;

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

// Función para generar PDFs
const generarPDF = (tipo, datos) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const nombreArchivo = `${tipo}_${datos.cliente.replace(/\s/g, '_')}_${Date.now()}.pdf`;
    const rutaPDF = path.join(__dirname, 'public', 'pdfs', nombreArchivo);
    const stream = fs.createWriteStream(rutaPDF);
    doc.pipe(stream);

    // Logo
    const logoPath = path.join(__dirname, 'public', 'img', 'logo-casa-mexico.png');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 45, { width: 100 });
    }

    // Encabezado
    doc.fillColor('#1d3557')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text(tipo === 'cliente' ? 'CASA MÉXICO CATERING' : 'CASA MÉXICO CATERING', {
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
       .stroke('#e63946');

    // Información principal
    const infoX = 50;
    let currentY = 140;

    // Función para agregar fila de información
    const agregarFila = (label, value, isBold = false) => {
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(10)
         .text(label, infoX, currentY, { width: 150, align: 'left' })
         .text(value, infoX + 160, currentY, { width: 340, align: 'left' });
      currentY += 20;
    };

    // Status con color
    let statusColor = '#000000';
    if (datos.status === 'pagado') statusColor = '#2a9d8f';
    if (datos.status === 'impago') statusColor = '#e63946';
    if (datos.status === 'en_proceso') statusColor = '#e9c46a';

    // Información común
        agregarFila('Date:', datos.fecha, true);
    agregarFila('Day:', datos.dia);
    agregarFila('Client:', datos.cliente, true);
    agregarFila('Contact Number:', datos.numero);
    agregarFila('Event Time:', datos.hora_evento);
    
    if (tipo === 'cliente') {
      // PDF Cliente (inglés)
      agregarFila('Service:', datos.servicio);
      agregarFila('Location:', datos.ubicacion);
      agregarFila('Serving Time:', datos.hora_servir);
      agregarFila('Status:', datos.status.toUpperCase(), true);
      doc.fillColor(statusColor).text(datos.status.toUpperCase(), infoX + 160, currentY - 20);
      doc.fillColor('#000000');
      
      currentY += 30;
      
      // Tabla de platos
      doc.font('Helvetica-Bold')
         .text('MENU DETAILS', infoX, currentY);
      currentY += 20;
      
      doc.font('Helvetica-Bold')
   .text('Item', infoX, currentY)
   .text('Price', 400, currentY);

      currentY += 15;
      
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      // Antes del forEach
if (!Array.isArray(datos.platos)) {
  datos.platos = [];
}
      datos.platos.forEach(plato => {
        doc.font('Helvetica')
           .text(plato.nombre, infoX, currentY, { width: 300 })
           .text(`$${plato.precio_total.toFixed(2)}`, 400, currentY);
        currentY += 20;
      });
      
      // Totales
      currentY += 20;
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 20;
      
      agregarFila('Subtotal:', `$${datos.subtotal.toFixed(2)}`);
      agregarFila(`Tax (${datos.taxPercentage}%):`, `$${datos.tax.toFixed(2)}`);
      agregarFila(`Gratuity (${datos.gratuityPercentage}%):`, `$${datos.gratuity.toFixed(2)}`);
      if (datos.deliveryFee > 0) {
        agregarFila('Delivery Fee:', `$${datos.deliveryFee.toFixed(2)}`);
      }
      
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 20;
      
      agregarFila('TOTAL:', `$${datos.precioTotal.toFixed(2)}`, true);
      doc.font('Helvetica-Bold').text(`$${datos.precioTotal.toFixed(2)}`, 450, currentY - 20);
      
      // Pie de página
      currentY = 700;
      doc.fontSize(10)
        
    } else {
      // PDF Cocina (español)
      agregarFila('Servicio:', datos.servicio);
      agregarFila('Ubicación:', datos.ubicacion);
      agregarFila('Contacto en lugar:', datos.contacto);
      agregarFila('Hora de servir:', datos.hora_servir);
      agregarFila('Hora de salida:', datos.hora_salida);
      agregarFila('Estado:', datos.status.toUpperCase(), true);
      doc.fillColor(statusColor).text(datos.status.toUpperCase(), infoX + 160, currentY - 20);
      doc.fillColor('#000000');
      
      currentY += 30;
      
      // Tabla de platos
      doc.font('Helvetica-Bold')
         .text('DETALLES DEL MENÚ', infoX, currentY);
      currentY += 20;
      
      doc.font('Helvetica-Bold')
          .text('Cantidad', 400, currentY)
         .text('Plato', infoX, currentY);
      currentY += 15;
      
      doc.moveTo(infoX, currentY).lineTo(550, currentY).stroke();
      currentY += 10;
      // Antes del forEach
if (!Array.isArray(datos.platos)) {
  datos.platos = [];
}
      datos.platos.forEach(plato => {
        doc.font('Helvetica')
          .text((plato.cantidad_personas || 0).toString(), infoX, currentY, { width: 100 })
          .text(plato.nombre, infoX + 120, currentY, { width: 380 });
        currentY += 20;
      });
      
      // Saldo pendiente
      if (datos.status !== 'pagado') {
        currentY += 20;
        doc.font('Helvetica-Bold')
           .fillColor('#e63946')
           .text('SALDO PENDIENTE:', infoX, currentY)
           .text(`$${datos.precioTotal.toFixed(2)}`, 400, currentY);
        doc.fillColor('#000000');
      }
      
      // Notas para cocina
      if (datos.notasCocina && datos.notasCocina !== 'Ninguna') {
        currentY += 40;
        doc.font('Helvetica-Bold')
           .text('INSTRUCCIONES ESPECIALES:', infoX, currentY);
        currentY += 20;
        
        doc.font('Helvetica')
           .text(datos.notasCocina, infoX, currentY, { width: 500 });
      }
      
      // Pie de página
      currentY = 700;
      doc.fontSize(10)
          }

    doc.end();
    stream.on('finish', () => resolve(nombreArchivo));
  });
};

// Crear cotización
app.post('/api/cotizaciones', requireLogin, async (req, res) => {
  const datos = req.body;
  const usuario = req.session.user.username;

  try {
    // Validar datos esenciales
    if (!datos.platos || !Array.isArray(datos.platos)) {
      throw new Error('No se han seleccionado platos');
    }

    // Crear nueva cotización
    const nuevaCotizacion = new Cotizacion({
      invoiceNumber: datos.invoiceNumber || 1,
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
        precio_por_persona: p.precio_por_persona,
        cantidad_personas: p.cantidad,
        precio_total: p.precio_total
      })),
      numeroPersonas: datos.numeroPersonas || datos.platos.reduce((total, plato) => total + (plato.cantidad || 0), 0),
      subtotal: datos.subtotal,
      tax: datos.tax,
      taxPercentage: datos.taxPercentage || 8,
      gratuity: datos.gratuity,
      gratuityPercentage: datos.gratuityPercentage || 20,
      deliveryFee: datos.deliveryFee || 0,
      precioTotal: datos.precioTotal,
      notas: datos.notas || 'Ninguna',
      notasCocina: datos.notasCocina || 'Ninguna',
      creadoPor: usuario,
      pagos: datos.pagos || []
    });

    await nuevaCotizacion.save();

    // Generar PDFs
    const pdfCliente = await generarPDF('cliente', nuevaCotizacion.toObject());
    const pdfCocina = await generarPDF('cocina', nuevaCotizacion.toObject());

    res.json({
      success: true,
      cotizacion: nuevaCotizacion,
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

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
