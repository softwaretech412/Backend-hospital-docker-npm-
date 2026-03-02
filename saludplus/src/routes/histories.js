import { Router } from 'express';
import { listAllHistories } from '../services/patientService.js';

const router = Router();

/**
 * GET /api/histories
 * List all patient histories (from MongoDB patient_histories).
 */
router.get('/', async (req, res) => {
  try {
    const histories = await listAllHistories();
    res.json({ ok: true, histories });
  } catch (err) {
    console.error('List histories error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
