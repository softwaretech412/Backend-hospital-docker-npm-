import { pool } from '../config/postgres.js';
import { PatientHistory } from '../config/mongodb.js';

/**
 * List all patients from PostgreSQL (master data).
 */
export async function listPatients() {
  const result = await pool.query(
    'SELECT id, name, email, phone, address FROM patients ORDER BY name'
  );
  return result.rows;
}

/**
 * List all patient histories from MongoDB (patient_histories collection).
 */
export async function listAllHistories() {
  const docs = await PatientHistory.find({}).lean().sort({ patientEmail: 1 });
  return docs.map((doc) => ({
    patientEmail: doc.patientEmail,
    patientName: doc.patientName,
    appointmentCount: (doc.appointments || []).length,
  }));
}

/**
 * Get full patient history by email from MongoDB (read-optimized document).
 * Includes summary: totalAppointments, totalSpent, mostFrequentSpecialty.
 */
export async function getPatientHistoryByEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;

  const doc = await PatientHistory.findOne({ patientEmail: normalized }).lean();
  if (!doc) return null;

  const appointments = (doc.appointments || []).map((apt) => ({
    appointmentId: apt.appointmentId,
    date: apt.date,
    doctorName: apt.doctorName,
    doctorEmail: apt.doctorEmail,
    specialty: apt.specialty,
    treatmentCode: apt.treatmentCode,
    treatmentDescription: apt.treatmentDescription,
    treatmentCost: apt.treatmentCost,
    insuranceProvider: apt.insuranceProvider,
    coveragePercentage: apt.coveragePercentage,
    amountPaid: apt.amountPaid,
  }));

  const totalAppointments = appointments.length;
  const totalSpent = appointments.reduce((sum, a) => sum + (a.amountPaid || 0), 0);
  const specialtyCounts = {};
  appointments.forEach((a) => {
    const s = a.specialty || 'Unknown';
    specialtyCounts[s] = (specialtyCounts[s] || 0) + 1;
  });
  const mostFrequentSpecialty =
    Object.keys(specialtyCounts).length > 0
      ? Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    patient: {
      email: doc.patientEmail,
      name: doc.patientName,
    },
    appointments,
    summary: {
      totalAppointments,
      totalSpent,
      mostFrequentSpecialty,
    },
  };
}
