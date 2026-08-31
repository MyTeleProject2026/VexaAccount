require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../../vexaccount/src/config/database');

const email = String(process.env.VEXA_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.VEXA_SUPER_ADMIN_PASSWORD || '');

async function main() {
  if (!email || !password) {
    console.log('Super Admin bootstrap skipped: VEXA_SUPER_ADMIN_EMAIL/PASSWORD are not configured.');
    return;
  }
  const hash = await bcrypt.hash(password, 12);
  const [users] = await pool.query('SELECT id,email,name FROM store_users WHERE email=? LIMIT 1', [email]);
  if (!users.length) throw new Error(`Super Admin bootstrap user does not exist: ${email}`);
  const user = users[0];
  await pool.query('UPDATE store_users SET password=?, is_verified=1, is_active=1 WHERE id=?', [hash, user.id]);
  await pool.query(`INSERT INTO vexa_super_admins (user_id, role, is_active) VALUES (?, 'owner', 1) ON DUPLICATE KEY UPDATE role='owner', is_active=1`, [user.id]);
  console.log(`Super Admin bootstrap ready for ${email}`);
}

main().catch(error => { console.error('Super Admin bootstrap failed:', error.message); process.exitCode = 1; }).finally(async () => { await pool.end(); });
