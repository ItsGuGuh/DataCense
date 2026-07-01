import { Router } from 'express';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../controllers/notificationsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getNotifications);
router.post('/read', authMiddleware, markNotificationRead);
router.post('/read-all', authMiddleware, markAllNotificationsRead);
router.post('/delete', authMiddleware, deleteNotification);

export default router;