import { Router } from 'express';
import { getRevenueReport } from '../services/reportService.js';

const router = Router();

/**
 * GET /api/reports/revenue
 * Query: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD) - optional
 */
router.get('/revenue', async (req, res) => {
  try {
    const startDate = req.query.startDate?.trim() || undefined;
    const endDate = req.query.endDate?.trim() || undefined;
    const report = await getRevenueReport({ startDate, endDate });
    res.json({
      ok: true,
      report: {
        totalRevenue: report.totalRevenue,
        byInsurance: report.byInsurance,
        period: report.period,
      },
    });
  } catch (err) {
    console.error('Revenue report error:', err);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

export default router;
