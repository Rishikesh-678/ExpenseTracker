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

function handleUpload(req, res, next) {
  upload.single('invoice')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload error' });
    }
    next();
  });
}

function validateExpensePayload(body, db) {
  const { category, description, amount, date, po_number, vendor_name, reference_link, business_line, project } = body;
  if (!category || !description || !amount || !date) {
    return { error: 'Category, description, amount, and date are required' };
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10_000_000) {
    return { error: 'Amount must be a positive number not exceeding ₹10,000,000' };
  }
  if (description.length > 500) return { error: 'Description must be 500 characters or fewer' };
  if (po_number && po_number.length > 100) return { error: 'PO number must be 100 characters or fewer' };
  if (vendor_name && vendor_name.length > 200) return { error: 'Vendor name must be 200 characters or fewer' };
  if (reference_link) {
    try { new URL(reference_link); } catch (_) { return { error: 'Invalid reference link URL — must start with http:// or https://' }; }
    if (reference_link.length > 500) return { error: 'Reference link must be 500 characters or fewer' };
  }
  if (business_line && business_line.length > 200) return { error: 'Business line must be 200 characters or fewer' };
  if (project && project.length > 200) return { error: 'Project must be 200 characters or fewer' };

  const validCat = db.prepare('SELECT id FROM categories WHERE name=? AND is_active=1').get(category);
  if (!validCat) return { error: 'Invalid or inactive category' };

  return {
    value: {
      category,
      description,
      amount: parsedAmount,
      date,
      po_number: po_number ? po_number.trim() : null,
      vendor_name: vendor_name ? vendor_name.trim() : null,
      fiscal_year: getFYForDate(date),
      reference_link: reference_link ? reference_link.trim() : null,
      business_line: business_line ? business_line.trim() : null,
      project: project ? project.trim() : null,
    }
  };
}

// Submit expense
router.post('/', requireAuth, handleUpload, (req, res) => {
  const db = getDb();
  const validated = validateExpensePayload(req.body, db);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const { category, description, amount, date, po_number, vendor_name, fiscal_year, reference_link, business_line, project } = validated.value;

  const result = db.prepare(`
    INSERT INTO expenses (user_id,category,description,amount,date,file_path,file_name,po_number,vendor_name,fiscal_year,reference_link,business_line,project)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, category, description, amount, date,
    req.file ? req.file.filename : null,
    req.file ? req.file.originalname : null,
    po_number,
    vendor_name,
    fiscal_year,
    reference_link,
    business_line,
    project);

  const admins = db.prepare('SELECT id FROM users WHERE role=? AND is_active=1').all('admin');
  const notifStmt = db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)');
  for (const admin of admins) {
    notifStmt.run(admin.id, `New expense: "${description}" by ${req.user.name} (₹${amount.toFixed(2)})${po_number ? ` · PO: ${po_number}` : ''}`, 'info', result.lastInsertRowid);
  }

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'EXPENSE_SUBMITTED', 'expense', result.lastInsertRowid,
    JSON.stringify({ category, description, amount, date, po_number: po_number || null, vendor_name: vendor_name || null, reference_link: reference_link || null, business_line: business_line || null, project: project || null })
  );

  res.status(201).json({ message: 'Expense submitted', expense: db.prepare('SELECT * FROM expenses WHERE id=?').get(result.lastInsertRowid) });
});

// List expenses
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const { status, category, fiscal_year, month, quarter, search, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (req.user.role !== 'admin') { conditions.push('e.user_id=?'); params.push(req.user.id); }
  if (status) { conditions.push('e.status=?'); params.push(status); }
  if (category) { conditions.push('e.category=?'); params.push(category); }
  if (fiscal_year) { conditions.push('e.fiscal_year=?'); params.push(fiscal_year); }
  if (month) { conditions.push("strftime('%Y-%m', e.date)=?"); params.push(month); }
  if (search) {
    const s = `%${search}%`;
    conditions.push(`(e.description LIKE ? OR e.vendor_name LIKE ? OR e.po_number LIKE ? OR e.business_line LIKE ? OR e.project LIKE ?)`);
    params.push(s, s, s, s, s);
  }
  if (quarter) {
    // Indian FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    const qMap = { Q1: [4,5,6], Q2: [7,8,9], Q3: [10,11,12], Q4: [1,2,3] };
    const qMonths = qMap[quarter];
    if (qMonths) {
      conditions.push(`CAST(strftime('%m', e.date) AS INTEGER) IN (${qMonths.join(',')})`);
    }
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  // ⚠️  SECURITY NOTE: ORDER BY is hardcoded intentionally. SQLite prepared-statement
  //    parameters cannot be used for column names, so adding user-controlled sorting
  //    (e.g. `ORDER BY ${req.query.sort}`) would create a SQL injection vulnerability.
  //    If sort-by-column is needed, validate against a strict allowlist first.
  let expenses;
  if (req.user.role === 'admin' && status === 'pending') {
    expenses = db.prepare(`
      SELECT e.*,u.name as user_name,u.email as user_email,r.name as reviewer_name,
             0 as is_update_request,NULL as update_request_id,NULL as original_expense_id,
             0 as has_pending_update_request,NULL as pending_update_request_id
      FROM expenses e
      JOIN users u ON e.user_id=u.id
      LEFT JOIN users r ON e.reviewed_by=r.id
      ${where}

      UNION ALL

      SELECT
        eur.expense_id as id,
        eur.user_id,
        eur.category,
        eur.description,
        eur.amount,
        eur.date,
        'pending' as status,
        eur.file_path,
        eur.file_name,
        eur.po_number,
        eur.vendor_name,
        eur.fiscal_year,
        eur.submitted_at,
        NULL as reviewed_by,
        NULL as reviewed_at,
        NULL as rejection_reason,
        eur.reference_link,
        NULL as expense_type,
        eur.business_line,
        eur.project,
        u.name as user_name,
        u.email as user_email,
        NULL as reviewer_name,
        1 as is_update_request,
        eur.id as update_request_id,
        eur.expense_id as original_expense_id,
        0 as has_pending_update_request,
        NULL as pending_update_request_id
      FROM expense_update_requests eur
      JOIN users u ON eur.user_id=u.id
      WHERE eur.status='pending'
      ${category ? 'AND eur.category=?' : ''}

      ORDER BY submitted_at DESC LIMIT ? OFFSET ?
    `).all(...params, ...(category ? [category] : []), parseInt(limit), offset);
  } else {
    expenses = db.prepare(`
      SELECT e.*,u.name as user_name,u.email as user_email,r.name as reviewer_name,
             0 as is_update_request,NULL as update_request_id,NULL as original_expense_id,
             CASE WHEN eur_pending.id IS NULL THEN 0 ELSE 1 END as has_pending_update_request,
             eur_pending.id as pending_update_request_id
      FROM expenses e
      JOIN users u ON e.user_id=u.id
      LEFT JOIN users r ON e.reviewed_by=r.id
      LEFT JOIN (
        SELECT expense_id,user_id,MIN(id) as id
        FROM expense_update_requests
        WHERE status='pending'
        GROUP BY expense_id,user_id
      ) eur_pending
        ON eur_pending.expense_id=e.id AND eur_pending.user_id=e.user_id
      ${where} ORDER BY e.submitted_at DESC LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);
  }

  let total;
  if (req.user.role === 'admin' && status === 'pending') {
    const pendingExpenseCount = db.prepare(`SELECT COUNT(*) as t FROM expenses e ${where}`).get(...params).t;
    const pendingUpdateCount = db.prepare(`
      SELECT COUNT(*) as t
      FROM expense_update_requests
      WHERE status='pending' ${category ? 'AND category=?' : ''}
    `).get(...(category ? [category] : [])).t;
    total = pendingExpenseCount + pendingUpdateCount;
  } else {
    total = db.prepare(`SELECT COUNT(*) as t FROM expenses e ${where}`).get(...params).t;
  }
  res.json({ expenses, total, page: parseInt(page), limit: parseInt(limit) });
});

// Request update for an already approved expense (keeps approved record unchanged until re-approved)
router.post('/:id/update-request', requireAuth, handleUpload, (req, res) => {
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (expense.status !== 'approved') {
    return res.status(400).json({ error: 'Only approved expenses can be updated through re-review' });
  }

  const validated = validateExpensePayload(req.body, db);
  if (validated.error) return res.status(400).json({ error: validated.error });
  const { category, description, amount, date, po_number, vendor_name, fiscal_year, reference_link, business_line, project } = validated.value;

  const existingPending = db.prepare(`
    SELECT id FROM expense_update_requests
    WHERE expense_id=? AND user_id=? AND status='pending'
  `).get(expense.id, req.user.id);

  if (existingPending) {
    return res.status(400).json({ error: 'A pending update request already exists for this expense' });
  }

  const result = db.prepare(`
    INSERT INTO expense_update_requests
      (expense_id,user_id,category,description,amount,date,file_path,file_name,po_number,vendor_name,fiscal_year,reference_link,business_line,project)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    expense.id,
    req.user.id,
    category,
    description,
    amount,
    date,
    req.file ? req.file.filename : null,
    req.file ? req.file.originalname : null,
    po_number,
    vendor_name,
    fiscal_year,
    reference_link,
    business_line,
    project
  );

  const admins = db.prepare('SELECT id FROM users WHERE role=? AND is_active=1').all('admin');
  const notifStmt = db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)');
  for (const admin of admins) {
    notifStmt.run(
      admin.id,
      `Expense update requested: "${description}" by ${req.user.name} (₹${amount.toFixed(2)})`,
      'warning',
      expense.id
    );
  }

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id,
    req.user.name,
    'EXPENSE_UPDATE_REQUESTED',
    'expense',
    expense.id,
    JSON.stringify({
      update_request_id: result.lastInsertRowid,
      category, description, amount, date, po_number, vendor_name, reference_link, business_line, project,
    })
  );

  res.status(201).json({ message: 'Expense update submitted for admin review' });
});

router.put('/update-requests/:id/approve', requireAuth, requireRole('admin'), (req, res) => {
  const { expense_type } = req.body;
  const db = getDb();
  const updateReq = db.prepare('SELECT * FROM expense_update_requests WHERE id=?').get(req.params.id);
  if (!updateReq) return res.status(404).json({ error: 'Update request not found' });
  if (updateReq.status !== 'pending') return res.status(400).json({ error: 'Update request is not pending' });

  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(updateReq.expense_id);
  if (!expense) return res.status(404).json({ error: 'Original expense not found' });

  db.transaction(() => {
    db.prepare(`
      UPDATE expenses
      SET category=?,description=?,amount=?,date=?,
          file_path=COALESCE(?,file_path),
          file_name=COALESCE(?,file_name),
          po_number=?,vendor_name=?,fiscal_year=?,
          reference_link=COALESCE(?,reference_link),
          business_line=?,project=?,
          expense_type=COALESCE(?,expense_type),
          status='approved',reviewed_by=?,reviewed_at=datetime('now'),rejection_reason=NULL
      WHERE id=?
    `).run(
      updateReq.category,
      updateReq.description,
      updateReq.amount,
      updateReq.date,
      updateReq.file_path,
      updateReq.file_name,
      updateReq.po_number,
      updateReq.vendor_name,
      updateReq.fiscal_year,
      updateReq.reference_link,
      updateReq.business_line,
      updateReq.project,
      expense_type || null,
      req.user.id,
      expense.id
    );

    db.prepare(`
      UPDATE expense_update_requests
      SET status='approved',reviewed_by=?,reviewed_at=datetime('now')
      WHERE id=?
    `).run(req.user.id, updateReq.id);
  })();

  db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)').run(
    updateReq.user_id,
    `Your expense update request for "${updateReq.description}" has been approved ✅`,
    'success',
    expense.id
  );

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id,
    req.user.name,
    'EXPENSE_UPDATE_APPROVED',
    'expense',
    expense.id,
    JSON.stringify({ update_request_id: updateReq.id, amount: updateReq.amount, description: updateReq.description, expense_type: expense_type || null })
  );

  res.json({ message: 'Expense update request approved and applied' });
});

router.put('/update-requests/:id/reject', requireAuth, requireRole('admin'), (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
  if (reason.length > 500) return res.status(400).json({ error: 'Rejection reason must be 500 characters or fewer' });

  const db = getDb();
  const updateReq = db.prepare('SELECT * FROM expense_update_requests WHERE id=?').get(req.params.id);
  if (!updateReq) return res.status(404).json({ error: 'Update request not found' });
  if (updateReq.status !== 'pending') return res.status(400).json({ error: 'Update request is not pending' });

  db.prepare(`
    UPDATE expense_update_requests
    SET status='rejected',reviewed_by=?,reviewed_at=datetime('now'),rejection_reason=?
    WHERE id=?
  `).run(req.user.id, reason, updateReq.id);

  db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)').run(
    updateReq.user_id,
    `Your expense update request for "${updateReq.description}" was rejected. Reason: ${reason}`,
    'error',
    updateReq.expense_id
  );

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id,
    req.user.name,
    'EXPENSE_UPDATE_REJECTED',
    'expense',
    updateReq.expense_id,
    JSON.stringify({ update_request_id: updateReq.id, reason })
  );

  res.json({ message: 'Expense update request rejected' });
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
  const { expense_type } = req.body;
  const db = getDb();
  const expense = db.prepare('SELECT * FROM expenses WHERE id=?').get(req.params.id);
  if (!expense) return res.status(404).json({ error: 'Not found' });
  if (expense.status !== 'pending') return res.status(400).json({ error: 'Expense is not pending' });

  db.prepare("UPDATE expenses SET status='approved',reviewed_by=?,reviewed_at=datetime('now'),expense_type=? WHERE id=?").run(req.user.id, expense_type || null, expense.id);
  db.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)').run(
    expense.user_id, `Your expense "${expense.description}" (₹${expense.amount.toFixed(2)}) has been approved ✅`, 'success', expense.id
  );
  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'EXPENSE_APPROVED', 'expense', expense.id, JSON.stringify({ description: expense.description, amount: expense.amount, expense_type: expense_type || null })
  );
  res.json({ message: 'Expense approved' });
});

// Reject
router.put('/:id/reject', requireAuth, requireRole('admin'), (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Rejection reason required' });
  if (reason.length > 500) return res.status(400).json({ error: 'Rejection reason must be 500 characters or fewer' });
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
