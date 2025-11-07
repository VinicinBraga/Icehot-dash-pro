// server/db.js
const mysql = require("mysql2/promise");
require("dotenv").config({ path: __dirname + "/.env" });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // charset opcional: 'utf8mb4_general_ci'
});

module.exports = { pool };
