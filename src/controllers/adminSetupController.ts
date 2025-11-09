// src/controllers/adminSetupController.ts
import { Request, Response } from 'express';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { adminAuth, adminDb } from '../config/firebaseAdmin';

export class AdminSetupController {
  
  // ⚠️ USAR SOLO EN DESARROLLO - ELIMINAR EN PRODUCCIÓN
  static async createAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { name, surname, email, phone, password, secretKey } = req.body;

      // 🔒 Protección: Requerir clave secreta
      if (secretKey !== process.env.ADMIN_SETUP_SECRET) {
        res.status(403).json({
          success: false,
          message: 'Clave secreta incorrecta',
        });
        return;
      }

      // Validar campos
      if (!name || !surname || !email || !phone || !password) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son obligatorios',
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres',
        });
        return;
      }

      console.log('🔐 Creando admin:', email);

      // 1. Crear usuario en Firebase Auth usando Admin SDK
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
        displayName: `${name} ${surname}`,
      });

      console.log('✅ Admin creado en Auth:', userRecord.uid);

      // 2. Guardar en Firestore con isAdmin: true
      await adminDb.collection('users').doc(userRecord.uid).set({
        name: name,
        surname: surname,
        email: email,
        phone: phone,
        isAdmin: true,  // ← IMPORTANTE
        balance: 0,
        avatar: null,
        createdAt: new Date().toISOString(),
      });

      console.log('✅ Admin guardado en Firestore');

      res.status(201).json({
        success: true,
        message: 'Admin creado exitosamente',
        admin: {
          uid: userRecord.uid,
          email: email,
          name: name,
          isAdmin: true,
        },
      });

    } catch (error: any) {
      console.error('❌ Error al crear admin:', error);
      
      let message = 'Error al crear admin';
      if (error.code === 'auth/email-already-exists') {
        message = 'El email ya está registrado';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Email inválido';
      } else if (error.code === 'auth/weak-password') {
        message = 'Contraseña muy débil';
      }

      res.status(500).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  // Convertir usuario existente en admin
  static async makeUserAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { userId, secretKey } = req.body;

      // 🔒 Protección: Requerir clave secreta
      if (secretKey !== process.env.ADMIN_SETUP_SECRET) {
        res.status(403).json({
          success: false,
          message: 'Clave secreta incorrecta',
        });
        return;
      }

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId es requerido',
        });
        return;
      }

      console.log('👑 Convirtiendo usuario a admin:', userId);

      // Actualizar Firestore
      await adminDb.collection('users').doc(userId).update({
        isAdmin: true,
      });

      console.log('✅ Usuario convertido a admin');

      res.json({
        success: true,
        message: 'Usuario convertido a admin exitosamente',
      });

    } catch (error: any) {
      console.error('❌ Error:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar usuario',
      });
    }
  }
}