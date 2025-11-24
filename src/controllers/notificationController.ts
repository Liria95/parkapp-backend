import { Request, Response } from 'express';
import { NotificationService } from '../services/notificationService';

export class NotificationController {
    private notificationService: NotificationService;

    constructor() {
        this.notificationService = new NotificationService();
    }

    // ==================== PUSH TOKENS ====================

    // POST /api/notifications/register
    registerPushToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.uid;
            const { expoPushToken } = req.body;

            if (!expoPushToken) {
                res.status(400).json({
                    success: false,
                    message: 'expoPushToken es requerido',
                });
                return;
            }

            console.log('Guardando token push para usuario:', userId);

            const token = await this.notificationService.registerPushToken(userId, expoPushToken);

            res.json({
                success: true,
                message: 'Token registrado exitosamente',
                token
            });

        } catch (error) {
            console.error('Error al registrar token:', error);
            res.status(500).json({
                success: false,
                message: 'Error al registrar token',
            });
        }
    };

    // DELETE /api/notifications/token
    deletePushToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.uid;

            await this.notificationService.deletePushToken(userId);

            res.json({
                success: true,
                message: 'Token eliminado exitosamente'
            });

        } catch (error) {
            console.error('Error al eliminar token:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar token'
            });
        }
    };

    // ==================== ENVIAR PUSH ====================

    // POST /api/notifications/send
    sendPushNotification = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, title, body, data } = req.body;

            if (!userId || !title || !body) {
                res.status(400).json({
                    success: false,
                    message: 'userId, title y body son requeridos',
                });
                return;
            }

            console.log('Enviando notificación push a:', userId);

            const result = await this.notificationService.sendPushNotification(userId, title, body, data);

            if (result.data && result.data.status === 'ok') {
                console.log('Notificación enviada exitosamente');
                res.json({
                    success: true,
                    message: 'Notificación enviada',
                    result: result.data,
                });
            } else {
                console.log('Error al enviar notificación:', result);
                res.status(500).json({
                    success: false,
                    message: 'Error al enviar notificación',
                    error: result,
                });
            }

        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al enviar notificación',
            });
        }
    };

    // POST /api/notifications/broadcast
    sendBroadcastNotification = async (req: Request, res: Response): Promise<void> => {
        try {
            const { title, body, data } = req.body;

            if (!title || !body) {
                res.status(400).json({
                    success: false,
                    message: 'title y body son requeridos',
                });
                return;
            }

            console.log('Enviando notificación broadcast');

            const result = await this.notificationService.sendBroadcastNotification(title, body, data);

            const pushTokens = await this.notificationService.getAllPushTokens();

            console.log('Notificación broadcast enviada');
            res.json({
                success: true,
                message: `Notificación enviada a ${pushTokens.length} dispositivos`,
                result,
            });

        } catch (error: any) {
            console.error('Error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al enviar notificación broadcast',
            });
        }
    };

    // ==================== GESTIÓN DE NOTIFICACIONES ====================

    // GET /api/notifications-user/user/:userId
    getUserNotifications = async (req: Request, res: Response): Promise<void> => {
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

            const notifications = await this.notificationService.getUserNotifications(userId);

            const unread = notifications.filter((n: any) => !n.is_read).length;

            console.log('Notificaciones encontradas:', notifications.length);

            res.json({
                success: true,
                notifications,
                total: notifications.length,
                unread
            });

        } catch (error) {
            console.error('Error al obtener notificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones'
            });
        }
    };

    // PUT /api/notifications-user/:notificationId/read
    markAsRead = async (req: Request, res: Response): Promise<void> => {
        try {
            const { notificationId } = req.params;
            const authenticatedUser = (req as any).user;

            console.log('Marcando notificación como leída:', notificationId);

            await this.notificationService.markAsRead(notificationId, authenticatedUser.uid);

            console.log('Notificación marcada como leída');

            res.json({
                success: true,
                message: 'Notificación marcada como leída'
            });

        } catch (error: any) {
            console.error('Error al marcar notificación:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al marcar notificación como leída'
            });
        }
    };

    // PUT /api/notifications-user/user/:userId/read-all
    markAllAsRead = async (req: Request, res: Response): Promise<void> => {
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

            const updated = await this.notificationService.markAllAsRead(userId);

            console.log('Notificaciones actualizadas:', updated);

            res.json({
                success: true,
                message: 'Todas las notificaciones marcadas como leídas',
                updated
            });

        } catch (error: any) {
            console.error('Error al marcar notificaciones:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al marcar notificaciones'
            });
        }
    };

    // DELETE /api/notifications-user/:notificationId
    deleteNotification = async (req: Request, res: Response): Promise<void> => {
        try {
            const { notificationId } = req.params;
            const authenticatedUser = (req as any).user;

            console.log('Eliminando notificación:', notificationId);

            await this.notificationService.deleteNotification(notificationId, authenticatedUser.uid);

            console.log('Notificación eliminada');

            res.json({
                success: true,
                message: 'Notificación eliminada'
            });

        } catch (error: any) {
            console.error('Error al eliminar notificación:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al eliminar notificación'
            });
        }
    };
}