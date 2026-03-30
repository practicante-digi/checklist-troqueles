import mssql from 'mssql';
import { connectDB } from '../config/db.js';
import { logger } from '../config/logger.js';

export const getHistorial = async (req, res) => {
    try {
        const { tecnico, troquel, desde, hasta, page = 1, limit = 50 } = req.query;
        const dbPool = await connectDB();
        const request = dbPool.request();

        let conditions = [];

        if (tecnico) {
            request.input('NombreTecnico', mssql.NVarChar(100), tecnico);
            conditions.push('NombreTecnico = @NombreTecnico');
        }
        if (troquel) {
            request.input('CodigoTroquel', mssql.NVarChar(100), troquel);
            conditions.push('CodigoTroquel = @CodigoTroquel');
        }
        if (desde) {
            request.input('desde', mssql.Date, desde);
            conditions.push('CAST(Inicio AS DATE) >= @desde');
        }
        if (hasta) {
            request.input('hasta', mssql.Date, hasta);
            conditions.push('CAST(Inicio AS DATE) <= @hasta');
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        request.input('offset', mssql.Int, offset);
        request.input('limit', mssql.Int, parseInt(limit));

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query de conteo total
        const countResult = await request.query(`
            SELECT COUNT(*) AS total
            FROM Mantenimiento.vw_HistorialMantenimientos
            ${whereClause}
        `);
        const total = countResult.recordset[0].total;

        // Query de datos con paginación
        const request2 = dbPool.request();
        if (tecnico) request2.input('NombreTecnico', mssql.NVarChar(100), tecnico);
        if (troquel) request2.input('CodigoTroquel', mssql.NVarChar(100), troquel);
        if (desde) request2.input('desde', mssql.Date, desde);
        if (hasta) request2.input('hasta', mssql.Date, hasta);
        request2.input('offset', mssql.Int, offset);
        request2.input('limit', mssql.Int, parseInt(limit));

        const dataResult = await request2.query(`
            SELECT *
            FROM Mantenimiento.vw_HistorialMantenimientos
            ${whereClause}
            ORDER BY Inicio DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({
            data: dataResult.recordset,
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
        });

    } catch (err) {
        logger.error('Error al obtener historial', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Error al obtener el historial de mantenimientos' });
    }
};

export const getDetalleHistorial = async (req, res) => {
    const { id } = req.params;
    try {
        const dbPool = await connectDB();

        const infoResult = await dbPool.request()
            .input('idMantenimiento', mssql.BigInt, id)
            .query(`SELECT * FROM Mantenimiento.vw_HistorialMantenimientos WHERE idMantenimiento = @idMantenimiento`);

        if (infoResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Mantenimiento no encontrado' });
        }

        const detalleResult = await dbPool.request()
            .input('idMantenimiento', mssql.BigInt, id)
            .query(`
                SELECT d.idCheckList, c.Actividad, tm.Tipo_Mantenimiento AS TipoMantenimiento, d.Estado, d.Comentario
                FROM Mantenimiento.Mantenimiento_Detalle d
                JOIN Mantenimiento.CheckList c ON d.idCheckList = c.idCheckList
                JOIN Mantenimiento.TiposMantenimiento tm ON c.idTipoMantenimiento = tm.idTipoMantenimiento
                WHERE d.idMantenimiento = @idMantenimiento
                ORDER BY tm.Tipo_Mantenimiento, c.Actividad
            `);

        res.json({ info: infoResult.recordset[0], actividades: detalleResult.recordset });
    } catch (err) {
        logger.error('Error al obtener detalle de mantenimiento', { error: err.message, idMantenimiento: id });
        res.status(500).json({ error: 'Error al obtener el detalle del mantenimiento' });
    }
};