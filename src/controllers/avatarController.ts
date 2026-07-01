import { Request, Response } from 'express';
import { poolPromise, sql } from '../config/database';
import fs from 'fs';
import path from 'path';

// ==========================================
// 1. AS NOVAS FUNÇÕES (Para a Galeria)
// ==========================================
export async function getAvatarTabs(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;

        if (!username) {
            return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
        }

        // Lê exatamente as colunas que existem na sua tabela
        const query = `
            SELECT id, Titulo as title, Arquivo as arquivo, Guia as categoria 
            FROM avatar_persona
            WHERE Guia NOT IN ('Tripulantes')
            ORDER BY Guia, Titulo
        `;
        const result = await pool.request().query(query);

        const tabsMap: any = {};
        result.recordset.forEach(a => {
            const cat = a.categoria || 'Geral';
            if (!tabsMap[cat]) tabsMap[cat] = { categoria: cat, avatares: [] };

            tabsMap[cat].avatares.push({
                id: a.id,
                title: a.title,
                arquivo: a.arquivo
            });
        });

        res.json({ success: true, tabs: Object.values(tabsMap) });
    } catch (error) {
        console.error("Erro ao buscar avatares:", error);
        res.status(500).json({ success: false, message: 'Erro no servidor' });
    }
}

export async function selectAvatar(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const { id_avatar, avatar } = req.body;
        const username = req.user?.username;

        if (!username) return res.status(401).json({ success: false });

        const checkUser = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT id, Avatar FROM avatar_users WHERE Username = @username');

        if (checkUser.recordset.length > 0) {
            const lastAvatar = checkUser.recordset[0].Avatar;
            await pool.request()
                .input('id_avatar', sql.Int, id_avatar)
                .input('avatar', sql.NVarChar, avatar)
                .input('ultimo_avatar', sql.NVarChar, lastAvatar)
                .input('username', sql.NVarChar, username)
                .query(`
                    UPDATE avatar_users 
                    SET id_avatar = @id_avatar, 
                        Avatar = @avatar, 
                        Ultimo_Avatar = @ultimo_avatar,
                        Data_Alteracao = GETDATE() 
                    WHERE Username = @username
                `);
        } else {
            await pool.request()
                .input('id_avatar', sql.Int, id_avatar)
                .input('avatar', sql.NVarChar, avatar)
                .input('username', sql.NVarChar, username)
                .query(`
                    INSERT INTO avatar_users (id_avatar, Avatar, Username, Data_Escolha) 
                    VALUES (@id_avatar, @avatar, @username, GETDATE())
                `);
        }

        const pathResult = await pool.request()
            .input('id_avatar', sql.Int, id_avatar)
            .query('SELECT Arquivo FROM avatar_persona WHERE id = @id_avatar');

        let avatarPath = `/assets/img/avatar/default.png`;
        if (pathResult.recordset.length > 0) {
            avatarPath = `/assets/img/avatar/${pathResult.recordset[0].Arquivo}`;
        }

        res.json({ success: true, avatarPath: avatarPath });
    } catch (error) {
        console.error("Erro ao salvar avatar:", error);
        res.status(500).json({ success: false });
    }
}

// ==========================================
// 2. FUNÇÕES MANTIDAS (Upload e Atual)
// ==========================================
export async function uploadAvatar(req: Request, res: Response) {
    try {
        const username = req.user?.username;
        const userRole = req.user?.role || '';

        if (!username) return res.status(401).json({ success: false, message: 'Não autenticado' });
        if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado' });

        // --- SISTEMA DE PERMISSÕES PARA AVATAR PERSONALIZADO ---
        // Apenas as roles permitidas podem usar esta funcionalidade
        const allowedRoles = ['Apolo', 'Qualidade', 'Marketing', 'GP Backoffice'];
        const hasPermission = allowedRoles.some(r => userRole.includes(r));

        if (!hasPermission) {
            // Apaga o arquivo temporário do servidor imediatamente
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(403).json({ success: false, message: 'Seu cargo não possui permissão para usar avatares personalizados.' });
        }

        const file = req.file;
        if (!file.mimetype.startsWith('image/')) {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, message: 'Arquivo deve ser uma imagem' });
        }

        const avatarDir = path.join(__dirname, '../../public/assets/img/avatar');
        if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

        // O Cropper.js sempre salva como PNG
        const newFileName = `${username}.png`;
        const newPath = path.join(avatarDir, newFileName);

        if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
        fs.renameSync(file.path, newPath);

        const pool = await poolPromise;
        const checkResult = await pool.request()
            .input('filename', sql.NVarChar, newFileName)
            .query('SELECT id FROM avatar_persona WHERE Arquivo = @filename');

        let avatarId: number;

        if (checkResult.recordset.length === 0) {
            const insertResult = await pool.request()
                .input('titulo', sql.NVarChar, `Avatar de ${username}`)
                .input('filename', sql.NVarChar, newFileName)
                .input('username', sql.NVarChar, username)
                .query(`
                    INSERT INTO avatar_persona (Arquivo, Titulo, Guia, Data_Criado, Quem_Criou)
                    OUTPUT INSERTED.id
                    VALUES (@filename, @titulo, 'Personalizado', GETDATE(), @username)
                `);
            avatarId = insertResult.recordset[0].id;
        } else {
            avatarId = checkResult.recordset[0].id;
        }

        const checkUser = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT id, Avatar FROM avatar_users WHERE Username = @username');

        const avatarTitle = `Avatar de ${username}`;

        if (checkUser.recordset.length > 0) {
            const lastAvatar = checkUser.recordset[0].Avatar;
            await pool.request()
                .input('id_avatar', sql.Int, avatarId)
                .input('avatar', sql.NVarChar, avatarTitle)
                .input('ultimo_avatar', sql.NVarChar, lastAvatar)
                .input('username', sql.NVarChar, username)
                .query(`
                    UPDATE avatar_users 
                    SET id_avatar = @id_avatar, Avatar = @avatar, Ultimo_Avatar = @ultimo_avatar, Data_Alteracao = GETDATE() 
                    WHERE Username = @username
                `);
        } else {
            await pool.request()
                .input('id_avatar', sql.Int, avatarId)
                .input('avatar', sql.NVarChar, avatarTitle)
                .input('username', sql.NVarChar, username)
                .query(`
                    INSERT INTO avatar_users (id_avatar, Avatar, Username, Data_Escolha) 
                    VALUES (@id_avatar, @avatar, @username, GETDATE())
                `);
        }

        res.json({ success: true, message: 'Avatar personalizado salvo com sucesso!', avatarPath: `/assets/img/avatar/${newFileName}?t=${Date.now()}` });
    } catch (error) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ success: false, message: 'Erro ao fazer upload do avatar' });
    }
}

export async function getCurrentAvatar(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;

        if (!username) return res.status(401).json({ success: false, message: 'Não autenticado' });

        const query = `
            SELECT TOP 1 au.id_avatar, au.Avatar, ap.Arquivo
            FROM avatar_users au
            LEFT JOIN avatar_persona ap ON au.id_avatar = ap.id
            WHERE au.Username = @username
            ORDER BY COALESCE(au.Data_Alteracao, au.Data_Escolha) DESC
        `;

        const result = await pool.request().input('username', sql.NVarChar, username).query(query);

        if (result.recordset.length > 0 && result.recordset[0].Arquivo) {
            const avatarPath = path.join(__dirname, '../../public/assets/img/avatar', result.recordset[0].Arquivo);
            if (fs.existsSync(avatarPath)) {
                return res.json({ success: true, avatarPath: `/assets/img/avatar/${result.recordset[0].Arquivo}?t=${Date.now()}` });
            }
        }

        res.json({ success: true, avatarPath: `/assets/img/avatar/default.png` });
    } catch (error) {
        res.json({ success: true, avatarPath: `/assets/img/avatar/default.png` });
    }
}