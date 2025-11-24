// src/routes/parkingSpaces.routes.ts
import { Router } from 'express';
import { ParkingSpacesController } from '../controllers/parkingSpacesController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Obtener espacios disponibles (todos los usuarios)
router.get('/available', 
  authMiddleware, 
  ParkingSpacesController.getAvailableSpaces
);

// Obtener estadísticas de espacios (solo admin)
router.get('/stats', 
  authMiddleware, 
  adminMiddleware, 
  ParkingSpacesController.getStats
);

// Obtener todos los espacios (solo admin)
router.get('/', 
  authMiddleware, 
  adminMiddleware, 
  ParkingSpacesController.getAllSpaces
);

// Actualizar estado de espacio (solo admin)
router.put('/:spaceId/status', 
  authMiddleware, 
  adminMiddleware, 
  ParkingSpacesController.updateSpaceStatus
);

export default router;