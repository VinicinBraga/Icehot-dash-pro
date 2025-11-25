const mysql = require("mysql2");

// ===== Config fixa do MySQL (DigitalOcean) =====
// (depois a gente volta isso para env vars com calma)

const DB_HOST = "167.99.0.137";
const DB_USER = "root";
const DB_PASSWORD = "!Root@568f74e2b304";
const DB_NAME = "icehot";
const DB_PORT = 3306;

// Log seguro (sem senha) para confirmar no Cloud Run
console.log("[DB CONFIG]", {
  host: DB_HOST,
  user: DB_USER,
  database: DB_NAME,
  port: DB_PORT,
});

// ===== Cria pool usando as configs acima =====
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
