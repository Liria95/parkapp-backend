import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Registro de usuario
router.post('/register', AuthController.register);

// Login
router.post('/login', AuthController.login);

// Verificar token
router.get('/verify', authMiddleware, AuthController.verifyToken);

// Logout
router.post('/logout', authMiddleware, AuthController.logout);

export default router;