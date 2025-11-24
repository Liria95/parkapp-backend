import { Router } from 'express';
import { UserNotificationsController } from '../controllers/userNotificationsController';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Obtener notificaciones del usuario
router.get('/user/:userId', 
  authMiddleware, 
  UserNotificationsController.getUserNotifications
);

// Marcar notificación como leída
router.put('/:notificationId/read', 
  authMiddleware, 
  UserNotificationsController.markAsRead
);

// Marcar todas las notificaciones como leídas
router.put('/user/:userId/read-all', 
  authMiddleware, 
  UserNotificationsController.markAllAsRead
);

// Eliminar notificación
router.delete('/:notificationId', 
  authMiddleware, 
  UserNotificationsController.deleteNotification
);

export default router;