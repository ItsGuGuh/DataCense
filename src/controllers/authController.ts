import { Request, Response } from 'express';
import ldap from 'ldapjs';

export const loginLdap = async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Usuário e senha são obrigatórios.' });
        return;
    }

    // Cria o cliente LDAP conectando no IP que você enviou no PHP
    const client = ldap.createClient({
        url: 'ldap://192.168.1.7:389',
        timeout: 5000,
        connectTimeout: 5000
    });

    // Formata o usuário para o padrão do Active Directory (usuário@domínio)
    const userPrincipalName = username.includes('@') ? username : `${username}@trc.local`;

    // Tenta fazer o "bind" (login) direto com as credenciais do usuário
    client.bind(userPrincipalName, password, (err) => {
        if (err) {
            client.unbind();
            res.status(401).json({ success: false, message: 'Usuário ou senha incorretos.' });
            return;
        }

        // Se chegou aqui, a senha está correta!
        client.unbind();
        res.status(200).json({ 
            success: true, 
            message: 'Autenticação realizada com sucesso!',
            redirect: '/pages/menu.html'
        });
    });
    
    // Tratamento de erro de conexão com o servidor LDAP
    client.on('error', (err) => {
        console.error('Erro de conexão LDAP:', err);
        res.status(500).json({ success: false, message: 'Servidor de autenticação indisponível.' });
    });
};