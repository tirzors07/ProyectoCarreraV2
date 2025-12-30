import { pool } from "../db/mysql.js";
import { sendToESP32Root } from "../tcp/esp32_root_server.js";
import { io } from "../../index.js";

async function calcularTraceroute(macOrigen) {
    try {
        // Obtener todos los links
        const [links] = await pool.query(
            "SELECT parent_mac, child_mac FROM mesh_links"
        );
        // Obtener todos los nodos con sus alias
        const [nodes] = await pool.query(
            "SELECT mac, role, alias FROM mesh_nodes"
        );
        // Crear mapa de child -> parent
        const parentMap = {};
        links.forEach(link => {
            parentMap[link.child_mac] = link.parent_mac;
        });
        // Crear mapa de mac -> alias
        const aliasMap = {};
        nodes.forEach(node => {
            aliasMap[node.mac] = node.alias || node.mac;
        });
        // Reconstruir el path desde origen hasta root
        const path = [];
        let current = macOrigen;
        let intentos = 0;
        const MAX_INTENTOS = 20; // Evitar loops infinitos
        // Agregar el nodo origen
        path.push({
            mac: current,
            alias: aliasMap[current] || "Desconocido"
        });
        // Seguir subiendo hasta encontrar el root
        while (current && intentos < MAX_INTENTOS) {
            const parent = parentMap[current];
            if (!parent) {// Ya llegamos al root (no tiene padre)
                break;
            }
            path.push({
                mac: parent,
                alias: aliasMap[parent] || "Desconocido"
            });
            current = parent;
            intentos++;
        }
        return path;
    } catch (err) {
        console.error("Error calculando traceroute:", err);
        return [];
    }
}

export const AlertsService = {
    async guardarAlerta(mac) {
        try {
            // Obtener alias del nodo
            const [rows] = await pool.query(
                "SELECT alias FROM mesh_nodes WHERE mac = ?",
                [mac]
            );
            const alias = rows.length ? rows[0].alias : "Desconocido";
            // Calcular el traceroute
            const pathArray = await calcularTraceroute(mac);
            const pathString = pathArray
                .map(p => `${p.alias} (${p.mac})`)
                .join(" → ");
            
            console.log("Traceroute calculado:", pathString);
            // Insertar alerta
            const sql = "INSERT INTO mesh_alerts (mac, alias, path) VALUES (?, ?, ?)";
            const [result] = await pool.query(sql, [mac, alias, pathString]);
              // obtener alerta completa (con role y fecha)
            const [alertRows] = await pool.query(`
                SELECT a.id, a.mac, a.alias, n.role, a.created_at, a.path
                FROM mesh_alerts a
                LEFT JOIN mesh_nodes n ON n.mac = a.mac
                WHERE a.id = ?
            `, [result.insertId]);
            const alert = alertRows[0];
            io.emit("new_alert", alert);
            // Opcional: enviar alerta al root ESP32
            sendToESP32Root(`ALERTA:${mac}|${alias}`);
            return result.insertId;
        } catch (err) {
            console.error("Error guardando alerta:", err);
            throw err;
        }
    },
    async obtenerAlertas() {
        const sql = `
            SELECT a.id, a.mac, a.alias, n.role, a.created_at, a.path
            FROM mesh_alerts a
            LEFT JOIN mesh_nodes n ON n.mac = a.mac
            ORDER BY a.created_at ASC
            LIMIT 100
        `;
        const [rows] = await pool.query(sql);
        return rows;
    },
    async borrarAlertas() {
        const sql = "DELETE FROM mesh_alerts";
        await pool.query(sql);
    }
};
