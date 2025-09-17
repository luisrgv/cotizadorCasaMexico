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
    enum: ['Appetizers', 'Tacos', 'Specialty', 'Desserts', 'Chef Cristina Experience', 'Barbacoa']
  },
  precio_15: {
    type: Number,
    required: function() {
      return this.categoria === 'Appetizers' || this.categoria === 'Tacos' || this.categoria === 'Specialty';
    },
    min: 0
  },
  precio_30: {
    type: Number,
    required: function() {
      return this.categoria === 'Appetizers' || this.categoria === 'Tacos' || this.categoria === 'Specialty';
    },
    min: 0
  },
  precio_full: {
    type: Number,
    required: function () {
      // Ahora obligatorio SOLO para 'Desserts' y 'Barbacoa'
      return this.categoria === 'Desserts' || this.categoria === 'Barbacoa';
    },
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
PlatoSchema.index({ nombre: 1, categoria: 1 }, { unique: true });
PlatoSchema.index({ nombre: 1 }, { unique: true });

module.exports = mongoose.model('Plato', PlatoSchema);
