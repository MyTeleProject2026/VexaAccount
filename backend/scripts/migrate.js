require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

// mysql2 connections intentionally keep multiStatements disabled. Execute the
// migration as individual SQL statements so production TiDB does not need the
// global tidb_multi_statement_mode switch enabled.
function splitStatements(sql) {
  const statements = [];
  let start = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (!quote && ch === '-' && next === '-' && /\s/.test(sql[i + 2] || '')) {
      lineComment = true; i += 1; continue;
    }
    if (!quote && ch === '/' && next === '*') {
      blockComment = true; i += 1; continue;
    }
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) {
        if (sql[i + 1] === quote) { i += 1; continue; }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === ';') {
      const statement = sql.slice(start, i).trim();
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) statements.push(tail);
  return statements;
}

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
      const statements = splitStatements(sql);
      console.log(`Applying ${filename} (${statements.length} statements)`);
      await connection.beginTransaction();
      try {
        for (const statement of statements) await connection.query(statement);
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
