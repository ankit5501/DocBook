const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./config/db');

async function migrateAuth() {
  console.log('🚀 Running DocBook Authentication Schema Migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add is_verified and email_verified_at to users table
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
    `);
    console.log('  ✓ Verified columns added to users table');

    // 2. Mark legacy users as verified so legacy accounts and appointments are strictly preserved
    const updateRes = await client.query(`
      UPDATE users 
      SET is_verified = TRUE,
          email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP)
      WHERE email_verified_at IS NULL AND (is_verified IS NULL OR is_verified = FALSE)
      RETURNING id, name, email, role;
    `);
    console.log(`  ✓ Legacy user preservation: ${updateRes.rowCount} legacy accounts safely marked as verified`);

    // 3. Create email_verifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          otp_hash VARCHAR(255) NOT NULL,
          name VARCHAR(100),
          password_hash VARCHAR(255),
          role VARCHAR(20) DEFAULT 'patient',
          purpose VARCHAR(30) DEFAULT 'signup',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 5,
          expires_at TIMESTAMP NOT NULL,
          resend_available_at TIMESTAMP NOT NULL,
          is_consumed BOOLEAN DEFAULT FALSE,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_email_verifications_email_purpose ON email_verifications(email, purpose);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);
    `);
    console.log('  ✓ email_verifications table and indexes verified');

    await client.query('COMMIT');
    console.log('✅ Auth migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrateAuth()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = migrateAuth;

