import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';

// ========== MIDDLEWARE DE AUTENTICACIÓN ==========
export const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Authorization header:', authHeader ? 'Presente' : 'Ausente');

    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      console.log('No se proporcionó token');
      res.status(401).json({ 
        success: false, 
        message: 'Token no proporcionado' 
      });
      return;
    }

    console.log('Verificando token con Firebase Admin...');

    // Verificar token con Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    console.log('Token válido. Usuario ID:', decodedToken.uid);
    console.log('Email:', decodedToken.email);
    
    // Obtener datos adicionales de Firestore
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(decodedToken.uid)
      .get();

    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado en Firestore'
      });
      return;
    }

    const userData = userDoc.data();
    
    // Agregar datos del usuario al request
    (req as any).user = {
      uid: decodedToken.uid,
      userId: decodedToken.uid, // Alias para compatibilidad
      email: decodedToken.email,
      isAdmin: userData?.isAdmin || false,
      name: userData?.name,
      surname: userData?.surname
    };

    console.log('Usuario autenticado:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAdmin: userData?.isAdmin || false
    });

    next();

  } catch (error: any) {
    console.error('Error al verificar token:', error.message);
    console.error('Código de error:', error.code);
    
    // Manejo de errores de Firebase
    if (error.code === 'auth/id-token-expired') {
      res.status(401).json({ 
        success: false, 
        message: 'Token expirado. Por favor, inicia sesión nuevamente' 
      });
    } else if (error.code === 'auth/argument-error') {
      res.status(401).json({ 
        success: false, 
        message: 'Token inválido o malformado' 
      });
    } else if (error.code === 'auth/id-token-revoked') {
      res.status(401).json({
        success: false,
        message: 'Token revocado. Por favor, inicia sesión nuevamente'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'No autorizado' 
      });
    }
  }
};

// ========== MIDDLEWARE PARA ADMIN ==========
export const adminMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
      return;
    }

    if (!user.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      return;
    }

    console.log('Admin verificado:', user.uid);
    next();

  } catch (error) {
    console.error('Error en adminMiddleware:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos de administrador'
    });
  }
};

// ========== MIDDLEWARE OPCIONAL: Verificar si es el dueño del recurso ==========
export const ownerMiddleware = (resourceField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = (req as any).user;
      const resourceOwnerId = req.params[resourceField] || req.body[resourceField];

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'No autenticado'
        });
        return;
      }

      // Si es admin, puede acceder a todo
      if (user.isAdmin) {
        next();
        return;
      }

      // Si no es admin, verificar que sea el dueño
      if (user.uid !== resourceOwnerId) {
        res.status(403).json({
          success: false,
          message: 'No tienes permiso para acceder a este recurso'
        });
        return;
      }

      next();

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al verificar permisos'
      });
    }
  };
};