import { Router } from "express";
import { MeshService } from "../services/mesh-service.js";
import { pool } from "../db/mysql.js";

const router = Router();

//assign parent
router.post("/setParent", (req, res) => {
    const { child, parent, depth } = req.body;
    MeshService.setParent(child, parent, depth);
    res.json({ ok: true });
});

router.post("/sendMessage", (req, res) => {
    const { dst, msg } = req.body;
    MeshService.sendMessage(dst, msg);
    res.json({ ok: true });
});
router.post("/sendAlert", (req, res) => {
    MeshService.sendAlert();
    res.json({ ok: true });
});
router.get("/nodes", async (req, res) => {
    const [rows] = await pool.query(
        "SELECT mac, role, alias, x, y FROM mesh_nodes"
    );
    res.json(rows);
});
router.get("/links", async (req, res) => {
    const [rows] = await pool.query(
        "SELECT parent_mac, child_mac FROM mesh_links"
    );
    res.json(rows);
});
export default router;