import { Request, Response } from 'express';
import ldap from 'ldapjs';
import jwt from 'jsonwebtoken';
import { poolPromise, sql } from '../config/database';

export const loginLdap = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
        return;
    }

    const client = ldap.createClient({ url: 'ldap://192.168.1.7:389', timeout: 5000 });
    const userPrincipalName = username.includes('@') ? username : `${username}@trc.local`;

    client.bind(userPrincipalName, password, async (err) => {
        if (err) {
            client.unbind();
            res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
            return;
        }

        client.unbind();

        try {
            const pool = await poolPromise;

            let userResult = await pool.request()
                .input('username', username)
                .query('SELECT * FROM user_wiki WHERE Username = @username');

            let user = userResult.recordset[0];

            if (!user) {
                await pool.request()
                    .input('username', username)
                    .input('ip', ip_address)
                    .query(`
                        INSERT INTO user_wiki (Username, Role, last_login, is_logged_in, ip_address) 
                        VALUES (@username, 'Padrao', GETDATE(), 1, @ip)
                    `);
                userResult = await pool.request().input('username', username).query('SELECT * FROM user_wiki WHERE Username = @username');
                user = userResult.recordset[0];
            } else {
                if (user.Status !== 'Ativo') {
                    res.status(403).json({ success: false, message: `Seu acesso está ${user.Status}.` });
                    return;
                }
                await pool.request()
                    .input('username', username)
                    .input('ip', ip_address)
                    .query('UPDATE user_wiki SET last_login = GETDATE(), is_logged_in = 1, ip_address = @ip WHERE Username = @username');
            }

            // LÓGICA DE MÚLTIPLAS ROLES COM TIPAGEM ESTRITA (Correção do Erro TS7006)
            const userRoleString: string = user.Role || 'Padrao';
            const rolesArray: string[] = userRoleString.split(',').map((r: string) => r.trim());

            let allowedPages: string[] = [];

            if (rolesArray.length > 0) {
                // Tipamos o _ como string e o i como number
                const inClause = rolesArray.map((_: string, i: number) => `@role${i}`).join(',');
                const permRequest = pool.request();

                // Tipamos o role como string e o i como number
                rolesArray.forEach((role: string, i: number) => permRequest.input(`role${i}`, role));

                const permResult = await permRequest.query(`SELECT Allowed_Pages FROM group_permissions WHERE Role_Name IN (${inClause})`);

                permResult.recordset.forEach(row => {
                    if (row.Allowed_Pages) {
                        const pages = JSON.parse(row.Allowed_Pages);
                        allowedPages = [...allowedPages, ...pages];
                    }
                });

                allowedPages = [...new Set(allowedPages)];
            }

            // Cria um token de segurança (JWT) COM AS PREFERÊNCIAS DO BANCO DE DADOS
            const token = jwt.sign(
                {
                    username: user.Username,
                    role: user.Role,
                    super: user.Super,
                    permissions: allowedPages,
                    theme: user.Theme || 'datacense', // Puxa o tema do banco
                    sideFixed: user.Side_Fixed === undefined ? true : user.Side_Fixed // Puxa o pino do banco
                },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '8h' }
            );

            res.status(200).json({ success: true, message: 'Sucesso!', token, redirect: '/pages/menu.html' });

        } catch (dbError) {
            console.error('Erro no banco de dados:', dbError);
            res.status(500).json({ success: false, message: 'Erro ao conectar com o banco de dados.' });
        }
    });
};

export async function updatePreferences(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;
        const { theme, side_fixed } = req.body;

        if (!username) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        // 1. Salva no banco de dados
        await pool.request()
            .input('theme', sql.VarChar, theme)
            .input('sideFixed', sql.Bit, side_fixed)
            .input('username', sql.VarChar, username)
            .query('UPDATE user_wiki SET Theme = @theme, Side_Fixed = @sideFixed WHERE Username = @username');

        // 2. Gera um NOVO TOKEN com as preferências recém-atualizadas
        const newToken = jwt.sign(
            {
                username: req.user?.username,
                role: req.user?.role,
                super: req.user?.super,
                permissions: req.user?.permissions,
                theme: theme,
                sideFixed: side_fixed === 1 || side_fixed === true
            },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        // 3. Devolve o novo Token para o Frontend
        res.json({ success: true, token: newToken });
    } catch (error) {
        console.error('Erro ao salvar preferências:', error);
        res.status(500).json({ success: false });
    }
}