require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

(async () => {
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS vexa_schema_migrations (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, filename VARCHAR(255) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(id), UNIQUE KEY uq_vexa_schema_migration_filename(filename))`);
    const dir = path.join(__dirname, '../database/migrations');
    const files = fs.readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
    const [applied] = await connection.query('SELECT filename FROM vexa_schema_migrations');
    const done = new Set(applied.map(row => row.filename));
    for (const filename of files) {
      if (done.has(filename)) continue;
      const sql = fs.readFileSync(path.join(dir, filename), 'utf8').trim();
      if (!sql) continue;
      console.log(`Applying ${filename}`);
      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query('INSERT INTO vexa_schema_migrations (filename) VALUES (?)', [filename]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`${filename}: ${error.message}`);
      }
    }
    console.log('VexaAccount database migrations are up to date.');
  } finally {
    connection.release();
    await pool.end();
  }
})().catch(error => { console.error('Migration failed:', error.message); process.exit(1); });
