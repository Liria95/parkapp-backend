// src/controllers/finesController.ts
import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

export class FinesController {
  
  // ========== CREAR MULTA ==========
  static async createFine(req: Request, res: Response): Promise<void> {
    try {
      const { userId, licensePlate, reason, amount, location, parkingSpaceId, parkingSessionId } = req.body;
      
      if (!userId || !licensePlate || !reason || !amount || !location) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios'
        });
        return;
      }
      
      // Obtener datos del usuario
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }
      
      const userData = userDoc.data();
      
      // Generar número de multa
      const finesCount = await db.collection('fines').count().get();
      const numero = String(finesCount.data().count + 1).padStart(6, '0');
      
      // Crear multa
      const fineRef = await db.collection('fines').add({
        numero,
        userId,
        userName: `${userData?.name} ${userData?.surname}`,
        userEmail: userData?.email,
        licensePlate: licensePlate.toUpperCase(),
        reason,
        amount: parseFloat(amount),
        status: 'pendiente',
        location,
        parkingSpaceId: parkingSpaceId || null,
        parkingSessionId: parkingSessionId || null,
        issuedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({
        success: true,
        message: 'Infracción creada exitosamente',
        fineId: fineRef.id,
        numero
      });
      
    } catch (error: any) {
      console.error('Error al crear multa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear infracción'
      });
    }
  }

  // ========== OBTENER TODAS LAS MULTAS (Admin) ==========
  static async getAllFines(req: Request, res: Response): Promise<void> {
    try {
      console.log('Obteniendo todas las infracciones...');
      
      const finesSnapshot = await db.collection('fines')
        .orderBy('createdAt', 'desc')
        .get();
      
      const fines = finesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        issuedAt: doc.data().issuedAt?.toDate().toISOString(),
        paidAt: doc.data().paidAt?.toDate().toISOString(),
        createdAt: doc.data().createdAt?.toDate().toISOString()
      }));
      
      console.log('Infracciones encontradas:', fines.length);
      
      res.json({
        success: true,
        fines,
        total: fines.length
      });
      
    } catch (error: any) {
      console.error('Error al obtener infracciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener infracciones'
      });
    }
  }

  // ========== OBTENER MULTAS DE UN USUARIO ==========
  static async getUserFines(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authenticatedUser = (req as any).user;
      
      console.log('Obteniendo infracciones del usuario:', userId);
      
      // Verificar que el usuario consulta sus propias multas o es admin
      const isAdmin = await db.collection('users').doc(authenticatedUser.uid).get()
        .then(doc => doc.data()?.isAdmin || false);
      
      if (authenticatedUser.uid !== userId && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver estas infracciones'
        });
        return;
      }
      
      const finesSnapshot = await db.collection('fines')
        .where('userId', '==', userId)
        .get();
      
      const fines = finesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        issuedAt: doc.data().issuedAt?.toDate().toISOString(),
        paidAt: doc.data().paidAt?.toDate().toISOString(),
        createdAt: doc.data().createdAt?.toDate().toISOString()
      }));
      
      // Ordenar manualmente
      fines.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      console.log('Infracciones encontradas:', fines.length);
      
      res.json({
        success: true,
        fines,
        total: fines.length
      });
      
    } catch (error: any) {
      console.error('Error al obtener infracciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener infracciones'
      });
    }
  }

  // ========== PAGAR MULTA ==========
  static async payFine(req: Request, res: Response): Promise<void> {
    try {
      const { fineId } = req.params;
      const authenticatedUser = (req as any).user;
      
      console.log('Procesando pago de multa:', fineId);
      
      const fineDoc = await db.collection('fines').doc(fineId).get();
      
      if (!fineDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Infracción no encontrada'
        });
        return;
      }
      
      const fineData = fineDoc.data();
      
      // Verificar permisos
      const isAdmin = await db.collection('users').doc(authenticatedUser.uid).get()
        .then(doc => doc.data()?.isAdmin || false);
      
      if (fineData?.userId !== authenticatedUser.uid && !isAdmin) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para pagar esta infracción'
        });
        return;
      }
      
      if (fineData?.status !== 'pendiente') {
        res.status(400).json({
          success: false,
          message: 'Esta infracción no está pendiente de pago'
        });
        return;
      }
      
      // Obtener saldo del usuario
      const userDoc = await db.collection('users').doc(fineData.userId).get();
      const currentBalance = userDoc.data()?.balance || 0;
      
      if (currentBalance < fineData.amount) {
        res.status(400).json({
          success: false,
          message: 'Saldo insuficiente para pagar la infracción'
        });
        return;
      }
      
      // Descontar del saldo
      await db.collection('users').doc(fineData.userId).update({
        balance: admin.firestore.FieldValue.increment(-fineData.amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Marcar como pagada
      await db.collection('fines').doc(fineId).update({
        status: 'pagada',
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Registrar transacción
      await db.collection('transactions').add({
        userId: fineData.userId,
        type: 'fine_payment',
        amount: -fineData.amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Multa pagada exitosamente');
      
      res.json({
        success: true,
        message: 'Infracción pagada exitosamente',
        newBalance: currentBalance - fineData.amount
      });
      
    } catch (error: any) {
      console.error('Error al pagar multa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el pago'
      });
    }
  }
}