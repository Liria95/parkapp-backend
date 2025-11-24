import { IPushToken, INotification, IPushMessage } from '../interfaces/models';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

const pushTokensCollection = db.collection('pushTokens');
const notificationsCollection = db.collection('notifications');

export class NotificationService {

    // ==================== PUSH TOKENS ====================

    /**
     * Registra o actualiza el token push de un usuario
     */
    async registerPushToken(userId: string, expoPushToken: string): Promise<IPushToken> {
        const now = Date.now();
        
        const tokenData: Omit<IPushToken, 'id'> = {
            userId,
            token: expoPushToken,
            updatedAt: now
        };

        await pushTokensCollection.doc(userId).set(tokenData);

        return {
            id: userId,
            ...tokenData
        };
    }

    /**
     * Obtiene el token push de un usuario
     */
    async getPushToken(userId: string): Promise<string | null> {
        const tokenDoc = await pushTokensCollection.doc(userId).get();

        if (!tokenDoc.exists) {
            return null;
        }

        const data = tokenDoc.data() as IPushToken;
        return data.token;
    }

    /**
     * Obtiene todos los tokens push registrados
     */
    async getAllPushTokens(): Promise<string[]> {
        const tokensSnapshot = await pushTokensCollection.get();
        
        return tokensSnapshot.docs.map(doc => {
            const data = doc.data() as IPushToken;
            return data.token;
        });
    }

    /**
     * Elimina el token push de un usuario
     */
    async deletePushToken(userId: string): Promise<void> {
        await pushTokensCollection.doc(userId).delete();
    }

    // ==================== ENVIAR NOTIFICACIONES PUSH ====================

    /**
     * Envía una notificación push a un usuario específico
     */
    async sendPushNotification(
        userId: string, 
        title: string, 
        body: string, 
        data?: Record<string, any>
    ): Promise<any> {
        const pushToken = await this.getPushToken(userId);

        if (!pushToken) {
            throw new Error('Token no encontrado para el usuario');
        }

        const message: IPushMessage = {
            to: pushToken,
            sound: 'default',
            title,
            body,
            data: data || {}
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        const result = await response.json();
        
        // Guardar notificación en historial
        await this.saveNotification(userId, title, body, data);

        return result;
    }

    /**
     * Envía notificación broadcast a todos los usuarios
     */
    async sendBroadcastNotification(
        title: string, 
        body: string, 
        data?: Record<string, any>
    ): Promise<any> {
        const pushTokens = await this.getAllPushTokens();

        if (pushTokens.length === 0) {
            throw new Error('No hay tokens registrados');
        }

        const messages: IPushMessage[] = pushTokens.map(token => ({
            to: token,
            sound: 'default',
            title,
            body,
            data: data || {}
        }));

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        return await response.json();
    }

    // ==================== GESTIÓN DE NOTIFICACIONES (HISTORIAL) ====================

    /**
     * Guarda una notificación en Firestore
     */
    async saveNotification(
        userId: string, 
        title: string, 
        message: string, 
        data?: Record<string, any>
    ): Promise<INotification> {
        const now = Date.now();
        
        const notificationData: any = {
            user_id: userId, // Mantener snake_case para compatibilidad
            title,
            message,
            data: data || {},
            is_read: false,
            parking_session_id: data?.parkingSessionId || null,
            fines_id: data?.finesId || null,
            notification_time: new Date().toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: 'America/Argentina/Buenos_Aires',
            }),
            created_at: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await notificationsCollection.add(notificationData);

        return {
            id: docRef.id,
            userId,
            title,
            body: message,
            data: data || {},
            read: false,
            createdAt: now
        };
    }

    /**
     * Obtiene todas las notificaciones de un usuario
     */
    async getUserNotifications(userId: string): Promise<any[]> {
        const snapshot = await notificationsCollection
            .where('user_id', '==', userId)
            .orderBy('created_at', 'desc')
            .limit(50)
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                created_at: data.created_at?.toDate().toISOString()
            };
        });
    }

    /**
     * Marca una notificación como leída
     */
    async markAsRead(notificationId: string, userId: string): Promise<void> {
        const notificationDoc = await notificationsCollection.doc(notificationId).get();

        if (!notificationDoc.exists) {
            throw new Error('Notificación no encontrada');
        }

        const notificationData = notificationDoc.data();

        // Verificar que la notificación pertenece al usuario
        if (notificationData?.user_id !== userId) {
            throw new Error('No tienes permiso para modificar esta notificación');
        }

        await notificationsCollection.doc(notificationId).update({
            is_read: true
        });
    }

    /**
     * Marca todas las notificaciones de un usuario como leídas
     */
    async markAllAsRead(userId: string): Promise<number> {
        const snapshot = await notificationsCollection
            .where('user_id', '==', userId)
            .where('is_read', '==', false)
            .get();

        const batch = db.batch();

        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { is_read: true });
        });

        await batch.commit();

        return snapshot.size;
    }

    /**
     * Elimina una notificación
     */
    async deleteNotification(notificationId: string, userId: string): Promise<void> {
        const notificationDoc = await notificationsCollection.doc(notificationId).get();

        if (!notificationDoc.exists) {
            throw new Error('Notificación no encontrada');
        }

        const notificationData = notificationDoc.data();

        // Verificar que la notificación pertenece al usuario
        if (notificationData?.user_id !== userId) {
            throw new Error('No tienes permiso para eliminar esta notificación');
        }

        await notificationsCollection.doc(notificationId).delete();
    }
}