import express, { Request, Response } from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import fs from 'fs';

// Importar rotas modulares (Arquitetura MVC Limpa)
import authRoutes from './routes/authRoutes';
import postsRoutes from './routes/postsRoutes';
import notificationsRoutes from './routes/notificationsRoutes';
import avatarRoutes from './routes/avatarRoutes';
import calendarRoutes from './routes/calendarRoutes';
import patchNotesRoutes from './routes/patchNotesRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Criar pasta temp se não existir
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Rate limiting para API
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // 60 requisições por minuto
    message: { success: false, message: 'Muitas requisições. Tente novamente em 1 minuto.' }
});

// Aplicar rate limit em todas as rotas da API
app.use('/api', apiLimiter);

// ========================================================
// ROTAS DA API (100% MVC - Cada módulo cuida do seu)
// ========================================================
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/avatar', avatarRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/updates', patchNotesRoutes); // Ajustado para '/api/updates' para bater com o Frontend

// Middleware para rotas não encontradas da API
app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: `Rota da API não encontrada: ${req.method} ${req.originalUrl}`
    });
});

// ========================================================
// ARQUIVOS ESTÁTICOS E ROTAS DO FRONTEND
// ========================================================
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/pages/menu.html', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/pages/menu.html'));
});

app.get('/pages/header.html', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/pages/header.html'));
});

app.get('/pages/sidebar.html', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/pages/sidebar.html'));
});

// Rota curinga para outras páginas html
app.use((req: Request, res: Response) => {
    if (req.path.endsWith('.html') || req.path.includes('/pages/')) {
        const filePath = path.join(__dirname, '../public', req.path);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).sendFile(path.join(__dirname, '../public/404.html'));
        }
    } else {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta http://localhost:${PORT}`);
    console.log(`✅ Rotas Modulares Carregadas:`);
    console.log(`   - /api/auth`);
    console.log(`   - /api/posts`);
    console.log(`   - /api/notifications`);
    console.log(`   - /api/avatar`);
    console.log(`   - /api/calendar`);
    console.log(`   - /api/updates`);
});