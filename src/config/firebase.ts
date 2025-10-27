// Cargar dotenv PRIMERO
import dotenv from 'dotenv';
dotenv.config();

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Validar que las credenciales estén configuradas
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('Error: Firebase config incompleto. Verifica tu archivo .env');
  console.error('Variables faltantes:');
  if (!firebaseConfig.apiKey) console.error('FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) console.error('FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) console.error('FIREBASE_PROJECT_ID');
  if (!firebaseConfig.storageBucket) console.error('FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) console.error('FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) console.error('FIREBASE_APP_ID');
  throw new Error('Firebase configuration is incomplete');
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

console.log('Firebase Client SDK inicializado');
console.log(`Proyecto: ${firebaseConfig.projectId}`);

export default app;