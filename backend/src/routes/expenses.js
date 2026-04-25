const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getFYForDate } = require('../utils/fiscalYear');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /\.(jpg|jpeg|png|pdf)$/i.test(file.originalname) ? cb(null, true) : cb(new Error('Only JPG, PNG, PDF allowed'));
  }
});

// Submit expense
router.post('/', requireAuth, upload.single('invoice'), (req, res) => {
  const { category, description, amount, date, po_number } = req.body;
  if (!category || !description || !amount || !date) {
    return res.status(400).json({ error: 'Category, description, amount, and date are required' });
  }
  const db = getDb();
  // Validate category against the categories table (supports custom categories)
  const validCat = db.prepare('SELECT id FROM categories WHERE name=? AND is_active=1').get(category);
  if (!validCat) return res.status(400).json({ error: 'Invalid or inactive category' });
  const fiscalYear = getFYForDate(date);
  const result = db.prepare(`
    INSERT INTO expenses (user_id,category,description,amount,date,file_path,file_name,po_number,fiscal_year)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, category, description, parseFloat(amount), date,
    req.file ? req.file.filename : null,
    req.file ? req.file.originalname : null,
    po_number ? po_number.trim() : null,
    fiscalYear);

  const admins = db.prepare('SELECT id FROM users WHERE role=? AND is_active=1').all('admin');
  const notifStmt = db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)');
  for (const admin of admins) {
    notifStmt.run(admin.id, `New expense: "${description}" by ${req.user.name} (₹${parseFloat(amount).toFixed(2)})${po_number ? ` · PO: ${po_number}` : ''}`, 'info', result.lastInsertRowid);
  }

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'EXPENSE_SUBMITTED', 'expense', result.lastInsertRowid,
    JSON.stringify({ category, description, amount: parseFloat(amount), date, po_number: po_number || null })
  );

  res.status(201).json({ message: 'Expense submitted', expense: db.prepare('SELECT * FROM expenses WHERE id=?').get(result.lastInsertRowid) });
});

// List expenses
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { status, category, fiscal_year, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') { conditions.push('e.user_id=?'); params.push(req.user.id); }
  if (status) { conditions.push('e.status=?'); params.push(status); }
  if (category) { conditions.push('e.category=?'); params.push(category); }
  if (fiscal_year) { conditions.push('e.fiscal_year=?'); params.push(fiscal_year); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const expenses = db.prepare(`
    SELECT e.*,u.name as user_name,u.email as user_email,r.name as reviewer_name
    FROM expenses e
    JOIN users u ON e.user_id=u.id
    LEFT JOIN users r ON e.reviewed_by=r.id
    ${where} ORDER BY e.submitted_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`SELECT COUNT(*) as t FROM expenses e ${where}`).get(...params).t;
  res.json({ expenses, total, page: parseInt(page), limit: parseInt(limit) });
});

// Single expense
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const expense = db.prepare(`
    SELECT e.*,u.name as user_name,u.email as user_email,r.name as reviewer_name
    FROM expenses e JOIN users u ON e.user_id=u.id LEFT JOIN users r ON e.reviewed_by=r.id
    WHERE e.id=?
  `).get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'admin' && expense.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  res.json({ expense });
});

// Approve
router.put('/:id/approve', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.status !== 'pending') return res.status(400).json({ error: 'Expense is not pending' });

  db.prepare("UPDATE expenses SET status='approved',reviewed_by=?,reviewed_at=datetime('now') WHERE id=?").run(req.user.id, expense.id);
  db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)').run(
    expense.user_id, `Your expense "${expense.description}" (₹${expense.amount.toFixed(2)}) has been approved ✅`, 'success', expense.id
  );
  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'EXPENSE_APPROVED', 'expense', expense.id, JSON.stringify({ description: expense.description, amount: expense.amount })
  );
  res.json({ message: 'Expense approved' });
});

// Reject
router.put('/:id/reject', requireAuth, requireRole('admin'), (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.status !== 'pending') return res.status(400).json({ error: 'Expense is not pending' });

  db.prepare("UPDATE expenses SET status='rejected',reviewed_by=?,reviewed_at=datetime('now'),rejection_reason=? WHERE id=?").run(req.user.id, reason, expense.id);
  db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)').run(
    expense.user_id, `Your expense "${expense.description}" was rejected. Reason: ${reason}`, 'error', expense.id
  );
  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'EXPENSE_REJECTED', 'expense', expense.id, JSON.stringify({ description: expense.description, reason })
  );
  res.json({ message: 'Expense rejected' });
});

module.exports = router;
