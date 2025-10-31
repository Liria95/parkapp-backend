// server/src/config/firebaseAdmin.ts
import dotenv from 'dotenv';
dotenv.config();

import admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Verificar si ya está inicializado
if (!admin.apps.length) {
  try {
    // Ruta al Service Account Key
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('Service Account Key file not found');
    }
    
    // Importar credenciales
    const serviceAccount = require(serviceAccountPath);
    
    // Validar que el archivo tiene la estructura correcta
    if (!serviceAccount.project_id || !serviceAccount.private_key) {
      console.error('ERROR: serviceAccountKey.json tiene formato inválido');
      throw new Error('Invalid Service Account Key format');
    }
    
    // Inicializar Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    
    console.log('✅ Firebase Admin SDK inicializado correctamente');
    console.log(`📁 Proyecto: ${serviceAccount.project_id}`);
    
  } catch (error: any) {
    console.error('❌ Error al inicializar Firebase Admin:', error.message);
    throw error;
  }
}

// Exportar servicios de Admin
export const auth = admin.auth();
export const db = admin.firestore();
export const storage = admin.storage();

export default admin;