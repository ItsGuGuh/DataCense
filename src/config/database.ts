import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    user: process.env.DB1_USERNAME as string,
    password: process.env.DB1_PASSWORD as string,
    database: process.env.DB1_NAME as string,
    server: process.env.DB1_SERVER as string,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false, // Use true se estiver no Azure
        trustServerCertificate: true // Importante para conexões locais/intranet
    }
};

// Criamos uma única instância de conexão (Singleton)
const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Conectado ao banco de dados SQL Server com sucesso!');
        return pool;
    })
    .catch(err => {
        console.error('❌ Erro ao conectar no banco de dados: ', err);
        process.exit(1);
    });

export { sql, poolPromise };