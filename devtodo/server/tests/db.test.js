const { createDb, createTask, getTasks, getTaskById, updateTask, deleteTask } = require('../src/db');
const fs = require('fs');
const path = require('path');

describe('Database', () => {
  let db;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(() => {
    // Remove test db if exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = createDb(testDbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('creates tasks table on init', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.map(t => t.name)).toContain('tasks');
  });

  test('createTask returns task with id', () => {
    const task = createTask(db, {
      title: 'Test task',
      priority: 'high',
      source: 'manual',
    });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Test task');
    expect(task.completed).toBe(false);
  });

  test('getTasks returns all tasks', () => {
    createTask(db, { title: 'Task 1', priority: 'high', source: 'manual' });
    createTask(db, { title: 'Task 2', priority: 'low', source: 'docker' });
    const tasks = getTasks(db);
    expect(tasks).toHaveLength(2);
  });

  test('getTaskById returns specific task', () => {
    const created = createTask(db, { title: 'Find me', priority: 'medium', source: 'manual' });
    const found = getTaskById(db, created.id);
    expect(found.title).toBe('Find me');
  });

  test('updateTask modifies task', () => {
    const task = createTask(db, { title: 'Original', priority: 'low', source: 'manual' });
    updateTask(db, task.id, { title: 'Updated', completed: 1 });
    const updated = getTaskById(db, task.id);
    expect(updated.title).toBe('Updated');
    expect(updated.completed).toBe(true);
  });

  test('deleteTask removes task', () => {
    const task = createTask(db, { title: 'Delete me', priority: 'high', source: 'manual' });
    deleteTask(db, task.id);
    const found = getTaskById(db, task.id);
    expect(found).toBeUndefined();
  });
});
