import { Router, Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Middleware para verificar que el usuario es admin
const adminMiddleware = async (req: Request, res: Response, next: Function) => {
  const authenticatedUser = (req as any).user;
  
  try {
    const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Error al verificar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};

// Obtener espacios disponibles
router.get('/spaces/available', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo espacios disponibles...');
    
    // Obtener todas las sesiones activas
    const activeSessions = await db.collection('parking_sessions')
      .where('status', '==', 'active')
      .get();
    
    const occupiedSpaces = activeSessions.docs.map(doc => doc.data().spaceId);
    
    // Obtener todos los espacios
    const spacesSnapshot = await db.collection('parking_spaces').get();
    
    const availableSpaces = spacesSnapshot.docs
      .filter(doc => !occupiedSpaces.includes(doc.id))
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    
    console.log('Espacios disponibles:', availableSpaces.length);
    
    res.json({
      success: true,
      spaces: availableSpaces,
      total: availableSpaces.length
    });
    
  } catch (error: any) {
    console.error('Error al obtener espacios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener espacios disponibles'
    });
  }
});

// Buscar usuario por email, teléfono o patente
router.get('/users/search', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { query } = req.query;
  
  if (!query || typeof query !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Debe proporcionar un término de búsqueda'
    });
    return;
  }
  
  try {
    console.log('Buscando usuario:', query);
    
    const searchTerm = query.toLowerCase();
    
    // Buscar en usuarios
    const usersSnapshot = await db.collection('users').get();
    
    const matchingUsers = usersSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        const email = data.email?.toLowerCase() || '';
        const phone = data.phone?.toLowerCase() || '';
        const name = `${data.name} ${data.surname}`.toLowerCase();
        
        return email.includes(searchTerm) || 
               phone.includes(searchTerm) || 
               name.includes(searchTerm);
      })
      .map(doc => ({
        id: doc.id,
        nombre: `${doc.data().name} ${doc.data().surname}`,
        email: doc.data().email,
        telefono: doc.data().phone,
        saldo: doc.data().balance || 0
      }));
    
    console.log('Usuarios encontrados:', matchingUsers.length);
    
    res.json({
      success: true,
      users: matchingUsers
    });
    
  } catch (error: any) {
    console.error('Error al buscar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar usuario'
    });
  }
});

// Registrar estacionamiento manual (admin)
router.post('/sessions/manual', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { 
    licensePlate, 
    spaceId, 
    userId, 
    notifyUser, 
    location 
  } = req.body;
  
  if (!licensePlate || !spaceId || !location) {
    res.status(400).json({
      success: false,
      message: 'Faltan campos obligatorios: licensePlate, spaceId, location'
    });
    return;
  }
  
  try {
    console.log('Registrando estacionamiento manual...');
    
    // Verificar que el espacio existe y está disponible
    const spaceDoc = await db.collection('parking_spaces').doc(spaceId).get();
    
    if (!spaceDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Espacio no encontrado'
      });
      return;
    }
    
    // Verificar que el espacio no esté ocupado
    const activeSessions = await db.collection('parking_sessions')
      .where('spaceId', '==', spaceId)
      .where('status', '==', 'active')
      .get();
    
    if (!activeSessions.empty) {
      res.status(400).json({
        success: false,
        message: 'El espacio ya está ocupado'
      });
      return;
    }
    
    const spaceData = spaceDoc.data();
    const adminUser = (req as any).user;
    
    // Datos del usuario si existe
    let userName = 'Usuario sin registro';
    let userEmail = null;
    let userPhone = null;
    
    if (userId) {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        userName = `${userData?.name} ${userData?.surname}`;
        userEmail = userData?.email;
        userPhone = userData?.phone;
      }
    }
    
    // Crear sesión de estacionamiento
    const sessionRef = await db.collection('parking_sessions').add({
      userId: userId || null,
      userName,
      userEmail,
      userPhone,
      licensePlate: licensePlate.toUpperCase(),
      spaceId,
      spaceNumber: spaceData?.numero || spaceData?.number,
      location,
      rate: spaceData?.tarifaPorHora || spaceData?.rate || 50,
      status: 'active',
      registeredBy: 'admin',
      adminId: adminUser.uid,
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      notifyUser: notifyUser || false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Sesión de estacionamiento creada:', sessionRef.id);
    
    // TODO: Enviar notificación al usuario si notifyUser es true y hay email/phone
    
    res.json({
      success: true,
      message: 'Estacionamiento registrado exitosamente',
      sessionId: sessionRef.id
    });
    
  } catch (error: any) {
    console.error('Error al registrar estacionamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar estacionamiento'
    });
  }
});

// Finalizar sesión de estacionamiento (admin)
router.put('/sessions/:sessionId/end', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  
  try {
    console.log('Finalizando sesión:', sessionId);
    
    const sessionDoc = await db.collection('parking_sessions').doc(sessionId).get();
    
    if (!sessionDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Sesión no encontrada'
      });
      return;
    }
    
    const sessionData = sessionDoc.data();
    
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
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60)); // Redondear hacia arriba
    
    const rate = sessionData.rate || 50;
    const totalCost = durationHours * rate;
    
    // Actualizar sesión
    await db.collection('parking_sessions').doc(sessionId).update({
      status: 'completed',
      endTime: admin.firestore.FieldValue.serverTimestamp(),
      duration: durationHours,
      totalCost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Si hay usuario, descontar del saldo
    if (sessionData.userId) {
      const userDoc = await db.collection('users').doc(sessionData.userId).get();
      const currentBalance = userDoc.data()?.balance || 0;
      
      if (currentBalance >= totalCost) {
        await db.collection('users').doc(sessionData.userId).update({
          balance: admin.firestore.FieldValue.increment(-totalCost),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Registrar transacción
        await db.collection('transactions').add({
          userId: sessionData.userId,
          userEmail: sessionData.userEmail,
          userName: sessionData.userName,
          type: 'parking',
          amount: -totalCost,
          previousBalance: currentBalance,
          newBalance: currentBalance - totalCost,
          method: 'balance',
          status: 'approved',
          description: `Estacionamiento en ${sessionData.location} - ${durationHours}h`,
          parkingSessionId: sessionId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Crear multa por saldo insuficiente
        await db.collection('fines').add({
          userId: sessionData.userId,
          userName: sessionData.userName,
          userEmail: sessionData.userEmail,
          licensePlate: sessionData.licensePlate,
          reason: 'SALDO INSUFICIENTE AL FINALIZAR ESTACIONAMIENTO',
          amount: totalCost,
          status: 'pendiente',
          location: sessionData.location,
          parkingSessionId: sessionId,
          issuedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    console.log('Sesión finalizada exitosamente');
    
    res.json({
      success: true,
      message: 'Sesión finalizada exitosamente',
      duration: durationHours,
      totalCost
    });
    
  } catch (error: any) {
    console.error('Error al finalizar sesión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al finalizar sesión'
    });
  }
});

// Obtener sesiones activas
router.get('/sessions/active', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo sesiones activas...');
    
    const sessionsSnapshot = await db.collection('parking_sessions')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();
    
    const sessions = sessionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate().toISOString(),
      createdAt: doc.data().createdAt?.toDate().toISOString()
    }));
    
    console.log('Sesiones activas:', sessions.length);
    
    res.json({
      success: true,
      sessions,
      total: sessions.length
    });
    
  } catch (error: any) {
    console.error('Error al obtener sesiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sesiones activas'
    });
  }
});

export default router;