import { Router } from 'express';
import { getUpdates } from '../controllers/patchNotesController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// O front-end chama /api/updates, então mapeamos a raiz "/" para o getUpdates
router.get('/', authMiddleware, getUpdates);

export default router;