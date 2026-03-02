import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { parse } from 'csv-parse/sync';
import { pool } from '../config/postgres.js';
import { env } from '../config/env.js';
import { PatientHistory } from '../config/mongodb.js';

/**
 * Normalize string: trim, lowercase for emails, capitalize words for names.
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function normalizeName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Runs the full migration: CSV → PostgreSQL (normalized) + MongoDB (patient histories).
 * Idempotent when clearBefore is false (uses ON CONFLICT / upsert logic).
 * @param {boolean} clearBefore - If true, truncates tables before loading.
 * @returns {{ patients, doctors, insurances, appointments, histories, csvPath }}
 */
export async function migrate(clearBefore = false) {
  const csvPath = resolve(env.csvPath);
  let fileContent;
  try {
    fileContent = await readFile(csvPath, 'utf-8');
  } catch (err) {
    throw new Error(`Cannot read CSV file: ${csvPath}. ${err.message}`);
  }

  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (!rows.length) {
    return { patients: 0, doctors: 0, insurances: 0, appointments: 0, histories: 0, csvPath };
  }

  const client = await pool.connect();
  try {
    if (clearBefore) {
      await client.query('BEGIN');
      await client.query(`
        TRUNCATE TABLE appointments, patients, doctors, insurances RESTART IDENTITY CASCADE
      `);
      await client.query('COMMIT');
      await PatientHistory.deleteMany({});
    }

    const patientEmails = new Set();
    const doctorEmails = new Set();
    const insuranceNames = new Set();
    const appointmentIds = new Set();

    for (const row of rows) {
      const pEmail = normalizeEmail(row.patient_email);
      const dEmail = normalizeEmail(row.doctor_email);
      const pName = normalizeName(row.patient_name);
      const dName = normalizeName(row.doctor_name);
      const insName = (row.insurance_provider || '').trim();
      const covPct = parseFloat(row.coverage_percentage) || 0;
      const cost = parseFloat(row.treatment_cost) || 0;
      const paid = parseFloat(row.amount_paid) || 0;

      if (!pEmail || !dEmail) continue;

      // ── Insurances ──
      if (!insuranceNames.has(insName)) {
        await client.query(
          `INSERT INTO insurances (name, coverage_percentage) VALUES ($1, $2)
           ON CONFLICT (name) DO UPDATE SET coverage_percentage = EXCLUDED.coverage_percentage`,
          [insName, covPct]
        );
        insuranceNames.add(insName);
      }

      // ── Doctors ──
      if (!doctorEmails.has(dEmail)) {
        await client.query(
          `INSERT INTO doctors (name, email, specialty) VALUES ($1, $2, $3)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty`,
          [dName, dEmail, (row.specialty || '').trim()]
        );
        doctorEmails.add(dEmail);
      }

      // ── Patients ──
      if (!patientEmails.has(pEmail)) {
        await client.query(
          `INSERT INTO patients (name, email, phone, address) VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, address = EXCLUDED.address`,
          [pName, pEmail, (row.patient_phone || '').trim(), (row.patient_address || '').trim()]
        );
        patientEmails.add(pEmail);
      }

      // ── Appointments ──
      const aptId = (row.appointment_id || '').trim();
      if (!aptId || appointmentIds.has(aptId)) continue;

      const pRes = await client.query('SELECT id FROM patients WHERE email = $1', [pEmail]);
      const dRes = await client.query('SELECT id FROM doctors WHERE email = $1', [dEmail]);
      const iRes = await client.query('SELECT id FROM insurances WHERE name = $1', [insName]);
      if (!pRes.rows[0] || !dRes.rows[0] || !iRes.rows[0]) continue;

      await client.query(
        `INSERT INTO appointments (
          appointment_id, appointment_date, patient_id, doctor_id,
          treatment_code, treatment_description, treatment_cost, insurance_id, amount_paid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (appointment_id) DO NOTHING`,
        [
          aptId,
          row.appointment_date,
          pRes.rows[0].id,
          dRes.rows[0].id,
          (row.treatment_code || '').trim(),
          (row.treatment_description || '').trim(),
          cost,
          iRes.rows[0].id,
          paid,
        ]
      );
      appointmentIds.add(aptId);
    }

    // ── MongoDB: patient histories (one doc per patient, appointments embedded) ──
    const patientMap = new Map();
    for (const row of rows) {
      const pEmail = normalizeEmail(row.patient_email);
      const dEmail = normalizeEmail(row.doctor_email);
      if (!pEmail) continue;

      if (!patientMap.has(pEmail)) {
        patientMap.set(pEmail, {
          patientEmail: pEmail,
          patientName: normalizeName(row.patient_name),
          appointments: [],
        });
      }
      patientMap.get(pEmail).appointments.push({
        appointmentId: (row.appointment_id || '').trim(),
        date: row.appointment_date,
        doctorName: normalizeName(row.doctor_name),
        doctorEmail: dEmail,
        specialty: (row.specialty || '').trim(),
        treatmentCode: (row.treatment_code || '').trim(),
        treatmentDescription: (row.treatment_description || '').trim(),
        treatmentCost: parseFloat(row.treatment_cost) || 0,
        insuranceProvider: (row.insurance_provider || '').trim(),
        coveragePercentage: parseFloat(row.coverage_percentage) || 0,
        amountPaid: parseFloat(row.amount_paid) || 0,
      });
    }

    const toUpsert = Array.from(patientMap.values());
    if (toUpsert.length > 0) {
      for (const doc of toUpsert) {
        await PatientHistory.findOneAndUpdate(
          { patientEmail: doc.patientEmail },
          { $set: { patientName: doc.patientName, appointments: doc.appointments } },
          { upsert: true, new: true }
        );
      }
    }

    const histories = await PatientHistory.countDocuments();
    const [pCount, dCount, iCount, aCount] = await Promise.all([
      client.query('SELECT COUNT(*) AS c FROM patients'),
      client.query('SELECT COUNT(*) AS c FROM doctors'),
      client.query('SELECT COUNT(*) AS c FROM insurances'),
      client.query('SELECT COUNT(*) AS c FROM appointments'),
    ]);

    return {
      patients: parseInt(pCount.rows[0].c, 10),
      doctors: parseInt(dCount.rows[0].c, 10),
      insurances: parseInt(iCount.rows[0].c, 10),
      appointments: parseInt(aCount.rows[0].c, 10),
      histories,
      csvPath,
    };
  } finally {
    client.release();
  }
}
