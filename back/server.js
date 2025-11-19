import express from 'express';
import mssql from 'mssql';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import Joi from 'joi';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import https from 'https';
import fs from 'fs';

// --- Configuración de Módulos ES para __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// --- Configuración de Winston Logger ---
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'sistema-troqueles' },
    transports: [
        // Archivo para errores críticos
        new DailyRotateFile({
            filename: 'logs/error-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d'
        }),
        // Archivo para eventos de seguridad y auditoría
        new DailyRotateFile({
            filename: 'logs/security-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            level: 'warn',
            maxSize: '20m',
            maxFiles: '30d'
        }),
        // Archivo general de actividad
        new DailyRotateFile({
            filename: 'logs/app-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d'
        })
    ]
});

// En desarrollo, también log a consola
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

const app = express();
const port = process.env.PORT || 3000;

// Límite ESTRICTO para crear o borrar
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 50, // 50 acciones (iniciar/finalizar/borrar) por IP cada 15 min
    message: 'Demasiadas acciones desde esta IP, intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false
});

// Límite más relajado para leer datos
const getLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // 200 lecturas por IP cada 15 min
    message: 'Demasiadas solicitudes desde esta IP, intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false
});

// --- Middlewares ---
app.use(cors());

// Helmet con configuración de seguridad completa
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.tailwindcss.com",
                "https://cdn.jsdelivr.net"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdn.tailwindcss.com",
                "https://cdn.jsdelivr.net"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com"
            ],
            frameSrc: [
                "'self'",
                "https://app.powerbi.com",
                "https://*.powerbi.com"
            ],
            connectSrc: ["'self'", "https://dc.services.visualstudio.com"],
            imgSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false, // Para compatibilidad
    hidePoweredBy: true, // Oculta X-Powered-By: Express
    hsts: false,
    noSniff: true,
    frameguard: false, // Deshabilitar frameguard para permitir iframes
    xssFilter: true
}));

app.use(express.json({ limit: '10mb' })); // Límite de payload

// Sirve los archivos estáticos desde la carpeta '../client'
app.use(express.static(path.join(__dirname, '../client')));

// --- Configuración de la Base de Datos ---
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: process.env.NODE_ENV === 'production',
        enableArithAbort: true,
        trustServerCertificate: process.env.NODE_ENV !== 'production' // Para desarrollo local
    }
}

let pool;
async function connectDB() {
    try {
        if (!pool) {
            pool = await mssql.connect(dbConfig);
        }
        return pool;
    } catch (error) {
        throw error; // Lanza el error para que sea capturado por las rutas
    }
}

// --- Esquemas de Validación con Joi ---
const schemaIniciarMantenimiento = Joi.object({
    idTroquel: Joi.number().integer().positive().required(),
    idUsuario: Joi.number().integer().positive().required()
});

const schemaActividad = Joi.object({
    id: Joi.number().integer().positive().required(),
    status: Joi.string().valid('Completado', 'No Completado', 'No Aplica').required(),
    comment: Joi.string().max(500).allow('').optional() // Máximo 500 caracteres
});

const schemaFinalizarMantenimiento = Joi.object({
    idMantenimiento: Joi.number().integer().positive().required(),
    actividadesCompletadas: Joi.array().items(schemaActividad).min(1).required()
});

// Middleware de validación
const validarEsquema = (esquema) => {
    return (req, res, next) => {
        const { error } = esquema.validate(req.body, { 
            abortEarly: false, // Muestra todos los errores, no solo el primero
            stripUnknown: true // Elimina campos no definidos en el esquema
        });
        
        if (error) {
            const errores = error.details.map(detail => ({
                campo: detail.path.join('.'),
                mensaje: detail.message
            }));
            
            // Log del intento de datos maliciosos
            logger.warn('Datos inválidos detectados', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                url: req.originalUrl,
                method: req.method,
                errores: errores,
                payload: req.body,
                timestamp: new Date().toISOString(),
                type: 'VALIDATION_ERROR'
            });
            
            return res.status(400).json({ 
                error: 'Datos de entrada inválidos', 
                detalles: errores 
            });
        }
        
        next();
    };
};

// RUTAS "GET" (Para cargar datos al formulario)

// GET: Obtiene ls lista de Troqueles
app.get('/api/troqueles', getLimiter, async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .query(`
                SELECT idTroquel, Codigo
                FROM Mantenimiento.Troqueles
                WHERE bActivo = 1
                ORDER BY Codigo
            `);
        res.json(result.recordset);
    }
    catch (error) {
        res.status(500).json({ error: 'Error al obtener los troqueles' });
    }
});

// GET: Obtiene la lista de Técnicos (Usuarios)
app.get('/api/users', getLimiter, async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .query(`
                SELECT idUsuario, Nombre
                FROM Mantenimiento.Usuarios 
                WHERE bActivo = 1 
                ORDER BY Nombre;
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send('Error al obtener los técnicos');
    }
});

// GET: Obtiene todas las actividades del Checklist
app.get('/api/actividades', getLimiter, async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .query(`
                SELECT 
                    c.idCheckList AS id, 
                    c.Actividad AS label, 
                    t.Tipo_Mantenimiento AS tipo
                FROM Mantenimiento.CheckList c
                JOIN Mantenimiento.TiposMantenimiento t ON c.idTipoMantenimiento = t.idTipoMantenimiento
                WHERE c.bActivo = 1
            `);

        // Transforma la lista plana de SQL en el objeto que el frontend espera
        const actividades = {
            preventivo: [],
            correctivo: [],
            antesProduccion: []
        };

        result.recordset.forEach(row => {
            const task = { 
                id: row.id, 
                label: row.label, 
                status: null, 
                comment: "" 
            };
            
            if (row.tipo === 'Preventivo') {
                actividades.preventivo.push(task);
            } else if (row.tipo === 'Correctivo') {
                actividades.correctivo.push(task);
            } else {
                actividades.antesProduccion.push(task);
            }
        });

        res.json(actividades);

    } catch (err) {
        res.status(500).send('Error al obtener las actividades');
    }
});


// RUTAS "POST" (Para mantenimiento en dos pasos: Iniciar y Finalizar)

// POST: Iniciar un nuevo mantenimiento (Paso 1)
app.post('/api/mantenimiento/iniciar', apiLimiter, validarEsquema(schemaIniciarMantenimiento), async (req, res) => {
    const { idTroquel, idUsuario } = req.body;

    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .input('idTroquel', mssql.Int, idTroquel)
            .input('idUsuario', mssql.Int, idUsuario)
            .query(`
                INSERT INTO Mantenimiento.Mantenimiento (idTroquel, Inicio, Fin, idUsuario)
                OUTPUT INSERTED.idMantenimiento
                VALUES (@idTroquel, GETDATE(), NULL, @idUsuario);
            `);
        
        const idMantenimiento = result.recordset[0].idMantenimiento;

        // Log del evento de seguridad
        logger.info('Mantenimiento iniciado', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            idMantenimiento: idMantenimiento,
            idTroquel: idTroquel,
            idUsuario: idUsuario,
            timestamp: new Date().toISOString(),
            type: 'MANTENIMIENTO_INICIADO'
        });

        res.status(201).json({ 
            message: 'Mantenimiento iniciado con éxito', 
            idMantenimiento: idMantenimiento 
        });

    } catch (err) {
        logger.error('Error al iniciar mantenimiento', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            error: err.message,
            stack: err.stack,
            payload: req.body,
            timestamp: new Date().toISOString(),
            type: 'DATABASE_ERROR'
        });
        res.status(500).json({ message: 'Error al iniciar el mantenimiento.' });
    }
});

// POST: Finalizar un mantenimiento existente
app.post('/api/mantenimiento/finalizar', apiLimiter, validarEsquema(schemaFinalizarMantenimiento), async (req, res) => {
    const { idMantenimiento, actividadesCompletadas } = req.body;

    const dbPool = await connectDB();
    const transaction = new mssql.Transaction(dbPool);

    try {
        await transaction.begin();

        // Actualiza el registro de Mantenimiento con la hora de Fin
        const requestUpdate = new mssql.Request(transaction);
        await requestUpdate
            .input('idMantenimiento', mssql.BigInt, idMantenimiento)
            .query(`
                UPDATE Mantenimiento.Mantenimiento
                SET Fin = GETDATE()
                WHERE idMantenimiento = @idMantenimiento;
            `);

        // Prepara la inserción de Detalles
        const psDetalle = new mssql.PreparedStatement(transaction);
        psDetalle.input('idMantenimiento', mssql.BigInt);
        psDetalle.input('idCheckList', mssql.Int);
        psDetalle.input('Estado', mssql.NVarChar(50));
        psDetalle.input('Comentario', mssql.NVarChar(500));
        
        await psDetalle.prepare(`
            INSERT INTO Mantenimiento.Mantenimiento_Detalle (idMantenimiento, idCheckList, Estado, Comentario)
            VALUES (@idMantenimiento, @idCheckList, @Estado, @Comentario);
        `);

        // Inserta cada actividad completada
        for (const actividad of actividadesCompletadas) {
            await psDetalle.execute({
                idMantenimiento: idMantenimiento,
                idCheckList: actividad.id,
                Estado: actividad.status,
                Comentario: actividad.comment
            });
        }
        await psDetalle.unprepare();

        // Confirma la transacción
        await transaction.commit();

        // Log del evento de seguridad
        logger.info('Mantenimiento finalizado', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            idMantenimiento: idMantenimiento,
            cantidadActividades: actividadesCompletadas.length,
            timestamp: new Date().toISOString(),
            type: 'MANTENIMIENTO_FINALIZADO'
        });

        res.status(200).json({ 
            message: 'Mantenimiento finalizado con éxito', 
            idMantenimiento: idMantenimiento 
        });

    } catch (err) {
        await transaction.rollback();
        res.status(500).json({ message: 'Error al finalizar. Se revirtieron los cambios.' });
    }
});

// Validación para parámetros de URL
const validarIdParam = (req, res, next) => {
    const { id } = req.params;
    const schema = Joi.number().integer().positive().required();
    const { error } = schema.validate(parseInt(id));
    
    if (error) {
        return res.status(400).json({ 
            error: 'ID inválido', 
            mensaje: 'El ID debe ser un número entero positivo' 
        });
    }
    
    next();
};

// DELETE: Elimina un mantenimiento existente
app.delete('/api/mantenimiento/:id', apiLimiter, validarIdParam, async (req, res) => {
    const { id } = req.params;

    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .input('idMantenimiento', mssql.BigInt, id)
            .query(`
                DELETE FROM Mantenimiento.Mantenimiento
                WHERE idMantenimiento = @idMantenimiento;
            `);

        if (result.rowsAffected[0] === 0) {
            logger.warn('Intento de eliminar mantenimiento inexistente', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                idMantenimiento: id,
                timestamp: new Date().toISOString(),
                type: 'DELETE_NOT_FOUND'
            });
            return res.status(404).json({ message: 'Mantenimiento no encontrado.' });
        }

        // Log del evento crítico de eliminación
        logger.warn('Mantenimiento eliminado', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            idMantenimiento: id,
            timestamp: new Date().toISOString(),
            type: 'MANTENIMIENTO_ELIMINADO'
        });

        res.status(200).json({ message: 'Mantenimiento eliminado con éxito.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el mantenimiento.' });
    }
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dashboard.html'));
})

const httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

connectDB().then(() => {
    https.createServer(httpsOptions, app).listen(port, () => {
        console.log(`Servidor escuchando en http://localhost:${port}`);
        console.log(`Accede al frontend en http://localhost:${port}`);
        console.log(`Monitor (Dashboard) disponible en http://localhost:${port}/dashboard`);
    });
}).catch(error => {
    console.error('Error fatal al iniciar el servidor:', error);
    process.exit(1); 
});

