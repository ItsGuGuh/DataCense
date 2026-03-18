import { Router } from 'express';
import { loginLdap } from '../controllers/authController';

const router = Router();

// Rota POST para /api/auth/login
router.post('/login', loginLdap);

export default router;