// server/src/routes/payment.routes.ts
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

// Obtener estadísticas de transacciones del día (solo admin)
router.get('/stats/today', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    console.log('Obteniendo estadísticas del día...');
    
    // Obtener inicio y fin del día actual
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    console.log('Rango de fechas:');
    console.log('- Inicio:', startOfDay.toISOString());
    console.log('- Fin:', endOfDay.toISOString());
    
    // Obtener TODAS las transacciones y filtrar manualmente (evita problema de índices)
    const transactionsSnapshot = await db.collection('transactions')
      .orderBy('createdAt', 'desc')
      .get();
    
    let totalIncome = 0;
    let rechargesCount = 0;
    let parkingExpenses = 0;
    let parkingCount = 0;
    let todayTransactions = 0;
    
    transactionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // Verificar si la transacción es de hoy
      if (data.createdAt) {
        const transactionDate = data.createdAt.toDate();
        
        // Solo procesar transacciones de HOY
        if (transactionDate >= startOfDay && transactionDate <= endOfDay) {
          todayTransactions++;
          const amount = data.amount || 0;
          
          console.log(`Transacción del día:`, {
            type: data.type,
            amount: amount,
            date: transactionDate.toISOString()
          });
          
          if (data.type === 'recharge' && amount > 0) {
            // Solo contar recargas positivas (ingresos reales)
            totalIncome += amount;
            rechargesCount++;
          } else if (data.type === 'parking' && amount < 0) {
            // Gastos de estacionamiento
            parkingExpenses += Math.abs(amount);
            parkingCount++;
          }
        }
      }
    });
    
    console.log('Resumen del día:');
    console.log('- Transacciones totales hoy:', todayTransactions);
    console.log('- Ingresos (recargas):', totalIncome);
    console.log('- Cantidad de recargas:', rechargesCount);
    console.log('- Gastos estacionamiento:', parkingExpenses);
    console.log('- Cantidad de estacionamientos:', parkingCount);
    
    res.json({
      success: true,
      stats: {
        totalIncome: totalIncome.toFixed(2),
        rechargesCount,
        parkingExpenses: parkingExpenses.toFixed(2),
        parkingCount,
        netIncome: (totalIncome - parkingExpenses).toFixed(2),
        todayTransactions
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener estadísticas del día:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del día',
      error: error.message
    });
  }
});

export default router;