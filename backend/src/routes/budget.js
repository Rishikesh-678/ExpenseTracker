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
  const pendingCount = db.prepare("SELECT COUNT(*) as c FROM expenses WHERE status='pending' AND fiscal_year=?").get(fy).c;
  const pendingTotal = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE status='pending' AND fiscal_year=?").get(fy).total;

  const byCategoryRaw = db.prepare(`
    SELECT category, COALESCE(SUM(amount),0) as total, COUNT(*) as count
    FROM expenses WHERE status='approved' AND fiscal_year=?
    GROUP BY category
  `).all(fy);

  const categoryBudgets = db.prepare('SELECT category, allocated_amount FROM category_budgets WHERE fiscal_year=?').all(fy);
  const catBudgetMap = {};
  categoryBudgets.forEach(cb => { catBudgetMap[cb.category] = cb.allocated_amount; });

  // Merge spend with allocations; also include categories with allocation but no spend
  const spendCats = new Set(byCategoryRaw.map(c => c.category));
  const byCategory = byCategoryRaw.map(c => ({ ...c, allocated: catBudgetMap[c.category] || 0 }));
  for (const cb of categoryBudgets) {
    if (!spendCats.has(cb.category)) {
      byCategory.push({ category: cb.category, total: 0, count: 0, allocated: cb.allocated_amount });
    }
  }

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

  // Get planned/unplanned breakdown for approved expenses
  const typeRows = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
           COALESCE(SUM(CASE WHEN expense_type='planned' THEN amount ELSE 0 END),0) as planned,
           COALESCE(SUM(CASE WHEN expense_type='unplanned' THEN amount ELSE 0 END),0) as unplanned,
           COALESCE(SUM(CASE WHEN expense_type IS NULL THEN amount ELSE 0 END),0) as unclassified
    FROM expenses WHERE status='approved' AND fiscal_year=?
    GROUP BY month
  `).all(fy);

  const monthMap = Object.fromEntries(rows.map(r => [r.month, r]));
  const typeMap = Object.fromEntries(typeRows.map(r => [r.month, r]));

  // Merge: all 12 FY months with data + cumulative running total
  let cumulative = 0;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const monthly = fyMonths.map(month => {
    const data = monthMap[month] || { approved: 0, rejected: 0, pending: 0, count: 0 };
    const typeData = typeMap[month] || { planned: 0, unplanned: 0, unclassified: 0 };
    cumulative += data.approved;
    const isFuture = month > currentMonth;
    return {
      month,
      approved: data.approved,
      pending: data.pending,
      rejected: data.rejected,
      count: data.count,
      planned: typeData.planned,
      unplanned: typeData.unplanned,
      unclassified: typeData.unclassified,
      cumulative: isFuture ? null : cumulative, // null for future months so line stops
      isFuture,
    };
  });

  const fyList = getFYList();

  // Find the single expense that first pushed each over-budget category over its limit
  const tippingExpenseIds = [];
  for (const cat of byCategory) {
    if (cat.allocated > 0 && cat.total > cat.allocated) {
      const catExpenses = db.prepare(`
        SELECT id, amount FROM expenses
        WHERE category=? AND status='approved' AND fiscal_year=?
        ORDER BY COALESCE(reviewed_at, submitted_at) ASC, id ASC
      `).all(cat.category, fy);
      let running = 0;
      for (const exp of catExpenses) {
        running += exp.amount;
        if (running > cat.allocated) {
          tippingExpenseIds.push(exp.id);
          break;
        }
      }
    }
  }

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
    budgetNotes: budget ? budget.notes : null,
    categoryBudgets,
    tippingExpenseIds,
  });
});


// PUT /api/budget — admin sets budget for a FY
router.put('/', requireAuth, requireRole('admin'), (req, res) => {
  const { notes, fiscal_year, category_allocations } = req.body;

  if (!Array.isArray(category_allocations) || category_allocations.length === 0) {
    return res.status(400).json({ error: 'At least one category allocation is required' });
  }

  // Total budget is derived from category allocations
  const total_budget = category_allocations.reduce((sum, ca) => {
    const amt = parseFloat(ca.amount);
    return sum + (isNaN(amt) || amt < 0 ? 0 : amt);
  }, 0);

  if (total_budget <= 0) {
    return res.status(400).json({ error: 'Total budget must be greater than 0' });
  }

  const fy = fiscal_year || getCurrentFY();
  const db = getDb();

  db.prepare('INSERT INTO budget (total_budget,updated_by,fiscal_year,notes) VALUES (?,?,?,?)').run(
    total_budget, req.user.id, fy, notes || null
  );

  const upsert = db.prepare(`
    INSERT INTO category_budgets (fiscal_year, category, allocated_amount, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(fiscal_year, category) DO UPDATE SET
      allocated_amount = excluded.allocated_amount,
      updated_by = excluded.updated_by,
      updated_at = datetime('now')
  `);
  for (const ca of category_allocations) {
    const amt = parseFloat(ca.amount);
    if (ca.category && !isNaN(amt) && amt >= 0) {
      upsert.run(fy, ca.category, amt, req.user.id);
    }
  }

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,details) VALUES (?,?,?,?,?)').run(
    req.user.id, req.user.name, 'BUDGET_SET', 'budget',
    JSON.stringify({ total_budget, fiscal_year: fy, notes, category_allocations })
  );
  res.json({ message: 'Budget updated', total_budget, fiscal_year: fy });
});

module.exports = router;
