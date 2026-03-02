import { Router } from 'express';
import { migrate } from '../services/migrationService.js';

const router = Router();

/**
 * GET /api/simulacro - Info about the simulacro module (optional, for Postman collection)
 */
router.get('/', (req, res) => {
  res.json({
    ok: true,
    message: 'SaludPlus Simulacro API - Hybrid persistence (PostgreSQL + MongoDB)',
    endpoints: {
      migrate: 'POST /api/simulacro/migrate',
    },
  });
});

/**
 * POST /api/simulacro/migrate
 * Body: { "clearBefore": true } (optional)
 * Runs CSV migration to PostgreSQL + MongoDB. Returns stats.
 */
router.post('/migrate', async (req, res) => {
  try {
    const clearBefore = Boolean(req.body?.clearBefore);
    const result = await migrate(clearBefore);
    res.status(200).json({
      ok: true,
      message: 'Migration completed successfully',
      result: {
        patients: result.patients,
        doctors: result.doctors,
        insurances: result.insurances,
        appointments: result.appointments,
        histories: result.histories,
        csvPath: result.csvPath,
      },
    });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Error during migration',
    });
  }
});

export default router;
