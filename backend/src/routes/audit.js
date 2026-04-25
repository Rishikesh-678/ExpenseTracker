const router = require('express').Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// GET /api/audit — business action log (no LOGIN/LOGOUT)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();
  const logs = db.prepare(
    "SELECT * FROM audit_logs WHERE action != 'LOGIN' AND action != 'LOGOUT' ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(parseInt(limit), offset);
  const total = db.prepare("SELECT COUNT(*) as t FROM audit_logs WHERE action != 'LOGIN' AND action != 'LOGOUT'").get().t;
  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/audit/access — login/logout access log
router.get('/access', requireAuth, requireRole('admin'), (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDb();
  const logs = db.prepare(
    'SELECT * FROM access_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(parseInt(limit), offset);
  const total = db.prepare('SELECT COUNT(*) as t FROM access_logs').get().t;
  res.json({ logs, total, page: parseInt(page), limit: parseInt(limit) });
});

module.exports = router;
