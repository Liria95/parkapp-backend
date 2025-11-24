import { IUser, IUserProfile } from '../interfaces/models';
import { db, auth } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import cloudinary from '../config/cloudinary';
import fs from 'fs';

const usersCollection = db.collection('users');

export class UserService {

    // ==================== PERFIL DE USUARIO ====================

    /**
     * Obtiene el perfil de un usuario específico
     */
    async getUserProfile(userId: string): Promise<IUserProfile | null> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            return null;
        }

        const data = userDoc.data() as IUser;
        
        return {
            id: userDoc.id,
            name: data.name,
            surname: data.surname,
            email: data.email,
            phone: data.phone,
            avatar: data.avatar,
            balance: data.balance || 0
        };
    }

    /**
     * Actualiza los datos del perfil
     */
    async updateProfile(
        userId: string,
        updates: {
            name?: string;
            surname?: string;
            phone?: string;
        }
    ): Promise<IUserProfile> {
        const docRef = usersCollection.doc(userId);
        const existingDoc = await docRef.get();

        if (!existingDoc.exists) {
            throw new Error(`Usuario con ID ${userId} no encontrado.`);
        }

        const updateData: any = {};
        if (updates.name) updateData.name = updates.name.trim();
        if (updates.surname) updateData.surname = updates.surname.trim();
        if (updates.phone) updateData.phone = updates.phone.trim();
        updateData.updatedAt = Date.now();

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        const data = updatedDoc.data() as IUser;

        return {
            id: updatedDoc.id,
            name: data.name,
            surname: data.surname,
            email: data.email,
            phone: data.phone,
            avatar: data.avatar,
            balance: data.balance || 0
        };
    }

    /**
     * Actualiza la foto de perfil
     */
    async updateProfilePhoto(userId: string, filePath: string): Promise<string> {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'parkapp/profiles',
            public_id: `user-${userId}`,
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: 'fill' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
            ]
        });

        const photoUrl = result.secure_url;

        try {
            fs.unlinkSync(filePath);
            console.log('Archivo temporal eliminado');
        } catch (err) {
            console.log('No se pudo eliminar archivo temporal');
        }

        await usersCollection.doc(userId).update({
            avatar: photoUrl,
            updatedAt: Date.now()
        });

        return photoUrl;
    }

    /**
     * Elimina la foto de perfil
     */
    async deleteProfilePhoto(userId: string): Promise<void> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }

        const userData = userDoc.data() as IUser;
        const currentAvatar = userData.avatar;

        if (!currentAvatar) {
            throw new Error('No hay foto de perfil para eliminar');
        }

        if (currentAvatar.includes('cloudinary.com')) {
            try {
                const publicId = `parkapp/profiles/user-${userId}`;
                await cloudinary.uploader.destroy(publicId);
                console.log('Archivo eliminado de Cloudinary');
            } catch (err) {
                console.log('No se pudo eliminar archivo de Cloudinary:', err);
            }
        }

        await usersCollection.doc(userId).update({
            avatar: null,
            updatedAt: Date.now()
        });
    }

    /**
     * Cambiar contraseña
     */
    async updatePassword(userId: string, newPassword: string): Promise<void> {
        await auth.updateUser(userId, {
            password: newPassword
        });
    }

    /**
     * Elimina una cuenta de usuario
     */
    async deleteAccount(userId: string): Promise<void> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }

        // Verificar estacionamiento activo
        const activeParkingSnapshot = await db.collection('parking_sessions')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (!activeParkingSnapshot.empty) {
            throw new Error('No puedes eliminar tu cuenta con estacionamiento activo');
        }

        // Verificar multas pendientes
        const pendingFinesSnapshot = await db.collection('fines')
            .where('userId', '==', userId)
            .where('status', '==', 'pending')
            .get();

        if (!pendingFinesSnapshot.empty) {
            throw new Error('No puedes eliminar tu cuenta con multas pendientes');
        }

        // Eliminar datos relacionados
        const batch = db.batch();

        const notificationsSnapshot = await db.collection('notifications')
            .where('user_id', '==', userId).get();
        notificationsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const sessionsSnapshot = await db.collection('parking_sessions')
            .where('userId', '==', userId).get();
        sessionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId).get();
        transactionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const vehiclesSnapshot = await db.collection('vehicles')
            .where('userId', '==', userId).get();
        vehiclesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        const finesSnapshot = await db.collection('fines')
            .where('userId', '==', userId).get();
        finesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        batch.delete(userDoc.ref);
        await batch.commit();

        try {
            await auth.deleteUser(userId);
        } catch (authError) {
            console.error('Error al eliminar de Auth:', authError);
        }
    }

    // ==================== BALANCE ====================

    /**
     * Obtiene el balance de un usuario
     */
    async getUserBalance(userId: string): Promise<number> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }

        const userData = userDoc.data() as IUser;
        return userData.balance || 0;
    }

    // ==================== ADMIN - GESTIÓN DE USUARIOS ====================

    /**
     * Obtiene todos los usuarios (solo admin)
     */
    async getAllUsers(): Promise<IUser[]> {
        const usersSnapshot = await usersCollection.get();

        return usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<IUser, 'id'>)
        }));
    }

    /**
     * Busca usuarios por término
     */
    async searchUsers(searchTerm: string): Promise<IUser[]> {
        const term = searchTerm.toLowerCase();
        const usersSnapshot = await usersCollection.get();

        const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<IUser, 'id'>)
        }));

        return users.filter((user: IUser) => {
            const name = user.name?.toLowerCase() || '';
            const surname = user.surname?.toLowerCase() || '';
            const email = user.email?.toLowerCase() || '';
            const phone = user.phone?.toLowerCase() || '';

            return (
                name.includes(term) ||
                surname.includes(term) ||
                email.includes(term) ||
                phone.includes(term)
            );
        });
    }

    /**
     * Actualiza el balance de un usuario (solo admin)
     */
    async updateUserBalance(userId: string, newBalance: number): Promise<{ previousBalance: number; newBalance: number }> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }

        const userData = userDoc.data() as IUser;
        const previousBalance = userData.balance || 0;

        await usersCollection.doc(userId).update({
            balance: newBalance,
            updatedAt: Date.now()
        });

        // Registrar transacción
        await db.collection('transactions').add({
            userId,
            userEmail: userData.email,
            userName: `${userData.name} ${userData.surname}`,
            type: 'admin_adjustment',
            amount: newBalance - previousBalance,
            previousBalance,
            newBalance: newBalance,
            method: 'admin',
            status: 'approved',
            description: 'Ajuste manual de saldo por administrador',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { previousBalance, newBalance };
    }

    /**
     * Activa o desactiva un usuario
     */
    async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
        const userDoc = await usersCollection.doc(userId).get();

        if (!userDoc.exists) {
            throw new Error('Usuario no encontrado');
        }

        await usersCollection.doc(userId).update({
            isActive: isActive,
            updatedAt: Date.now()
        });
    }
}