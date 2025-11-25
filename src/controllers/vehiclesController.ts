import { Request, Response } from "express";
import { db } from "../config/firebaseAdmin";

export const getUserVehicles = async (req: Request, res: Response) => {
  try {
    const authenticatedUser: any = (req as any).user;

    if (!authenticatedUser || !authenticatedUser.uid) {
      return res.status(401).json({
        success: false,
        message: "Usuario no autenticado"
      });
    }

    const userId = authenticatedUser.uid;

    const snapshot = await db
      .collection("vehicles")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const vehicles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({
      success: true,
      vehicles,
    });

  } catch (error) {
    console.error("Error al obtener vehículos:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
};
