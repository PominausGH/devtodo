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

  // Create git_repos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS git_repos (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_commit_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Add git completion columns to tasks table (if they don't exist)
  const columns = db.prepare("PRAGMA table_info(tasks)").all();
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('completed_by')) {
    db.exec("ALTER TABLE tasks ADD COLUMN completed_by TEXT DEFAULT NULL");
  }
  if (!columnNames.includes('git_commit_hash')) {
    db.exec("ALTER TABLE tasks ADD COLUMN git_commit_hash TEXT DEFAULT NULL");
  }
  if (!columnNames.includes('git_commit_repo')) {
    db.exec("ALTER TABLE tasks ADD COLUMN git_commit_repo TEXT DEFAULT NULL");
  }
  if (!columnNames.includes('git_commit_branch')) {
    db.exec("ALTER TABLE tasks ADD COLUMN git_commit_branch TEXT DEFAULT NULL");
  }
  if (!columnNames.includes('git_commit_message')) {
    db.exec("ALTER TABLE tasks ADD COLUMN git_commit_message TEXT DEFAULT NULL");
  }

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
  const allowedFields = ['title', 'completed', 'priority', 'due_date', 'notes', 'completed_at', 'auto_completed', 'completed_by', 'git_commit_hash', 'git_commit_repo', 'git_commit_branch', 'git_commit_message'];
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
    completedBy: 'completed_by',
    gitCommitHash: 'git_commit_hash',
    gitCommitRepo: 'git_commit_repo',
    gitCommitBranch: 'git_commit_branch',
    gitCommitMessage: 'git_commit_message',
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
    completedBy: row.completed_by,
    gitCommitHash: row.git_commit_hash,
    gitCommitRepo: row.git_commit_repo,
    gitCommitBranch: row.git_commit_branch,
    gitCommitMessage: row.git_commit_message,
  };
}

// Git repos functions
const generateRepoId = () => `repo-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

function upsertGitRepo(db, name) {
  const existing = db.prepare('SELECT * FROM git_repos WHERE name = ?').get(name);

  if (existing) {
    db.prepare('UPDATE git_repos SET last_commit_at = datetime("now") WHERE name = ?').run(name);
    return db.prepare('SELECT * FROM git_repos WHERE name = ?').get(name);
  } else {
    const id = generateRepoId();
    db.prepare('INSERT INTO git_repos (id, name) VALUES (?, ?)').run(id, name);
    return db.prepare('SELECT * FROM git_repos WHERE id = ?').get(id);
  }
}

function getGitRepos(db) {
  return db.prepare('SELECT * FROM git_repos ORDER BY last_commit_at DESC').all().map(row => ({
    id: row.id,
    name: row.name,
    firstSeenAt: row.first_seen_at,
    lastCommitAt: row.last_commit_at,
  }));
}

function deleteGitRepo(db, name) {
  return db.prepare('DELETE FROM git_repos WHERE name = ?').run(name);
}

function findMatchingTasks(db, commitMessage) {
  // Find pending tasks where the commit message contains the task title (case-insensitive)
  const pendingTasks = db.prepare('SELECT * FROM tasks WHERE completed = 0').all();

  const lowerMessage = commitMessage.toLowerCase();
  return pendingTasks
    .filter(task => lowerMessage.includes(task.title.toLowerCase()))
    .map(formatTask);
}

module.exports = {
  createDb,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  upsertGitRepo,
  getGitRepos,
  deleteGitRepo,
  findMatchingTasks,
};
