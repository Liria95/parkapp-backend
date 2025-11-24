import dotenv from 'dotenv';
dotenv.config();
import vehicleRoutes from './routes/vehicle.routes';

console.log('\n===== VERIFICANDO VARIABLES DE ENTORNO =====');
console.log('Directorio de trabajo:', process.cwd());
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'NO ENCONTRADO');
console.log('FIREBASE_API_KEY:', process.env.FIREBASE_API_KEY ? 'Configurado' : 'NO ENCONTRADO');
console.log('FIREBASE_APP_ID:', process.env.FIREBASE_APP_ID ? 'Configurado' : 'NO ENCONTRADO');
console.log('================================================\n');

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
import finesRoutes from './routes/fines.routes';
import userProfileRoutes from './routes/user-profile.routes';
import notificationsUserRoutes from './routes/notifications-user.routes';
import manualRegistrationRoutes from './routes/manualRegistration.routes';
import parkingSpacesRoutes from './routes/parkingSpaces.routes';
import parkingSessionsRoutes from './routes/parkingSessions.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use('/api/vehicles', vehicleRoutes);
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// RUTAS
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/fines', finesRoutes);
app.use('/api/user-profile', userProfileRoutes);
app.use('/api/notifications-user', notificationsUserRoutes);
app.use('/api/manual-registration', manualRegistrationRoutes);
app.use('/api/parking-spaces', parkingSpacesRoutes);
app.use('/api/parking-sessions', parkingSessionsRoutes);

// RUTA RAIZ
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
      fines: '/api/fines',
      userProfile: '/api/user-profile',
      notificationsUser: '/api/notifications-user',
      manualRegistration: '/api/manual-registration',
      parkingSpaces: '/api/parking-spaces',
      parkingSessions: '/api/parking-sessions',
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
      'GET /api/users/balance',

      // User Profile
      'GET /api/user-profile/:userId',
      'PUT /api/user-profile/:userId',
      'DELETE /api/user-profile/:userId',

      // Notifications
      'POST /api/notifications/register',
      'POST /api/notifications/send',
      'POST /api/notifications/broadcast',

      // Notifications User
      'GET /api/notifications-user/user/:userId',
      'PUT /api/notifications-user/:notificationId/read',
      'PUT /api/notifications-user/user/:userId/read-all',
      'DELETE /api/notifications-user/:notificationId',

      // Payments
      'GET /api/payments/test',
      'POST /api/payments/simulate-payment',
      'GET /api/payments/balance',
      'GET /api/payments/transactions',

      // Fines
      'GET /api/fines/all',
      'GET /api/fines/user/:userId',
      'POST /api/fines/create',
      'PUT /api/fines/:fineId/status',
      'POST /api/fines/:fineId/pay',
      'GET /api/fines/stats/overview',

      // Manual Registration
      'GET /api/manual-registration/search-by-plate/:licensePlate',
      'GET /api/manual-registration/available-spaces',
      'GET /api/manual-registration/user/:userId/vehicles',
      'POST /api/manual-registration/register-user',
      'POST /api/manual-registration/register-visitor',
      'POST /api/manual-registration/end-session/:sessionId',
      'POST /api/manual-registration/end-visitor/:visitorId',

      // Parking Spaces
      'GET /api/parking-spaces/stats',
      'GET /api/parking-spaces',

      // Parking Sessions
      'POST /api/parking-sessions/start',
      'POST /api/parking-sessions/end',
      'GET /api/parking-sessions/active',
      'GET /api/parking-sessions/history'
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
  console.log('\n[SERVER] Servidor corriendo en puerto ' + PORT);
  console.log('[API] Base: http://localhost:' + PORT);
  console.log('[HEALTH] http://localhost:' + PORT + '/api/health');
  console.log('[AUTH] http://localhost:' + PORT + '/api/auth');
  console.log('[USERS] http://localhost:' + PORT + '/api/users');
  console.log('[USER PROFILE] http://localhost:' + PORT + '/api/user-profile');
  console.log('[NOTIFICATIONS] http://localhost:' + PORT + '/api/notifications');
  console.log('[NOTIFICATIONS USER] http://localhost:' + PORT + '/api/notifications-user');
  console.log('[PAYMENTS] http://localhost:' + PORT + '/api/payments');
  console.log('[FINES] http://localhost:' + PORT + '/api/fines');
  console.log('[MANUAL REGISTRATION] http://localhost:' + PORT + '/api/manual-registration');
  console.log('[PARKING SPACES] http://localhost:' + PORT + '/api/parking-spaces');
  console.log('[PARKING SESSIONS] http://localhost:' + PORT + '/api/parking-sessions');
  console.log('\n[FIREBASE] Project: ' + (process.env.FIREBASE_PROJECT_ID || 'NOT_CONFIGURED'));
  console.log('[ENV] Environment: ' + (process.env.NODE_ENV || 'development') + '\n');
});

export default app;