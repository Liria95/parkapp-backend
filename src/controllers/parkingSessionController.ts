import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

export class ParkingSessionController {
  
  // ========== INICIAR SESIÓN DE ESTACIONAMIENTO ==========
  static async startSession(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      const userId = authenticatedUser.uid;
      const { parkingSpaceId, licensePlate } = req.body;

      console.log('=== INICIANDO SESIÓN DE ESTACIONAMIENTO ===');
      console.log('User ID:', userId);
      console.log('Parking Space ID:', parkingSpaceId);
      console.log('License Plate:', licensePlate);

      if (!parkingSpaceId || !licensePlate) {
        res.status(400).json({
          success: false,
          message: 'Faltan datos obligatorios: parkingSpaceId y licensePlate'
        });
        return;
      }

      const spaceRef = db.collection('parkingSpaces').doc(parkingSpaceId);
      const spaceDoc = await spaceRef.get();

      if (!spaceDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Espacio de estacionamiento no encontrado'
        });
        return;
      }

      const spaceData = spaceDoc.data();

      if (spaceData?.status !== 'available') {
        res.status(400).json({
          success: false,
          message: 'El espacio no está disponible'
        });
        return;
      }

      const streetRef = db.collection('streets').doc(spaceData.streetId);
      const streetDoc = await streetRef.get();

      if (!streetDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Información de la calle no encontrada'
        });
        return;
      }

      const streetData = streetDoc.data();

      const priceSnapshot = await db.collection('price')
        .where('streetId', '==', spaceData.streetId)
        .limit(1)
        .get();

      if (priceSnapshot.empty) {
        res.status(404).json({
          success: false,
          message: 'Tarifa no encontrada para este espacio'
        });
        return;
      }

      const feePerHour = priceSnapshot.docs[0].data().fee;

      console.log('Tarifa por hora:', feePerHour);

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }

      const userData = userDoc.data();
      const currentBalance = userData?.balance || 0;

      if (currentBalance < feePerHour) {
        res.status(400).json({
          success: false,
          message: 'Saldo insuficiente. Recarga tu cuenta para continuar.',
          requiredAmount: feePerHour,
          currentBalance
        });
        return;
      }

      const activeSessionSnapshot = await db.collection('parkingSessions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (!activeSessionSnapshot.empty) {
        res.status(400).json({
          success: false,
          message: 'Ya tienes una sesión de estacionamiento activa'
        });
        return;
      }

      const vehiclesSnapshot = await db.collection('vehicles')
        .where('userId', '==', userId)
        .where('licensePlate', '==', licensePlate.toUpperCase())
        .limit(1)
        .get();

      let vehicleId: string;

      if (vehiclesSnapshot.empty) {
        const newVehicleRef = db.collection('vehicles').doc();
        await newVehicleRef.set({
          userId,
          licensePlate: licensePlate.toUpperCase(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        vehicleId = newVehicleRef.id;
      } else {
        vehicleId = vehiclesSnapshot.docs[0].id;
      }

      const sessionRef = db.collection('parkingSessions').doc();
      await sessionRef.set({
        userId,
        vehicleId,
        parkingSpaceId,
        licensePlate: licensePlate.toUpperCase(),
        amount: 0,
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        endTime: null,
        status: 'active',
        feePerHour,
        spaceCode: spaceData.spaceCode,
        streetAddress: streetData?.streetAddress,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await spaceRef.update({
        status: 'occupied',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await streetRef.update({
        availableSpaces: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({
        success: true,
        message: 'Estacionamiento iniciado correctamente',
        sessionId: sessionRef.id,
        spaceCode: spaceData.spaceCode,
        streetAddress: streetData?.streetAddress,
        feePerHour
      });

    } catch (error) {
      console.error('Error al iniciar estacionamiento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al iniciar sesión de estacionamiento',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // ========== FINALIZAR SESIÓN DE ESTACIONAMIENTO ==========
  static async endSession(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      const userId = authenticatedUser.uid;
      const { sessionId } = req.body;

      console.log('=== FINALIZANDO SESIÓN DE ESTACIONAMIENTO ===');
      console.log('User ID:', userId);
      console.log('Session ID:', sessionId);

      if (!sessionId) {
        res.status(400).json({
          success: false,
          message: 'Falta el ID de la sesión'
        });
        return;
      }

      const sessionRef = db.collection('parkingSessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Sesión no encontrada'
        });
        return;
      }

      const sessionData = sessionDoc.data();

      if (sessionData?.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para finalizar esta sesión'
        });
        return;
      }

      if (sessionData?.status !== 'active') {
        res.status(400).json({
          success: false,
          message: 'La sesión ya está finalizada'
        });
        return;
      }

      const startTime = sessionData.startTime.toDate();
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));

      const feePerHour = sessionData.feePerHour || 50;
      const totalCost = durationHours * feePerHour;

      console.log('Duración:', durationHours);
      console.log('Costo total:', totalCost);

      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data();
      const currentBalance = userData?.balance || 0;

      await sessionRef.update({
        status: 'completed',
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        duration: durationHours,
        amount: totalCost,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const spaceRef = db.collection('parkingSpaces').doc(sessionData.parkingSpaceId);
      await spaceRef.update({
        status: 'available',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const spaceDoc = await spaceRef.get();
      if (spaceDoc.exists) {
        const spaceData = spaceDoc.data();
        await db.collection('streets').doc(spaceData?.streetId).update({
          availableSpaces: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      if (currentBalance >= totalCost) {
        await userRef.update({
          balance: admin.firestore.FieldValue.increment(-totalCost),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('transactions').add({
          userId,
          type: 'parking',
          amount: -totalCost,
          previousBalance: currentBalance,
          newBalance: currentBalance - totalCost,
          method: 'balance',
          status: 'approved',
          description: `Estacionamiento ${sessionData.spaceCode} - ${durationHours}h`,
          parkingSessionId: sessionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
          success: true,
          message: 'Estacionamiento finalizado y pagado exitosamente',
          duration: durationHours,
          totalCost,
          newBalance: currentBalance - totalCost
        });

      } else {
        await db.collection('fines').add({
          userId,
          licensePlate: sessionData.licensePlate,
          reason: 'SALDO INSUFICIENTE AL FINALIZAR ESTACIONAMIENTO',
          amount: totalCost,
          status: 'pendiente',
          location: sessionData.streetAddress,
          spaceCode: sessionData.spaceCode,
          parkingSessionId: sessionId,
          issuedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
          success: true,
          message: 'Estacionamiento finalizado. Se generó una multa por saldo insuficiente.',
          duration: durationHours,
          totalCost,
          currentBalance,
          fineCreated: true
        });
      }

    } catch (error) {
      console.error('Error al finalizar estacionamiento:', error);
      res.status(500).json({
        success: false,
        message: 'Error al finalizar sesión de estacionamiento',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  // ========== OBTENER SESIÓN ACTIVA DEL USUARIO ==========
  static async getActiveSession(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      const userId = authenticatedUser.uid;

      console.log('Obteniendo sesión activa para usuario:', userId);

      const activeSessionSnapshot = await db.collection('parkingSessions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (activeSessionSnapshot.empty) {
        res.json({
          success: true,
          hasActiveSession: false,
          session: null
        });
        return;
      }

      const sessionDoc = activeSessionSnapshot.docs[0];
      const sessionData = sessionDoc.data();

      const startTime = sessionData.startTime.toDate();
      const now = new Date();
      const elapsedMs = now.getTime() - startTime.getTime();
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

      res.json({
        success: true,
        hasActiveSession: true,
        session: {
          id: sessionDoc.id,
          spaceCode: sessionData.spaceCode,
          streetAddress: sessionData.streetAddress,
          licensePlate: sessionData.licensePlate,
          feePerHour: sessionData.feePerHour,
          startTime: startTime.toISOString(),
          elapsedMinutes
        }
      });

    } catch (error) {
      console.error('Error al obtener sesión activa:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener sesión activa'
      });
    }
  }

  // ========== OBTENER HISTORIAL DE SESIONES ==========
  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      const userId = authenticatedUser.uid;

      console.log('Obteniendo historial de sesiones para usuario:', userId);

      const sessionsSnapshot = await db.collection('parkingSessions')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const sessions = sessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          spaceCode: data.spaceCode,
          streetAddress: data.streetAddress,
          licensePlate: data.licensePlate,
          feePerHour: data.feePerHour,
          startTime: data.startTime?.toDate().toISOString(),
          endTime: data.endTime?.toDate().toISOString(),
          duration: data.duration,
          amount: data.amount,
          status: data.status
        };
      });

      res.json({
        success: true,
        sessions,
        total: sessions.length
      });

    } catch (error) {
      console.error('Error al obtener historial:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de sesiones'
      });
    }
  }

  // ========== ESTADÍSTICAS DE OCUPACIÓN REAL ==========
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      const userId = authenticatedUser.uid;

      console.log('Obteniendo estadísticas de ocupación...');

      const activeSessionsSnapshot = await db.collection('parkingSessions')
        .where('status', '==', 'active')
        .get();

      const occupied = activeSessionsSnapshot.size;

      const allSpacesSnapshot = await db.collection('parkingSpaces').get();
      const total = allSpacesSnapshot.size;

      const available = total - occupied;

      const activeSessions = activeSessionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          licensePlate: data.licensePlate,
          spaceCode: data.spaceCode,
          streetAddress: data.streetAddress,
          startTime: data.startTime?.toDate().toISOString(),
          feePerHour: data.feePerHour,
          userId: data.userId,
          isVisitor: data.isVisitor || false
        };
      });

      res.json({
        success: true,
        stats: {
          occupied,
          available,
          total,
          occupancyRate: total > 0 ? ((occupied / total) * 100).toFixed(2) : '0'
        },
        activeSessions,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas'
      });
    }
  }
}