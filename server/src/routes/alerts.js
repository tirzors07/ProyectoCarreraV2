import { Router } from "express";
import { AlertsService } from "../services/alerts.js";

const router = Router();

// Guardar alerta
router.post("/", async (req, res) => {
    const { mac } = req.body;
    try {
        const id = await AlertsService.guardarAlerta(mac);
        res.json({ ok: true, id });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Obtener alertas
router.get("/", async (req, res) => {
    try {
        const alerts = await AlertsService.obtenerAlertas();
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// Borrar alertas
router.delete("/", async (req, res) => {
    try {
        await AlertsService.borrarAlertas();
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

export default router;
