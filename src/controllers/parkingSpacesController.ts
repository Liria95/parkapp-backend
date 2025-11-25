// src/controllers/parkingSpacesController.ts
import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';

export class ParkingSpacesController {
  
  // ========== OBTENER ESPACIOS DISPONIBLES ==========
  static async getAvailableSpaces(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;
      
      console.log('=== OBTENIENDO ESPACIOS DISPONIBLES ===');
      console.log('Ubicacion usuario:', { latitude, longitude, radius });
      
      const spacesSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'available')
        .get();
      
      console.log('Espacios disponibles encontrados:', spacesSnapshot.size);
      
      if (spacesSnapshot.empty) {
        res.json({
          success: true,
          espacios: [],
          total: 0,
          message: 'No hay espacios disponibles'
        });
        return;
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

      console.log('Calles unicas encontradas:', streetIds.size);

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
          ubicacion: street?.streetAddress || 'Ubicacion desconocida',
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
        
        console.log('Filtrando por ubicacion:', { userLat, userLon, maxRadius });
        
        // FIX: Usar ParkingSpacesController.calculateDistance en lugar de this.calculateDistance
        espacios = espacios
          .map(espacio => ({
            ...espacio,
            distancia: ParkingSpacesController.calculateDistance(
              userLat, 
              userLon, 
              espacio.latitude, 
              espacio.longitude
            )
          }))
          .filter(espacio => espacio.distancia <= maxRadius)
          .sort((a, b) => a.distancia - b.distancia);
        
        console.log('Espacios dentro del radio:', espacios.length);
      }
      
      const espaciosLimitados = espacios.slice(0, 50);
      
      console.log('Espacios retornados:', espaciosLimitados.length);
      if (espaciosLimitados.length > 0) {
        console.log('Primer espacio:', espaciosLimitados[0]);
      }
      
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

  // ========== OBTENER ESTADISTICAS DE ESPACIOS (Admin) ==========
  static async getStats(req: Request, res: Response): Promise<void> {
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

  // ========== OBTENER TODOS LOS ESPACIOS (Admin) ==========
  static async getAllSpaces(req: Request, res: Response): Promise<void> {
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

  // ========== ACTUALIZAR ESTADO DE ESPACIO (Admin) ==========
  static async updateSpaceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { spaceId } = req.params;
      const { status } = req.body;

      console.log('Actualizando estado del espacio:', spaceId, 'a', status);

      const validStatuses = ['available', 'occupied', 'maintenance', 'reserved'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: `Estado invalido. Debe ser uno de: ${validStatuses.join(', ')}`
        });
        return;
      }

      const spaceDoc = await db.collection('parkingSpaces').doc(spaceId).get();

      if (!spaceDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Espacio no encontrado'
        });
        return;
      }

      await db.collection('parkingSpaces').doc(spaceId).update({
        status: status
      });

      console.log('Estado actualizado exitosamente');

      res.json({
        success: true,
        message: `Espacio actualizado a ${status}`
      });

    } catch (error) {
      console.error('Error al actualizar estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar estado del espacio'
      });
    }
  }

  // ========== FUNCION AUXILIAR PARA CALCULAR DISTANCIA ==========
  // NOTA: Retorna distancia en KILOMETROS
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Radio de la Tierra en kilometros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Retorna en kilometros
  }
}