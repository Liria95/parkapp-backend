import { Request, Response } from 'express';
import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

export class ManualRegistrationController {
  
  // ========== BUSCAR USUARIO POR PATENTE ==========
  static async searchUserByPlate(req: Request, res: Response): Promise<void> {
    try {
      const { licensePlate } = req.params;
      const licensePlateUpper = licensePlate.toUpperCase();
      
      const vehiclesSnapshot = await db.collection('vehicles')
        .where('licensePlate', '==', licensePlateUpper)
        .limit(1)
        .get();
      
      console.log('Vehículos encontrados:', vehiclesSnapshot.size);
      
      if (vehiclesSnapshot.empty) {
        res.json({
          success: true,
          found: false,
          message: 'Usuario no encontrado con esta patente'
        });
        return;
      }
      
      const vehicleData = vehiclesSnapshot.docs[0].data();
      const vehicleId = vehiclesSnapshot.docs[0].id;
      
      const userDoc = await db.collection('users').doc(vehicleData.userId).get();
      
      if (!userDoc.exists) {
        console.log('Usuario no encontrado');
        res.json({
          success: true,
          found: false,
          message: 'Usuario no encontrado'
        });
        return;
      }
      
      const userData = userDoc.data();
      
      res.json({
        success: true,
        found: true,
        user: {
          id: userDoc.id,
          vehicleId: vehicleId,
          nombre: `${userData?.name} ${userData?.surname}`,
          email: userData?.email,
          telefono: userData?.phone,
          saldo: userData?.balance || 0,
          patente: vehicleData.licensePlate
        },
        message: 'Usuario encontrado exitosamente'
      });
      
    } catch (error: any) {
      console.error('ERROR:', error);
      res.status(500).json({
        success: false,
        found: false,
        message: 'Error al buscar usuario'
      });
    }
  }

  // ========== OBTENER ESPACIOS CERCANOS ==========
  static async getAvailableSpaces(req: Request, res: Response): Promise<void> {
    try {
      const { latitude, longitude, radius } = req.query;
      
      const spacesSnapshot = await db.collection('parkingSpaces')
        .where('status', '==', 'available')
        .get();
      
      const espaciosPromises = spacesSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
        let ubicacion = `Espacio ${data.spaceCode}`;
        if (data.streetId) {
          const streetDoc = await db.collection('streets').doc(data.streetId).get();
          if (streetDoc.exists) {
            const streetData = streetDoc.data();
            ubicacion = streetData?.streetAddress || ubicacion;
          }
        }
        
        let tarifaPorHora = 50;
        if (data.streetId) {
          const priceSnapshot = await db.collection('price')
            .where('streetId', '==', data.streetId)
            .limit(1)
            .get();
          
          if (!priceSnapshot.empty) {
            const priceData = priceSnapshot.docs[0].data();
            tarifaPorHora = priceData.fee || 50;
          }
        }
        
        return {
          id: doc.id,
          numero: data.spaceCode,
          ubicacion: ubicacion,
          tarifaPorHora: tarifaPorHora,
          latitude: data.latitude,
          longitude: data.longitude
        };
      });
      
      const espacios = await Promise.all(espaciosPromises);
      
      if (latitude && longitude) {
        const adminLat = parseFloat(latitude as string);
        const adminLng = parseFloat(longitude as string);
        const maxRadius = radius ? parseFloat(radius as string) : Infinity;
        
        console.log('Calculando distancias desde:', { adminLat, adminLng });
        
        const espaciosConDistancia = espacios
          .map(espacio => {
            if (!espacio.latitude || !espacio.longitude) {
              return { ...espacio, distancia: Infinity };
            }
            
            const distancia = ManualRegistrationController.calcularDistancia(
              adminLat,
              adminLng,
              espacio.latitude,
              espacio.longitude
            );
            
            return { ...espacio, distancia };
          })
          .filter(espacio => espacio.distancia <= maxRadius)
          .sort((a, b) => a.distancia - b.distancia);
                
        res.json({
          success: true,
          espacios: espaciosConDistancia,
          total: espaciosConDistancia.length,
          ordenadoPor: 'distancia'
        });
      } else {        
        res.json({
          success: true,
          espacios,
          total: espacios.length,
          ordenadoPor: 'ninguno'
        });
      }
      
    } catch (error) {
      console.error('Error al obtener espacios:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener espacios disponibles'
      });
    }
  }

  // ========== REGISTRAR VISITANTE ==========
  static async registerVisitor(req: Request, res: Response): Promise<void> {
    try {
      const { licensePlate, parkingSpaceId, hours } = req.body;
      const authenticatedUser = (req as any).user;
      const adminId = authenticatedUser.uid;
      
      if (!licensePlate || !parkingSpaceId || !hours) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios'
        });
        return;
      }
      
      const hoursNum = parseFloat(hours);
      if (hoursNum <= 0) {
        res.status(400).json({
          success: false,
          message: 'Las horas deben ser mayor a 0'
        });
        return;
      }
      
      const batch = db.batch();
      
      const spaceDoc = await db.collection('parkingSpaces').doc(parkingSpaceId).get();
      
      if (!spaceDoc.exists) {
        res.status(404).json({
          success: false,
          message: 'Espacio no encontrado'
        });
        return;
      }
      
      const spaceData = spaceDoc.data();
      
      if (spaceData?.status !== 'available') {
        res.status(400).json({
          success: false,
          message: 'El espacio no está disponible'
        });
        return;
      }
            
      let streetAddress = 'Sin dirección';
      
      if (spaceData.streetId) {
        const streetDoc = await db.collection('streets').doc(spaceData.streetId).get();
        
        if (streetDoc.exists) {
          const streetData = streetDoc.data();
          streetAddress = streetData?.streetAddress || 'Sin dirección';
          console.log('Dirección obtenida:', streetAddress);
        }
      }
      
      let tarifaPorHora = 50;
      
      if (spaceData.streetId) {
        const priceSnapshot = await db.collection('price')
          .where('streetId', '==', spaceData.streetId)
          .limit(1)
          .get();
        
        if (!priceSnapshot.empty) {
          const priceData = priceSnapshot.docs[0].data();
          tarifaPorHora = priceData.fee || 50;
        }
      }
      
      const totalAmount = tarifaPorHora * hoursNum;
      
      console.log('Tarifa:', tarifaPorHora, 'Horas:', hoursNum, 'Total:', totalAmount);
      
      const visitorUserRef = db.collection('users').doc();
      
      batch.set(visitorUserRef, {
        name: 'Visitante',
        surname: licensePlate.toUpperCase(),
        email: `visitante_${licensePlate.toLowerCase()}@temp.com`,
        phone: 'N/A',
        balance: 0,
        isAdmin: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const vehicleRef = db.collection('vehicles').doc();
      
      batch.set(vehicleRef, {
        userId: visitorUserRef.id,
        licensePlate: licensePlate.toUpperCase(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const startTime = admin.firestore.Timestamp.now();
      const endTime = admin.firestore.Timestamp.fromMillis(
        startTime.toMillis() + (hoursNum * 60 * 60 * 1000)
      );
      
      const sessionRef = db.collection('parkingSessions').doc();
      
      batch.set(sessionRef, {
        userId: visitorUserRef.id,
        vehicleId: vehicleRef.id,
        parkingSpaceId,
        licensePlate: licensePlate.toUpperCase(),
        spaceCode: spaceData.spaceCode,
        streetAddress: streetAddress,
        feePerHour: tarifaPorHora,
        amount: totalAmount,
        startTime,
        endTime,
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      batch.update(db.collection('parkingSpaces').doc(parkingSpaceId), {
        status: 'occupied',
        currentSessionId: sessionRef.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const transactionRef = db.collection('transactions').doc();
      
      batch.set(transactionRef, {
        userId: visitorUserRef.id,
        type: 'parking_cash',
        amount: -totalAmount,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      
      console.log('Visitante registrado y cobrado exitosamente');
      
      res.json({
        success: true,
        message: 'Visitante registrado y cobrado en efectivo',
        data: {
          userId: visitorUserRef.id,
          vehicleId: vehicleRef.id,
          sessionId: sessionRef.id,
          espacioCodigo: spaceData.spaceCode,
          ubicacion: streetAddress,
          hours: hoursNum,
          totalAmount,
          tarifaPorHora,
          startTime: startTime.toDate().toISOString(),
          endTime: endTime.toDate().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Error al registrar visitante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar el visitante'
      });
    }
  }

  // ========== CREAR MULTA A VISITANTE NO REGISTRADO ==========
  static async createVisitorFine(req: Request, res: Response): Promise<void> {
    try {
      const { licensePlate, visitorName, parkingSpaceId, reason, amount, location } = req.body;
      
      if (!licensePlate || !parkingSpaceId || !reason || !amount || !location) {
        res.status(400).json({
          success: false,
          message: 'Faltan campos obligatorios'
        });
        return;
      }
      
      const batch = db.batch();
      
      const licensePlateUpper = licensePlate.toUpperCase();
      const finalName = visitorName || `Visitante ${licensePlateUpper}`;
      
      const visitorUserRef = db.collection('users').doc();
      
      batch.set(visitorUserRef, {
        name: finalName.split(' ')[0] || 'Visitante',
        surname: finalName.split(' ').slice(1).join(' ') || licensePlateUpper,
        email: `visitante_${licensePlateUpper.toLowerCase()}@temp.com`,
        phone: 'N/A',
        balance: 0,
        isAdmin: false,
        createdBy: (req as any).user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const vehicleRef = db.collection('vehicles').doc();
      
      batch.set(vehicleRef, {
        userId: visitorUserRef.id,
        licensePlate: licensePlateUpper,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      const finesCount = await db.collection('fines').count().get();
      const fineNumero = String(finesCount.data().count + 1).padStart(6, '0');
      
      const fineRef = db.collection('fines').doc();
      
      batch.set(fineRef, {
        numero: fineNumero,
        userId: visitorUserRef.id,
        userName: finalName,
        userEmail: `visitante_${licensePlateUpper.toLowerCase()}@temp.com`,
        licensePlate: licensePlateUpper,
        reason,
        amount: parseFloat(amount),
        status: 'pagada',
        location,
        parkingSpaceId,
        parkingSessionId: null,
        issuedAt: admin.firestore.FieldValue.serverTimestamp(),
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentMethod: 'cash',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await batch.commit();
      
      res.json({
        success: true,
        message: 'Multa a visitante registrada exitosamente',
        userId: visitorUserRef.id,
        fineId: fineRef.id,
        fineNumero
      });
      
    } catch (error: any) {
      console.error('Error al crear multa a visitante:', error);
      res.status(500).json({
        success: false,
        message: 'Error al registrar multa a visitante'
      });
    }
  }

  // ========== FUNCIONES AUXILIARES ==========
  private static calcularDistancia(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distancia = R * c;
    
    return distancia;
  }

  private static toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}