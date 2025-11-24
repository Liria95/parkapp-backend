import { Request, Response } from 'express';
import { UserService } from '../services/userService';

export class UserController {
    private userService: UserService;

    constructor() {
        this.userService = new UserService();
    }

    // ==================== PERFIL DE USUARIO ====================

    // GET /api/user-profile/:userId O /api/users/profile
    getProfile = async (req: Request, res: Response): Promise<void> => {
        try {
            // Puede venir de params o del usuario autenticado
            const userId = req.params.userId || (req as any).user?.uid;
            const authenticatedUser = (req as any).user;

            // Si hay userId en params, verificar permisos
            if (req.params.userId && authenticatedUser.uid !== req.params.userId) {
                res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para ver este perfil'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'Se requiere userId'
                });
                return;
            }

            const user = await this.userService.getUserProfile(userId);

            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
                return;
            }

            res.json({
                success: true,
                user
            });

        } catch (error) {
            console.error('Error al obtener perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener perfil'
            });
        }
    };

    // PUT /api/user-profile/:userId O /api/users/profile
    updateProfile = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = req.params.userId || (req as any).user?.uid;
            const authenticatedUser = (req as any).user;
            const { name, surname, phone, newPassword } = req.body;

            // Si hay userId en params, verificar permisos
            if (req.params.userId && authenticatedUser.uid !== req.params.userId) {
                res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para editar este perfil'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'Se requiere userId'
                });
                return;
            }

            if (!name && !surname && !phone && !newPassword) {
                res.status(400).json({
                    success: false,
                    message: 'No hay datos para actualizar'
                });
                return;
            }

            // Actualizar contraseña si se proporciona
            if (newPassword) {
                await this.userService.updatePassword(userId, newPassword);
            }

            // Actualizar perfil
            const updates: any = {};
            if (name) updates.name = name;
            if (surname) updates.surname = surname;
            if (phone) updates.phone = phone;

            const updatedUser = await this.userService.updateProfile(userId, updates);

            res.json({
                success: true,
                message: 'Perfil actualizado exitosamente',
                user: updatedUser
            });

        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar perfil'
            });
        }
    };

    // POST /api/users/profile-photo O /api/users/profile/photo
    updateProfilePhoto = async (req: Request, res: Response): Promise<void> => {
        try {
            const authenticatedUser = (req as any).user;
            const userId = authenticatedUser.uid;
            const file = req.file;

            if (!file) {
                res.status(400).json({
                    success: false,
                    message: 'No se recibió ninguna imagen'
                });
                return;
            }

            console.log('Subiendo imagen a Cloudinary...');

            const photoUrl = await this.userService.updateProfilePhoto(userId, file.path);

            res.json({
                success: true,
                photoUrl,
                message: 'Foto de perfil actualizada exitosamente'
            });

        } catch (error: any) {
            console.error('Error al actualizar foto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar foto de perfil',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    };

    // DELETE /api/users/profile/photo
    deleteProfilePhoto = async (req: Request, res: Response): Promise<void> => {
        try {
            const authenticatedUser = (req as any).user;
            const userId = authenticatedUser.uid;

            await this.userService.deleteProfilePhoto(userId);

            res.json({
                success: true,
                message: 'Foto de perfil eliminada exitosamente'
            });

        } catch (error: any) {
            console.error('Error al eliminar foto:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al eliminar foto de perfil'
            });
        }
    };

    // DELETE /api/user-profile/:userId
    deleteAccount = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId } = req.params;
            const authenticatedUser = (req as any).user;

            if (authenticatedUser.uid !== userId) {
                res.status(403).json({
                    success: false,
                    message: 'No tienes permiso para eliminar esta cuenta'
                });
                return;
            }

            await this.userService.deleteAccount(userId);

            res.json({
                success: true,
                message: 'Cuenta eliminada exitosamente'
            });

        } catch (error: any) {
            console.error('Error al eliminar cuenta:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al eliminar cuenta'
            });
        }
    };

    // ==================== BALANCE ====================

    // GET /api/users/balance
    getBalance = async (req: Request, res: Response): Promise<void> => {
        try {
            const authenticatedUser = (req as any).user;
            const userId = authenticatedUser.uid;

            console.log('Obteniendo saldo para usuario:', userId);

            const balance = await this.userService.getUserBalance(userId);

            console.log('Saldo obtenido:', balance);

            res.json({
                success: true,
                balance
            });

        } catch (error: any) {
            console.error('Error al obtener saldo:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error al obtener saldo'
            });
        }
    };
}