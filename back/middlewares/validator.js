// middlewares/validator.js
import Joi from 'joi';
import { logger } from '../config/logger.js'; // Importamos el logger que acabamos de separar

export const schemaIniciarMantenimiento = Joi.object({
    idTroquel: Joi.number().integer().positive().required(),
    idUsuario: Joi.number().integer().positive().required()
});

export const schemaActividad = Joi.object({
    id: Joi.number().integer().positive().required(),
    status: Joi.string().valid('Completado', 'No Completado', 'No Aplica').required(),
    comment: Joi.string().max(500).allow('').optional()
});

export const schemaFinalizarMantenimiento = Joi.object({
    idMantenimiento: Joi.number().integer().positive().required(),
    actividadesCompletadas: Joi.array().items(schemaActividad).min(1).required()
});

export const validarEsquema = (esquema) => {
    return (req, res, next) => {
        const { error } = esquema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errores = error.details.map(detail => ({
                campo: detail.path.join('.'),
                mensaje: detail.message
            }));

            logger.warn('Datos inválidos detectados', {
                ip: req.ip, userAgent: req.get('User-Agent'), url: req.originalUrl,
                method: req.method, errores: errores, payload: req.body, type: 'VALIDATION_ERROR'
            });

            return res.status(400).json({ error: 'Datos de entrada inválidos', detalles: errores });
        }
        next();
    };
};

export const validarIdParam = (req, res, next) => {
    const { id } = req.params;
    const { error } = Joi.number().integer().positive().required().validate(parseInt(id));
    if (error) {
        return res.status(400).json({ error: 'ID inválido', mensaje: 'El ID debe ser un número entero positivo' });
    }
    next();
};