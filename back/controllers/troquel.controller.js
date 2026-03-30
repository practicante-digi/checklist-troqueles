import mssql from 'mssql';
import QRCode from 'qrcode';
import { connectDB } from "../config/db.js";   
import { logger } from '../config/logger.js';

const APP_BASE_URL = process.env.APP_BASE_URL || `https://localhost:${process.env.PORT || 3000}`;

export const getTroqueles = async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
        .query(`
            WITH Componentes AS
            (
                SELECT DISTINCT
                       Materiales.idMaterial AS idComponente
                      ,Materiales.ClaveMaterial
                      ,Materiales.idTipoMaterial
                      ,Troquel_Materiales.idTroquel
                FROM   WaPP.Mantenimiento.Troquel_Materiales
                       LEFT JOIN EPS.dbo.tblMaterial AS Materiales
                              ON Materiales.idMaterial = Troquel_Materiales.idMaterial
            )
            SELECT   
                     Troqueles.idTroquel
                    ,Troqueles.Codigo
                    ,MIN(Clientes.NombreCliente) AS Cliente
                    ,CASE WHEN MIN(Demanda.IdComponente) IS NULL THEN 0 ELSE 1 END AS TieneDemanda
                    ,MIN(Componentes.ClaveMaterial) AS ClaveMaterial -- <-- ¡AQUÍ ESTÁ LA MAGIA NUEVA!
            FROM     WaPP.Mantenimiento.Troqueles AS Troqueles
                     
                     LEFT JOIN Componentes
                            ON Componentes.idTroquel = Troqueles.idTroquel
                     
                     LEFT JOIN EPS.AppProc.tblDemandaExplosionada AS Demanda
                            ON Demanda.IdComponente = Componentes.idComponente
                     
                     LEFT JOIN EPS.dbo.tblCliente AS Clientes
                            ON Clientes.idCliente = Demanda.IdCliente
                           AND Clientes.idCliente <> 2683
            
            WHERE    Troqueles.bActivo = 1
            
            GROUP BY
                     Troqueles.idTroquel
                    ,Troqueles.Codigo
            ORDER BY 
                     Troqueles.Codigo;
        `);
        
        res.json(result.recordset);
    } catch (error) {
        console.log('Error al obtener troqueles:', error);
        res.status(500).json({ error: 'Error al obtener los troqueles' });
    }
};

export const getImagenTroquel = async (req, res) => {
    const { clave } = req.params;
    // Aquí es donde Node.js hace la petición directa a la IP
    const url = `http://192.168.4.5/Dibujos/normal/${clave}.jpg`;

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(404).send('Imagen no encontrada');
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Le decimos al navegador "ahí te va una imagen"
        res.set('Content-Type', 'image/jpeg');
        res.send(buffer);
    } catch (error) {
        console.error('Error al descargar la imagen:', error.message);
        res.status(500).send('Error al cargar la imagen');
    }
};

export const getQRsBatch = async (req, res) => {
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .query(`SELECT idTroquel, Codigo FROM Mantenimiento.Troqueles WHERE bActivo = 1 ORDER BY Codigo`);

        const troqueles = await Promise.all(result.recordset.map(async (t) => {
            const url = `${APP_BASE_URL}/?troquel=${t.idTroquel}`;
            const qrDataUrl = await QRCode.toDataURL(url, {
                width: 300,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
            return { idTroquel: t.idTroquel, codigo: t.Codigo, qr: qrDataUrl, url };
        }));

        res.json(troqueles);
    } catch (err) {
        logger.error('Error generando QRs en lote', { error: err.message });
        res.status(500).json({ error: 'Error al generar los códigos QR' });
    }
};

export const getQRIndividual = async (req, res) => {
    const { id } = req.params;
    try {
        const dbPool = await connectDB();
        const result = await dbPool.request()
            .input('idTroquel', mssql.Int, parseInt(id))
            .query(`SELECT idTroquel, Codigo FROM Mantenimiento.Troqueles WHERE idTroquel = @idTroquel AND bActivo = 1`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Troquel no encontrado' });
        }

        const troquel = result.recordset[0];
        const url = `${APP_BASE_URL}/?troquel=${troquel.idTroquel}`;
        const qrBuffer = await QRCode.toBuffer(url, {
            type: 'png',
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `inline; filename="QR-${troquel.Codigo}.png"`);
        res.send(qrBuffer);
    } catch (err) {
        logger.error('Error generando QR', { error: err.message, idTroquel: id });
        res.status(500).json({ error: 'Error al generar el código QR' });
    }
};