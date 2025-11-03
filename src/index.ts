import dotenv from 'dotenv';
dotenv.config();

console.log('\n===== VERIFICANDO VARIABLES DE ENTORNO =====');
console.log('Directorio de trabajo:', process.cwd());
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'NO ENCONTRADO');
console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? 'Configurado' : 'NO ENCONTRADO');
console.log('FIREBASE_APP_ID:', process.env.FIREBASE_APP_ID ? 'Configurado' : 'NO ENCONTRADO');
console.log('================================================\n');

// Si las variables no están, mostrar error
if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_PROJECT_ID) {
  console.error('ERROR: Variables de Firebase NO encontradas en .env');
  console.error('Verifica que el archivo .env existe en:', process.cwd());
  console.error('Y que contiene las variables FIREBASE_*\n');
}

import express from 'express';
import cors from 'cors';

// Importar configuración de Firebase Admin
import './config/firebaseAdmin';

// Importar rutas
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import notificationRoutes from './routes/notification.routes';
import paymentRoutes from './routes/payments.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(` ${req.method} ${req.path}`);
  next();
});

// RUTAS
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes); 

// RUTA RAÍZ
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ParkApp API con Firebase',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      notifications: '/api/notifications',
      payments: '/api/payments',
      health: '/api/health'
    }
  });
});

// HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ParkApp API funcionando correctamente',
    timestamp: new Date().toISOString(),
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'NOT_CONFIGURED',
      configured: !!process.env.FIREBASE_API_KEY
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'NOT_CONFIGURED',
      configured: !!process.env.CLOUDINARY_API_KEY
    },
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000
    }
  });
});

// RUTAS NO ENCONTRADAS
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.path}`,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      
      // Auth
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/verify',
      
      // Users
      'GET /api/users/profile',
      'PUT /api/users/profile',
      'POST /api/users/profile-photo',
      'DELETE /api/users/profile-photo',
      
      // Notifications
      'POST /api/notifications/register',
      'POST /api/notifications/send',
      'POST /api/notifications/broadcast',
      
      // Payments
      'GET /api/payments/test',
      'POST /api/payments/simulate-payment',
      'GET /api/payments/balance',
      'GET /api/payments/transactions',
    ]
  });
});

// MANEJO DE ERRORES
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`API Base: http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Auth: http://localhost:${PORT}/api/auth`);
  console.log(`Users: http://localhost:${PORT}/api/users`);
  console.log(`Notifications: http://localhost:${PORT}/api/notifications`);
  console.log(`Payments: http://localhost:${PORT}/api/payments`);
  console.log(`Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'NOT_CONFIGURED'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;