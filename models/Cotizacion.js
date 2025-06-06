const mongoose = require('mongoose');

const CotizacionSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  
  cliente: { type: String, required: true },
  numero: { type: String },
  servicio: { type: String, required: true },
  ubicacion: { type: String, required: true },
  platos: [{
    nombre: String,
    precio_por_persona: Number,
    cantidad: Number,
    precio_total: Number
  }],
  hora_evento: String,
  hora_servir: String,
  hora_salida: String,
  contacto: String,
  status: { type: String, enum: ['en_proceso', 'pagada', 'impaga'], default: 'en_proceso' },
  numeroPersonas: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  gratuity: { type: Number, required: true },
  deliveryFee: { type: Number, default: 0 },
  precioTotal: { type: Number, required: true },
  platosDesechables: { type: Boolean, default: false },
  tipoPlatos: String,
  notas: String,
  creadoPor: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Cotizacion', CotizacionSchema);