import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';

export class PushNotificationController {
  
  // ========== REGISTRAR TOKEN PUSH ==========
  static async registerPushToken(req: Request, res: Response): Promise<void> {
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

      await db.collection('pushTokens').doc(userId).set({
        userId: userId,
        token: expoPushToken,
        updatedAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: 'Token registrado exitosamente',
      });

    } catch (error) {
      console.error('Error al registrar token:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar token',
      });
    }
  }

  // ========== ENVIAR NOTIFICACIÓN PUSH ==========
  static async sendPushNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, title, body, data } = req.body;

      if (!userId || !title || !body) {
        res.status(400).json({
          success: false,
          message: 'userId, title y body son requeridos',
        });
        return;
      }

      const tokenDoc = await db.collection('pushTokens').doc(userId).get();

      if (!tokenDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Token no encontrado para el usuario',
        });
        return;
      }

      const pushToken = tokenDoc.data()?.token;

      console.log('Enviando notificación push a:', userId);

      const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
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

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación',
      });
    }
  }

  // ========== ENVIAR NOTIFICACIÓN BROADCAST ==========
  static async sendBroadcastNotification(req: Request, res: Response): Promise<void> {
    try {
      const { title, body, data } = req.body;

      if (!title || !body) {
        res.status(400).json({
          success: false,
          message: 'title y body son requeridos',
        });
        return;
      }

      const tokensSnapshot = await db.collection('pushTokens').get();
      const pushTokens = tokensSnapshot.docs.map(doc => doc.data().token);

      if (pushTokens.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No hay tokens registrados',
        });
        return;
      }

      console.log(`Enviando notificación broadcast a ${pushTokens.length} dispositivos`);

      const messages = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
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

      const result = await response.json();

      console.log('Notificación broadcast enviada');
      res.json({
        success: true,
        message: `Notificación enviada a ${pushTokens.length} dispositivos`,
        result: result,
      });

    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al enviar notificación broadcast',
      });
    }
  }
}