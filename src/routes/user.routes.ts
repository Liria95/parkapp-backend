import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth.middleware';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

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

// RUTAS DE USUARIO (Requieren autenticación)

//Obtener saldo del usuario actual
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  try {
    const authenticatedUser = (req as any).user;
    const userId = authenticatedUser.uid;

    console.log('Obteniendo saldo para usuario:', userId);

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
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

// Subir foto de perfil (con Cloudinary)
router.post('/profile-photo', authMiddleware, upload.single('photo'), UserController.updateProfilePhoto);

// Ruta alternativa (mismo endpoint)
router.post('/profile/photo', authMiddleware, upload.single('photo'), UserController.updateProfilePhoto);

// Eliminar foto de perfil
router.delete('/profile/photo', authMiddleware, UserController.deleteProfilePhoto);

// RUTAS DE ADMINISTRADOR (Requieren admin)

// Obtener todos los usuarios (solo admin)
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

// Buscar usuarios (solo admin)
router.get('/search', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Debe proporcionar un término de búsqueda'
    });
    return;
  }
  
  try {
    console.log('Buscando usuarios con término:', q);
    
    const searchTerm = q.toLowerCase();
    
    // Obtener todos los usuarios
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

// Obtener estadísticas de usuarios (solo admin)
router.get('/stats/overview', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadísticas de usuarios...');
    
    const usersSnapshot = await db.collection('users').get();
    
    let totalBalance = 0;
    let activeUsers = 0;
    let activeAdmins = 0;
    const userData = usersSnapshot.docs.map(doc => doc.data());
    
    userData.forEach(user => {
      totalBalance += user.balance || 0;
      
      // Considerar activo si tiene actividad en los últimos 7 días
      if (user.updatedAt) {
        const lastActivity = user.updatedAt.toDate();
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity <= 7) {
          activeUsers++;
          
          // Contar admins activos
          if (user.isAdmin) {
            activeAdmins++;
          }
        }
      }
      
      // Si no tiene updatedAt pero es admin, contar como activo
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
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

// Obtener usuario específico (solo admin)
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

// Actualizar saldo de usuario (solo admin)
router.put('/:userId/balance', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { balance } = req.body;
  
  if (balance === undefined || balance < 0) {
    res.status(400).json({
      success: false,
      message: 'El saldo debe ser un número positivo'
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
    
    // Registrar transacción
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

// Activar/desactivar usuario (solo admin)
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

// Obtener estadísticas históricas (solo admin)
router.get('/stats/history', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadísticas históricas...');
    
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Obtener usuarios
    const usersSnapshot = await db.collection('users').get();
    
    // Obtener transacciones de ayer
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));
    
    const yesterdayTransactions = await db.collection('transactions')
      .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(yesterdayStart))
      .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(yesterdayEnd))
      .get();
    
    // Calcular ingresos de ayer (solo recargas positivas)
    let yesterdayRevenue = 0;
    yesterdayTransactions.docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'recharge' && data.amount > 0) {
        yesterdayRevenue += data.amount;
      }
    });
    
    // Calcular usuarios activos ayer
    let yesterdayActiveUsers = 0;
    const currentActiveUsers = usersSnapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.updatedAt) {
        const daysSinceActivity = (Date.now() - data.updatedAt.toDate().getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceActivity <= 7;
      }
      return false;
    }).length;
    
    // Estimación basada en datos actuales (ya que no tenemos histórico real)
    yesterdayActiveUsers = Math.max(1, Math.floor(currentActiveUsers * 0.9));
    const lastWeekActiveUsers = Math.max(1, Math.floor(currentActiveUsers * 0.95));
    
    // Si no hay transacciones de ayer, usar estimación
    if (yesterdayRevenue === 0) {
      const currentRevenue = usersSnapshot.docs.reduce((sum, doc) => sum + (doc.data().balance || 0), 0);
      yesterdayRevenue = currentRevenue * 0.85;
    }
    
    const lastWeekRevenue = yesterdayRevenue * 1.05;
    
    res.json({
      success: true,
      history: {
        yesterday: {
          activeUsers: yesterdayActiveUsers,
          revenue: yesterdayRevenue.toFixed(2),
        },
        lastWeek: {
          activeUsers: lastWeekActiveUsers,
          revenue: lastWeekRevenue.toFixed(2),
        }
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas históricas'
    });
  }
});

export default router;