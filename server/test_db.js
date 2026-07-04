require('dotenv').config();
const { pool } = require('./config/db');

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('DB Connection Success:', res.rows[0]);
  } catch (err) {
    console.error('DB Connection Failed:', err.message);
  } finally {
    pool.end();
  }
}
test();
