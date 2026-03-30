import mssql from 'mssql';
import { connectDB } from '../config/db.js';
import { logger } from '../config/logger.js'


export const iniciarMantenimiento = async (req, res) => {
    const { idTroquel, idUsuario } = req.body; // Se obtiene los IDs de la request.

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

        logger.info('Mantenimiento iniciado', {
            ip: req.ip, 
            userAgent: req.get('User-Agent'), 
            idMantenimiento, 
            idTroquel, 
            idUsuario,
            timestamp: new Date().toISOString(), 
            type: 'MANTENIMIENTO_INICIADO'
        });

        res.status(200).json({ message: 'Mantenimiento inicado con éxito', idMantenimiento })

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

        res.status(500).json({ message: 'Error al iniciar mantenimiento.' })
    }
}


export const finalizarMantenimiento = async (req, res) => {
    const { idMantenimiento, actividadesCompletadas } = req.body;

    const dbPool = await connectDB();
    const transaction = new mssql.Transaction(dbPool);

    try {
        await transaction.begin();

        const requestUpdate = new mssql.Request(transaction);
        await requestUpdate.input('idMantenimiento', mssql.BigInt, idMantenimiento)
            .query(`
                UPDATE Mantenimiento.Mantenimiento
                SET Fin = GETDATE()
                WHERE idMantenimiento = @idMantenimiento;
            `);

        const psDetalle = new mssql.PreparedStatement(transaction);
        psDetalle.input('idMantenimiento', mssql.BigInt);
        psDetalle.input('idCheckList', mssql.Int);
        psDetalle.input('Estado', mssql.NVarChar(50));
        psDetalle.input('Comentario', mssql.NVarChar(500));

        await psDetalle.prepare(`
            INSERT INTO Mantenimiento.Mantenimiento_Detalle (idMantenimiento, idCheckList, Estado, Comentario)
            VALUES (@idMantenimiento, @idCheckList, @Estado, @Comentario);
        `);

        for (const actividad of actividadesCompletadas) {
            await psDetalle.execute({
                idMantenimiento, idCheckList: actividad.id, Estado: actividad.status, Comentario: actividad.comment
            });
        }
        await psDetalle.unprepare();
        await transaction.commit();

        logger.info('Mantenimiento finalizado', {
            ip: req.ip, userAgent: req.get('User-Agent'), idMantenimiento, cantidadActividades: actividadesCompletadas.length,
            timestamp: new Date().toISOString(), type: 'MANTENIMIENTO_FINALIZADO'
        });

        res.status(200).json({ message: 'Mantenimiento finalizado con éxito', idMantenimiento });
    } catch (err) {
        await transaction.rollback();
        res.status(500).json({ message: 'Error al finalizar. Se revirtieron los cambios.' });
    }
};


export const eliminarMantenimiento = async (req, res) => {
    const { id } = req.params;

    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .input('idMantenimiento', mssql.BigInt, id)
            .query(`DELETE FROM Mantenimiento.Mantenimiento WHERE idMantenimiento = @idMantenimiento;`);

        if (result.rowsAffected[0] === 0) {
            logger.warn('Intento de eliminar mantenimiento inexistente', {
                ip: req.ip, userAgent: req.get('User-Agent'), idMantenimiento: id,
                timestamp: new Date().toISOString(), type: 'DELETE_NOT_FOUND'
            });
            return res.status(404).json({ message: 'Mantenimiento no encontrado.' });
        }

        logger.warn('Mantenimiento eliminado', {
            ip: req.ip, userAgent: req.get('User-Agent'), idMantenimiento: id,
            timestamp: new Date().toISOString(), type: 'MANTENIMIENTO_ELIMINADO'
        });

        res.status(200).json({ message: 'Mantenimiento eliminado con éxito.' });
    } catch (err) {
        res.status(500).json({ message: 'Error al eliminar el mantenimiento.' });
    }
};