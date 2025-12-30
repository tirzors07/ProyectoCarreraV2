import { pool } from "../db/mysql.js";
import { MeshService } from "../services/mesh-service.js";

export function initMeshSocket(io) {
    io.on("connection", socket => {
        console.log(":: Socket Mesh conectado");
        socket.on("apply_mesh", async () => {
            console.log(":: Apply_mesh recibido desde FRONT");
            try {
                await MeshService.applyMesh();
            } catch (err) {
                console.error(":: Error aplicando mesh:", err);
            }
        });
        socket.on("mesh_link_added", async ({ parent, child }) => {
            try {
                console.log(`:: Link agregado: ${parent} -> ${child}`);
                // El child solo puede tener UN padre
                const [existing] = await pool.query(
                    "SELECT 1 FROM mesh_links WHERE child_mac = ?",
                    [child]
                );
                if (existing.length > 0) {
                    console.warn("Este nodo ya tiene padre");
                    return;
                }
                // Evitar ciclo directo
                const [inverse] = await pool.query(
                    "SELECT 1 FROM mesh_links WHERE parent_mac = ? AND child_mac = ?",
                    [child, parent]
                );
                if (inverse.length > 0) {
                    console.warn("Enlace cíclico detectado");
                    return;
                }
                // VALIDACIÓN DURA POR ROLES (AQUÍ VA)
                const [[parentNode]] = await pool.query(
                    "SELECT role FROM mesh_nodes WHERE mac = ?",
                    [parent]
                );
                const [[childNode]] = await pool.query(
                    "SELECT role FROM mesh_nodes WHERE mac = ?",
                    [child]
                );
                if (!parentNode || !childNode) {
                    console.warn("Nodo inexistente");
                    return;
                }
                // Reglas de mesh
                if (parentNode.role === "leaf") {
                    console.warn("Un leaf NO puede ser padre");
                    return;
                }
                if (childNode.role === "root") {
                    console.warn("El root NO puede ser hijo");
                    return;
                }
                const PRIORITY = {
                    root: 3,
                    intermediario: 2,
                    leaf: 1
                };
                if (PRIORITY[parentNode.role] <= PRIORITY[childNode.role]) {
                    console.warn("Jerarquía inválida");
                    return;
                }
                // INSERT FINAL (YA VALIDADO)
                await pool.query(
                    "INSERT INTO mesh_links (parent_mac, child_mac) VALUES (?, ?)",
                    [parent, child]
                );
                //44.1D.64.F7.0B.90        CC.7B.5C.27.D3.64
                console.log("Link guardado correctamente");
            } catch (err) {
                console.error(":: Error guardando link:", err.message);
            }
        });

    });
}
