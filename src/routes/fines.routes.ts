// src/routes/fines.routes.ts
import { Router } from 'express';
import { FinesController } from '../controllers/finesController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ========== RUTAS ADMIN ==========
// Crear multa (solo admin)
router.post('/create', 
  authMiddleware, 
  adminMiddleware, 
  FinesController.createFine
);

// Obtener todas las multas (solo admin)
router.get('/all', 
  authMiddleware, 
  adminMiddleware, 
  FinesController.getAllFines
);

// ========== RUTAS USUARIO ==========
// Obtener multas de un usuario específico
router.get('/user/:userId', 
  authMiddleware, 
  FinesController.getUserFines
);

// Pagar multa
router.post('/:fineId/pay', 
  authMiddleware, 
  FinesController.payFine
);

export default router;