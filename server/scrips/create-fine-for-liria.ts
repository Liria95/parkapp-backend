// server/scripts/create-fine-for-liria.ts
// Script para crear multa para Liria Olivera

import admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

async function createFineForLiria() {
  try {
    console.log('🚨 Creando multa para Liria Olivera...\n');
    
    const userId = 'Sm590CsCFIR7AYQpi2vu7VknhNi1';
    
    // Verificar que el usuario existe
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Usuario no encontrado con ID:', userId);
      process.exit(1);
    }
    
    const userData = userDoc.data();
    console.log('✅ Usuario encontrado:', userData?.name, userData?.surname);
    console.log('📧 Email:', userData?.email);
    console.log('💰 Saldo actual:', userData?.balance);
    console.log('');
    
    // Crear multa
    const fineRef = await db.collection('fines').add({
      numero: '000001',
      userId: userId,
      userName: 'Liria Olivera',
      userEmail: 'liriaolivera20@gmail.com',
      licensePlate: 'ABC123',
      reason: 'ESTACIONAMIENTO EN ZONA PROHIBIDA',
      amount: 500,
      status: 'pendiente',
      location: 'AV. CORRIENTES 1234',
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Multa creada exitosamente!');
    console.log('🆔 ID de la multa:', fineRef.id);
    console.log('📋 Número:', '000001');
    console.log('💵 Monto: $500');
    console.log('📍 Ubicación: AV. CORRIENTES 1234');
    console.log('⚠️  Estado: pendiente');
    console.log('');
    console.log('🎯 Ahora puedes ver la multa en:');
    console.log('   - Firebase Console → fines');
    console.log('   - La app en InfraccionesScreen');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error al crear multa:', error);
  } finally {
    process.exit(0);
  }
}

createFineForLiria()