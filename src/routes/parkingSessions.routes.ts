import { Router } from 'express';
import { ParkingSessionController } from '../controllers/parkingSessionController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Iniciar sesión de estacionamiento
router.post('/start', 
  authMiddleware, 
  ParkingSessionController.startSession
);

// Finalizar sesión de estacionamiento
router.post('/end', 
  authMiddleware, 
  ParkingSessionController.endSession
);

// Obtener sesión activa del usuario
router.get('/active', 
  authMiddleware, 
  ParkingSessionController.getActiveSession
);

// Obtener historial de sesiones
router.get('/history', 
  authMiddleware, 
  ParkingSessionController.getHistory
);

// Estadísticas de ocupación
router.get('/stats', 
  authMiddleware, 
  ParkingSessionController.getStats
);

export default router;