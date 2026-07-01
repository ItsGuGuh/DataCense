import { Router } from 'express';
import { loginLdap, updatePreferences } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', loginLdap);

// NOVA ROTA: Salva as preferências de layout do usuário
router.post('/preferences', authMiddleware, updatePreferences);

export default router;