import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../types';

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1] || 
                   req.cookies?.token || 
                   req.query.token as string;

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Token não fornecido' 
        });
    }

    try {
        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'fallback_secret'
        ) as User;
        
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Token inválido' 
        });
    }
}

export function checkPermission(permission: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Não autenticado' 
            });
        }

        if (req.user.role === 'Apolo' || req.user.permissions.includes('*')) {
            return next();
        }

        if (req.user.permissions.includes(permission)) {
            return next();
        }

        return res.status(403).json({ 
            success: false, 
            message: 'Acesso negado' 
        });
    };
}