import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

export class UserNotificationsController {
  
  // ========== OBTENER NOTIFICACIONES DEL USUARIO ==========
  static async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authenticatedUser = (req as any).user;
      
      if (authenticatedUser.uid !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para ver estas notificaciones'
        });
        return;
      }
      
      console.log('Obteniendo notificaciones del usuario:', userId);
      
      const notificationsSnapshot = await db.collection('notifications')
        .where('user_id', '==', userId)
        .get();
      
      const notifications = notificationsSnapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate().toISOString(),
      }));
      
      notifications.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
      
      console.log('Notificaciones encontradas:', notifications.length);
      
      res.json({
        success: true,
        notifications,
        total: notifications.length,
        unread: notifications.filter((n: any) => !n.is_read).length
      });
      
    } catch (error: any) {
      console.error('Error al obtener notificaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener notificaciones'
      });
    }
  }

  // ========== MARCAR NOTIFICACIÓN COMO LEÍDA ==========
  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const authenticatedUser = (req as any).user;
      
      console.log('Marcando notificación como leída:', notificationId);
      
      const notificationDoc = await db.collection('notifications').doc(notificationId).get();
      
      if (!notificationDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
        return;
      }
      
      const notificationData = notificationDoc.data();
      
      if (notificationData?.user_id !== authenticatedUser.uid) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para modificar esta notificación'
        });
        return;
      }
      
      await db.collection('notifications').doc(notificationId).update({
        is_read: true
      });
      
      console.log('Notificación marcada como leída');
      
      res.json({
        success: true,
        message: 'Notificación marcada como leída'
      });
      
    } catch (error: any) {
      console.error('Error al marcar notificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar notificación como leída'
      });
    }
  }

  // ========== MARCAR TODAS COMO LEÍDAS ==========
  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const authenticatedUser = (req as any).user;
      
      if (authenticatedUser.uid !== userId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso'
        });
        return;
      }
      
      console.log('Marcando todas las notificaciones como leídas para usuario:', userId);
      
      const notificationsSnapshot = await db.collection('notifications')
        .where('user_id', '==', userId)
        .where('is_read', '==', false)
        .get();
      
      const batch = db.batch();
      
      notificationsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { is_read: true });
      });
      
      await batch.commit();
      
      console.log('Notificaciones actualizadas:', notificationsSnapshot.size);
      
      res.json({
        success: true,
        message: 'Todas las notificaciones marcadas como leídas',
        updated: notificationsSnapshot.size
      });
      
    } catch (error: any) {
      console.error('Error al marcar notificaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error al marcar notificaciones'
      });
    }
  }

  // ========== ELIMINAR NOTIFICACIÓN ==========
  static async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const authenticatedUser = (req as any).user;
      
      console.log('Eliminando notificación:', notificationId);
      
      const notificationDoc = await db.collection('notifications').doc(notificationId).get();
      
      if (!notificationDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Notificación no encontrada'
        });
        return;
      }
      
      const notificationData = notificationDoc.data();
      
      if (notificationData?.user_id !== authenticatedUser.uid) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para eliminar esta notificación'
        });
        return;
      }
      
      await db.collection('notifications').doc(notificationId).delete();
      
      console.log('Notificación eliminada');
      
      res.json({
        success: true,
        message: 'Notificación eliminada'
      });
      
    } catch (error: any) {
      console.error('Error al eliminar notificación:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar notificación'
      });
    }
  }
}