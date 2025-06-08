// migrations/update-platos.js
const mongoose = require('mongoose');
const Plato = require('../models/Plato');
const platosData = require('../platos.json');
require('dotenv').config();
require('../db');

async function updatePlatos() {
  try {
    // 1. Eliminar todos los platos existentes
    await Plato.deleteMany({});
    console.log('🗑️  Platos existentes eliminados');

    // 2. Insertar nuevos platos
    const platos = platosData.platos.map(plato => ({
      nombre: plato.nombre.trim(),
      ingredientes: plato.ingredientes.filter(i => i.trim() !== ''),
      precio_por_persona: plato.precio_por_persona
    }));

    await Plato.insertMany(platos);
    console.log('✅ Platos actualizados correctamente:');
    console.log(platos.map(p => `- ${p.nombre} ($${p.precio_por_persona})`));

    // 3. Verificar inserción
    const count = await Plato.countDocuments();
    console.log(`📊 Total de platos en DB: ${count}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error actualizando platos:', error);
    process.exit(1);
  }
}

updatePlatos();