import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getAvatarTabs, selectAvatar, uploadAvatar, getCurrentAvatar } from '../controllers/avatarController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tempDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `temp_${uniqueSuffix}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
});

router.get('/tabs', authMiddleware, getAvatarTabs);
router.get('/current', authMiddleware, getCurrentAvatar);
router.post('/select', authMiddleware, selectAvatar);
router.post('/upload', authMiddleware, upload.single('avatar'), uploadAvatar);

export default router;