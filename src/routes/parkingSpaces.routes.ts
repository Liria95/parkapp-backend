import { Router, Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Middleware para verificar que el usuario es admin
const adminMiddleware = async (req: Request, res: Response, next: Function) => {
  const authenticatedUser = (req as any).user;
  
  try {
    const userDoc = await db.collection('users').doc(authenticatedUser.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Acceso denegado. Se requieren permisos de administrador'
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Error al verificar admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar permisos'
    });
  }
};

// Función auxiliar para calcular distancia entre dos puntos (Haversine)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Obtener espacios disponibles con JOIN
router.get('/available', 
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      const { latitude, longitude, radius } = req.query;
      
      console.log('=== OBTENIENDO ESPACIOS DISPONIBLES ===');
      console.log('Ubicación usuario:', { latitude, longitude, radius });
      
      const spacesSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'available')
        .get();
      
      console.log('Espacios disponibles encontrados:', spacesSnapshot.size);
      
      if (spacesSnapshot.empty) {
        return res.json({
          success: true,
          espacios: [],
          total: 0,
          message: 'No hay espacios disponibles'
        });
      }

      const streetIds = new Set<string>();
      const spacesData: any[] = [];

      spacesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        streetIds.add(data.streetId);
        spacesData.push({
          id: doc.id,
          spaceCode: data.spaceCode,
          streetId: data.streetId,
          latitude: data.latitude,
          longitude: data.longitude,
          status: data.status
        });
      });

      console.log('Calles únicas encontradas:', streetIds.size);

      const streetsMap = new Map<string, any>();
      for (const streetId of streetIds) {
        const streetDoc = await db.collection('streets').doc(streetId).get();
        if (streetDoc.exists) {
          streetsMap.set(streetId, streetDoc.data());
        }
      }

      console.log('Calles cargadas:', streetsMap.size);

      const pricesSnapshot = await db.collection('price').get();
      const pricesMap = new Map<string, number>();
      
      pricesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        pricesMap.set(data.streetId, data.fee);
      });

      console.log('Tarifas cargadas:', pricesMap.size);

      let espacios = spacesData.map(space => {
        const street = streetsMap.get(space.streetId);
        const fee = pricesMap.get(space.streetId) || 50;

        return {
          id: space.id,
          numero: space.spaceCode,
          ubicacion: street?.streetAddress || 'Ubicación desconocida',
          tarifaPorHora: fee,
          latitude: space.latitude,
          longitude: space.longitude,
          status: space.status
        };
      });
      
      if (latitude && longitude) {
        const userLat = Number(latitude);
        const userLon = Number(longitude);
        const maxRadius = Number(radius) || 1000;
        
        console.log('Filtrando por ubicación:', { userLat, userLon, maxRadius });
        
        espacios = espacios
          .map(espacio => ({
            ...espacio,
            distancia: calculateDistance(userLat, userLon, espacio.latitude, espacio.longitude)
          }))
          .filter(espacio => espacio.distancia <= maxRadius)
          .sort((a, b) => a.distancia - b.distancia);
        
        console.log('Espacios dentro del radio:', espacios.length);
      }
      
      const espaciosLimitados = espacios.slice(0, 50);
      
      console.log('Espacios retornados:', espaciosLimitados.length);
      console.log('Primer espacio:', espaciosLimitados[0]);
      
      res.json({
        success: true,
        espacios: espaciosLimitados,
        total: espaciosLimitados.length
      });
      
    } catch (error) {
      console.error('Error al obtener espacios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener espacios disponibles',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
);

// Obtener estadísticas de espacios (solo admin)
router.get('/stats', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    try {
      console.log('Obteniendo estadisticas de espacios...');
      
      const availableSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'available')
        .get();
      
      const occupiedSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'occupied')
        .get();
      
      const totalSnapshot = await db.collection('parkingSpaces').get();
      
      const stats = {
        total: totalSnapshot.size,
        available: availableSnapshot.size,
        occupied: occupiedSnapshot.size,
      };
      
      console.log('Estadisticas de espacios:', stats);
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      console.error('Error al obtener estadisticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadisticas de espacios'
      });
    }
  }
);

// Obtener todos los espacios (solo admin)
router.get('/', 
  authMiddleware, 
  adminMiddleware, 
  async (req: Request, res: Response) => {
    try {
      console.log('Obteniendo todos los espacios...');
      
      const spacesSnapshot = await db.collection('parkingSpaces').get();
      
      const streetIds = new Set<string>();
      spacesSnapshot.docs.forEach(doc => {
        streetIds.add(doc.data().streetId);
      });

      const streetsMap = new Map<string, any>();
      for (const streetId of streetIds) {
        const streetDoc = await db.collection('streets').doc(streetId).get();
        if (streetDoc.exists) {
          streetsMap.set(streetId, streetDoc.data());
        }
      }

      const pricesSnapshot = await db.collection('price').get();
      const pricesMap = new Map<string, number>();
      pricesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        pricesMap.set(data.streetId, data.fee);
      });

      const spaces = spacesSnapshot.docs.map(doc => {
        const data = doc.data();
        const street = streetsMap.get(data.streetId);
        const fee = pricesMap.get(data.streetId) || 0;

        return {
          id: doc.id,
          spaceCode: data.spaceCode,
          streetAddress: street?.streetAddress || 'Desconocida',
          status: data.status,
          feePerHour: fee,
          latitude: data.latitude,
          longitude: data.longitude,
        };
      });
      
      res.json({
        success: true,
        spaces
      });
      
    } catch (error) {
      console.error('Error al obtener espacios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener espacios'
      });
    }
  }
);

export default router;