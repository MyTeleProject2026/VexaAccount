// backend/src/config/database.js
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const port = Number(process.env.DB_PORT || 4000);
const connectionLimit = Math.max(5, Number(process.env.DB_CONNECTION_LIMIT || 15));
const maxIdle = Math.min(connectionLimit, Math.max(2, Number(process.env.DB_MAX_IDLE || connectionLimit)));
const queueLimit = Math.max(25, Number(process.env.DB_QUEUE_LIMIT || 100));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'vexastore',
  port,
  waitForConnections: true,
  connectionLimit,
  maxIdle,
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS || 60000),
  queueLimit,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 8000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    console.log(`✅ Database connected successfully (${process.env.DB_HOST}:${port}/${process.env.DB_NAME || 'vexastore'})`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

module.exports = { pool, testConnection };
