const router = require('express').Router();
const XLSX = require('xlsx');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.get('/export', requireAuth, requireRole('admin'), (req, res) => {
  const { format = 'csv', status, startDate, endDate, fiscal_year } = req.query;
  const db = getDb();

  const conditions = [];
  const params = [];
  if (status) { conditions.push('e.status=?'); params.push(status); }
  if (startDate) { conditions.push('e.date>=?'); params.push(startDate); }
  if (endDate) { conditions.push('e.date<=?'); params.push(endDate); }
  if (fiscal_year) { conditions.push('e.fiscal_year=?'); params.push(fiscal_year); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const expenses = db.prepare(`
    SELECT e.id, u.name as submitted_by, e.category, e.description, e.amount,
           e.date, e.status, e.submitted_at, e.rejection_reason, r.name as reviewed_by, e.reviewed_at
    FROM expenses e JOIN users u ON e.user_id=u.id LEFT JOIN users r ON e.reviewed_by=r.id
    ${where} ORDER BY e.submitted_at DESC
  `).all(...params);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(expenses);
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');

  const timestamp = new Date().toISOString().split('T')[0];
  if (format === 'xlsx') {
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename=expenses_${timestamp}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } else {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader('Content-Disposition', `attachment; filename=expenses_${timestamp}.csv`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  }
});

module.exports = router;
