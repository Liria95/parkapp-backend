import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

interface SimulatePaymentRequest {
  amount: number;
  userId: string;
  userName: string;
}

export class PaymentsController {
  
  // ========== SIMULAR PAGO ==========
  static async simulatePayment(req: Request, res: Response): Promise<void> {
    try {
      const { amount, userId, userName } = req.body as SimulatePaymentRequest;
      const authenticatedUser = (req as any).user;
      
      console.log('===== SIMULANDO PAGO =====');
      console.log('Monto:', amount);
      console.log('UserId solicitado:', userId);
      console.log('Usuario autenticado:', authenticatedUser.uid);
      
      if (authenticatedUser.uid !== userId) {
        console.log('No autorizado');
        res.status(403).json({
          success: false,
          message: 'No puedes recargar el saldo de otro usuario'
        });
        return;
      }
      
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
      
      await db.collection('users').doc(userId).update({
        balance: admin.firestore.FieldValue.increment(amount),
        lastRecharge: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
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

  // ========== OBTENER SALDO ==========
  static async getBalance(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      
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
  }

  // ========== OBTENER TRANSACCIONES ==========
  static async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const authenticatedUser = (req as any).user;
      
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
  }

  // ========== TEST ==========
  static async test(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'API de pagos funcionando',
      payment_methods: ['simulated']
    });
  }

  // ========== ESTADÍSTICAS DEL DÍA (Admin) ==========
  static async getTodayStats(req: Request, res: Response): Promise<void> {
    try {
      console.log('Obteniendo estadísticas del día...');
      
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      console.log('Rango de fechas:');
      console.log('- Inicio:', startOfDay.toISOString());
      console.log('- Fin:', endOfDay.toISOString());
      
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
        
        if (data.createdAt) {
          const transactionDate = data.createdAt.toDate();
          
          if (transactionDate >= startOfDay && transactionDate <= endOfDay) {
            todayTransactions++;
            const amount = data.amount || 0;
            
            console.log(`Transacción del día:`, {
              type: data.type,
              amount: amount,
              date: transactionDate.toISOString()
            });
            
            if (data.type === 'recharge' && amount > 0) {
              totalIncome += amount;
              rechargesCount++;
            } else if (data.type === 'parking' && amount < 0) {
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
  }
}