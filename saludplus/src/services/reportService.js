import { pool } from '../config/postgres.js';

/**
 * Revenue report: total and by insurance. Optional date range (startDate, endDate in YYYY-MM-DD).
 */
export async function getRevenueReport(options = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (options.startDate) {
    conditions.push(`appointment_date >= $${idx++}`);
    params.push(options.startDate);
  }
  if (options.endDate) {
    conditions.push(`appointment_date <= $${idx++}`);
    params.push(options.endDate);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const whereForJoin = conditions.length
    ? 'WHERE ' + conditions.map((c) => c.replace('appointment_date', 'a.appointment_date')).join(' AND ')
    : '';

  const [totalResult, byInsuranceResult] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(amount_paid), 0)::numeric AS total FROM appointments ${whereClause}`,
      params
    ),
    pool.query(
      conditions.length
        ? `
          SELECT i.name AS "insuranceName",
                 SUM(a.amount_paid)::numeric AS "totalAmount",
                 COUNT(a.id)::int AS "appointmentCount"
          FROM insurances i
          INNER JOIN appointments a ON a.insurance_id = i.id
          ${whereForJoin}
          GROUP BY i.id, i.name
          ORDER BY "totalAmount" DESC
        `
        : `
          SELECT i.name AS "insuranceName",
                 COALESCE(SUM(a.amount_paid), 0)::numeric AS "totalAmount",
                 COUNT(a.id)::int AS "appointmentCount"
          FROM insurances i
          LEFT JOIN appointments a ON a.insurance_id = i.id
          GROUP BY i.id, i.name
          ORDER BY "totalAmount" DESC
        `,
      conditions.length ? params : []
    ),
  ]);

  const totalRevenue = parseFloat(totalResult.rows[0]?.total || 0);
  const byInsurance = byInsuranceResult.rows.map((r) => ({
    insuranceName: r.insuranceName,
    totalAmount: parseFloat(r.totalAmount) || 0,
    appointmentCount: parseInt(r.appointmentCount, 10) || 0,
  }));

  return {
    totalRevenue,
    byInsurance,
    period: {
      startDate: options.startDate || null,
      endDate: options.endDate || null,
    },
  };
}
