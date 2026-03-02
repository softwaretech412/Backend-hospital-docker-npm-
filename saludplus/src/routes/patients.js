import { Router } from 'express';
import { listPatients, getPatientHistoryByEmail } from '../services/patientService.js';

const router = Router();

/**
 * GET /api/patients
 * List all patients (from PostgreSQL).
 */
router.get('/', async (req, res) => {
  try {
    const patients = await listPatients();
    res.json({ ok: true, patients });
  } catch (err) {
    console.error('List patients error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/patients/:email/history
 * Returns patient info + full appointments + summary (totalAppointments, totalSpent, mostFrequentSpecialty).
 */
router.get('/:email/history', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || '').trim();
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }
    const history = await getPatientHistoryByEmail(email);
    if (!history) {
      return res.status(404).json({ ok: false, error: 'Patient not found' });
    }
    res.json({
      ok: true,
      patient: history.patient,
      appointments: history.appointments,
      summary: history.summary,
    });
  } catch (err) {
    console.error('Patient history error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
