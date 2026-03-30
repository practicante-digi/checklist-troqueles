import { Router } from 'express';
import { iniciarMantenimiento, finalizarMantenimiento, eliminarMantenimiento } from '../controllers/mantenimiento.controller.js';
import { schemaIniciarMantenimiento, schemaFinalizarMantenimiento, validarEsquema, validarIdParam } from '../middlewares/validator.js';

const router = Router();

// Ya no necesitamos poner '/api/mantenimiento/' porque lo definiremos en server.js
router.post('/iniciar', validarEsquema(schemaIniciarMantenimiento), iniciarMantenimiento);
router.post('/finalizar', validarEsquema(schemaFinalizarMantenimiento), finalizarMantenimiento);
router.delete('/:id', validarIdParam, eliminarMantenimiento);

export default router;