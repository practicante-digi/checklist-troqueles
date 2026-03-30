import { Router } from 'express';
import { getHistorial, getDetalleHistorial } from '../controllers/historial.controller.js';
import { validarIdParam } from '../middlewares/validator.js';

const router = Router();

router.get('/', getHistorial);
router.get('/:id', validarIdParam, getDetalleHistorial);

export default router;