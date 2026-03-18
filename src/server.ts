import express, { Request, Response } from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes';

const app = express();
const PORT = process.env.PORT || 3000;

// Configura o Express para entender JSON (Crucial para o POST funcionar)
app.use(express.json());

// Limitador de requisições apenas para a API
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10,
    message: { success: false, message: 'Muitas tentativas de login. Tente novamente em 1 minuto.' }
});

// Aplica as rotas
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);

// TRATAMENTO DE ERRO DE API CORRIGIDO PARA EXPRESS 5: 
// Removido o '*' do '/api/*'. 
// O app.use já entende que qualquer coisa que comece com '/api' e chegue até aqui é um erro 404.
app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ success: false, message: `Rota da API não encontrada: ${req.method} ${req.originalUrl}` });
});

// Arquivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Fallback do Frontend: Se não for rota de API, entrega o index.html
app.use((req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta http://localhost:${PORT}`);
    console.log(`✅ Rotas de Autenticação carregadas e prontas!`);
});