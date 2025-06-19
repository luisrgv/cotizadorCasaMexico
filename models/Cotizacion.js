const mongoose = require('mongoose');

const CotizacionSchema = new mongoose.Schema({
  invoiceNumber: { type: Number, unique: true, required: true },
  fecha: { type: Date, required: true },
  dia: { type: String }, // Se calculará automáticamente
  cliente: { type: String, required: true },
  numero: { type: String },
  hora_evento: String,
  hora_servir: String,
  hora_salida: String,
  servicio: { type: String, required: true },
  ubicacion: { type: String, required: true },
  contacto: String,
  status: { 
    type: String, 
    enum: ['pagado', 'pre-pagado', 'impago', 'en_proceso'], 
    default: 'impago' 
  },
  pagos: [{
    fecha: Date,
    monto: Number,
    metodo: {
      type: String,
      enum: ['square', 'venmo', 'toast', 'cash', 'PO', 'Zelle', 'otro']
    },
    notas: String
  }],
  platos: [{
    nombre: String,
    precio_por_persona: Number,
    cantidad_personas: Number, // Cantidad modificable por plato
    precio_total: Number
  }],
  numeroPersonas: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  taxPercentage: { type: Number, default: 8 }, // Porcentaje editable
  gratuity: { type: Number, required: true },
  gratuityPercentage: { type: Number, default: 20 }, // Porcentaje editable
  deliveryFee: { type: Number, default: 0 },
  precioTotal: { type: Number, required: true },
  notas: String,
  notasCocina: String, // Nuevo campo para notas de cocina
  creadoPor: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

// Middleware para asignar número de invoice y día de la semana
// Cotizacion.js - Asegurar el middleware pre-save
CotizacionSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Obtener el último invoiceNumber y sumar 1
    const lastInvoice = await this.constructor.findOne().sort('-invoiceNumber');
    this.invoiceNumber = lastInvoice ? lastInvoice.invoiceNumber + 1 : 1;
    
    // Calcular día de la semana
    if (this.fecha) {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      this.dia = days[this.fecha.getDay()];
    }
  }
  
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Cotizacion', CotizacionSchema);
