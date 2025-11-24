import { IVehicle } from '../interfaces/models';
import { db } from '../config/firebaseAdmin'; 

const vehiclesCollection = db.collection('vehicles');

export class VehicleService {
    
    async createVehicle(
        userId: string, 
        vehicleData: Omit<IVehicle, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'userId'>
    ): Promise<IVehicle> {
        const now = Date.now(); 
        
        const vehicleToCreate: Omit<IVehicle, 'id'> = {
            ...vehicleData,
            userId: userId, 
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await vehiclesCollection.add(vehicleToCreate);

        return {
            id: docRef.id,
            ...vehicleToCreate
        } as IVehicle;
    }

    async getVehiclesByUserId(userId: string): Promise<IVehicle[]> {
        const snapshot = await vehiclesCollection
            .where('userId', '==', userId)
            .where('status', '!=', 'deleted')
            .orderBy('status')
            .orderBy('updatedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<IVehicle, 'id'>)
        }));
    }

    async searchByPlate(licensePlate: string): Promise<IVehicle | null> {
        const snapshot = await vehiclesCollection
            .where('licensePlate', '==', licensePlate.toUpperCase())
            .where('status', '==', 'active')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return {
            id: doc.id,
            ...(doc.data() as Omit<IVehicle, 'id'>)
        } as IVehicle;
    }

    async updateVehicle(
        vehicleId: string, 
        updates: Partial<Omit<IVehicle, 'id' | 'createdAt' | 'userId' | 'updatedAt'>>
    ): Promise<IVehicle> {
        const docRef = vehiclesCollection.doc(vehicleId);
        const existingDoc = await docRef.get();
        
        if (!existingDoc.exists) {
            throw new Error(`Vehículo con ID ${vehicleId} no encontrado.`);
        }

        const updatesWithTimestamp = {
            ...updates,
            updatedAt: Date.now(),
        };

        await docRef.update(updatesWithTimestamp);
        
        return {
            id: vehicleId,
            ...(existingDoc.data() as Omit<IVehicle, 'id'>),
            ...updatesWithTimestamp
        } as IVehicle;
    }

    async deleteVehicle(vehicleId: string): Promise<void> {
        const docRef = vehiclesCollection.doc(vehicleId);
        
        const updates = {
            status: 'deleted' as const,
            updatedAt: Date.now(), 
        };
        
        await docRef.update(updates);
    }
}