# ParkApp Backend

## Descripción

ParkApp Backend es una API RESTful desarrollada en Node.js con TypeScript, diseñada para gestionar un sistema de estacionamiento inteligente. Utiliza Express.js como framework principal, PostgreSQL como base de datos, Firebase para autenticación y notificaciones, y MercadoPago para pagos.

## Características

- **Autenticación de usuarios**: Registro, login y verificación con Firebase.
- **Gestión de usuarios**: Perfiles, balances y fotos de perfil.
- **Estacionamiento**: Sesiones de parking, espacios disponibles y estadísticas.
- **Pagos**: Integración con MercadoPago para pagos y transacciones.
- **Multas**: Creación y pago de infracciones.
- **Notificaciones**: Push notifications y notificaciones en base de datos.
- **Registro manual**: Búsqueda por placa y registro de visitantes.
- **Base de datos**: PostgreSQL con triggers para actualizar espacios disponibles.

## Tecnologías Utilizadas

- **Node.js** con **TypeScript**
- **Express.js** para el servidor
- **PostgreSQL** para la base de datos
- **Firebase** para autenticación y notificaciones
- **MercadoPago** para pagos
- **Cloudinary** para almacenamiento de imágenes
- **JWT** para tokens de autenticación
- **bcrypt** para hashing de contraseñas

## Instalación

1. Clona el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd parkapp-backend
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
   ```
   PORT=3000
   NODE_ENV=development

   

   # Firebase
   FIREBASE_PROJECT_ID=tu-project-id
   FIREBASE_API_KEY=tu-api-key
   FIREBASE_APP_ID=tu-app-id

   # Firebase Admin (opcional, para notificaciones push)
   FIREBASE_PRIVATE_KEY_ID=tu-private-key-id
   FIREBASE_PRIVATE_KEY=tu-private-key
   FIREBASE_CLIENT_EMAIL=tu-client-email

   # Cloudinary
   CLOUDINARY_CLOUD_NAME=tu-cloud-name
   CLOUDINARY_API_KEY=tu-api-key
   CLOUDINARY_API_SECRET=tu-api-secret

   # MercadoPago
   MERCADOPAGO_ACCESS_TOKEN=tu-access-token



### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm run build
npm start
```

### Scripts Disponibles
- `npm run dev`: Inicia el servidor en modo desarrollo con nodemon.
- `npm run build`: Compila TypeScript a JavaScript.
- `npm start`: Inicia el servidor en producción.


## Endpoints de la API

### Autenticación
- `POST /api/auth/register`: Registrar un nuevo usuario.
- `POST /api/auth/login`: Iniciar sesión.
- `GET /api/auth/verify`: Verificar token JWT.

### Usuarios
- `GET /api/users/profile`: Obtener perfil del usuario.
- `PUT /api/users/profile`: Actualizar perfil.
- `POST /api/users/profile-photo`: Subir foto de perfil.
- `DELETE /api/users/profile-photo`: Eliminar foto de perfil.
- `GET /api/users/balance`: Obtener balance del usuario.

### Perfil de Usuario
- `GET /api/user-profile/:userId`: Obtener perfil por ID.
- `PUT /api/user-profile/:userId`: Actualizar perfil por ID.
- `DELETE /api/user-profile/:userId`: Eliminar perfil por ID.

### Notificaciones Push
- `POST /api/notifications/register`: Registrar token de notificación.
- `POST /api/notifications/send`: Enviar notificación a usuario.
- `POST /api/notifications/broadcast`: Enviar notificación a todos.

### Notificaciones de Usuario
- `GET /api/notifications-user/user/:userId`: Obtener notificaciones de usuario.
- `PUT /api/notifications-user/:notificationId/read`: Marcar notificación como leída.
- `PUT /api/notifications-user/user/:userId/read-all`: Marcar todas como leídas.
- `DELETE /api/notifications-user/:notificationId`: Eliminar notificación.

### Pagos
- `GET /api/payments/test`: Test de pagos.
- `POST /api/payments/simulate-payment`: Simular pago.
- `GET /api/payments/balance`: Obtener balance.
- `GET /api/payments/transactions`: Obtener transacciones.

### Multas
- `POST /api/fines/create`: Crear multa.
- `GET /api/fines/all`: Obtener todas las multas.
- `GET /api/fines/user/:userId`: Obtener multas de usuario.
- `POST /api/fines/:fineId/pay`: Pagar multa.

### Registro Manual
- `GET /api/manual-registration/search-by-plate/:licensePlate`: Buscar por placa.
- `GET /api/manual-registration/available-spaces`: Espacios disponibles.
- `POST /api/manual-registration/register-visitor`: Registrar visitante.
- `POST /api/manual-registration/visitor-fine`: Crear multa para visitante.

### Espacios de Estacionamiento
- `GET /api/parking-spaces/available`: Espacios disponibles.
- `GET /api/parking-spaces/stats`: Estadísticas de espacios.
- `GET /api/parking-spaces`: Todos los espacios.

### Sesiones de Estacionamiento
- `POST /api/parking-sessions/start`: Iniciar sesión de parking.
- `POST /api/parking-sessions/end`: Terminar sesión de parking.
- `GET /api/parking-sessions/active`: Sesiones activas.
- `GET /api/parking-sessions/history`: Historial de sesiones.
- `GET /api/parking-sessions/stats`: Estadísticas de sesiones.

### Salud del Sistema
- `GET /`: Información básica de la API.
- `GET /api/health`: Verificación de salud del sistema.

## Esquema de Base de Datos

El esquema de la base de datos incluye las siguientes tablas principales:

- **users**: Usuarios del sistema.
- **vehicles**: Vehículos asociados a usuarios.
- **street_parking**: Zonas de estacionamiento.
- **street**: Calles con rangos geográficos.
- **parking_spaces**: Espacios individuales de parking.
- **price**: Tarifas por calle.
- **parking_sessions**: Sesiones de estacionamiento.
- **transactions**: Movimientos de saldo.
- **fines**: Multas e infracciones.
- **notifications**: Notificaciones.

Incluye índices para optimización y triggers para actualizar automáticamente los espacios disponibles.

## Contribución

1. Liria Olivera
2. Monica Maria Zuluaga Pelaez
3. Anabella Ventavoli
4. Dagatti Marianela 



