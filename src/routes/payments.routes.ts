import { Router } from 'express';
import { PaymentsController } from '../controllers/paymentsController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Test
router.get('/test', PaymentsController.test);

// Simular pago
router.post('/simulate-payment', 
  authMiddleware, 
  PaymentsController.simulatePayment
);

// Obtener saldo
router.get('/balance', 
  authMiddleware, 
  PaymentsController.getBalance
);

// Obtener transacciones
router.get('/transactions', 
  authMiddleware, 
  PaymentsController.getTransactions
);

// Estadísticas del día (solo admin)
router.get('/stats/today', 
  authMiddleware, 
  adminMiddleware, 
  PaymentsController.getTodayStats
);

export default router;