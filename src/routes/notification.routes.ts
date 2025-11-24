import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// Registrar token push del dispositivo
router.post('/register', authMiddleware, notificationController.registerPushToken);

// Eliminar token push
router.delete('/token', authMiddleware, notificationController.deletePushToken);

// Enviar notificación a un usuario específico (admin)
router.post('/send', authMiddleware, notificationController.sendPushNotification);

// Enviar notificación a todos los usuarios (admin)
router.post('/broadcast', authMiddleware, notificationController.sendBroadcastNotification);

export default router;