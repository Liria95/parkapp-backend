import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// Obtener notificaciones del usuario
router.get('/user/:userId', authMiddleware, notificationController.getUserNotifications);

// Marcar notificación como leída
router.put('/:notificationId/read', authMiddleware, notificationController.markAsRead);

// Marcar todas las notificaciones como leídas
router.put('/user/:userId/read-all', authMiddleware, notificationController.markAllAsRead);

// Eliminar notificación
router.delete('/:notificationId', authMiddleware, notificationController.deleteNotification);

export default router;