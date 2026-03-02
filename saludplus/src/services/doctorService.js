import { pool } from '../config/postgres.js';
import { PatientHistory } from '../config/mongodb.js';

/**
 * List doctors, optionally filtered by specialty.
 * @param {{ specialty?: string }} options
 */
export async function listDoctors(options = {}) {
  let query = 'SELECT id, name, email, specialty FROM doctors ORDER BY name';
  const params = [];
  if (options.specialty) {
    query = 'SELECT id, name, email, specialty FROM doctors WHERE specialty = $1 ORDER BY name';
    params.push(options.specialty);
  }
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get a single doctor by id.
 */
export async function getDoctorById(id) {
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return null;
  const result = await pool.query(
    `SELECT id, name, email, specialty,
            COALESCE(created_at, NOW())::timestamptz AS "createdAt"
     FROM doctors WHERE id = $1`,
    [numId]
  );
  return result.rows[0] || null;
}

/**
 * Check if another doctor (other than excludeId) has the given email.
 */
export async function isEmailTakenByOther(email, excludeId) {
  const result = await pool.query(
    'SELECT id FROM doctors WHERE email = $1 AND id != $2',
    [email, excludeId]
  );
  return result.rows.length > 0;
}

/**
 * Update doctor in PostgreSQL and propagate name/email to MongoDB patient_histories.
 */
export async function updateDoctor(id, data) {
  const numId = parseInt(id, 10);
  if (Number.isNaN(numId)) return null;

  const { name, email, specialty } = data;
  const updates = [];
  const values = [];
  let n = 1;
  if (name !== undefined) {
    updates.push(`name = $${n++}`);
    values.push(name);
  }
  if (email !== undefined) {
    updates.push(`email = $${n++}`);
    values.push(email);
  }
  if (specialty !== undefined) {
    updates.push(`specialty = $${n++}`);
    values.push(specialty);
  }
  if (updates.length === 0) return getDoctorById(id);

  values.push(numId);
  const oldRow = await pool.query('SELECT email FROM doctors WHERE id = $1', [numId]);
  const oldEmail = oldRow.rows[0]?.email;
  if (!oldEmail) return null;

  const result = await pool.query(
    `UPDATE doctors SET ${updates.join(', ')} WHERE id = $${n} RETURNING id, name, email, specialty`,
    values
  );
  const doctor = result.rows[0];
  if (!doctor) return null;
  const withCreated = await pool.query(
    'SELECT created_at AS "createdAt" FROM doctors WHERE id = $1',
    [numId]
  );
  doctor.createdAt = withCreated.rows[0]?.createdAt?.toISOString?.() || new Date().toISOString();

  // Propagate to NoSQL: update doctorName, doctorEmail, specialty in all appointments that reference this doctor
  const newEmail = doctor.email;
  const newName = doctor.name;
  const newSpecialty = doctor.specialty;

  const docs = await PatientHistory.find({
    'appointments.doctorEmail': oldEmail,
  });
  for (const doc of docs) {
    const appointments = doc.appointments.map((apt) => {
      if (apt.doctorEmail !== oldEmail) return apt;
      return {
        ...apt.toObject ? apt.toObject() : apt,
        doctorName: newName,
        doctorEmail: newEmail,
        specialty: newSpecialty,
      };
    });
    await PatientHistory.updateOne(
      { _id: doc._id },
      { $set: { appointments } }
    );
  }

  return doctor;
}
