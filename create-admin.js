// create-admin.js
const User = require('./models/User');
require('dotenv').config();
require('./db');

async function createAdmin() {
  try {
    await User.create({
      usuario: 'admin',
      password: 'admin123',
      rol: 'admin'
    });
    
    console.log('Usuario admin creado');
    process.exit(0);
  } catch (err) {
    console.error('Error creando admin:', err);
    process.exit(1);
  }
}

createAdmin();