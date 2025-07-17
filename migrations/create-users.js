const mongoose = require('mongoose');
require('dotenv').config();

// 1. Definir el esquema directamente en el script
const userSchema = new mongoose.Schema({
  usuario: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, required: true, enum: ['admin', 'chef', 'ventas'] },
  createdAt: { type: Date, default: Date.now }
});

// 2. Registrar el modelo
const User = mongoose.model('User', userSchema);

async function createUsers() {
  try {
    // 3. Conectar a MongoDB (versión simplificada sin opciones obsoletas)
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conexión a MongoDB establecida');

    // 4. Eliminar usuarios existentes (opcional, solo para desarrollo)
    await User.deleteMany({});
    console.log('🗑️  Usuarios existentes eliminados');

    // 5. Crear nuevos usuarios
    const users = await User.insertMany([
      { usuario: '1', password: '', rol: 'admin' },
      { usuario: '2', password: '', rol: 'chef' },
      { usuario: '3', password: '', rol: 'ventas' }
    ]);

    console.log('🆕 Usuarios creados exitosamente:');
    users.forEach(user => {
      console.log(`- ${user.usuario} (${user.rol})`);
    });

    // 6. Cerrar conexión
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createUsers();
