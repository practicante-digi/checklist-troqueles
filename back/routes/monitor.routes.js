import { Router } from "express";
import { getMonitorData } from "../controllers/monitor.controller.js";

const router = Router();

router.get('/datos', getMonitorData);

export default router;
