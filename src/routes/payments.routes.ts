import { Router, Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Interfaces
interface SimulatePaymentRequest {
  amount: number;
  userId: string;
  userName: string;
}

interface SimulatePaymentResponse {
  success: boolean;
  payment?: any;
  message?: string;
  error?: string;
}

// Simulación de pago
router.post(
  '/simulate-payment',
  authMiddleware,
  async (req: Request<{}, {}, SimulatePaymentRequest>, res: Response<SimulatePaymentResponse>) => {
    const { amount, userId, userName } = req.body;
    const authenticatedUser = (req as any).user;
    
    console.log('===== SIMULANDO PAGO =====');
    console.log('Monto:', amount);
    console.log('UserId solicitado:', userId);
    console.log('Usuario autenticado:', authenticatedUser.uid);
    
    // Verificar autorización
    if (authenticatedUser.uid !== userId) {
      console.log('No autorizado');
      res.status(403).json({
        success: false,
        message: 'No puedes recargar el saldo de otro usuario'
      });
      return;
    }
    
    // Validar monto
    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        message: 'El monto debe ser mayor a 0'
      });
      return;
    }
    
    if (amount > 50000) {
      res.status(400).json({
        success: false,
        message: 'El monto máximo es $50,000'
      });
      return;
    }
    
    try {
      // Simular delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const paymentId = `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const simulatedPayment = {
        id: paymentId,
        status: 'approved',
        status_detail: 'accredited',
        transaction_amount: amount,
        external_reference: userId,
        payer: {
          email: authenticatedUser.email,
          name: userName
        },
        payment_method_id: 'simulated',
        date_approved: new Date().toISOString(),
        date_created: new Date().toISOString()
      };
      
      console.log('Pago simulado aprobado:', paymentId);
      
      // Obtener saldo actual
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }

      const currentBalance = userDoc.data()?.balance || 0;
      const newBalance = currentBalance + amount;
      
      console.log('Actualizando saldo...');
      console.log('  - Actual:', currentBalance);
      console.log('  - Nuevo:', newBalance);
      
      // Actualizar saldo
      await db.collection('users').doc(userId).update({
        balance: admin.firestore.FieldValue.increment(amount),
        lastRecharge: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Guardar transacción
      await db.collection('transactions').add({
        userId,
        userEmail: authenticatedUser.email,
        userName: userName,
        type: 'recharge',
        amount,
        previousBalance: currentBalance,
        newBalance: newBalance,
        method: 'simulated',
        paymentId: paymentId,
        status: 'approved',
        description: `Recarga simulada`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('Transacción guardada');
      
      res.json({
        success: true,
        payment: simulatedPayment,
        message: `Saldo actualizado: $${currentBalance} → $${newBalance}`
      });
      
    } catch (error: any) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el pago',
        error: error.message
      });
    }
  }
);

// Obtener saldo
router.get('/balance', authMiddleware, async (req: Request, res: Response) => {
  const authenticatedUser = (req as any).user;
  
  try {
    const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    const balance = userDoc.data()?.balance || 0;
    
    res.json({
      success: true,
      balance,
      userId: authenticatedUser.uid
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener saldo'
    });
  }
});

// Obtener transacciones
router.get('/transactions', authMiddleware, async (req: Request, res: Response) => {
  const authenticatedUser = (req as any).user;
  
  try {
    const transactionsSnapshot = await db.collection('transactions')
      .where('userId', '==', authenticatedUser.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    
    const transactions = transactionsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString()
    }));
    
    res.json({
      success: true,
      transactions
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener transacciones'
    });
  }
});

// Ruta de prueba
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API de pagos funcionando',
    payment_methods: ['simulated']
  });
});

export default router;