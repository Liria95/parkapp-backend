// Cargar dotenv PRIMERO
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
    
    console.log('Firebase Admin SDK inicializado correctamente');
    console.log(`Proyecto: ${serviceAccount.project_id}`);
    
  } catch (error: any) {
    console.error('Error al inicializar Firebase Admin:', error.message);
    
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('not found')) {
    }
    
    throw error;
  }
}

// Exportar servicios de Admin
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export const adminStorage = admin.storage();

export default admin;