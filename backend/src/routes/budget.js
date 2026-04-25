const router = require('express').Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getCurrentFY, getFYList } = require('../utils/fiscalYear');

// GET /api/budget?fy=FY2026-27
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const fy = req.query.fy || getCurrentFY();

  const budget = db.prepare('SELECT * FROM budget WHERE fiscal_year=? ORDER BY id DESC LIMIT 1').get(fy);
  const approvedTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE status='approved' AND fiscal_year=?").get(fy).total;
  const pendingCount = db.prepare("SELECT COUNT(*) as c FROM expenses WHERE status='pending'").get().c;
  const pendingTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE status='pending'").get().total;

  const byCategory = db.prepare(`
    SELECT category, COALESCE(SUM(amount),0) as total, COUNT(*) as count
    FROM expenses WHERE status='approved' AND fiscal_year=?
    GROUP BY category
  `).all(fy);

  // Build full 12-month FY series (Apr → Mar) always, fill zeros for missing months
  const startYear = parseInt(fy.replace('FY', '').split('-')[0]); // e.g. 2024
  const fyMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(startYear, 3 + i); // April = month index 3
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Get actual expense data grouped by month
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN status='approved' THEN amount ELSE 0 END),0) as approved,
           COALESCE(SUM(CASE WHEN status='rejected' THEN amount ELSE 0 END),0) as rejected,
           COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) as pending,
           COUNT(*) as count
    FROM expenses WHERE fiscal_year=?
    GROUP BY month
  `).all(fy);

  const monthMap = Object.fromEntries(rows.map(r => [r.month, r]));

  // Merge: all 12 FY months with data + cumulative running total
  let cumulative = 0;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthly = fyMonths.map(month => {
    const data = monthMap[month] || { approved: 0, rejected: 0, pending: 0, count: 0 };
    cumulative += data.approved;
    const isFuture = month > currentMonth;
    return {
      month,
      approved: data.approved,
      pending: data.pending,
      rejected: data.rejected,
      count: data.count,
      cumulative: isFuture ? null : cumulative, // null for future months so line stops
      isFuture,
    };
  });

  const fyList = getFYList();

  res.json({
    fiscalYear: fy,
    currentFY: getCurrentFY(),
    fyList,
    totalBudget: budget ? budget.total_budget : 0,
    approvedTotal,
    remaining: budget ? budget.total_budget - approvedTotal : 0,
    pendingCount,
    pendingTotal,
    byCategory,
    monthly,
    budgetUpdatedAt: budget ? budget.updated_at : null,
    budgetNotes: budget ? budget.notes : null
  });
});


// PUT /api/budget — admin sets budget for a FY
router.put('/', requireAuth, requireRole('admin'), (req, res) => {
  const { total_budget, notes, fiscal_year } = req.body;
  if (!total_budget || isNaN(total_budget) || total_budget <= 0) {
    return res.status(400).json({ error: 'Valid budget amount required' });
  }
  const fy = fiscal_year || getCurrentFY();
  const db = getDb();
  db.prepare('INSERT INTO budget (total_budget,updated_by,fiscal_year,notes) VALUES (?,?,?,?)').run(
    parseFloat(total_budget), req.user.id, fy, notes || null
  );
  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,details) VALUES (?,?,?,?,?)').run(
    req.user.id, req.user.name, 'BUDGET_SET', 'budget',
    JSON.stringify({ amount: parseFloat(total_budget), fiscal_year: fy, notes })
  );
  res.json({ message: 'Budget updated', total_budget: parseFloat(total_budget), fiscal_year: fy });
});

module.exports = router;
