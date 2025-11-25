import { Router } from "express";
import { db } from "../config/firebaseAdmin";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Obtener vehículos del usuario autenticado
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.uid;

    const snapshot = await db
      .collection("vehicles")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const vehicles = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.json({ success: true, vehicles });
  } catch (error) {
    console.log("Error obteniendo vehículos:", error);
    return res.status(500).json({ success: false, message: "Error al obtener vehículos" });
  }
});

export default router;
