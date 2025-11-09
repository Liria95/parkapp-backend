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

// Interfaces
interface Fine {
  id: string;
  numero: string;
  userId: string;
  userName: string;
  userEmail: string;
  licensePlate: string;
  reason: string;
  amount: number;
  status: 'pendiente' | 'pagada' | 'cancelada';
  location: string;
  parkingSessionId?: string;
  issuedAt: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
}

// Obtener todas las infracciones (solo admin)
router.get('/all', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
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
      createdAt: doc.data().createdAt?.toDate().toISOString(),
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
});

// Obtener infracciones de un usuario
router.get('/user/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  
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
  
  try {
    console.log('Obteniendo infracciones del usuario:', userId);
    
    const finesSnapshot = await db.collection('fines')
      .where('userId', '==', userId)
      // .orderBy('createdAt', 'desc')  // ← Comentado hasta crear índice
      .get();
    
    const fines = finesSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
      issuedAt: doc.data().issuedAt?.toDate().toISOString(),
      paidAt: doc.data().paidAt?.toDate().toISOString(),
      createdAt: doc.data().createdAt?.toDate().toISOString(),
    }));
    
    // Ordenar manualmente en JavaScript
    fines.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA; // Desc
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
});

// Crear nueva infracción (solo admin)
router.post('/create', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { userId, licensePlate, reason, amount, location, parkingSessionId } = req.body;
  
  if (!userId || !licensePlate || !reason || !amount || !location) {
    res.status(400).json({
      success: false,
      message: 'Faltan campos obligatorios'
    });
    return;
  }
  
  try {
    console.log('Creando nueva infracción...');
    
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
    
    // Generar número de infracción
    const finesCount = await db.collection('fines').count().get();
    const numero = String(finesCount.data().count + 1).padStart(6, '0');
    
    // Crear infracción
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
      parkingSessionId: parkingSessionId || null,
      issuedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('Infracción creada:', fineRef.id);
    
    res.json({
      success: true,
      message: 'Infracción creada exitosamente',
      fineId: fineRef.id,
      numero
    });
    
  } catch (error: any) {
    console.error('Error al crear infracción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear infracción'
    });
  }
});

// Actualizar estado de infracción (solo admin)
router.put('/:fineId/status', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  const { fineId } = req.params;
  const { status } = req.body;
  
  if (!['pendiente', 'pagada', 'cancelada'].includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Estado inválido'
    });
    return;
  }
  
  try {
    console.log('Actualizando estado de infracción:', fineId, 'a', status);
    
    const fineDoc = await db.collection('fines').doc(fineId).get();
    
    if (!fineDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Infracción no encontrada'
      });
      return;
    }
    
    const updateData: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (status === 'pagada') {
      updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await db.collection('fines').doc(fineId).update(updateData);
    
    console.log('Estado actualizado exitosamente');
    
    res.json({
      success: true,
      message: `Infracción marcada como ${status}`
    });
    
  } catch (error: any) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar estado'
    });
  }
});

// Pagar infracción (usuario o admin)
router.post('/:fineId/pay', authMiddleware, async (req: Request, res: Response) => {
  const { fineId } = req.params;
  const authenticatedUser = (req as any).user;
  
  try {
    console.log('Procesando pago de infracción:', fineId);
    
    const fineDoc = await db.collection('fines').doc(fineId).get();
    
    if (!fineDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Infracción no encontrada'
      });
      return;
    }
    
    const fineData = fineDoc.data();
    
    // Verificar que el usuario es dueño de la infracción o admin
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
      userEmail: fineData.userEmail,
      userName: fineData.userName,
      type: 'fine_payment',
      amount: -fineData.amount,
      previousBalance: currentBalance,
      newBalance: currentBalance - fineData.amount,
      method: 'balance',
      status: 'approved',
      description: `Pago de infracción #${fineData.numero}`,
      fineId: fineId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('Infracción pagada exitosamente');
    
    res.json({
      success: true,
      message: 'Infracción pagada exitosamente',
      newBalance: currentBalance - fineData.amount
    });
    
  } catch (error: any) {
    console.error('Error al pagar infracción:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el pago'
    });
  }
});

// Obtener estadísticas de infracciones (solo admin)
router.get('/stats/overview', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadísticas de infracciones...');
    
    const finesSnapshot = await db.collection('fines').get();
    
    let totalAmount = 0;
    let pendingAmount = 0;
    let paidAmount = 0;
    let pendingCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;
    
    finesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalAmount += data.amount || 0;
      
      if (data.status === 'pendiente') {
        pendingCount++;
        pendingAmount += data.amount || 0;
      } else if (data.status === 'pagada') {
        paidCount++;
        paidAmount += data.amount || 0;
      } else if (data.status === 'cancelada') {
        cancelledCount++;
      }
    });
    
    res.json({
      success: true,
      stats: {
        total: finesSnapshot.size,
        pending: pendingCount,
        paid: paidCount,
        cancelled: cancelledCount,
        totalAmount: totalAmount.toFixed(2),
        pendingAmount: pendingAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2)
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

export default router;