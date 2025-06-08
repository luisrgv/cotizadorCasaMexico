const mongoose = require('mongoose');
const Plato = require('../public/models/Plato');
const platosData = require('./platos.json');
const connectDB = require('./db');

async function migratePlatos() {
  try {
    await connectDB();
    
    // Eliminar platos existentes (opcional)
    await Plato.deleteMany({});
    
    // Insertar nuevos platos
    const platos = platosData.platos.map(plato => ({
      nombre: plato.nombre,
      ingredientes: plato.ingredientes || [],
      precio_por_persona: plato.precio_por_persona
    }));
    
    await Plato.insertMany(platos);
    console.log('Platos migrados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('Error migrando platos:', error);
    process.exit(1);
  }
}

migratePlatos();