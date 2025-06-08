const mongoose = require('mongoose');

const PlatoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  ingredientes: [{ type: String }],
  precio_por_persona: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Plato', PlatoSchema);