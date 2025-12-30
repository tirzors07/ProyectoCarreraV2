import net from "net";
import { pool } from "../db/mysql.js";
import nodemailer from "nodemailer";
import { TCP_PORT, VALID_CLIENT_ID } from "../config/config.js";
import { AlertsService } from "../services/alerts.js";

const clients = new Map(); // clientId -> socket
let rootMac = null;
const ROLE_MAP = {
    0: "root", // DISP_COLABORADOR
    1: "intermediario",          // DISP_USUARIO
    2: "baliza"           // DISP_BALIZA
};
export function startESP32RootServer(io) {
    const server = net.createServer(socket => {
        console.log("ESP32 Root connected:", socket.remoteAddress);
        socket.setEncoding("utf8");
        socket.setKeepAlive(true, 10000);
        socket.on("data", async raw => {
            const data = raw.trim();
            console.log("[RX]", data);
            // LOGIN PROTOCOL
            // ESP32 sends: RAV:a1282016:L:S:Login al server
            if (data.startsWith("RAV:") && data.includes(":L:S:")) {
                const parts = data.split(":");
                const clientId = parts[1];

                if (clientId !== VALID_CLIENT_ID) {
                    socket.write("NACK\n");
                    socket.destroy();
                    return;
                }
                console.log("Login OK from", clientId);
                socket.write("ACK\n");
                // SI YA EXISTE SOCKET, CIERRALO
                //cFIX: Cerrar socket anterior correctamente
                const oldEntry = clients.get(clientId);
                if (oldEntry) {
                    if (oldEntry.socket && !oldEntry.socket.destroyed) {
                        console.log("Reemplazando socket TCP previo del root");
                        try {
                            oldEntry.socket.destroy();
                        } catch (err) {
                            console.warn("Error cerrando socket anterior:", err.message);
                        }
                    }
                }
                //clients.set(clientId, socket);
                clients.set(clientId, { socket, notified: false });
                console.log("Socket guardado para cliente:", clientId);
                return;
            }
            // KEEP-ALIVE
            // ESP32 sends: RAV:a1282016:K:S:Keep-Alive al server
            if (data.includes(":K:S:")) {
                socket.write("ACK\n");
                return;
            }
            if (data.startsWith("REGISTRAR_CONEXION:")) {
                const mac = data.split(":")[1];
                const clientEntry = Array.from(clients.values()).find(c => c.socket === socket);
                if (!clientEntry) return;
                
                try {
                    // Verificar si ya existe en DB
                    const [existing] = await pool.query(
                        "SELECT mac, role, x, y FROM mesh_nodes WHERE mac = ?",
                        [mac]
                    );
                    if (existing.length > 0) {
                        // Ya existe, solo actualizar que es root
                        await pool.query(
                            "UPDATE mesh_nodes SET role='root' WHERE mac = ?",
                            [mac]
                        );
                        console.log("Root ya registrado previamente, reconexión aceptada");
                        clientEntry.notified = true;
                        return; //NO emitir evento, ya existe en frontend
                    }
                    // NO existe, insertar nuevo
                    await pool.query(
                        "INSERT INTO mesh_nodes (mac, role, x, y) VALUES (?, 'root', ?, ?)",
                        [mac, 200, 100]
                    );
                    // Obtener el nodo recién insertado con sus coordenadas de DB
                    const [[node]] = await pool.query(
                        "SELECT mac, role, x, y FROM mesh_nodes WHERE mac = ?",
                        [mac]
                    );
                    // Emitir evento CON las coordenadas de DB
                    io.emit("node_registered", {
                        id: node.mac,
                        rol: node.role,
                        x: node.x,
                        y: node.y,
                        alias: ""
                    });
                    console.log("Root registrado y emitido:", node.mac);
                    clientEntry.notified = true;
                } catch (err) {
                    console.error("Error registrando root:", err);
                }
                return;
            }
            if (data.startsWith("AGREGAR_NODO:")) {
                const parts = data.split(":");
                const mac = parts[1];
                const roleNum = parts[2] !== undefined ? parseInt(parts[2], 10) : 0;
                const role = ROLE_MAP[roleNum] ?? "intermediario";
                const alias = parts[3] ?? "";
                
                try {
                    //Verificar si ya existe
                    const [existing] = await pool.query(
                        "SELECT mac, role, alias, x, y FROM mesh_nodes WHERE mac = ?",
                        [mac]
                    );
                    if (existing.length > 0) {
                        // Ya existe, solo actualizar role y alias
                        await pool.query(
                            "UPDATE mesh_nodes SET role=?, alias=? WHERE mac = ?",
                            [role, alias, mac]
                        );
                        console.log(`Nodo ${mac} ya existía, actualizado`);
                        return; //NO emitir evento, ya existe en frontend
                    }
                    // NO existe, generar coordenadas e insertar
                    const { x, y } = await generarCoordenadasSinColision();
                    await pool.query(
                        "INSERT INTO mesh_nodes (mac, role, alias, x, y) VALUES (?, ?, ?, ?, ?)",
                        [mac, role, alias, x, y]
                    );
                    //Obtener el nodo con sus coordenadas de DB
                    const [[node]] = await pool.query(
                        "SELECT mac, role, alias, x, y FROM mesh_nodes WHERE mac = ?",
                        [mac]
                    );
                    // Emitir evento CON las coordenadas de DB
                    io.emit("node_registered", {
                        id: node.mac,
                        rol: node.role,
                        alias: node.alias,
                        x: node.x,
                        y: node.y
                    });
                    console.log(`Nuevo nodo agregado: ${mac} (${role}) alias=${alias}`);
                } catch (err) {
                    console.error("Error agregando nodo:", err);
                }
                return;
            }
            if (data.startsWith("RAV:")) {
                console.log("RAV Frame Received:", data);
                return;
            }
            if (data.startsWith("ALERTA:")) {
                const mac = data.split(":")[1];
                console.warn("ALERTA desde nodo:", mac);
                try {
                    await AlertsService.guardarAlerta(mac);
                    // El servicio ya emite "new_alert" automáticamente
                    await enviarCorreoAlerta(mac, ""); // El servicio ya tiene el alias
                } catch (err) {
                    console.error("Error guardando alerta desde TCP:", err);
                }
                return;
            }
            console.log("Unknown data:", data);
        });
        socket.on("close", () => console.log("ESP32 Root disconnected"));
        socket.on("error", err => {
            if (err.code === "ECONNRESET") {
                console.warn("TCP reset por ESP32 (reconexión normal)");
            } else {
                console.error("TCP error:", err.message);
            }
        });

    });
    server.listen(TCP_PORT, '0.0.0.0', () =>
        console.log("TCP Server running on port", TCP_PORT)
    );
}
// API para enviar comando al root
export function sendToESP32Root(msg) {
    const clientEntry = clients.get(VALID_CLIENT_ID);
    if (!clientEntry) return false;
    clientEntry.socket.write(msg + "\n"); // <-- acceder al socket real
    return true;
}
// Configuración del transporte SMTP
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",   // Ej. smtp.gmail.com
    port: 587,                     // 465 para SSL, 587 para TLS
    secure: false,                 // true para SSL
    auth: {
        user: "tirzors07@gmail.com",
        pass: "bubx hvml eidg mfww"
    },
    tls: {
        rejectUnauthorized: false
    }
});
async function enviarCorreoAlerta(mac, alias) {
    try {
        // Si no recibimos alias, obtenerlo
        if (!alias) {
            const [rows] = await pool.query(
                "SELECT alias FROM mesh_nodes WHERE mac = ?",
                [mac]
            );
            alias = rows.length ? rows[0].alias : "Desconocido";
        }
        const info = await transporter.sendMail({
            from: '"Sistema de Alertas" <tirzors07@gmail.com>',
            to: "rtirzo@uabc.edu.mx",
            subject: `Nueva alerta de nodo ${alias}`,
            text: `Se ha recibido una nueva alerta del nodo ${alias} (MAC: ${mac})`,
            html: `<p>Se ha recibido una <b>nueva alerta</b> del nodo <b>${alias}</b> (MAC: ${mac})</p>`
        });
        console.log("Correo enviado:", info.messageId);
    } catch (err) {
        console.error("Error enviando correo:", err);
    }
}
async function generarCoordenadasSinColision() {
    const [existingNodes] = await pool.query(
        "SELECT x, y FROM mesh_nodes"
    );
    let x, y, ok = false;
    let intentos = 0;
    const DISTANCIA_MIN = 80; // Distancia mínima entre nodos
    while (!ok && intentos < 50) {
        x = 100 + Math.random() * 400; // Rango: 100-500
        y = 100 + Math.random() * 300; // Rango: 100-400
        // Verificar distancia con nodos existentes
        ok = existingNodes.every(n => 
            Math.hypot(n.x - x, n.y - y) > DISTANCIA_MIN
        );
        intentos++;
    }
    // Si no encuentra posicision, usar coordenadas fijas
    if (!ok) {
        x = 300;
        y = 250;
    }
    return { x, y };
}