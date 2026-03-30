import { Router } from "express";
import { getTroqueles, getImagenTroquel, getQRsBatch, getQRIndividual } from "../controllers/troquel.controller.js";
import { validarIdParam } from '../middlewares/validator.js';

const router = Router();

router.get('/qr/batch', getQRsBatch);
router.get('/', getTroqueles);
router.get('/imagen/:clave', getImagenTroquel);
router.get('/:id/qr', validarIdParam, getQRIndividual);

export default router;