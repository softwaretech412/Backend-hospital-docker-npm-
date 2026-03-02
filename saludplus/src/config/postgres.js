import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

if (!env.databaseUrl) {
  throw new Error(
    'DATABASE_URL (or POSTGRES_URI) is not set. Add it to .env, e.g. DATABASE_URL=postgresql://user:password@localhost:5432/saludplus'
  );
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

/**
 * Connects to the default "postgres" database and creates the target database if it doesn't exist.
 */
async function ensureDatabaseExists() {
  const url = new URL(env.databaseUrl);
  const dbName = url.pathname.slice(1) || 'saludplus';
  url.pathname = '/postgres';
  const adminUrl = url.toString();

  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    const res = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (res.rows.length === 0) {
      if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
        throw new Error('Invalid database name in DATABASE_URL');
      }
      await adminPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`PostgreSQL database "${dbName}" created.`);
    }
  } finally {
    await adminPool.end();
  }
}

/**
 * Creates the normalized PostgreSQL schema (1NF, 2NF, 3NF).
 * Idempotent: safe to run multiple times.
 */
export async function createTables() {
  await ensureDatabaseExists();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── patients (master data) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(50) NOT NULL,
        address VARCHAR(255)
      )
    `);

    // ── doctors (master data, specialty as column per requirements) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        specialty VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── insurances (master data) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS insurances (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        coverage_percentage NUMERIC(5,2) NOT NULL
      )
    `);

    // ── appointments (transactional data, FKs to patients, doctors, insurances) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        appointment_id VARCHAR(50) NOT NULL UNIQUE,
        appointment_date DATE NOT NULL,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
        doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
        treatment_code VARCHAR(50) NOT NULL,
        treatment_description TEXT NOT NULL,
        treatment_cost NUMERIC(12,2) NOT NULL,
        insurance_id INTEGER NOT NULL REFERENCES insurances(id) ON DELETE RESTRICT,
        amount_paid NUMERIC(12,2) NOT NULL
      )
    `);

    // ── Indexes for frequent queries ──
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_insurance_id ON appointments(insurance_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_doctors_email ON doctors(email)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty)');

    await client.query('COMMIT');
    console.log('PostgreSQL tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating PostgreSQL tables:', error.message);
    throw error;
  } finally {
    client.release();
  }
}
