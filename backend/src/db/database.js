const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { getFYForDate, getCurrentFY } = require('../utils/fiscalYear');

const DB_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DB_DIR, 'expense_tracker.db');

let db;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budget (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_budget REAL NOT NULL DEFAULT 0,
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      fiscal_year TEXT NOT NULL DEFAULT 'FY2024-25',
      notes TEXT,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Hardware','Software License','Cloud Billing','Miscellaneous')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      file_path TEXT,
      file_name TEXT,
      po_number TEXT,
      fiscal_year TEXT NOT NULL DEFAULT 'FY2024-25',
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_by INTEGER,
      reviewed_at TEXT,
      rejection_reason TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info','success','warning','error')),
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      related_expense_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER,
      actor_name TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      event TEXT NOT NULL CHECK(event IN ('LOGIN','LOGOUT')),
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_by INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing databases
  try { database.exec(`ALTER TABLE expenses ADD COLUMN po_number TEXT`); } catch (_) {}
  try { database.exec(`ALTER TABLE expenses ADD COLUMN fiscal_year TEXT NOT NULL DEFAULT 'FY2024-25'`); } catch (_) {}
  try { database.exec(`ALTER TABLE budget ADD COLUMN fiscal_year TEXT NOT NULL DEFAULT 'FY2024-25'`); } catch (_) {}

  // Create access_logs for existing DBs that don't have it yet
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        event TEXT NOT NULL CHECK(event IN ('LOGIN','LOGOUT')),
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch (_) {}

  // Migrate LOGIN records from audit_logs → access_logs, then remove them
  const loginRows = database.prepare("SELECT * FROM audit_logs WHERE action='LOGIN'").all();
  if (loginRows.length > 0) {
    const insAccess = database.prepare(
      'INSERT INTO access_logs (user_id, user_name, event, created_at) VALUES (?,?,?,?)'
    );
    for (const row of loginRows) {
      insAccess.run(row.actor_id, row.actor_name, 'LOGIN', row.created_at);
    }
    database.prepare("DELETE FROM audit_logs WHERE action='LOGIN'").run();
    console.log(`✅ Migrated ${loginRows.length} LOGIN record(s) to access_logs`);
  }

  // Backfill fiscal_year on expenses from their date
  const unfilled = database.prepare("SELECT id, date FROM expenses WHERE fiscal_year = 'FY2024-25' OR fiscal_year IS NULL").all();
  const updateFY = database.prepare('UPDATE expenses SET fiscal_year=? WHERE id=?');
  for (const row of unfilled) {
    updateFY.run(getFYForDate(row.date), row.id);
  }

  // Migration: remove hardcoded category CHECK constraint so custom categories work
  try {
    const tableInfo = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'").get();
    if (tableInfo && tableInfo.sql.includes("CHECK(category IN")) {
      database.pragma('foreign_keys = OFF');
      database.transaction(() => {
        database.exec(`
          CREATE TABLE expenses_v2 (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
            file_path TEXT,
            file_name TEXT,
            po_number TEXT,
            fiscal_year TEXT NOT NULL DEFAULT 'FY2024-25',
            submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
            reviewed_by INTEGER,
            reviewed_at TEXT,
            rejection_reason TEXT
          )
        `);
        database.exec(`INSERT INTO expenses_v2
          SELECT id, user_id, category, description, amount, date, status,
                 file_path, file_name, po_number,
                 COALESCE(fiscal_year, 'FY2024-25'),
                 submitted_at, reviewed_by, reviewed_at, rejection_reason
          FROM expenses
        `);
        database.exec(`DROP TABLE expenses`);
        database.exec(`ALTER TABLE expenses_v2 RENAME TO expenses`);
      })();
      database.pragma('foreign_keys = ON');
      console.log('✅ Migration: opened category constraint on expenses table');
    }
  } catch (e) {
    database.pragma('foreign_keys = ON');
    console.error('Category constraint migration error:', e.message);
  }

  // Ensure categories table exists (for older DBs) and seed default categories
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_by INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch (_) {}

  const defaults = ['Hardware', 'Software License', 'Cloud Billing', 'Miscellaneous'];
  const insCategory = database.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  for (const cat of defaults) insCategory.run(cat);

  seedData(database);
  return database;
}

function seedData(database) {
  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get();
  if (userCount.c > 0) return;

  const adminHash = bcrypt.hashSync('Admin@123', 10);
  const adminId = database.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)'
  ).run('Admin User', 'admin@netops.com', adminHash, 'admin').lastInsertRowid;

  const aliceHash = bcrypt.hashSync('User@123', 10);
  const aliceId = database.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)'
  ).run('Alice Johnson', 'alice@netops.com', aliceHash, 'user').lastInsertRowid;

  const bobHash = bcrypt.hashSync('User@123', 10);
  const bobId = database.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)'
  ).run('Bob Smith', 'bob@netops.com', bobHash, 'user').lastInsertRowid;

  database.prepare(
    'INSERT INTO budget (total_budget, updated_by, notes) VALUES (?,?,?)'
  ).run(50000, adminId, 'Initial FY2024 department budget');

  const ins = database.prepare(`
    INSERT INTO expenses (user_id,category,description,amount,date,status,reviewed_by,reviewed_at,rejection_reason)
    VALUES (@user_id,@category,@description,@amount,@date,@status,@reviewed_by,@reviewed_at,@rejection_reason)
  `);

  const sampleExpenses = [
    { user_id: aliceId, category: 'Hardware', description: 'Dell Monitors x4', amount: 1200, date: '2024-01-15', status: 'approved', reviewed_by: adminId, reviewed_at: '2024-01-16', rejection_reason: null },
    { user_id: aliceId, category: 'Software License', description: 'Adobe Creative Cloud Annual', amount: 599.99, date: '2024-01-20', status: 'approved', reviewed_by: adminId, reviewed_at: '2024-01-21', rejection_reason: null },
    { user_id: bobId, category: 'Cloud Billing', description: 'AWS EC2 Instances - January', amount: 3200, date: '2024-02-01', status: 'approved', reviewed_by: adminId, reviewed_at: '2024-02-02', rejection_reason: null },
    { user_id: aliceId, category: 'Hardware', description: 'Cisco Network Switch', amount: 2800, date: '2024-02-10', status: 'rejected', reviewed_by: adminId, reviewed_at: '2024-02-11', rejection_reason: 'Over budget for this quarter. Please resubmit next quarter.' },
    { user_id: bobId, category: 'Miscellaneous', description: 'IT Training Materials', amount: 450, date: '2024-03-05', status: 'approved', reviewed_by: adminId, reviewed_at: '2024-03-06', rejection_reason: null },
    { user_id: aliceId, category: 'Software License', description: 'GitHub Enterprise - 10 seats', amount: 2100, date: '2024-03-15', status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null },
    { user_id: bobId, category: 'Cloud Billing', description: 'GCP Storage - Q1', amount: 1850, date: '2024-03-20', status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null },
    { user_id: aliceId, category: 'Hardware', description: 'USB-C Docking Stations x6', amount: 780, date: '2024-04-01', status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null },
  ];
  for (const e of sampleExpenses) ins.run(e);

  const notif = database.prepare('INSERT INTO notifications (user_id,message,type,related_expense_id) VALUES (?,?,?,?)');
  notif.run(aliceId, 'Your expense "Dell Monitors x4" has been approved ✅', 'success', 1);
  notif.run(aliceId, 'Your expense "Adobe Creative Cloud Annual" has been approved ✅', 'success', 2);
  notif.run(aliceId, 'Your expense "Cisco Network Switch" was rejected. Reason: Over budget for this quarter.', 'error', 4);
  notif.run(bobId, 'Your expense "AWS EC2 Instances - January" has been approved ✅', 'success', 3);
  notif.run(adminId, 'New expense: "GitHub Enterprise - 10 seats" by Alice Johnson ($2,100.00)', 'info', 6);
  notif.run(adminId, 'New expense: "GCP Storage - Q1" by Bob Smith ($1,850.00)', 'info', 7);
  notif.run(adminId, 'New expense: "USB-C Docking Stations x6" by Alice Johnson ($780.00)', 'info', 8);

  const audit = database.prepare('INSERT INTO audit_logs (actor_id,actor_name,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)');
  audit.run(adminId, 'Admin User', 'BUDGET_SET', 'budget', 1, JSON.stringify({ amount: 50000 }));
  audit.run(adminId, 'Admin User', 'EXPENSE_APPROVED', 'expense', 1, JSON.stringify({ description: 'Dell Monitors x4', amount: 1200 }));
  audit.run(adminId, 'Admin User', 'EXPENSE_APPROVED', 'expense', 2, JSON.stringify({ description: 'Adobe Creative Cloud Annual', amount: 599.99 }));
  audit.run(adminId, 'Admin User', 'EXPENSE_APPROVED', 'expense', 3, JSON.stringify({ description: 'AWS EC2 Instances - January', amount: 3200 }));
  audit.run(adminId, 'Admin User', 'EXPENSE_REJECTED', 'expense', 4, JSON.stringify({ description: 'Cisco Network Switch', reason: 'Over budget' }));
  audit.run(adminId, 'Admin User', 'EXPENSE_APPROVED', 'expense', 5, JSON.stringify({ description: 'IT Training Materials', amount: 450 }));

  console.log('✅ Database seeded with sample data');
}

module.exports = { getDb, initDb };
