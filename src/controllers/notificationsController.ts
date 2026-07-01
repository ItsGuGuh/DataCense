import { Request, Response } from 'express';
import { poolPromise, sql } from '../config/database';

export async function getNotifications(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const filter = req.query.filter as string || 'unread';
        const offset = (page - 1) * limit;

        if (!username) {
            return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
        }

        const baseWhere = `
            (n.destinatario = @username AND n.tipo_destinatario = 'usuario')
            OR (n.tipo_destinatario = 'tag' AND n.destinatario IN (SELECT tag_name FROM notification_tags WHERE usuario = @username))
        `;

        const visualizadoCase = `
            CASE 
                WHEN n.tipo_destinatario = 'usuario' THEN CAST(n.visualizado AS BIT)
                WHEN n.tipo_destinatario = 'tag' THEN 
                    CASE WHEN n.usuarios_visualizacao LIKE '%' + @username + '%' THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END
                ELSE CAST(n.visualizado AS BIT)
            END
        `;

        const countQuery = `
            SELECT 
                SUM(CASE WHEN ${visualizadoCase} = 0 THEN 1 ELSE 0 END) as total_unread,
                COUNT(*) as total_all
            FROM notificationcenter n
            WHERE ${baseWhere}
        `;
        const countResult = await pool.request().input('username', sql.VarChar, username).query(countQuery);
        const totals = countResult.recordset[0];

        let dataQuery = `
            SELECT n.id, n.data_hora_criado, n.remetente, n.icon, n.tipo, n.mensagem, n.tipo_destinatario, n.usuarios_visualizacao,
            ${visualizadoCase} as visualizado
            FROM notificationcenter n
            WHERE (${baseWhere})
        `;

        if (filter === 'unread') {
            dataQuery += ` AND (${visualizadoCase}) = 0 `;
        }

        dataQuery += `
            ORDER BY n.data_hora_criado DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const result = await pool.request().input('username', sql.VarChar, username).query(dataQuery);

        res.json({
            success: true,
            notifications: result.recordset,
            totalUnread: totals.total_unread || 0,
            totalAll: totals.total_all || 0
        });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar notificações' });
    }
}

export async function markNotificationRead(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const { id } = req.body;
        const username = req.user?.username;

        if (!id || !username) return res.status(400).json({ success: false });

        const check = await pool.request().input('id', sql.Int, id).query('SELECT tipo_destinatario, usuarios_visualizacao FROM notificationcenter WHERE id = @id');

        if (check.recordset.length > 0) {
            const notif = check.recordset[0];

            if (notif.tipo_destinatario === 'tag') {
                let users: string[] = [];
                try { users = JSON.parse(notif.usuarios_visualizacao || '[]'); } catch (e) { }

                if (!users.includes(username)) {
                    users.push(username);
                    await pool.request()
                        .input('id', sql.Int, id)
                        .input('users', sql.NVarChar, JSON.stringify(users))
                        .query('UPDATE notificationcenter SET usuarios_visualizacao = @users WHERE id = @id');
                }
            } else {
                await pool.request()
                    .input('id', sql.Int, id)
                    .input('username', sql.VarChar, username)
                    .query('UPDATE notificationcenter SET visualizado = 1, data_hora_visualizado = GETDATE() WHERE id = @id AND destinatario = @username');
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}

export async function markAllNotificationsRead(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;

        if (!username) return res.status(401).json({ success: false });

        await pool.request().input('username', sql.VarChar, username).query(`
            UPDATE notificationcenter SET visualizado = 1, data_hora_visualizado = GETDATE() 
            WHERE destinatario = @username AND tipo_destinatario = 'usuario' AND visualizado = 0
        `);

        const tagsUnread = await pool.request().input('username', sql.VarChar, username).query(`
            SELECT id, usuarios_visualizacao FROM notificationcenter 
            WHERE tipo_destinatario = 'tag' 
            AND destinatario IN (SELECT tag_name FROM notification_tags WHERE usuario = @username)
            AND (usuarios_visualizacao IS NULL OR usuarios_visualizacao NOT LIKE '%' + @username + '%')
        `);

        for (const row of tagsUnread.recordset) {
            let users: string[] = [];
            try { users = JSON.parse(row.usuarios_visualizacao || '[]'); } catch (e) { }
            users.push(username);
            await pool.request()
                .input('id', sql.Int, row.id)
                .input('users', sql.NVarChar, JSON.stringify(users))
                .query('UPDATE notificationcenter SET usuarios_visualizacao = @users WHERE id = @id');
        }

        res.json({ success: true, message: 'Todas as notificações marcadas como lidas' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}

export async function deleteNotification(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const { id, dias } = req.body;
        const username = req.user?.username;

        if (!username) return res.status(401).json({ success: false });

        const request = pool.request().input('username', sql.VarChar, username);

        if (id === 'all') {
            request.input('dias', sql.Int, dias);
            await request.query(`DELETE FROM notificationcenter WHERE destinatario = @username AND data_hora_criado < DATEADD(day, -@dias, GETDATE())`);
        } else {
            request.input('id', sql.Int, id);
            await request.query('DELETE FROM notificationcenter WHERE id = @id AND destinatario = @username');
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
}