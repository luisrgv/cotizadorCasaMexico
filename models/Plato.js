const mongoose = require('mongoose');

const PlatoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  categoria: {
    type: String,
    required: true,
    enum: ['Appetizers', 'Tacos', 'Specialty', 'Desserts']
  },
  precio_15: {
    type: Number,
    required: function() { return this.categoria !== 'Desserts'; },
    min: 0
  },
  precio_30: {
    type: Number,
    required: function() { return this.categoria !== 'Desserts'; },
    min: 0
  },
  precio_full: {
    type: Number,
    required: function() { return this.categoria === 'Desserts'; },
    min: 0
  },
  descripcion: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Actualizar la fecha de modificación antes de guardar
PlatoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Plato', PlatoSchema);
