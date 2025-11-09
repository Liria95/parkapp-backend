// src/routes/adminSetup.routes.ts
import { Router } from 'express';
import { AdminSetupController } from '../controllers/adminSetupController';

const router = Router();

// ⚠️ RUTAS TEMPORALES - ELIMINAR EN PRODUCCIÓN
router.post('/create-admin', AdminSetupController.createAdmin);
router.post('/make-admin', AdminSetupController.makeUserAdmin);

export default router;