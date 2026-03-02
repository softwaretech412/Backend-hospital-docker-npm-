import { Router } from 'express';
import * as doctorService from '../services/doctorService.js';

const router = Router();

/**
 * GET /api/doctors
 * Query: specialty (optional) - filter by specialty
 */
router.get('/', async (req, res) => {
  try {
    const specialty = req.query.specialty?.trim() || undefined;
    const doctors = await doctorService.listDoctors({ specialty });
    res.json({ ok: true, doctors });
  } catch (err) {
    console.error('List doctors error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/doctors/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const doctor = await doctorService.getDoctorById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found' });
    }
    res.json({ ok: true, doctor });
  } catch (err) {
    console.error('Get doctor error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/doctors/:id
 * Body: { name?, email?, specialty? }
 * Propagates name/email/specialty to MongoDB patient_histories.
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, email, specialty } = req.body || {};
    if (email !== undefined) {
      const taken = await doctorService.isEmailTakenByOther(email, req.params.id);
      if (taken) {
        return res.status(400).json({ ok: false, error: 'Email already in use by another doctor' });
      }
    }
    const doctor = await doctorService.updateDoctor(req.params.id, { name, email, specialty });
    if (!doctor) {
      return res.status(404).json({ ok: false, error: 'Doctor not found' });
    }
    res.json({
      ok: true,
      message: 'Doctor updated successfully',
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty,
        createdAt: doctor.createdAt,
      },
    });
  } catch (err) {
    console.error('Update doctor error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
