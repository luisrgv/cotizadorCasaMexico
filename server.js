require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// Configuración CORS
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://cotizador-web.onrender.com'
    ];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['set-cookie']
};
app.use(cors(corsOptions));

// Configuración de sesión con almacenamiento en MongoDB
app.use(session({
  secret: process.env.SESSION_SECRET || 'tu-secreto-super-seguro-123',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 día
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticación
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    console.log('🔒 Acceso no autorizado - No hay sesión activa');
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
};

// Ruta de login
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  
  try {
    // Aquí debes reemplazar con tu modelo de User real
    const user = await User.findOne({ usuario, password });
    
    if (!user) {
      console.log('❌ Login fallido - Credenciales inválidas');
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
    }

    req.session.user = {
      id: user._id,
      username: user.usuario,
      role: user.rol
    };

    console.log('✅ Login exitoso - Usuario:', user.usuario);

    // Configuración explícita de la cookie
    res.cookie('connect.sid', req.sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.json({ 
      ok: true, 
      user: { 
        username: user.usuario, 
        role: user.rol 
      } 
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    return res.status(500).json({ ok: false, error: 'Error del servidor' });
  }
});

// Ruta de logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('❌ Error al destruir sesión:', err);
      return res.status(500).json({ error: 'Error al cerrar sesión' });
    }
    
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    console.log('✅ Sesión cerrada correctamente');
    return res.json({ ok: true });
  });
});

// Ruta para verificar sesión
app.get('/api/user-info', (req, res) => {
  if (!req.session.user) {
    console.log('🔒 No hay sesión activa');
    return res.status(401).json({ error: 'No autorizado' });
  }
  console.log('✅ Sesión activa para:', req.session.user.username);
  res.json({ user: req.session.user });
});

// Ruta principal protegida
app.get('/cotizador', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cotizador.html'));
});

// Ruta para obtener platos (protegida)
app.get('/api/platos', requireLogin, async (req, res) => {
  try {
    const platos = await Plato.find().sort({ nombre: 1 });
    res.json({ platos });
  } catch (error) {
    console.error('❌ Error al obtener platos:', error);
    res.status(500).json({ error: 'Error al obtener platos' });
  }
});


// Calcular proforma automática
app.post('/api/calcular-proforma', requireLogin, async (req, res) => {
  const { numPersonas, platosSeleccionados } = req.body;
  
  try {
    const platosData = await Plato.find();
    let subtotal = 0;
    let ingredientes = [];
    
    // Procesar cada plato seleccionado
    platosSeleccionados.forEach(platoSel => {
      const plato = platosData.find(p => p.nombre === platoSel.nombre);
      
      if (plato) {
        subtotal += numPersonas * parseFloat(plato.precio_por_persona);
        
        // Agregar ingredientes
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

// Crear cotización
app.post('/api/cotizaciones', requireLogin, async (req, res) => {
  const datos = req.body;
  const usuario = req.session.user.username;

  try {
    // Crear nueva cotización
    const nuevaCotizacion = new Cotizacion({
      fecha: datos.fecha,
      cliente: datos.cliente,
      numero: datos.numero,
      servicio: datos.servicio,
      ubicacion: datos.ubicacion,
      platos: datos.platosSeleccionados.map(p => ({
        nombre: p.nombre,
        precio_por_persona: p.precio_por_persona,
        cantidad: p.cantidad,
        precio_total: p.precio_total
      })),
      hora_evento: datos.hora_evento,
      hora_servir: datos.hora_servir,
      hora_salida: datos.hora_salida,
      contacto: datos.contacto,
      status: datos.status,
      numeroPersonas: datos.numeroPersonas,
      subtotal: datos.subtotal,
      tax: datos.tax,
      gratuity: datos.gratuity,
      deliveryFee: datos.deliveryFee || 0,
      precioTotal: datos.precioTotal,
      platosDesechables: datos.platosDesechables === 'Sí',
      tipoPlatos: datos.tipoPlatos,
      notas: datos.notas || 'Ninguna',
      creadoPor: usuario
    });

    await nuevaCotizacion.save();

    // Función para generar PDFs
    const generarPDF = (tipo, datos) => {
      return new Promise((resolve) => {
        const doc = new PDFDocument({ margin: 50 });
        const nombreArchivo = `${tipo}_${datos.cliente.replace(/\s/g, '_')}_${Date.now()}.pdf`;
        const rutaPDF = path.join(__dirname, 'public', 'pdfs', nombreArchivo);
        const stream = fs.createWriteStream(rutaPDF);
        doc.pipe(stream);

        // Logo (ajusta la ruta según tu estructura de archivos)
        const logoPath = path.join(__dirname, 'public', 'img', 'logo-casa-mexico.png');
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 50, 45, { width: 100 });
        }

        // Encabezado
        doc.fontSize(20).text(tipo === 'cliente' ? 'CASA MÉXICO CATERING' : 'CASA MÉXICO CATERING', {
          align: 'center',
          underline: true,
          paragraphGap: 5
        });
        
        doc.fontSize(14).text(tipo === 'cliente' ? 'QUOTATION' : 'ORDEN DE COCINA', {
          align: 'center',
          paragraphGap: 20
        });

        // Información principal
        const infoX = 50;
        const infoY = 150;
        let currentY = infoY;

        if (tipo === 'cliente') {
          // PDF en inglés para el cliente
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
          
          // Tabla de platos
          doc.font('Helvetica-Bold').text('DETAILS', infoX, currentY);
          currentY += 20;
          
          doc.font('Helvetica').text('Item', infoX, currentY)
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
          
          // Resumen de pagos
          doc.font('Helvetica-Bold').text('PAYMENT SUMMARY', infoX, currentY);
          currentY += 20;
          
          doc.font('Helvetica')
             .text('Subtotal:', infoX, currentY)
             .text(`$${datos.subtotal.toFixed(2)}`, 450, currentY);
          currentY += 20;
          
          doc.text('Tax (8%):', infoX, currentY)
             .text(`$${datos.tax.toFixed(2)}`, 450, currentY);
          currentY += 20;
          
          doc.text(`Gratuity (20%):`, infoX, currentY)
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
          
          // Notas
          doc.font('Helvetica')
             .text('Notes:', infoX, currentY)
             .text(datos.notas || 'None', infoX + 50, currentY + 20, { width: 450 });
             
                 } else {
          // PDF en español para cocina
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
          
          // Tabla de platos
          doc.font('Helvetica-Bold').text('DETALLES DEL EVENTO', infoX, currentY);
          currentY += 20;
          
          doc.font('Helvetica').text('Plato', infoX, currentY)
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
          
          // Ingredientes
          if (datos.ingredientes && datos.ingredientes.length > 0) {
            doc.font('Helvetica-Bold').text('INGREDIENTES REQUERIDOS:', infoX, currentY);
            currentY += 20;
            
            datos.ingredientes.forEach(ing => {
              doc.font('Helvetica').text(`• ${ing}`, infoX, currentY);
              currentY += 20;
            });
            
            currentY += 10;
          }
          
          // Notas
          doc.font('Helvetica-Bold').text('NOTAS:', infoX, currentY);
          currentY += 20;
          
          doc.font('Helvetica')
             .text(datos.notas || 'Ninguna', infoX, currentY, { width: 450 });
             
          // Pie de página
          doc.fontSize(10)
             .text('¡Gracias por confiar en Casa México Catering!', 50, 700, { align: 'center' });
        }

        doc.end();
        stream.on('finish', () => resolve(nombreArchivo));
      });
    };

    // Crear directorio para PDFs si no existe
    if (!fs.existsSync(path.join(__dirname, 'public', 'pdfs'))) {
      fs.mkdirSync(path.join(__dirname, 'public', 'pdfs'));
    }

    // Generar ambos PDFs
    const pdfCliente = await generarPDF('cliente', {
      ...datos,
      ingredientes: datos.ingredientes || []
    });
    const pdfCocina = await generarPDF('cocina', {
      ...datos,
      ingredientes: datos.ingredientes || []
    });

    res.json({
      success: true,
      pdfCliente: `/pdfs/${pdfCliente}`,
      pdfCocina: `/pdfs/${pdfCocina}`
    });

  } catch (error) {
    console.error('Error al guardar cotización:', error);
    res.status(500).json({ error: 'Error al guardar cotización' });
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

// Rutas estáticas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});










// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});