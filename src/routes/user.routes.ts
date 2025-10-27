import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Crear carpeta uploads si no existe
const uploadsDir = 'uploads/profiles/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'));
    }
  }
});

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Obtener perfil del usuario actual
router.get('/profile', UserController.getProfile);

// Actualizar perfil
router.put('/profile', UserController.updateProfile);

// Subir foto de perfil (con Cloudinary)
router.post('/profile-photo', upload.single('photo'), UserController.updateProfilePhoto);

// Ruta alternativa (mismo endpoint)
router.post('/profile/photo', upload.single('photo'), UserController.updateProfilePhoto);

// Eliminar foto de perfil
router.delete('/profile/photo', UserController.deleteProfilePhoto);

export default router;