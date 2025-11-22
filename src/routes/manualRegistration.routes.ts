import { Router, Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Middleware para verificar que el usuario es admin
const adminMiddleware = async (req: Request, res: Response, next: Function) => {
  const authenticatedUser = (req as any).user;
  
  console.log('Verificando permisos de admin para usuario:', authenticatedUser?.uid);
  
  try {
    const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
    
    if (!userDoc.exists) {
      console.log('Usuario no encontrado en la base de datos');
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    const userData = userDoc.data();
    console.log('Datos del usuario:', {
      email: userData?.email,
      isAdmin: userData?.isAdmin
    });
    
    if (!userData?.isAdmin) {
      console.log('Usuario no tiene permisos de administrador');
      res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      return;
    }
    
    console.log('Usuario verificado como admin, continuando...');
    next();
  } catch (error) {
    console.error('Error al verificar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};

// BUSCAR USUARIO POR PATENTE
router.get('/search-by-plate/:licensePlate', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    const { licensePlate } = req.params;
    
    try {
      console.log('Buscando usuario por patente:', licensePlate);
      
      // Buscar vehículo por patente (solo usuarios registrados, no visitantes)
      const vehiclesSnapshot = await db.collection('vehicles')
        .where('licensePlate', '==', licensePlate.toUpperCase())
        .where('isVisitor', '==', false)
        .limit(1)
        .get();
      
      if (vehiclesSnapshot.empty) {
        console.log('No se encontró vehículo con esta patente');
        res.json({
          success: true,
          found: false,
          message: 'Usuario no encontrado con esta patente'
        });
        return;
      }
      
      const vehicleData = vehiclesSnapshot.docs[0].data();
      const vehicleId = vehiclesSnapshot.docs[0].id;
      
      console.log('Vehículo encontrado, buscando usuario:', vehicleData.userId);
      
      // Obtener datos del usuario
      const userDoc = await db.collection('users').doc(vehicleData.userId).get();
      
      if (!userDoc.exists) {
        console.log('Usuario no encontrado');
        res.json({
          success: true,
          found: false,
          message: 'Usuario no encontrado'
        });
        return;
      }
      
      const userData = userDoc.data();
      
      console.log('Usuario encontrado:', userData?.email);
      
      res.json({
        success: true,
        found: true,
        user: {
          id: userDoc.id,
          vehicleId: vehicleId,
          nombre: userData?.nombreCompleto || `${userData?.name} ${userData?.surname}`,
          email: userData?.email,
          telefono: userData?.phone || userData?.telefono,
          saldo: userData?.balance || 0,
          patente: vehicleData.licensePlate
        }
      });
      
    } catch (error) {
      console.error('Error al buscar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al buscar usuario'
      });
    }
  }
);

// OBTENER ESPACIOS DISPONIBLES
router.get('/available-spaces', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    try {
      console.log('Obteniendo espacios disponibles...');
      
      const spacesSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'available')
        .limit(50)
        .get();
      
      console.log('Espacios encontrados:', spacesSnapshot.size);
      
      const espacios = spacesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          numero: data.spaceCode,
          ubicacion: data.streetAddress,
          tarifaPorHora: data.feePerHour || 50,
          latitude: data.latitude,
          longitude: data.longitude
        };
      });
      
      res.json({
        success: true,
        espacios
      });
      
    } catch (error) {
      console.error('Error al obtener espacios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener espacios disponibles'
      });
    }
  }
);

// REGISTRAR USUARIO EXISTENTE (CON CUENTA)
router.post('/register-user', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    const { 
      userId, 
      vehicleId, 
      parkingSpaceId, 
      sendNotification 
    } = req.body;
    
    console.log('Iniciando registro de usuario con cuenta');
    console.log('Datos recibidos:', { userId, vehicleId, parkingSpaceId, sendNotification });
    
    if (!userId || !vehicleId || !parkingSpaceId) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
      });
      return;
    }
    
    const batch = db.batch();
    
    try {
      // 1. Verificar que el espacio está disponible
      const spaceDoc = await db.collection('parkingSpaces').doc(parkingSpaceId).get();
      
      if (!spaceDoc.exists) {
        console.log('Espacio no encontrado');
        res.status(404).json({
          success: false,
          message: 'Espacio no encontrado'
        });
        return;
      }
      
      const spaceData = spaceDoc.data();
      
      console.log('Estado del espacio:', spaceData?.status);
      
      if (spaceData?.status !== 'available') {
        console.log('El espacio no está disponible');
        res.status(400).json({
          success: false,
          message: 'El espacio no está disponible'
        });
        return;
      }
      
      const tarifaPorHora = spaceData.feePerHour || 50;
      
      // 2. Verificar saldo del usuario (mínimo 1 hora)
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const currentBalance = userData?.balance || 0;
      
      console.log('Saldo del usuario:', currentBalance);
      
      if (currentBalance < tarifaPorHora) {
        console.log('Saldo insuficiente');
        res.status(400).json({
          success: false,
          message: `Saldo insuficiente. Se requiere al menos $${tarifaPorHora} para 1 hora`
        });
        return;
      }
      
      // 3. Obtener datos del vehículo
      const vehicleDoc = await db.collection('vehicles').doc(vehicleId).get();
      const vehicleData = vehicleDoc.data();
      
      // 4. Crear sesión de estacionamiento
      const sessionRef = db.collection('parkingSessions').doc();
      const startTime = admin.firestore.FieldValue.serverTimestamp();
      
      batch.set(sessionRef, {
        userId,
        userName: userData?.nombreCompleto || `${userData?.name} ${userData?.surname}`,
        userEmail: userData?.email,
        vehicleId,
        licensePlate: vehicleData?.licensePlate,
        parkingSpaceId,
        spaceCode: spaceData.spaceCode,
        streetAddress: spaceData.streetAddress,
        amount: 0,
        feePerHour: tarifaPorHora,
        startTime,
        endTime: null,
        status: 'active',
        isVisitor: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 5. Marcar espacio como ocupado
      const spaceRef = db.collection('parkingSpaces').doc(parkingSpaceId);
      batch.update(spaceRef, {
        status: 'occupied',
        currentSessionId: sessionRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 6. Registrar transacción inicial
      const transactionRef = db.collection('transactions').doc();
      batch.set(transactionRef, {
        userId,
        userEmail: userData?.email,
        userName: userData?.nombreCompleto || `${userData?.name} ${userData?.surname}`,
        type: 'parking_start',
        amount: 0,
        previousBalance: currentBalance,
        newBalance: currentBalance,
        description: `Inicio de estacionamiento en ${spaceData.spaceCode}`,
        parkingSessionId: sessionRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 7. Commit batch
      await batch.commit();
      
      console.log('✅ Registro exitoso. Session ID:', sessionRef.id);
      
      // 8. TODO: Enviar notificación si está habilitado
      if (sendNotification) {
        console.log('Notificación habilitada - TODO: Implementar FCM');
      }
      
      res.json({
        success: true,
        message: 'Vehículo registrado exitosamente',
        data: {
          sessionId: sessionRef.id,
          startTime: new Date().toISOString(),
          ubicacion: spaceData.streetAddress,
          espacioCodigo: spaceData.spaceCode,
          tarifaPorHora,
          usuario: {
            nombre: userData?.nombreCompleto || `${userData?.name} ${userData?.surname}`,
            email: userData?.email
          }
        }
      });
      
    } catch (error) {
      console.error('❌ Error al registrar usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar el vehículo'
      });
    }
  }
);

// ============================================
// ✅ REGISTRAR VISITANTE (EN TABLA USERS) - CORREGIDO
// ============================================
router.post('/register-visitor', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    const { 
      licensePlate,
      parkingSpaceId,
      hours
    } = req.body;
    
    const authenticatedUser = (req as any).user;
    const adminId = authenticatedUser.uid;
    
    console.log('=== REGISTRANDO VISITANTE EN TABLA USERS ===');
    console.log('Datos recibidos:', { licensePlate, parkingSpaceId, hours });
    console.log('Admin ID:', adminId);
    
    // Validaciones
    if (!licensePlate || !parkingSpaceId || !hours) {
      res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios: licensePlate, parkingSpaceId, hours'
      });
      return;
    }
    
    const hoursNum = parseFloat(hours);
    if (hoursNum <= 0) {
      res.status(400).json({
        success: false,
        message: 'Las horas deben ser mayor a 0'
      });
      return;
    }
    
    const batch = db.batch();
    
    try {
      // 1. Verificar que el espacio está disponible
      const spaceDoc = await db.collection('parkingSpaces').doc(parkingSpaceId).get();
      
      if (!spaceDoc.exists) {
        console.log('❌ Espacio no encontrado');
        res.status(404).json({
          success: false,
          message: 'Espacio no encontrado'
        });
        return;
      }
      
      const spaceData = spaceDoc.data();
      
      if (spaceData?.status !== 'available') {
        console.log('❌ El espacio no está disponible');
        res.status(400).json({
          success: false,
          message: 'El espacio no está disponible'
        });
        return;
      }
      
      const tarifaPorHora = spaceData.feePerHour || 50;
      const totalAmount = tarifaPorHora * hoursNum;
      
      console.log('💰 Tarifa por hora:', tarifaPorHora);
      console.log('💰 Total a cobrar:', totalAmount);
      
      // 🚨 CORRECCIÓN DE ERROR 500: Obtener información de la calle de forma segura
      let streetData = null;
      let streetRef: admin.firestore.DocumentReference | undefined;
      let finalStreetAddress = spaceData.streetAddress; // Fallback a la dirección del espacio
      
      if (spaceData.streetId) {
        streetRef = db.collection('streets').doc(spaceData.streetId);
        const streetDoc = await streetRef.get();
        
        if (streetDoc.exists) {
          streetData = streetDoc.data();
          if (streetData?.streetAddress) {
            finalStreetAddress = streetData.streetAddress; // Usar la dirección de la calle si existe
          }
        } else {
          console.warn(`⚠️ Advertencia: Documento de calle no encontrado para streetId: ${spaceData.streetId}. Usando la dirección del espacio.`);
          streetRef = undefined; // Eliminar la referencia si el documento no existe
        }
      }
      // FIN DE CORRECCIÓN
      
      // 2. ✅ CREAR USUARIO VISITANTE EN TABLA USERS
      const visitorUserRef = db.collection('users').doc();
      
      batch.set(visitorUserRef, {
        // Datos mínimos obligatorios
        licensePlate: licensePlate.toUpperCase(),
        isVisitor: true,
        balance: 0,
        estado: 'activo',
        isAdmin: false,
        
        // Datos opcionales/auto-generados
        nombreCompleto: `Visitante ${licensePlate.toUpperCase()}`,
        email: undefined,
        telefono: undefined,
        
        // Metadata
        createdBy: adminId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log('✅ Usuario visitante creado en users:', visitorUserRef.id);
      
      // 3. Crear vehículo para el visitante
      const vehicleRef = db.collection('vehicles').doc();
      
      batch.set(vehicleRef, {
        userId: visitorUserRef.id,
        licensePlate: licensePlate.toUpperCase(),
        isVisitor: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Vehículo visitante creado:', vehicleRef.id);
      
      // 4. Calcular tiempo de finalización
      const startTime = admin.firestore.Timestamp.now();
      const endTime = admin.firestore.Timestamp.fromMillis(
        startTime.toMillis() + (hoursNum * 60 * 60 * 1000)
      );
      
      // 5. Crear sesión de estacionamiento
      const sessionRef = db.collection('parkingSessions').doc();
      
      batch.set(sessionRef, {
        userId: visitorUserRef.id,
        vehicleId: vehicleRef.id,
        parkingSpaceId,
        licensePlate: licensePlate.toUpperCase(),
        isVisitor: true,
        amount: totalAmount,
        startTime,
        endTime,
        scheduledEndTime: endTime,
        status: 'active',
        feePerHour: tarifaPorHora,
        duration: hoursNum,
        spaceCode: spaceData.spaceCode,
        streetAddress: finalStreetAddress, // Usar la dirección ya verificada
        paymentMethod: 'cash',
        paidAmount: totalAmount,
        createdBy: adminId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Sesión creada:', sessionRef.id);
      
      // 6. Actualizar estado del espacio
      batch.update(db.collection('parkingSpaces').doc(parkingSpaceId), {
        status: 'occupied',
        currentSessionId: sessionRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 7. Actualizar espacios disponibles en la calle SÓLO si la referencia es válida
      if (streetRef) {
        batch.update(streetRef, {
          availableSpaces: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // 8. Crear transacción de pago en efectivo
      const transactionRef = db.collection('transactions').doc();
      
      batch.set(transactionRef, {
        userId: visitorUserRef.id,
        type: 'parking',
        amount: -totalAmount,
        method: 'cash',
        status: 'approved',
        description: `Visitante - ${spaceData.spaceCode} - ${hoursNum}h`,
        parkingSessionId: sessionRef.id,
        previousBalance: 0,
        newBalance: 0,
        createdBy: adminId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 9. Commit batch
      await batch.commit();
      
      console.log('✅ Visitante registrado exitosamente');
      
      res.json({
        success: true,
        message: 'Visitante registrado exitosamente',
        data: {
          userId: visitorUserRef.id,
          vehicleId: vehicleRef.id,
          sessionId: sessionRef.id,
          espacioCodigo: spaceData.spaceCode,
          ubicacion: finalStreetAddress,
          hours: hoursNum,
          totalAmount,
          tarifaPorHora,
          startTime: startTime.toDate().toISOString(),
          endTime: endTime.toDate().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ Error al registrar visitante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar el visitante'
      });
    }
  }
);

// OBTENER VEHÍCULOS DEL USUARIO
router.get('/user/:userId/vehicles', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    
    try {
      console.log('Obteniendo vehículos del usuario:', userId);
      
      const vehiclesSnapshot = await db.collection('vehicles')
        .where('userId', '==', userId)
        .where('isVisitor', '==', false)
        .get();
      
      const vehicles = vehiclesSnapshot.docs.map(doc => ({
        id: doc.id,
        license_plate: doc.data().licensePlate
      }));
      
      console.log('Vehículos encontrados:', vehicles.length);
      
      res.json({
        success: true,
        vehicles
      });
      
    } catch (error) {
      console.error('Error al obtener vehículos:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener vehículos'
      });
    }
  }
);

// FINALIZAR SESIÓN (USUARIO REGISTRADO O VISITANTE)
router.post('/end-session/:sessionId', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    
    try {
      console.log('Finalizando sesión:', sessionId);
      
      const sessionDoc = await db.collection('parkingSessions').doc(sessionId).get();
      
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
          message: 'La sesión no está activa'
        });
        return;
      }
      
      const endTime = admin.firestore.Timestamp.now();
      const startTime = sessionData.startTime;
      
      // Calcular tiempo transcurrido en horas
      const hoursElapsed = (endTime.toMillis() - startTime.toMillis()) / (1000 * 60 * 60);
      const totalAmount = Math.ceil(hoursElapsed) * sessionData.feePerHour;
      
      console.log('Horas transcurridas:', hoursElapsed);
      console.log('Total a cobrar:', totalAmount);
      
      const batch = db.batch();
      
      // Si es visitante, solo actualizar sesión y liberar espacio
      if (sessionData.isVisitor) {
        console.log('Es visitante - finalizando sesión prepagada');
        
        batch.update(db.collection('parkingSessions').doc(sessionId), {
          status: 'completed',
          actualEndTime: endTime,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Liberar espacio
        batch.update(db.collection('parkingSpaces').doc(sessionData.parkingSpaceId), {
          status: 'available',
          currentSessionId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        
        res.json({
          success: true,
          message: 'Sesión de visitante finalizada exitosamente'
        });
        return;
      }
      
      // Usuario registrado - cobrar del saldo
      const userDoc = await db.collection('users').doc(sessionData.userId).get();
      const currentBalance = userDoc.data()?.balance || 0;
      
      if (currentBalance < totalAmount) {
        res.status(400).json({
          success: false,
          message: 'Saldo insuficiente para completar el pago'
        });
        return;
      }
      
      // Actualizar sesión
      batch.update(db.collection('parkingSessions').doc(sessionId), {
        endTime,
        amount: totalAmount,
        hoursElapsed: Math.ceil(hoursElapsed),
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Descontar del saldo
      batch.update(db.collection('users').doc(sessionData.userId), {
        balance: admin.firestore.FieldValue.increment(-totalAmount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Liberar espacio
      batch.update(db.collection('parkingSpaces').doc(sessionData.parkingSpaceId), {
        status: 'available',
        currentSessionId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Registrar transacción
      const transactionRef = db.collection('transactions').doc();
      batch.set(transactionRef, {
        userId: sessionData.userId,
        userEmail: sessionData.userEmail,
        userName: sessionData.userName,
        type: 'parking_end',
        amount: -totalAmount,
        previousBalance: currentBalance,
        newBalance: currentBalance - totalAmount,
        description: `Pago de estacionamiento en ${sessionData.spaceCode}`,
        parkingSessionId: sessionId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      
      console.log('Sesión finalizada exitosamente');
      
      res.json({
        success: true,
        message: 'Sesión finalizada exitosamente',
        data: {
          hoursElapsed: Math.ceil(hoursElapsed),
          totalAmount,
          newBalance: currentBalance - totalAmount
        }
      });
      
    } catch (error) {
      console.error('Error al finalizar sesión:', error);
      res.status(500).json({
        success: false,
        message: 'Error al finalizar sesión'
      });
    }
  }
);

export default router;