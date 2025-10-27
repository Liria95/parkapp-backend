import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import * as readline from 'readline';

// Inicializar Firebase Admin
const serviceAccount = require('./src/config/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Interface para readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function createAdmin() {
  try {
    console.log('\n ===== CREAR USUARIO ADMIN =====\n');

    // Solicitar datos
    const name = await question('Nombre: ');
    const surname = await question('Apellido: ');
    const email = await question('Email: ');
    const phone = await question('Teléfono (+543764123456): ');
    const password = await question('Contraseña (mín 6 caracteres): ');

    if (!name || !surname || !email || !phone || !password) {
      console.error('Todos los campos son obligatorios');
      rl.close();
      return;
    }

    if (password.length < 6) {
      console.error('La contraseña debe tener al menos 6 caracteres');
      rl.close();
      return;
    }

    console.log('\nCreando usuario en Firebase Auth...');

    // 1. Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: `${name} ${surname}`,
    });

    console.log('Usuario creado en Auth:', userRecord.uid);

    // 2. Crear documento en Firestore con isAdmin: true
    const userData = {
      name: name,
      surname: surname,
      email: email,
      phone: phone,
      isAdmin: true,
      balance: 0,
      avatar: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(userRecord.uid).set(userData);

    console.log('Usuario guardado en Firestore como ADMIN');
    console.log('\n===== ADMIN CREADO EXITOSAMENTE =====');
    console.log(`Email: ${email}`);
    console.log(`UID: ${userRecord.uid}`);
    console.log(`Admin: SÍ\n`);

  } catch (error: any) {
    console.error('Error al crear admin:', error.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createAdmin();