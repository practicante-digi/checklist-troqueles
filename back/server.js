import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import winston from 'winston';
import https from 'https';
import fs from 'fs';

import { connectDB } from './config/db.js';
import { logger } from './config/logger.js';

import troquelRoutes from './routes/troquel.routes.js';
import mantenimientoRoutes from './routes/mantenimiento.routes.js';
import usuarioRoutes from './routes/usuario.routes.js';
import actividadRoutes from './routes/actividad.routes.js';
import historialRoutes from './routes/historial.routes.js';

// --- Configuración de Módulos ES para __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// En desarrollo, también log a consola
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());

// Helmet con configuración de seguridad completa
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            frameSrc: ["'self'", "https://app.powerbi.com", "https://*.powerbi.com"],
            connectSrc: ["'self'", "https://dc.services.visualstudio.com"],
            imgSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false,
    hidePoweredBy: true,
    hsts: false,
    noSniff: true,
    frameguard: false,
    xssFilter: true
}));

app.use(express.json({ limit: '10mb' })); // Límite de payload

// Sirve los archivos estáticos desde la carpeta '../client'
app.use(express.static(path.join(__dirname, '../client')));

// API Routes
app.use('/api/troqueles', troquelRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);
app.use('/api/users', usuarioRoutes);
app.use('/api/actividades', actividadRoutes);
app.use('/api/historial', historialRoutes);


app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../client/pages/dashboard.html')));

/// --- Inicia el Servidor HTTPS ---
const httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

connectDB().then(() => {
    https.createServer(httpsOptions, app).listen(port, () => {
        console.log(`Servidor escuchando en https://localhost:${port}`);
        console.log(`Accede al frontend en https://localhost:${port}`);
        console.log(`Monitor (Dashboard) disponible en https://localhost:${port}/dashboard`);
    });
}).catch(error => {
    console.error('Error fatal al iniciar el servidor:', error);
    process.exit(1);
});

