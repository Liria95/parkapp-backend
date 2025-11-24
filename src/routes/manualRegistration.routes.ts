// src/routes/manualRegistration.routes.ts
import { Router } from 'express';
import { ManualRegistrationController } from '../controllers/manualRegistrationController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// ========== TODAS LAS RUTAS REQUIEREN ADMIN ==========

// Buscar usuario por patente
router.get('/search-by-plate/:licensePlate', 
  authMiddleware, 
  adminMiddleware, 
  ManualRegistrationController.searchUserByPlate
);

// Obtener espacios disponibles cercanos
router.get('/available-spaces', 
  authMiddleware, 
  adminMiddleware, 
  ManualRegistrationController.getAvailableSpaces
);

// Registrar visitante (pago en efectivo)
router.post('/register-visitor', 
  authMiddleware, 
  adminMiddleware, 
  ManualRegistrationController.registerVisitor
);

// Crear multa a visitante no registrado
router.post('/visitor-fine',
  authMiddleware,
  adminMiddleware,
  ManualRegistrationController.createVisitorFine
);

export default router;