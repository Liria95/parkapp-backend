import { Request, Response } from 'express';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export class NotificationController {
  
  // REGISTRAR TOKEN PUSH
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

      // Guardar token en Firestore
      await setDoc(doc(db, 'pushTokens', userId), {
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

  // ENVIAR NOTIFICACIÓN PUSH
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

      // Obtener token del usuario
      const tokenDoc = await getDoc(doc(db, 'pushTokens', userId));

      if (!tokenDoc.exists()) {
        res.status(404).json({
          success: false,
          message: 'Token no encontrado para el usuario',
        });
        return;
      }

      const pushToken = tokenDoc.data().token;

      console.log('Enviando notificación push a:', userId);

      // Enviar notificación a Expo Push API
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

  // ENVIAR NOTIFICACIÓN A TODOS LOS USUARIOS
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

      // Obtener todos los tokens
      const tokensSnapshot = await getDocs(collection(db, 'pushTokens'));
      const pushTokens = tokensSnapshot.docs.map(doc => doc.data().token);

      if (pushTokens.length === 0) {
        res.status(404).json({
          success: false,
          message: 'No hay tokens registrados',
        });
        return;
      }

      console.log(`Enviando notificación broadcast a ${pushTokens.length} dispositivos`);

      // Preparar mensajes
      const messages = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: body,
        data: data || {},
      }));

      // Enviar en batch
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