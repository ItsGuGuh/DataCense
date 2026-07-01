import { Router } from 'express';
import { 
    getPosts, 
    markPostAsRead, 
    addReaction, 
    getUserReactions 
} from '../controllers/postsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.get('/', authMiddleware, getPosts);
router.post('/mark-read', authMiddleware, markPostAsRead);
router.post('/add-reaction', authMiddleware, addReaction);
router.get('/user-reactions', authMiddleware, getUserReactions);

export default router;