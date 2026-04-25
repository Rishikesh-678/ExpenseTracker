const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// List all users (Admin)
router.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const users = getDb().prepare('SELECT id,name,email,role,is_active,created_at FROM users ORDER BY created_at DESC').all();
  res.json({ users });
});

// Create user (Admin)
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
  const validRoles = ['admin', 'user'];
  if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(name, email.toLowerCase().trim(), hash, role || 'user');

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'USER_CREATED', 'user', result.lastInsertRowid, JSON.stringify({ name, email, role: role || 'user' })
  );
  res.status(201).json({ message: 'User created', userId: result.lastInsertRowid });
});

// Update user (Admin)
router.put('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const { name, role, is_active, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (parseInt(req.params.id) === req.user.id && role && role !== 'admin') {
    return res.status(400).json({ error: 'Cannot demote your own admin account' });
  }

  const updates = [];
  const vals = [];
  if (name) { updates.push('name=?'); vals.push(name); }
  if (role) { updates.push('role=?'); vals.push(role); }
  if (is_active !== undefined) { updates.push('is_active=?'); vals.push(is_active ? 1 : 0); }
  if (password) { updates.push('password_hash=?'); vals.push(bcrypt.hashSync(password, 10)); }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
  vals.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'USER_UPDATED', 'user', req.params.id, JSON.stringify({ name, role, is_active })
  );
  res.json({ message: 'User updated' });
});

// Delete user (Admin)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET is_active=0 WHERE id=?').run(req.params.id);
  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'USER_DEACTIVATED', 'user', req.params.id, JSON.stringify({ email: user.email })
  );
  res.json({ message: 'User deactivated' });
});

module.exports = router;
