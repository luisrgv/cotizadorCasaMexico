const mongoose = require('mongoose');

const CotizacionSchema = new mongoose.Schema({
  invoiceNumber: { type: Number, unique: true, required: false }, // 🔄 ya se generará en el pre('save')

  fecha: { type: Date, required: true },
  dia: { type: String }, // Se calculará automáticamente
  cliente: { type: String, required: true },
   email: { type: String },
  numero: { type: String },
  hora_evento: String,
  hora_servir: String,
  hora_salida: String,
  servicio: { type: String, required: true },
  ubicacion: { type: String, required: true },
  contacto: String,
  status: { 
    type: String, 
    enum: ['pagado', 'impago', 'en_proceso', 'cancelado'], // Agregado 'cancelado'
    default: 'impago',
    required: true 
  },
  marca: {
    type: String,
    enum: ['chef', 'casa_mexico', 'south'],
    default: 'chef'
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
  categoria: String,
  precio_por_persona: Number,
  cantidad_personas: Number,
  cantidad: Number,
  cantidadTexto: String,
  precio_total: Number,
  descripcion: String,
  tipoSeleccionado: String // Nuevo campo para guardar la selección (half/full, 15/30, 10/20)
}],

  numeroPersonas: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  taxExempt: { type: Boolean, default: false },
  taxPercentage: { type: Number, default: 8 }, // Porcentaje editable
  gratuity: { type: Number, required: true },
  gratuityPercentage: { type: Number, default: 20 }, // Porcentaje editable
  deliveryFee: { type: Number, default: 0, required: true  },
  rentalFee: { type: Number, default: 0, required: true  },         // <-- NUEVO
rentalDescripcion: { type: String, default: '' },  
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
