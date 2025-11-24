import { Router, Request, Response } from 'express';
import { db, auth } from '../config/firebaseAdmin';
import admin from 'firebase-admin';
import { authMiddleware } from '../middleware/auth.middleware';
import bcrypt from 'bcrypt';

const router = Router();

// ========== OBTENER PERFIL ==========
router.get('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  
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

// ========== ACTUALIZAR PERFIL ==========
router.put('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  const { name, surname, phone, currentPassword, newPassword } = req.body;
  
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
    
    if (name && name.trim() !== '') {
      updateData.name = name.trim();
    }
    
    if (surname && surname.trim() !== '') {
      updateData.surname = surname.trim();
    }
    
    if (phone && phone.trim() !== '') {
      updateData.phone = phone.trim();
    }
    
    if (newPassword && newPassword.trim() !== '') {
      try {
        await auth.updateUser(userId, {
          password: newPassword
        });
        
        console.log('Contraseña actualizada en Firebase Auth');
        
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
    
    await db.collection('users').doc(userId).update(updateData);
    
    console.log('Perfil actualizado:', Object.keys(updateData));
    
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

// ========== ELIMINAR CUENTA ==========
router.delete('/:userId', authMiddleware, async (req: Request, res: Response) => {
  const { userId } = req.params;
  const authenticatedUser = (req as any).user;
  
  if (authenticatedUser.uid !== userId) {
    res.status(403).json({
      success: false,
      message: 'No tienes permiso para eliminar esta cuenta'
    });
    return;
  }
  
  try {
    console.log('Eliminando cuenta del usuario:', userId);
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
      return;
    }
    
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
    
    const batch = db.batch();
    
    const notificationsSnapshot = await db.collection('notifications')
      .where('user_id', '==', userId)
      .get();
    notificationsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    const sessionsSnapshot = await db.collection('parking_sessions')
      .where('userId', '==', userId)
      .get();
    sessionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    const transactionsSnapshot = await db.collection('transactions')
      .where('userId', '==', userId)
      .get();
    transactionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    const vehiclesSnapshot = await db.collection('vehicles')
      .where('userId', '==', userId)
      .get();
    vehiclesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    const finesSnapshot = await db.collection('fines')
      .where('userId', '==', userId)
      .get();
    finesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    batch.delete(userDoc.ref);
    
    await batch.commit();
    
    try {
      await auth.deleteUser(userId);
      console.log('Usuario eliminado de Firebase Auth');
    } catch (authError) {
      console.error('Error al eliminar de Auth:', authError);
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