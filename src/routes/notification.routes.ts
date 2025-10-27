import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Registrar token push del dispositivo
router.post('/register', NotificationController.registerPushToken);

// Enviar notificación a un usuario específico (solo admins)
router.post('/send', NotificationController.sendPushNotification);

// Enviar notificación a todos los usuarios (solo admins)
router.post('/broadcast', NotificationController.sendBroadcastNotification);

export default router;