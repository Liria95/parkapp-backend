import { Request, Response } from 'express';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  UserCredential 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export class AuthController {
  
  // ========== REGISTER ==========
  static async register(req: Request, res: Response): Promise<void> {
    const { name, surname, email, phone, password } = req.body;

    try {
      // Validaciones
      if (!name || !surname || !email || !phone || !password) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son obligatorios'
        });
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Formato de email inválido'
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
        return;
      }

      // FIREBASE: Crear usuario en Authentication
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        auth, 
        email, 
        password
      );

      const userId = userCredential.user.uid;

      // FIRESTORE: Guardar datos adicionales
      await setDoc(doc(db, 'users', userId), {
        name,
        surname,
        email,
        phone,
        avatar: null,
        balance: 0,
        isAdmin: false,
        createdAt: serverTimestamp()
      });

      // Obtener token de Firebase
      const token = await userCredential.user.getIdToken();

      console.log('Usuario registrado:', userId);

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        user: {
          id: userId,
          name,
          surname,
          email,
          phone,
          isAdmin: false,
          balance: 0,
          avatar: null
        },
        token
      });

    } catch (error: any) {
      console.error('Error en register:', error);

      // Manejo de errores de Firebase
      if (error.code === 'auth/email-already-in-use') {
        res.status(409).json({
          success: false,
          message: 'El email ya está registrado'
        });
      } else if (error.code === 'auth/weak-password') {
        res.status(400).json({
          success: false,
          message: 'La contraseña es muy débil'
        });
      } else if (error.code === 'auth/invalid-email') {
        res.status(400).json({
          success: false,
          message: 'Email inválido'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error al registrar usuario'
        });
      }
    }
  }

  // ========== LOGIN ==========
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    try {
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email y contraseña son obligatorios'
        });
        return;
      }

      // FIREBASE: Autenticar con Firebase Auth
      const userCredential: UserCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const userId = userCredential.user.uid;

      // FIRESTORE: Obtener datos adicionales del usuario
      const userDoc = await getDoc(doc(db, 'users', userId));

      if (!userDoc.exists()) {
        res.status(404).json({
          success: false,
          message: 'Datos de usuario no encontrados'
        });
        return;
      }

      const userData = userDoc.data();

      // 🔥 Obtener token de Firebase
      const token = await userCredential.user.getIdToken();

      console.log(' Login exitoso:', userId);

      res.status(200).json({
        success: true,
        message: 'Login exitoso',
        user: {
          id: userId,
          name: userData.name,
          surname: userData.surname,
          email: userData.email,
          phone: userData.phone,
          isAdmin: userData.isAdmin || false,
          balance: userData.balance || 0,
          avatar: userData.avatar || null
        },
        token,
        refreshToken: token, // Firebase maneja refresh automáticamente
        isAdmin: userData.isAdmin || false
      });

    } catch (error: any) {
      console.error('❌ Error en login:', error);

      // Manejo de errores de Firebase
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        res.status(401).json({
          success: false,
          message: 'Email o contraseña incorrectos'
        });
      } else if (error.code === 'auth/invalid-credential') {
        res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      } else if (error.code === 'auth/too-many-requests') {
        res.status(429).json({
          success: false,
          message: 'Demasiados intentos. Intenta más tarde'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error al iniciar sesión'
        });
      }
    }
  }

  // ========== VERIFY TOKEN ==========
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'Token no proporcionado'
        });
        return;
      }

      // El middleware authMiddleware ya verificó el token con Firebase Admin
      const userId = (req as any).user.uid;

      const userDoc = await getDoc(doc(db, 'users', userId));

      if (!userDoc.exists()) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
        return;
      }

      const userData = userDoc.data();

      res.status(200).json({
        success: true,
        user: {
          id: userId,
          ...userData
        },
        isAdmin: userData.isAdmin || false
      });

    } catch (error) {
      console.error('❌ Error en verifyToken:', error);
      res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }
  }

  // ========== LOGOUT ==========
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Firebase maneja el logout en el cliente
      
      res.status(200).json({
        success: true,
        message: 'Logout exitoso'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión'
      });
    }
  }
}