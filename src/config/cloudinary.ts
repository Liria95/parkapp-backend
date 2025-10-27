import { v2 as cloudinary } from 'cloudinary';

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Verificar configuración al iniciar
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('ADVERTENCIA: Cloudinary no está completamente configurado.');
  console.warn('Verifica las variables en tu archivo .env:');
  console.warn('CLOUDINARY_CLOUD_NAME');
  console.warn('CLOUDINARY_API_KEY');
  console.warn('CLOUDINARY_API_SECRET');
} else {
  console.log('Cloudinary configurado correctamente');
  console.log(`Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
}

export default cloudinary;