import { Router } from 'express';
import { AdminSetupController } from '../controllers/adminSetupController';

const router = Router();

// Crear admin (protegido con secretKey)
router.post('/create-admin', AdminSetupController.createAdmin);

// Convertir usuario en admin (protegido con secretKey)
router.post('/make-admin', AdminSetupController.makeUserAdmin);

export default router;