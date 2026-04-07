import { connectDB } from "../config/db.js";

export const getMonitorData = async (req, res) => {
    try {
        const pool = await connectDB();

        // Consulta 1: Datos principales de "Producidas" basados en fecha de Mantenimiento
        const queryProducidas = `
            DECLARE @Inicio DATE = dateFromParts(2025, 1, 1);
            WITH Troqueles AS (
                SELECT
                    T.idTroquel,
                    T.Codigo,
                    T.MaximoPisadas AS Maximo,
                    TM.idMaterial,
                    M.ClaveMaterial AS Material,
                    max(isNull(Mtto.Inicio, @Inicio)) AS Fecha_mantenimiento
                FROM
                    Mantenimiento.Troqueles AS T
                    INNER JOIN Mantenimiento.Troquel_Materiales AS TM ON TM.idTroquel = T.idTroquel
                    INNER JOIN EPS.dbo.tblMaterial AS M ON M.idMaterial = TM.idMaterial
                    LEFT JOIN Mantenimiento.Mantenimiento AS Mtto ON Mtto.idTroquel = T.idTroquel
                WHERE
                    T.bActivo = 1
                GROUP BY
                    T.idTroquel, T.Codigo, T.MaximoPisadas, TM.idMaterial, M.ClaveMaterial
            )
            SELECT
                Troqueles.idTroquel,
                Troqueles.Codigo,
                Troqueles.Material,
                Troqueles.Maximo AS Maximo_piezas,
                ISNULL(SUM(EL.Cantidad), 0) AS Piezas_Producidas
            FROM
                Troqueles
                LEFT JOIN EPSData.dbo.tblEtiquetaLiberacion AS EL
                    ON EL.idMaterial = Troqueles.idMaterial
                   AND EL.Fecha >= Troqueles.Fecha_mantenimiento
                   AND EL.IdProceso = 19
            GROUP BY
                Troqueles.idTroquel, Troqueles.Codigo, Troqueles.Material, Troqueles.Maximo;
        `;

        // Consulta 2: Totales de "Liberaciones" para el mapeo que solicitaste ("Por producir")
        const queryLiberaciones = `
            SELECT
                TM.idTroquel,
                M.ClaveMaterial AS Material,
                ISNULL(SUM(EL.Cantidad), 0) AS Piezas_Liberaciones
            FROM
                EPSData.dbo.tblEtiquetaLiberacion AS EL
                INNER JOIN EPS.Produccion.tblEtiqueta AS E
                    ON E.idEtiqueta = EL.IdEtiqueta AND E.bActiva = 1
                INNER JOIN WaPP.Mantenimiento.Troquel_Materiales AS TM
                    ON TM.idMaterial = EL.idMaterial
                INNER JOIN EPS.dbo.tblMaterial AS M
                    ON M.idMaterial = TM.idMaterial
            WHERE
                E.idProcesoSiguiente = 19
            GROUP BY
                TM.idTroquel, M.ClaveMaterial;
        `;

        const [resultProducidas, resultLiberaciones] = await Promise.all([
            pool.request().query(queryProducidas),
            pool.request().query(queryLiberaciones)
        ]);

        const datosProducidas = resultProducidas.recordset;
        const datosLiberaciones = resultLiberaciones.recordset;

        // Mezclar ambos datasets emulando el modelo relacional de Power BI
        const monitorData = datosProducidas.map(row => {
            const libRow = datosLiberaciones.find(l => l.idTroquel === row.idTroquel && l.Material === row.Material);
            
            const produc = row.Piezas_Producidas || 0; 
            const porProducir = libRow ? libRow.Piezas_Liberaciones : 0; 
            const maximo = row.Maximo_piezas || 1; // Prevenir división por 0

            return {
                id: row.Codigo,
                troquelId: row.idTroquel,
                material: row.Material,
                produc: produc,
                porProducir: porProducir, // Exactamente la medida de [Liberaciones | piezas] 
                maximo: maximo,
                percentage: Math.round((produc / maximo) * 100)
            };
        });

        // Orden descendente (más producidas % arriba)
        monitorData.sort((a, b) => b.percentage - a.percentage);

        res.json(monitorData);
    } catch (error) {
        console.error('Error al generar los datos del monitor remoto:', error);
        res.status(500).json({ error: 'Fallo al procesar KPIs en la Base de Datos.' });
    }
};
