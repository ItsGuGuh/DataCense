import { Router } from 'express';
import { getCalendar } from '../controllers/calendarController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getCalendar);

export default router;