import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

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
export const connectDB = async () => {
    try {
        if (!pool) {
            pool = await mssql.connect(dbConfig);
        }
        return pool;
    } catch (error) {
        throw error; // Lanza el error para que sea capturado por las rutas
    }
}