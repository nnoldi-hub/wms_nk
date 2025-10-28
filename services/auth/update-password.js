const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function updatePassword() {
  const pool = new Pool({
    host: 'postgres',
    port: 5432,
    database: 'wms_nks',
    user: 'wms_admin',
    password: 'wms_secure_pass_2025'
  });

  const hash = await bcrypt.hash('Admin123!', 10);
  await pool.query(
    'UPDATE users SET password_hash = $1 WHERE username = $2',
    [hash, 'admin']
  );
  
  console.log('Password updated successfully!');
  console.log('Hash:', hash);
  
  await pool.end();
  process.exit(0);
}

updatePassword().catch(console.error);
