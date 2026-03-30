import { Router } from 'express';
import { getUsuarios } from '../controllers/usuario.controller.js';

const router = Router();

router.get('/', getUsuarios);

export default router;