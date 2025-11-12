const mysql = require("mysql2");

// ===== Leitura robusta das variáveis de ambiente =====
const DB_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1";
const DB_USER = process.env.DB_USER || process.env.MYSQL_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || process.env.MYSQL_DATABASE || "icehot";
const DB_PORT = Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306);

// Log seguro (sem senha) para confirmar no Cloud Run
console.log("[DB CONFIG]", {
  host: DB_HOST,
  user: DB_USER,
  database: DB_NAME,
  port: DB_PORT,
});

// ===== Cria pool usando as envs acima =====
const pool = mysql
  .createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise();

// opcional: exporta a config pra endpoint de debug (se quiser usar)
function getDbConfigPublic() {
  return {
    host: DB_HOST,
    user: DB_USER,
    database: DB_NAME,
    port: DB_PORT,
    hasPassword: !!DB_PASSWORD,
  };
}

module.exports = { pool, getDbConfigPublic };
