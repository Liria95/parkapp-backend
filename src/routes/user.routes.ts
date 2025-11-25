import { Router, Request, Response } from 'express';
import { UserController } from '../controllers/userController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Crear carpeta uploads si no existe
const uploadsDir = 'uploads/profiles/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imagenes'));
    }
  }
});

// ========== RUTAS DE USUARIO (Requieren autenticacion) ==========

// Obtener saldo del usuario actual
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authenticatedUser = (req as any).user;
    const userId = authenticatedUser.uid;

    console.log('Obteniendo saldo para usuario:', userId);

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
    const balance = userData?.balance || 0;

    console.log('Saldo obtenido:', balance);

    res.json({
      success: true,
      balance
    });

  } catch (error) {
    console.error('Error al obtener saldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener saldo',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Obtener perfil del usuario actual
router.get('/profile', authMiddleware, UserController.getProfile);

// Actualizar perfil
router.put('/profile', authMiddleware, UserController.updateProfile);

// Subir foto de perfil
router.post('/profile-photo', authMiddleware, upload.single('photo'), UserController.updateProfilePhoto);

// Ruta alternativa
router.post('/profile/photo', authMiddleware, upload.single('photo'), UserController.updateProfilePhoto);

// Eliminar foto de perfil
router.delete('/profile/photo', authMiddleware, UserController.deleteProfilePhoto);

// ========== RUTAS DE ADMINISTRADOR (Requieren admin) ==========

// Obtener todos los usuarios
router.get('/all', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo todos los usuarios...');
    
    const usersSnapshot = await db.collection('users').get();
    
    const users = usersSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString(),
      lastRecharge: doc.data().lastRecharge?.toDate().toISOString(),
    }));
    
    console.log('Usuarios encontrados:', users.length);
    
    res.json({
      success: true,
      users,
      total: users.length
    });
    
  } catch (error: any) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

// Buscar usuarios
router.get('/search', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Debe proporcionar un termino de busqueda'
    });
    return;
  }
  
  try {
    console.log('Buscando usuarios con termino:', q);
    
    const searchTerm = q.toLowerCase();
    const usersSnapshot = await db.collection('users').get();
    
    const users = usersSnapshot.docs
      .map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate().toISOString(),
        lastRecharge: doc.data().lastRecharge?.toDate().toISOString(),
      }))
      .filter((user: any) => {
        const name = user.name?.toLowerCase() || '';
        const surname = user.surname?.toLowerCase() || '';
        const email = user.email?.toLowerCase() || '';
        const phone = user.phone?.toLowerCase() || '';
        
        return (
          name.includes(searchTerm) ||
          surname.includes(searchTerm) ||
          email.includes(searchTerm) ||
          phone.includes(searchTerm)
        );
      });
    
    console.log('Usuarios encontrados:', users.length);
    
    res.json({
      success: true,
      users,
      total: users.length
    });
    
  } catch (error: any) {
    console.error('Error al buscar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al buscar usuarios'
    });
  }
});

// Obtener estadisticas de usuarios
router.get('/stats/overview', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadisticas de usuarios...');
    
    const usersSnapshot = await db.collection('users').get();
    
    let totalBalance = 0;
    let activeUsers = 0;
    let activeAdmins = 0;
    const userData = usersSnapshot.docs.map(doc => doc.data());
    
    userData.forEach(user => {
      totalBalance += user.balance || 0;
      
      if (user.updatedAt) {
        const lastActivity = user.updatedAt.toDate();
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity <= 7) {
          activeUsers++;
          
          if (user.isAdmin) {
            activeAdmins++;
          }
        }
      }
      
      if (!user.updatedAt && user.isAdmin) {
        activeAdmins++;
      }
    });
    
    res.json({
      success: true,
      stats: {
        totalUsers: usersSnapshot.size,
        activeUsers,
        inactiveUsers: usersSnapshot.size - activeUsers,
        totalBalance: totalBalance.toFixed(2),
        averageBalance: (totalBalance / usersSnapshot.size).toFixed(2),
        activeAdmins
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener estadisticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas'
    });
  }
});

router.get('/stats/history', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadisticas historicas (sin indices)...');

    const now = new Date();
    
    // Calcular fecha de ayer
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Calcular fecha de hace una semana
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);

    // OBTENER TODAS LAS TRANSACCIONES (sin filtros de fecha ni tipo)
    const allTransactions = await db.collection('transactions').get();

    // Filtrar en memoria - AYER
    let yesterdayRevenue = 0;
    allTransactions.docs.forEach(doc => {
      const data = doc.data();
      if (!data.createdAt || !data.type || !data.amount) return;
      
      const createdAt = data.createdAt.toDate();
      if (data.type === 'recharge' && 
          data.amount > 0 && 
          createdAt >= yesterday && 
          createdAt <= yesterdayEnd) {
        yesterdayRevenue += data.amount;
      }
    });

    // Filtrar en memoria - SEMANA PASADA
    let lastWeekRevenue = 0;
    allTransactions.docs.forEach(doc => {
      const data = doc.data();
      if (!data.createdAt || !data.type || !data.amount) return;
      
      const createdAt = data.createdAt.toDate();
      if (data.type === 'recharge' && 
          data.amount > 0 && 
          createdAt >= lastWeekStart && 
          createdAt <= lastWeekEnd) {
        lastWeekRevenue += data.amount;
      }
    });

    // OBTENER TODOS LOS USUARIOS (sin filtros de fecha)
    const allUsers = await db.collection('users').get();

    // Filtrar en memoria - USUARIOS AYER
    let yesterdayUsers = 0;
    allUsers.docs.forEach(doc => {
      const data = doc.data();
      if (!data.updatedAt) return;
      
      const updatedAt = data.updatedAt.toDate();
      if (updatedAt >= yesterday && updatedAt <= yesterdayEnd) {
        yesterdayUsers++;
      }
    });

    // Filtrar en memoria - USUARIOS SEMANA PASADA
    let lastWeekUsers = 0;
    allUsers.docs.forEach(doc => {
      const data = doc.data();
      if (!data.updatedAt) return;
      
      const updatedAt = data.updatedAt.toDate();
      if (updatedAt >= lastWeekStart && updatedAt <= lastWeekEnd) {
        lastWeekUsers++;
      }
    });

    console.log('Estadisticas historicas calculadas:', {
      yesterday: { users: yesterdayUsers, revenue: yesterdayRevenue },
      lastWeek: { users: lastWeekUsers, revenue: lastWeekRevenue }
    });

    res.json({
      success: true,
      history: {
        yesterday: {
          activeUsers: yesterdayUsers,
          revenue: yesterdayRevenue.toFixed(2)
        },
        lastWeek: {
          activeUsers: lastWeekUsers,
          revenue: lastWeekRevenue.toFixed(2)
        }
      }
    });

  } catch (error: any) {
    console.error('Error al obtener estadisticas historicas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadisticas historicas'
    });
  }
});

// Obtener usuario especifico
router.get('/:userId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  try {
    console.log('Obteniendo usuario:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    const userData = userDoc.data();
    
    res.json({
      success: true,
      user: {
        id: userDoc.id,
        ...userData,
        createdAt: userData?.createdAt?.toDate().toISOString(),
        updatedAt: userData?.updatedAt?.toDate().toISOString(),
        lastRecharge: userData?.lastRecharge?.toDate().toISOString(),
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario'
    });
  }
});

// Actualizar saldo de usuario
router.put('/:userId/balance', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { balance } = req.body;
  
  if (balance === undefined || balance < 0) {
    res.status(400).json({
      success: false,
      message: 'El saldo debe ser un numero positivo'
    });
    return;
  }
  
  try {
    console.log('Actualizando saldo del usuario:', userId, 'a', balance);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    const previousBalance = userDoc.data()?.balance || 0;
    
    await db.collection('users').doc(userId).update({
      balance: balance,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await db.collection('transactions').add({
      userId,
      userEmail: userDoc.data()?.email,
      userName: `${userDoc.data()?.name} ${userDoc.data()?.surname}`,
      type: 'admin_adjustment',
      amount: balance - previousBalance,
      previousBalance,
      newBalance: balance,
      method: 'admin',
      status: 'approved',
      description: 'Ajuste manual de saldo por administrador',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Saldo actualizado exitosamente');
    
    res.json({
      success: true,
      message: 'Saldo actualizado correctamente',
      previousBalance,
      newBalance: balance
    });
    
  } catch (error: any) {
    console.error('Error al actualizar saldo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar saldo'
    });
  }
});

// Activar/desactivar usuario
router.put('/:userId/status', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { isActive } = req.body;
  
  if (isActive === undefined) {
    res.status(400).json({
      success: false,
      message: 'Debe especificar el estado (isActive: true/false)'
    });
    return;
  }
  
  try {
    console.log('Cambiando estado del usuario:', userId, 'a', isActive ? 'activo' : 'inactivo');
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    await db.collection('users').doc(userId).update({
      isActive: isActive,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Estado actualizado exitosamente');
    
    res.json({
      success: true,
      message: `Usuario ${isActive ? 'activado' : 'desactivado'} correctamente`
    });
    
  } catch (error: any) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado'
    });
  }
});

export default router;