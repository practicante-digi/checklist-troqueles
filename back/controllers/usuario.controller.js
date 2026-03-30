import { connectDB } from '../config/db.js'

export const getUsuarios = async (req, res) => {
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
        console.error('Error al obtener los técnicos:', err);
        res.status(500).send('Error al obtener los técnicos');
    }
};