import { Request, Response } from 'express';
import { VehicleService } from '../services/vehicleService';

export class VehicleController {
    private vehicleService: VehicleService;

    constructor() {
        this.vehicleService = new VehicleService();
    }

    // GET /api/vehicles/search?licensePlate=ABC123
    search = async (req: Request, res: Response): Promise<void> => {
        try {
            const { licensePlate } = req.query;

            if (!licensePlate || typeof licensePlate !== 'string') {
                res.status(400).json({ 
                    error: 'Se requiere el parámetro licensePlate' 
                });
                return;
            }

            const vehicle = await this.vehicleService.searchByPlate(licensePlate);

            if (!vehicle) {
                res.status(404).json({ 
                    error: 'Vehículo no encontrado' 
                });
                return;
            }

            res.status(200).json(vehicle);
        } catch (error) {
            console.error('Error en search:', error);
            res.status(500).json({ 
                error: 'Error al buscar el vehículo' 
            });
        }
    };

    // POST /api/vehicles
    create = async (req: Request, res: Response): Promise<void> => {
        try {
            // Obtener userId del cuerpo de la petición
            const { userId, ...vehicleData } = req.body;

            if (!userId) {
                res.status(400).json({ 
                    error: 'Se requiere userId' 
                });
                return;
            }

            if (!vehicleData.licensePlate || !vehicleData.brand || !vehicleData.model) {
                res.status(400).json({ 
                    error: 'Faltan campos requeridos: licensePlate, brand, model' 
                });
                return;
            }

            const newVehicle = await this.vehicleService.createVehicle(userId, vehicleData);

            res.status(201).json(newVehicle);
        } catch (error) {
            console.error('Error en create:', error);
            res.status(500).json({ 
                error: 'Error al crear el vehículo' 
            });
        }
    };

    // GET /api/vehicles/:userId
    getByUser = async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId } = req.params;

            if (!userId) {
                res.status(400).json({ 
                    error: 'Se requiere userId' 
                });
                return;
            }

            const vehicles = await this.vehicleService.getVehiclesByUserId(userId);

            res.status(200).json(vehicles);
        } catch (error) {
            console.error('Error en getByUser:', error);
            res.status(500).json({ 
                error: 'Error al obtener los vehículos' 
            });
        }
    };

    // PUT /api/vehicles/:id
    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const updatedVehicle = await this.vehicleService.updateVehicle(id, updates);

            res.status(200).json(updatedVehicle);
        } catch (error) {
            console.error('Error en update:', error);
            res.status(500).json({ 
                error: 'Error al actualizar el vehículo' 
            });
        }
    };

    // DELETE /api/vehicles/:id
    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            await this.vehicleService.deleteVehicle(id);

            res.status(200).json({ 
                message: 'Vehículo eliminado correctamente' 
            });
        } catch (error) {
            console.error('Error en delete:', error);
            res.status(500).json({ 
                error: 'Error al eliminar el vehículo' 
            });
        }
    };
}