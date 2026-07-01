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
        encrypt: false,
        trustServerCertificate: true
    }
};

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('✅ Conectado ao SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('❌ Erro no banco:', err);
        process.exit(1);
    });

export { sql, poolPromise };