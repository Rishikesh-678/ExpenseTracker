const router = require('express').Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// GET /api/categories — list all active categories
router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories WHERE is_active=1 ORDER BY id ASC').all();
  res.json({ categories });
});

// POST /api/categories — add a new category (any authenticated user)
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name required' });
  const trimmed = name.trim();
  if (trimmed.length > 50) return res.status(400).json({ error: 'Category name too long (max 50 characters)' });

  const db = getDb();
  // Check if it already exists (even inactive)
  const existing = db.prepare('SELECT * FROM categories WHERE name=?').get(trimmed);
  if (existing) {
    if (existing.is_active) return res.json({ category: existing, existed: true });
    // Reactivate if it was deactivated
    db.prepare('UPDATE categories SET is_active=1 WHERE id=?').run(existing.id);
    return res.json({ category: { ...existing, is_active: 1 }, existed: true });
  }

  const result = db.prepare('INSERT INTO categories (name, created_by) VALUES (?,?)').run(trimmed, req.user.id);
  const category = db.prepare('SELECT * FROM categories WHERE id=?').get(result.lastInsertRowid);

  db.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)').run(
    req.user.id, req.user.name, 'CATEGORY_CREATED', 'category', result.lastInsertRowid,
    JSON.stringify({ name: trimmed })
  );

  res.status(201).json({ category });
});

// DELETE /api/categories/:id — deactivate (admin only)
router.delete('/:id', requireAuth, requireRole('admin'), (req, res) => {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id=?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  db.prepare('UPDATE categories SET is_active=0 WHERE id=?').run(cat.id);
  res.json({ message: 'Category deactivated' });
});

module.exports = router;
