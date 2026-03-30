import { Router } from 'express';
import { getActividades } from '../controllers/actividad.controller.js';

const router = Router();

router.get('/', getActividades);

export default router;