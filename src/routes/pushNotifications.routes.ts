// src/routes/pushNotifications.routes.ts
import { Router } from 'express';
import { PushNotificationController } from '../controllers/pushNotificationController';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Registrar token push del dispositivo (todos los usuarios)
router.post('/register', 
  authMiddleware, 
  PushNotificationController.registerPushToken
);

// Enviar notificación a un usuario específico (solo admins)
router.post('/send', 
  authMiddleware, 
  adminMiddleware, 
  PushNotificationController.sendPushNotification
);

// Enviar notificación a todos los usuarios (solo admins)
router.post('/broadcast', 
  authMiddleware, 
  adminMiddleware, 
  PushNotificationController.sendBroadcastNotification
);

export default router;