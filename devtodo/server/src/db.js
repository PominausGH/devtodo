const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const generateId = () => `task-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

function createDb(dbPath = path.join(__dirname, '../data/devtodo.db')) {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      due_date TEXT,
      notes TEXT,
      docker_container_id TEXT,
      calendar_event_id TEXT,
      email_id TEXT,
      auto_completed INTEGER DEFAULT 0
    )
  `);

  // Create preferences table
  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  return db;
}

function createTask(db, task) {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO tasks (id, title, priority, source, due_date, notes, docker_container_id, calendar_event_id, email_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    task.title,
    task.priority || 'medium',
    task.source || 'manual',
    task.dueDate || null,
    task.notes || null,
    task.dockerContainerId || null,
    task.calendarEventId || null,
    task.emailId || null
  );

  return getTaskById(db, id);
}

function getTasks(db, filters = {}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (filters.completed !== undefined) {
    sql += ' AND completed = ?';
    params.push(filters.completed ? 1 : 0);
  }

  if (filters.source) {
    sql += ' AND source = ?';
    params.push(filters.source);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  return stmt.all(...params).map(formatTask);
}

function getTaskById(db, id) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
  const row = stmt.get(id);
  return row ? formatTask(row) : undefined;
}

function updateTask(db, id, updates) {
  const allowedFields = ['title', 'completed', 'priority', 'due_date', 'notes', 'completed_at', 'auto_completed'];
  const setClauses = [];
  const params = [];

  // Map camelCase to snake_case
  const fieldMap = {
    title: 'title',
    completed: 'completed',
    priority: 'priority',
    dueDate: 'due_date',
    notes: 'notes',
    completedAt: 'completed_at',
    autoCompleted: 'auto_completed',
  };

  for (const [key, value] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField && allowedFields.includes(dbField)) {
      setClauses.push(`${dbField} = ?`);
      params.push(value);
    }
  }

  if (setClauses.length === 0) return getTaskById(db, id);

  params.push(id);
  const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  return getTaskById(db, id);
}

function deleteTask(db, id) {
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  return stmt.run(id);
}

// Format database row to API response format
function formatTask(row) {
  return {
    id: row.id,
    title: row.title,
    completed: Boolean(row.completed),
    priority: row.priority,
    source: row.source,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    dueDate: row.due_date,
    notes: row.notes,
    dockerContainerId: row.docker_container_id,
    calendarEventId: row.calendar_event_id,
    emailId: row.email_id,
    autoCompleted: Boolean(row.auto_completed),
  };
}

module.exports = {
  createDb,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
