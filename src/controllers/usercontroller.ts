import { Request, Response } from 'express';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import cloudinary from '../config/cloudinary';
import fs from 'fs';

export class UserController {
  
  // ========== SUBIR FOTO DE PERFIL A CLOUDINARY ==========
  static async updateProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.uid; // ← Cambio principal: uid en vez de userId
      const file = req.file;

      if (!file) {
        res.status(400).json({ 
          success: false, 
          message: 'No se recibió ninguna imagen' 
        });
        return;
      }

      console.log('Subiendo imagen a Cloudinary...');
      console.log('Archivo temporal:', file.path);
      console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

      // Subir a Cloudinary (igual que antes)
      const result = await cloudinary.uploader.upload(file.path, {
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

      console.log('Imagen subida a Cloudinary:', photoUrl);

      // Eliminar archivo temporal
      try {
        fs.unlinkSync(file.path);
        console.log('Archivo temporal eliminado');
      } catch (err) {
        console.log('No se pudo eliminar archivo temporal');
      }

      // Guardar URL en Firestore (en vez de PostgreSQL)
      await updateDoc(doc(db, 'users', userId), {
        avatar: photoUrl
      });

      console.log('💾 URL guardada en Firestore');

      res.json({ 
        success: true, 
        photoUrl,
        message: 'Foto de perfil actualizada exitosamente'
      });

    } catch (error: any) {
      console.error('Error al actualizar foto:', error);
      console.error('Detalles del error:', error.message);
      res.status(500).json({ 
        success: false, 
        message: 'Error al actualizar foto de perfil',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ========== OBTENER PERFIL ==========
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.uid; // ← uid de Firebase

      // Obtener de Firestore (en vez de PostgreSQL)
      const userDoc = await getDoc(doc(db, 'users', userId));

      if (!userDoc.exists()) {
        res.status(404).json({ 
          success: false, 
          message: 'Usuario no encontrado' 
        });
        return;
      }

      const userData = userDoc.data();

      res.json({ 
        success: true, 
        user: {
          id: userId,
          name: userData.name,
          surname: userData.surname,
          email: userData.email,
          phone: userData.phone,
          avatar: userData.avatar || null,
          balance: userData.balance || 0,
          isAdmin: userData.isAdmin || false,
          createdAt: userData.createdAt
        }
      });

    } catch (error) {
      console.error('❌ Error al obtener perfil:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener perfil' 
      });
    }
  }

  // ========== ACTUALIZAR PERFIL ==========
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.uid;
      const { name, surname, phone } = req.body;

      // Validar que al menos un campo venga
      if (!name && !surname && !phone) {
        res.status(400).json({
          success: false,
          message: 'Debe proporcionar al menos un campo para actualizar'
        });
        return;
      }

      // Crear objeto con campos a actualizar
      const updates: any = {};
      if (name) updates.name = name;
      if (surname) updates.surname = surname;
      if (phone) updates.phone = phone;

      // Actualizar en Firestore
      await updateDoc(doc(db, 'users', userId), updates);

      // Obtener datos actualizados
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        user: {
          id: userId,
          ...userData
        }
      });

    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar perfil'
      });
    }
  }

  // ========== ELIMINAR FOTO DE PERFIL ==========
  static async deleteProfilePhoto(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.uid;

      // Obtener usuario para ver si tiene avatar
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }

      const userData = userDoc.data();
      const currentAvatar = userData.avatar;

      if (!currentAvatar) {
        res.status(400).json({
          success: false,
          message: 'No hay foto de perfil para eliminar'
        });
        return;
      }

      // Eliminar de Cloudinary
      if (currentAvatar.includes('cloudinary.com')) {
        try {
          const publicId = `parkapp/profiles/user-${userId}`;
          await cloudinary.uploader.destroy(publicId);
          console.log('Archivo eliminado de Cloudinary');
        } catch (err) {
          console.log('No se pudo eliminar archivo de Cloudinary:', err);
        }
      }

      // Actualizar Firestore (remover avatar)
      await updateDoc(doc(db, 'users', userId), {
        avatar: null
      });

      res.json({
        success: true,
        message: 'Foto de perfil eliminada exitosamente'
      });

    } catch (error) {
      console.error('Error al eliminar foto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar foto de perfil'
      });
    }
  }
}