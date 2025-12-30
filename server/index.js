import express from 'express';
import cookieParser from 'cookie-parser';
import { PORT } from './src/config/config.js';
import { authMiddleware } from './src/middleware/auth-middleware.js';
import authRoutes from './src/routes/auth-routes.js';
import meshRoutes from './src/routes/mesh-routes.js';
import { Server } from "socket.io";
import path from 'path';
import { fileURLToPath } from 'url';
import { startESP32RootServer } from './src/tcp/esp32_root_server.js';
import { initMeshSocket } from './src/sockets/mesh-socket.js';
import { pool } from "./src/db/mysql.js";
import alertsRouter from "./src/routes/alerts.js";


// Crear app y HTTP server
const app = express();
const httpServer = app.listen(PORT, '0.0.0.0',() => {
    console.log(`HTTP Server running on port ${PORT}`);
});
export const io = new Server(httpServer, {
    cors: { origin: "*" }
});
io.on("connection", (socket) => {
    console.log("Frontend conectado a WS");
});

startESP32RootServer(io);
initMeshSocket(io);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(cookieParser());
app.use(authMiddleware);

app.use(express.static(path.join(__dirname, '/../client/')));
app.get('/', (req, res) => { 
    res.sendFile(path.join(__dirname, '/../client/index.html'));
})
app.use('/', authRoutes);
app.get('/protected', (req, res) => { //aqui cuando ya se logueo
    res.sendFile(path.join(__dirname, '/../client/protected.html'));
});
//rutas mesh
app.use("/mesh", meshRoutes);

app.use("/api/mesh", meshRoutes);
app.use("/api/alerts", alertsRouter);