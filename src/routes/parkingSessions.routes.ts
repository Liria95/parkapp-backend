import { Router } from 'express';
import { ParkingSessionController } from '../controllers/parkingSessionController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// INICIAR SESION DE ESTACIONAMIENTO (Usuario normal)
router.post('/start', 
  authMiddleware, 
  ParkingSessionController.startSession
);

// FINALIZAR SESION DE ESTACIONAMIENTO
router.post('/end', 
  authMiddleware, 
  ParkingSessionController.endSession
);

// OBTENER SESION ACTIVA DEL USUARIO
router.get('/active', 
  authMiddleware, 
  ParkingSessionController.getActiveSession
);

// OBTENER HISTORIAL DE SESIONES
router.get('/history', 
  authMiddleware, 
  ParkingSessionController.getHistory
);

// ESTADISTICAS DE OCUPACION REAL
router.get('/stats', 
  authMiddleware, 
  ParkingSessionController.getStats
);

export default router;