import { Router, Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

console.log('Sistema de pagos configurado');

// INTERFACES
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

// SIMULACIÓN DE PAGO CON GUARDADO EN FIREBASE
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
    console.log('Usuario:', userName);
    
    // VERIFICAR QUE EL USUARIO SOLO PUEDA RECARGAR SU PROPIA CUENTA
    if (authenticatedUser.uid !== userId) {
      console.log('❌ Intento de recarga no autorizada');
      res.status(403).json({
        success: false,
        message: 'No puedes recargar el saldo de otro usuario'
      });
      return;
    }
    
    // VALIDAR MONTO
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
        message: 'El monto máximo de recarga es $50,000'
      });
      return;
    }
    
    try {
      // Simular delay de procesamiento
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simular ID de pago
      const paymentId = `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simular respuesta de pago aprobado
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
        payment_type_id: 'credit_card',
        date_approved: new Date().toISOString(),
        date_created: new Date().toISOString(),
        metadata: {
          simulated: true,
          user_name: userName
        }
      };
      
      console.log('Pago simulado aprobado:', paymentId);
      
      // ACTUALIZAR FIREBASE
      
      // 1. Obtener saldo actual
      const userDoc = await db.collection('users').doc(userId).get();
      const currentBalance = userDoc.data()?.balance || 0;
      const newBalance = currentBalance + amount;
      
      console.log('Actualizando saldo en Firestore...');
      console.log('  - Saldo actual:', currentBalance);
      console.log('  - Incremento:', amount);
      console.log('  - Nuevo saldo:', newBalance);
      
      // 2. Actualizar saldo del usuario
      await db.collection('users').doc(userId).update({
        balance: admin.firestore.FieldValue.increment(amount),
        lastRecharge: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Saldo actualizado');
      
      // 3. Guardar transacción
      console.log('Guardando transacción...');
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
        description: `Recarga de saldo - ${userName}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('Transacción guardada');
      
      res.json({
        success: true,
        payment: simulatedPayment,
        message: `Saldo actualizado: $${currentBalance} → $${newBalance}`
      });
      
    } catch (error: any) {
      console.error('❌ Error al simular pago:', error);
      res.status(500).json({
        success: false,
        message: 'Error al procesar el pago',
        error: error.message
      });
    }
  }
);

// OBTENER HISTORIAL DE TRANSACCIONES
router.get(
  '/transactions', 
  authMiddleware,
  async (req: Request, res: Response) => {
    const authenticatedUser = (req as any).user;
    
    try {
      console.log('Obteniendo transacciones del usuario:', authenticatedUser.uid);
      
      const transactionsSnapshot = await db.collection('transactions')
        .where('userId', '==', authenticatedUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      
      // TIPAR EL PARÁMETRO 'doc'
      const transactions = transactionsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toISOString()
      }));
      
      console.log('Transacciones encontradas:', transactions.length);
      
      res.json({
        success: true,
        transactions
      });
      
    } catch (error: any) {
      console.error('Error al obtener transacciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de transacciones',
        error: error.message
      });
    }
  }
);

// OBTENER SALDO ACTUAL
router.get(
  '/balance', 
  authMiddleware,
  async (req: Request, res: Response) => {
    const authenticatedUser = (req as any).user;
    
    try {
      console.log('Obteniendo saldo del usuario:', authenticatedUser.uid);
      
      const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
      
      if (!userDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }
      
      const balance = userDoc.data()?.balance || 0;
      
      console.log('Saldo:', balance);
      
      res.json({
        success: true,
        balance,
        userId: authenticatedUser.uid
      });
      
    } catch (error: any) {
      console.error('Error al obtener saldo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener saldo',
        error: error.message
      });
    }
  }
);

// RUTA DE PRUEBA PÚBLICA
interface TestResponse {
  success: boolean;
  message: string;
}

router.get('/test', (req: Request, res: Response<TestResponse>) => {
  res.json({
    success: true,
    message: 'API de pagos funcionando'
  });
});

export default router;