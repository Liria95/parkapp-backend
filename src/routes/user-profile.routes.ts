import { Router, Request, Response } from 'express';
import { db, auth } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';
import bcrypt from 'bcrypt';

const router = Router();

// Obtener datos del perfil del usuario
router.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  
  // Verificar que el usuario consulta su propio perfil
  if (authenticatedUser.uid !== userId) {
    res.status(403).json({
      success: false,
      message: 'No tienes permiso para ver este perfil'
    });
    return;
  }
  
  try {
    console.log('Obteniendo perfil del usuario:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
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
        id: userDoc.id,
        name: userData?.name,
        surname: userData?.surname,
        email: userData?.email,
        phone: userData?.phone,
        avatar: userData?.avatar,
        balance: userData?.balance || 0,
      }
    });
    
  } catch (error: any) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
});

// Actualizar datos del perfil
router.put('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  const { name, surname, phone, currentPassword, newPassword } = req.body;
  
  // Verificar que el usuario actualiza su propio perfil
  if (authenticatedUser.uid !== userId) {
    res.status(403).json({
      success: false,
      message: 'No tienes permiso para editar este perfil'
    });
    return;
  }
  
  try {
    console.log('Actualizando perfil del usuario:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    const userData = userDoc.data();
    const updateData: any = {};
    
    // Actualizar nombre
    if (name && name.trim() !== '') {
      updateData.name = name.trim();
    }
    
    // Actualizar apellido
    if (surname && surname.trim() !== '') {
      updateData.surname = surname.trim();
    }
    
    // Actualizar teléfono
    if (phone && phone.trim() !== '') {
      updateData.phone = phone.trim();
    }
    
    // Cambiar contraseña si se proporciona
    if (newPassword && newPassword.trim() !== '') {
      try {
        // Actualizar contraseña en Firebase Auth
        await auth.updateUser(userId, {
          password: newPassword
        });
        
        console.log('Contraseña actualizada en Firebase Auth');
        
        // Si también guarda password en Firestore (opcional)
        if (userData?.password) {
          const hashedPassword = await bcrypt.hash(newPassword, 10);
          updateData.password = hashedPassword;
        }
        
      } catch (authError: any) {
        console.error('Error al actualizar contraseña:', authError);
        res.status(500).json({
          success: false,
          message: 'No se pudo actualizar la contraseña'
        });
        return;
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No hay datos para actualizar'
      });
      return;
    }
    
    // Actualizar en Firestore
    await db.collection('users').doc(userId).update(updateData);
    
    console.log('Perfil actualizado:', Object.keys(updateData));
    
    // Obtener datos actualizados
    const updatedUserDoc = await db.collection('users').doc(userId).get();
    const updatedUserData = updatedUserDoc.data();
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: {
        id: updatedUserDoc.id,
        name: updatedUserData?.name,
        surname: updatedUserData?.surname,
        email: updatedUserData?.email,
        phone: updatedUserData?.phone,
        avatar: updatedUserData?.avatar,
        balance: updatedUserData?.balance || 0,
      }
    });
    
  } catch (error: any) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// Eliminar cuenta
router.delete('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  
  // Verificar que el usuario elimina su propia cuenta
  if (authenticatedUser.uid !== userId) {
    res.status(403).json({
      success: false,
      message: 'No tienes permiso para eliminar esta cuenta'
    });
    return;
  }
  
  try {
    console.log('Eliminando cuenta del usuario:', userId);
    
    // Verificar que el usuario existe
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
    // No permitir eliminar si hay estacionamiento activo
    const activeParkingSnapshot = await db.collection('parking_sessions')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();
    
    if (!activeParkingSnapshot.empty) {
      res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu cuenta con estacionamiento activo. Finaliza primero tu sesión.'
      });
      return;
    }
    
    // No permitir eliminar si hay multas pendientes
    const pendingFinesSnapshot = await db.collection('fines')
      .where('userId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    if (!pendingFinesSnapshot.empty) {
      res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu cuenta con multas pendientes. Paga primero tus infracciones.'
      });
      return;
    }
    
    // Eliminar datos relacionados en Firestore
    const batch = db.batch();
    
    // Eliminar notificaciones
    const notificationsSnapshot = await db.collection('notifications')
      .where('user_id', '==', userId)
      .get();
    notificationsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar sesiones de estacionamiento
    const sessionsSnapshot = await db.collection('parking_sessions')
      .where('userId', '==', userId)
      .get();
    sessionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar transacciones
    const transactionsSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();
    transactionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar vehículos
    const vehiclesSnapshot = await db.collection('vehicles')
      .where('userId', '==', userId)
      .get();
    vehiclesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar multas
    const finesSnapshot = await db.collection('fines')
      .where('userId', '==', userId)
      .get();
    finesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Eliminar el usuario
    batch.delete(userDoc.ref);
    
    await batch.commit();
    
    // Eliminar de Firebase Auth
    try {
      await auth.deleteUser(userId);
      console.log('Usuario eliminado de Firebase Auth');
    } catch (authError) {
      console.error('Error al eliminar de Auth:', authError);
      // Continuar aunque falle Auth
    }
    
    console.log('Cuenta eliminada completamente');
    
    res.json({
      success: true,
      message: 'Cuenta eliminada exitosamente'
    });
    
  } catch (error: any) {
    console.error('Error al eliminar cuenta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar cuenta'
    });
  }
});

export default router;