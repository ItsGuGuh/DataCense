import { Request, Response } from 'express';
import { poolPromise, sql } from '../config/database';

export async function getUpdates(req: Request, res: Response) {
    try {
        const pool = await poolPromise;

        // Usando as colunas exatas que sabemos que existem no seu banco
        const query = `
            SELECT id, version, title, description, release_date, is_important
            FROM patch_notes
            ORDER BY release_date DESC
        `;
        const result = await pool.request().query(query);

        res.json({ success: true, updates: result.recordset });
    } catch (error) {
        console.error("Erro SQL ao buscar Updates:", error);
        res.status(500).json({ success: false, message: "Erro interno no Banco de Dados" });
    }
}