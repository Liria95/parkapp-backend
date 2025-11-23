import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebaseAdmin';
import NodeCache from 'node-cache';

// ============================================
// CACHÉ DE TOKENS
// ============================================
const tokenCache = new NodeCache({ 
  stdTTL: 300,          
  checkperiod: 60,       
  useClones: false       
});

let cacheHits = 0;
let cacheMisses = 0;

setInterval(() => {
  const stats = getCacheStats();
  console.log('Stats del caché (última hora):', stats);
  cacheHits = 0;
  cacheMisses = 0;
}, 3600000);

// MIDDLEWARE DE AUTENTICACIÓN CON CACHÉ
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

    // VERIFICAR SI EL TOKEN ESTÁ EN CACHÉ
    const cachedUser = tokenCache.get<any>(token);

    if (cachedUser) {
      // TOKEN ENCONTRADO EN CACHÉ
      cacheHits++;
      const hitRate = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
      console.log(`Token en caché (hit ${cacheHits}/${cacheHits + cacheMisses} = ${hitRate}%)`);
      
      (req as any).user = cachedUser;
      next();
      return;
    }

    // TOKEN NO EN CACHÉ - VALIDAR CON FIREBASE
    cacheMisses++;
    console.log(`Validando token con Firebase (miss ${cacheMisses}/${cacheHits + cacheMisses})`);
    console.log('Verificando token con Firebase Admin...');

    const decodedToken = await admin.auth().verifyIdToken(token);
   
    console.log('Token válido. Usuario ID:', decodedToken.uid);
    console.log('Email:', decodedToken.email);
   
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
   
    const userObject = {
      uid: decodedToken.uid,
      userId: decodedToken.uid,
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

    //  GUARDAR EN CACHÉ POR 5 MINUTOS
    tokenCache.set(token, userObject);
    console.log(` Token guardado en caché para: ${decodedToken.email} (expira en 5 min)`);

    (req as any).user = userObject;
    next();

  } catch (error: any) {
    console.error(' Error al verificar token:', error.message);
    console.error('Código de error:', error.code);
   
    // Invalidar token del caché si hay error
    const authHeaderError = req.headers.authorization;
    if (authHeaderError) {
      const tokenError = authHeaderError.split(' ')[1];
      if (tokenError) {
        tokenCache.del(tokenError);
      }
    }

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

// MIDDLEWARE PARA ADMIN
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

// MIDDLEWARE Verificar si es dueño del recurso
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

      if (user.isAdmin) {
        next();
        return;
      }

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

// FUNCIONES AUXILIARES DEL CACHÉ

/**
 * Invalidar token manualmente 
 */
export const invalidateToken = (token: string): void => {
  const deleted = tokenCache.del(token);
  if (deleted) {
    console.log('Token invalidado del caché');
  }
};

/**
 * Limpiar toda la caché
 */
export const clearTokenCache = (): void => {
  tokenCache.flushAll();
  cacheHits = 0;
  cacheMisses = 0;
  console.log('Caché de tokens limpiada completamente');
};

/**
 * Obtener estadísticas del caché
 */
export const getCacheStats = () => {
  const stats = tokenCache.getStats();
  const hitRate = cacheHits + cacheMisses > 0 
    ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(2) 
    : '0.00';
    
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: `${hitRate}%`,
    keys: stats.keys,
    ksize: stats.ksize,
    vsize: stats.vsize,
    totalValidations: cacheHits + cacheMisses,
    firebaseOperations: cacheMisses,
    savedOperations: cacheHits
  };
};

/**
 * Endpoint para ver estadísticas
 */
export const statsEndpoint = (req: Request, res: Response) => {
  const stats = getCacheStats();
  res.json({
    success: true,
    cache: stats,
    message: 'Estadísticas del caché de tokens',
    interpretation: {
      hitRate: `${stats.hitRate} de requests usan caché`,
      firebaseOps: `Solo ${stats.firebaseOperations} operaciones de Firebase Auth`,
      saved: `${stats.savedOperations} operaciones ahorradas`,
      efficiency: stats.hits > stats.misses ? 'Excelente' : 'Revisar'
    }
  });
};