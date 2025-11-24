// routes/vehicleRoutes.ts
import { Router } from 'express';
import { VehicleController } from '../controllers/vehicleControllers';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const vehicleController = new VehicleController();

router.get('/search', vehicleController.search);
router.post('/', authMiddleware, vehicleController.create);
router.get('/', authMiddleware, vehicleController.getByUser);
router.put('/:id', authMiddleware, vehicleController.update);
router.delete('/:id', authMiddleware, vehicleController.delete);

export default router;