import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const PORT = 3000;

// Configura o Express para entender JSON
app.use(express.json());

// Diz ao Node para servir os arquivos estáticos (HTML, CSS, JS) da pasta 'public'
app.use(express.static(path.join(__dirname, '../public')));

// Rota de teste da API
app.get('/api/status', (req: Request, res: Response) => {
    res.json({ mensagem: 'API do DataCense rodando perfeitamente!' });
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta http://localhost:${PORT}`);
});