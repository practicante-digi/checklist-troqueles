// controllers/actividad.controller.js
import { connectDB } from '../config/db.js';

export const getActividades = async (req, res) => {
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

        // Transformación de datos para el frontend
        const actividades = {
            preventivo: [],
            correctivo: [],
            antesProduccion: []
        };

        result.recordset.forEach(row => {
            const task = { id: row.id, label: row.label, status: null, comment: "" };

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
        console.error('Error al obtener las actividades:', err);
        res.status(500).send('Error al obtener las actividades');
    }
};