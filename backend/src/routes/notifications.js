const router = require('express').Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const notifs = getDb().prepare(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  const unread = getDb().prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).c;
  res.json({ notifications: notifs, unread });
});

router.put('/read', requireAuth, (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ message: 'Marked all as read' });
});

router.put('/:id/read', requireAuth, (req, res) => {
  getDb().prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

module.exports = router;
