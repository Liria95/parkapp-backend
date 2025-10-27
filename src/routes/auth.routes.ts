import { Router } from 'express';
import { AuthController } from '../controllers/authcontroller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Rutas públicas
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Rutas protegidas
router.get('/verify', authMiddleware, AuthController.verifyToken);
router.post('/logout', authMiddleware, AuthController.logout);

export default router;