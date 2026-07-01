import { Request, Response } from 'express';
import { poolPromise, sql } from '../config/database';
import { formatName, makeClickableLinks } from '../utils/formatters';
import { Post } from '../types';

export async function getPosts(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const username = req.user?.username;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 3;
        const offset = (page - 1) * limit;

        // Buscar roles do usuário
        const userRoles = req.user?.role?.split(',').map(r => r.trim()) || [];

        // Construir condição WHERE para roles
        let rolesCondition = '';
        const params: any[] = [];

        if (userRoles.length > 0) {
            const roleConditions = userRoles.map((_, index) => {
                params.push(`%${userRoles[index]}%`);
                return `roles LIKE @p${params.length}`;
            });
            rolesCondition = `AND (roles IS NULL OR roles = '' OR ${roleConditions.join(' OR ')})`;
        }

        // Query principal
        const query = `
            SELECT id, username, titulo, post_image, post_description, post_type, 
                   data_publicacao, roles, OgtCheckMark, PostIsRead, Reacoes,
                   Emoji1, Emoji2, Emoji3, Emoji4, Emoji5, data_final, post_programado
            FROM posts_geral
            WHERE (data_final IS NULL OR data_final > GETDATE())
            ${rolesCondition}
            ORDER BY id DESC
            OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
        `;

        const request = pool.request();
        params.forEach((value, index) => {
            request.input(`p${index + 1}`, sql.NVarChar, value);
        });

        const result = await request.query(query);
        const posts = result.recordset as Post[];

        // Query para contar total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM posts_geral
            WHERE (data_final IS NULL OR data_final > GETDATE())
            ${rolesCondition}
        `;

        const countRequest = pool.request();
        params.forEach((value, index) => {
            countRequest.input(`p${index + 1}`, sql.NVarChar, value);
        });

        const countResult = await countRequest.query(countQuery);
        const total = countResult.recordset[0].total;

        // Buscar informações adicionais para cada post
        const postsWithDetails = await Promise.all(posts.map(async post => {
            // Buscar avatar do autor
            const avatarQuery = `
                SELECT TOP 1 ap.Arquivo
                FROM avatar_users au
                LEFT JOIN avatar_persona ap ON au.id_avatar = ap.id
                WHERE au.Username = @username
                ORDER BY au.Data_Escolha DESC
            `;

            const avatarRequest = pool.request();
            avatarRequest.input('username', sql.NVarChar, post.username);
            const avatarResult = await avatarRequest.query(avatarQuery);

            // Verificar se usuário já leu o post
            let isRead = false;
            if (post.OgtCheckMark === 1) {
                const readQuery = `
                    SELECT COUNT(*) as count
                    FROM posts_geral_read
                    WHERE post_id = @postId AND username = @username
                `;
                const readRequest = pool.request();
                readRequest.input('postId', sql.Int, post.id);
                readRequest.input('username', sql.NVarChar, username);
                const readResult = await readRequest.query(readQuery);
                isRead = readResult.recordset[0].count > 0;
            }

            // Verificar quantidade de reações do usuário
            let userReactions = 0;
            if (post.Reacoes === 1) {
                const reactQuery = `
                    SELECT COUNT(*) as count
                    FROM posts_geral_reacts
                    WHERE post_id = @postId AND username = @username
                `;
                const reactRequest = pool.request();
                reactRequest.input('postId', sql.Int, post.id);
                reactRequest.input('username', sql.NVarChar, username);
                const reactResult = await reactRequest.query(reactQuery);
                userReactions = reactResult.recordset[0].count;
            }

            return {
                ...post,
                author_name: formatName(post.username),
                avatar_path: avatarResult.recordset[0]?.Arquivo || 'default.png',
                isRead,
                userReactions,
                post_description: makeClickableLinks(post.post_description)
            };
        }));

        res.json({
            success: true,
            posts: postsWithDetails,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao buscar posts:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar posts'
        });
    }
}

export async function markPostAsRead(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const postId = req.body.post_id;
        const username = req.user?.username;

        if (!postId || !username) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos'
            });
        }

        // Verificar se já foi lido
        const checkQuery = `
            SELECT COUNT(*) as count
            FROM posts_geral_read
            WHERE post_id = @postId AND username = @username
        `;

        const checkRequest = pool.request();
        checkRequest.input('postId', sql.Int, postId);
        checkRequest.input('username', sql.NVarChar, username);
        const checkResult = await checkRequest.query(checkQuery);

        if (checkResult.recordset[0].count === 0) {
            // Inserir registro de leitura
            const insertQuery = `
                INSERT INTO posts_geral_read (post_id, username, data_leitura)
                VALUES (@postId, @username, GETDATE())
            `;

            const insertRequest = pool.request();
            insertRequest.input('postId', sql.Int, postId);
            insertRequest.input('username', sql.NVarChar, username);
            await insertRequest.query(insertQuery);

            // Incrementar contador no post
            const updateQuery = `
                UPDATE posts_geral
                SET PostIsRead = PostIsRead + 1
                WHERE id = @postId
            `;

            const updateRequest = pool.request();
            updateRequest.input('postId', sql.Int, postId);
            await updateRequest.query(updateQuery);
        }

        res.json({
            success: true,
            message: 'Post marcado como lido'
        });

    } catch (error) {
        console.error('Erro ao marcar post como lido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar post como lido'
        });
    }
}

export async function addReaction(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const { post_id, emoji_type } = req.body;
        const username = req.user?.username;

        if (!post_id || !emoji_type || !username) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos'
            });
        }

        // Verificar limite de 5 reações do usuário neste post
        const countQuery = `
            SELECT COUNT(*) as count
            FROM posts_geral_reacts
            WHERE post_id = @postId AND username = @username
        `;

        const countRequest = pool.request();
        countRequest.input('postId', sql.Int, post_id);
        countRequest.input('username', sql.NVarChar, username);
        const countResult = await countRequest.query(countQuery);

        if (countResult.recordset[0].count >= 5) {
            return res.status(400).json({
                success: false,
                message: 'Você atingiu o limite máximo de 5 reações nesta publicação.'
            });
        }

        // CORREÇÃO: Nomes corretos das colunas no banco (emoji e data_emoji)
        const insertQuery = `
            INSERT INTO posts_geral_reacts (post_id, username, emoji, data_emoji)
            VALUES (@postId, @username, @emojiType, GETDATE())
        `;

        const insertRequest = pool.request();
        insertRequest.input('postId', sql.Int, post_id);
        insertRequest.input('username', sql.NVarChar, username);
        insertRequest.input('emojiType', sql.Int, emoji_type);
        await insertRequest.query(insertQuery);

        // Incrementar contador do emoji específico na tabela posts_geral
        const updateQuery = `
            UPDATE posts_geral
            SET Emoji${emoji_type} = Emoji${emoji_type} + 1
            WHERE id = @postId
        `;

        const updateRequest = pool.request();
        updateRequest.input('postId', sql.Int, post_id);
        await updateRequest.query(updateQuery);

        // Buscar novo contador para atualizar na tela em tempo real
        const getQuery = `
            SELECT Emoji${emoji_type} as count
            FROM posts_geral
            WHERE id = @postId
        `;

        const getRequest = pool.request();
        getRequest.input('postId', sql.Int, post_id);
        const getResult = await getRequest.query(getQuery);

        res.json({
            success: true,
            message: 'Reação adicionada com sucesso!',
            newCount: getResult.recordset[0].count
        });

    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno ao registrar reação.'
        });
    }
}

export async function getUserReactions(req: Request, res: Response) {
    try {
        const pool = await poolPromise;
        const postId = req.query.post_id;
        const username = req.user?.username;

        if (!postId || !username) {
            return res.status(400).json({
                success: false,
                message: 'Dados inválidos'
            });
        }

        const query = `
            SELECT COUNT(*) as count
            FROM posts_geral_reacts
            WHERE post_id = @postId AND username = @username
        `;

        const request = pool.request();
        request.input('postId', sql.Int, postId);
        request.input('username', sql.NVarChar, username);
        const result = await request.query(query);

        res.json({
            success: true,
            reactions: result.recordset[0].count
        });

    } catch (error) {
        console.error('Erro ao buscar reações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar reações'
        });
    }
}