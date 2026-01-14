# Phase 1: Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform DevTodo from a prototype with mock data into a working full-stack application with persistent storage and real API integration.

**Architecture:** Express backend with SQLite database serves REST API. React frontend (Vite) consumes API and renders UI. Simple token-based auth protects all endpoints. Docker Compose orchestrates both services.

**Tech Stack:** Node.js 20, Express, better-sqlite3, React 18, Vite, Docker

---

## Pre-requisites

Before starting, ensure you have:
- Node.js 18+ installed (`node --version`)
- Docker and Docker Compose installed (`docker --version`)
- Working directory: `/home/andrew/Documents/Python/Git/Auto_todo_app/devtodo`

---

## Task 1: Create Backend Project Structure

**Files:**
- Create: `devtodo/server/package.json`
- Create: `devtodo/server/src/index.js`
- Move: `devtodo/index.js` → `devtodo/server/src/index.js` (will modify later)

**Step 1: Create server directory structure**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
mkdir -p server/src server/tests
```

**Step 2: Create server package.json**

Create `devtodo/server/package.json`:

```json
{
  "name": "devtodo-server",
  "version": "1.0.0",
  "description": "DevTodo API server",
  "main": "src/index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dockerode": "^4.0.2",
    "googleapis": "^129.0.0",
    "better-sqlite3": "^9.4.3",
    "chokidar": "^3.5.3",
    "morgan": "^1.10.0",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

**Step 3: Move and preserve existing backend code**

```bash
mv /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/index.js /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server/src/index.js
```

**Step 4: Install dependencies**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm install
```

Expected: `node_modules` created, no errors

**Step 5: Verify server starts**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm start
```

Expected: "DevTodo API server running on port 3001" (Ctrl+C to stop)

**Step 6: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/server/
git commit -m "refactor: move backend to server/ directory with proper package.json"
```

---

## Task 2: Create Frontend Project Structure

**Files:**
- Create: `devtodo/package.json`
- Create: `devtodo/vite.config.js`
- Create: `devtodo/index.html`
- Create: `devtodo/src/main.jsx`
- Move: `devtodo/App.jsx` → `devtodo/src/App.jsx`

**Step 1: Create frontend package.json**

Create `devtodo/package.json`:

```json
{
  "name": "devtodo",
  "version": "1.0.0",
  "description": "Infrastructure-Aware Task Manager for Developers",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.312.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.12",
    "vitest": "^1.2.2",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.0.0"
  }
}
```

**Step 2: Create vite.config.js**

Create `devtodo/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
```

**Step 3: Create index.html**

Create `devtodo/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevTodo - Infrastructure-Aware Task Manager</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: Create src directory and main.jsx**

```bash
mkdir -p /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/src/test
```

Create `devtodo/src/main.jsx`:

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 5: Create test setup file**

Create `devtodo/src/test/setup.js`:

```javascript
import '@testing-library/jest-dom';
```

**Step 6: Move App.jsx to src/**

```bash
mv /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/App.jsx /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/src/App.jsx
```

**Step 7: Install dependencies**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm install
```

**Step 8: Verify frontend starts**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm run dev
```

Expected: Vite server starts on http://localhost:3000 (Ctrl+C to stop)

**Step 9: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/package.json devtodo/vite.config.js devtodo/index.html devtodo/src/
git commit -m "feat: add Vite frontend build system with React 18"
```

---

## Task 3: Set Up SQLite Database Schema

**Files:**
- Create: `devtodo/server/src/db.js`
- Create: `devtodo/server/tests/db.test.js`

**Step 1: Write the database test**

Create `devtodo/server/tests/db.test.js`:

```javascript
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
    expect(task.completed).toBe(0);
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
    expect(updated.completed).toBe(1);
  });

  test('deleteTask removes task', () => {
    const task = createTask(db, { title: 'Delete me', priority: 'high', source: 'manual' });
    deleteTask(db, task.id);
    const found = getTaskById(db, task.id);
    expect(found).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: FAIL - Cannot find module '../src/db'

**Step 3: Create Jest config**

Create `devtodo/server/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js'],
  testMatch: ['**/tests/**/*.test.js'],
};
```

**Step 4: Write the database module**

Create `devtodo/server/src/db.js`:

```javascript
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
```

**Step 5: Run tests to verify they pass**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: All 6 tests pass

**Step 6: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/server/src/db.js devtodo/server/tests/db.test.js devtodo/server/jest.config.js
git commit -m "feat: add SQLite database layer with task CRUD operations"
```

---

## Task 4: Add Task API Endpoints

**Files:**
- Create: `devtodo/server/src/routes/tasks.js`
- Create: `devtodo/server/tests/tasks.test.js`
- Modify: `devtodo/server/src/index.js`

**Step 1: Write the API tests**

Create `devtodo/server/tests/tasks.test.js`:

```javascript
const request = require('supertest');
const express = require('express');
const { createDb } = require('../src/db');
const tasksRouter = require('../src/routes/tasks');
const fs = require('fs');
const path = require('path');

describe('Tasks API', () => {
  let app;
  let db;
  const testDbPath = path.join(__dirname, 'api-test.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    db = createDb(testDbPath);

    app = express();
    app.use(express.json());
    app.use('/api/tasks', tasksRouter(db));
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  test('GET /api/tasks returns empty array initially', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'New task', priority: 'high' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New task');
    expect(res.body.id).toBeDefined();
  });

  test('POST /api/tasks validates title is required', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ priority: 'high' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('title');
  });

  test('GET /api/tasks/:id returns specific task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Find me' });

    const res = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Find me');
  });

  test('PATCH /api/tasks/:id updates task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Original' });

    const res = await request(app)
      .patch(`/api/tasks/${created.body.id}`)
      .send({ title: 'Updated', completed: true });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.completed).toBe(true);
  });

  test('DELETE /api/tasks/:id removes task', async () => {
    const created = await request(app)
      .post('/api/tasks')
      .send({ title: 'Delete me' });

    const deleteRes = await request(app).delete(`/api/tasks/${created.body.id}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app).get(`/api/tasks/${created.body.id}`);
    expect(getRes.status).toBe(404);
  });

  test('GET /api/tasks filters by completed', async () => {
    await request(app).post('/api/tasks').send({ title: 'Task 1' });
    const task2 = await request(app).post('/api/tasks').send({ title: 'Task 2' });
    await request(app).patch(`/api/tasks/${task2.body.id}`).send({ completed: true });

    const activeRes = await request(app).get('/api/tasks?completed=false');
    expect(activeRes.body).toHaveLength(1);
    expect(activeRes.body[0].title).toBe('Task 1');

    const completedRes = await request(app).get('/api/tasks?completed=true');
    expect(completedRes.body).toHaveLength(1);
    expect(completedRes.body[0].title).toBe('Task 2');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: FAIL - Cannot find module '../src/routes/tasks'

**Step 3: Create tasks router**

```bash
mkdir -p /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server/src/routes
```

Create `devtodo/server/src/routes/tasks.js`:

```javascript
const express = require('express');
const { createTask, getTasks, getTaskById, updateTask, deleteTask } = require('../db');

function createTasksRouter(db) {
  const router = express.Router();

  // GET /api/tasks - List all tasks
  router.get('/', (req, res) => {
    try {
      const filters = {};

      if (req.query.completed !== undefined) {
        filters.completed = req.query.completed === 'true';
      }

      if (req.query.source) {
        filters.source = req.query.source;
      }

      const tasks = getTasks(db, filters);
      res.json(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  });

  // POST /api/tasks - Create a task
  router.post('/', (req, res) => {
    try {
      const { title, priority, source, dueDate, notes, dockerContainerId, calendarEventId, emailId } = req.body;

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'title is required and must be a non-empty string' });
      }

      const task = createTask(db, {
        title: title.trim(),
        priority,
        source,
        dueDate,
        notes,
        dockerContainerId,
        calendarEventId,
        emailId,
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  });

  // GET /api/tasks/:id - Get a specific task
  router.get('/:id', (req, res) => {
    try {
      const task = getTaskById(db, req.params.id);

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      console.error('Error fetching task:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
    }
  });

  // PATCH /api/tasks/:id - Update a task
  router.patch('/:id', (req, res) => {
    try {
      const existing = getTaskById(db, req.params.id);

      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const { title, completed, priority, dueDate, notes } = req.body;
      const updates = {};

      if (title !== undefined) updates.title = title;
      if (completed !== undefined) {
        updates.completed = completed ? 1 : 0;
        if (completed && !existing.completedAt) {
          updates.completedAt = new Date().toISOString();
        } else if (!completed) {
          updates.completedAt = null;
        }
      }
      if (priority !== undefined) updates.priority = priority;
      if (dueDate !== undefined) updates.dueDate = dueDate;
      if (notes !== undefined) updates.notes = notes;

      const task = updateTask(db, req.params.id, updates);
      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  });

  // DELETE /api/tasks/:id - Delete a task
  router.delete('/:id', (req, res) => {
    try {
      const existing = getTaskById(db, req.params.id);

      if (!existing) {
        return res.status(404).json({ error: 'Task not found' });
      }

      deleteTask(db, req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  });

  return router;
}

module.exports = createTasksRouter;
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: All tests pass (13 total: 6 db + 7 api)

**Step 5: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/server/src/routes/tasks.js devtodo/server/tests/tasks.test.js
git commit -m "feat: add REST API endpoints for task CRUD operations"
```

---

## Task 5: Integrate Database into Server

**Files:**
- Modify: `devtodo/server/src/index.js`

**Step 1: Update index.js to use database and task routes**

Replace the contents of `devtodo/server/src/index.js`. Key changes:
- Import and initialize database
- Mount tasks router
- Add security middleware (helmet, rate limiting, morgan)
- Create data directory for SQLite

Update `devtodo/server/src/index.js`:

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { Docker } = require('dockerode');
const { google } = require('googleapis');
const chokidar = require('chokidar');

const { createDb } = require('./db');
const createTasksRouter = require('./routes/tasks');

const app = express();

// Configuration
const CONFIG = {
  port: process.env.PORT || 3001,
  docker: {
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    host: process.env.DOCKER_HOST || null,
    port: process.env.DOCKER_PORT || 2375,
  },
  claudeChatsPath: process.env.CLAUDE_CHATS_PATH || '/home/user/.config/claude/chats',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
  },
  dataDir: process.env.DATA_DIR || path.join(__dirname, '../data'),
};

// Ensure data directory exists
if (!fs.existsSync(CONFIG.dataDir)) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
}

// Initialize database
const db = createDb(path.join(CONFIG.dataDir, 'devtodo.db'));

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Stricter rate limit for Docker actions
const dockerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: { error: 'Too many Docker actions, please wait' },
});

// Mount task routes
app.use('/api/tasks', createTasksRouter(db));

// Initialize Docker client
let docker;
try {
  if (CONFIG.docker.host) {
    docker = new Docker({
      host: CONFIG.docker.host,
      port: CONFIG.docker.port,
    });
  } else {
    docker = new Docker({ socketPath: CONFIG.docker.socketPath });
  }
} catch (error) {
  console.warn('Docker not available:', error.message);
  docker = null;
}

// Store for container actions (for auto-completion detection)
const containerActions = new Map();

// ==================== DOCKER API ====================

// Get all containers
app.get('/api/docker/containers', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker not available' });
  }

  try {
    const containers = await docker.listContainers({ all: true });
    const enrichedContainers = await Promise.all(
      containers.map(async (container) => {
        try {
          const inspect = await docker.getContainer(container.Id).inspect();
          return {
            id: container.Id.substring(0, 12),
            name: container.Names[0].replace('/', ''),
            image: container.Image,
            status: container.State,
            state: container.Status,
            created: container.Created,
            ports: container.Ports,
            lastAction: containerActions.get(container.Id) || null,
            health: inspect.State.Health?.Status || null,
            restartCount: inspect.RestartCount,
            startedAt: inspect.State.StartedAt,
            finishedAt: inspect.State.FinishedAt,
          };
        } catch (inspectError) {
          return {
            id: container.Id.substring(0, 12),
            name: container.Names[0].replace('/', ''),
            status: container.State,
            error: 'Could not inspect container',
          };
        }
      })
    );
    res.json(enrichedContainers);
  } catch (error) {
    console.error('Docker API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
app.get('/api/docker/containers/:id/logs', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker not available' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: req.query.tail || 100,
      timestamps: true,
    });
    res.json({ logs: logs.toString('utf8') });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Perform container action
app.post('/api/docker/containers/:id/:action', dockerLimiter, async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker not available' });
  }

  const { id, action } = req.params;
  const validActions = ['start', 'stop', 'restart', 'pause', 'unpause'];

  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const container = docker.getContainer(id);
    await container[action]();

    containerActions.set(id, {
      action,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, action, containerId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get container stats
app.get('/api/docker/containers/:id/stats', async (req, res) => {
  if (!docker) {
    return res.status(503).json({ error: 'Docker not available' });
  }

  try {
    const container = docker.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100 : 0;

    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 1;
    const memPercent = (memUsage / memLimit) * 100;

    res.json({
      cpu: cpuPercent.toFixed(2),
      memory: {
        usage: memUsage,
        limit: memLimit,
        percent: memPercent.toFixed(2),
      },
      network: stats.networks,
      blockIO: stats.blkio_stats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recorded container actions
app.get('/api/docker/actions', (req, res) => {
  const actions = Array.from(containerActions.entries()).map(([id, data]) => ({
    containerId: id,
    ...data,
  }));
  res.json(actions);
});

// ==================== CLAUDE CHATS API ====================

const parseClaudeChatFile = async (filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const actions = [];

    const patterns = [
      /TODO:?\s*(.+)/gi,
      /ACTION:?\s*(.+)/gi,
      /NEXT STEP:?\s*(.+)/gi,
      /\[ \]\s*(.+)/g,
      /- \[ \]\s*(.+)/g,
      /(?:I'll|I will|We should|You should|Let's)\s+(.+?)(?:\.|$)/gi,
      /(?:need to|should|must)\s+(.+?)(?:\.|$)/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const text = match[1].trim();
        if (text.length > 10 && text.length < 200 && !text.includes('\n')) {
          actions.push({
            text,
            source: path.basename(filePath),
            foundAt: new Date().toISOString(),
          });
        }
      }
    });

    return actions;
  } catch (error) {
    console.error(`Error parsing chat file ${filePath}:`, error);
    return [];
  }
};

app.get('/api/claude/actions', async (req, res) => {
  try {
    const chatPath = req.query.path || CONFIG.claudeChatsPath;

    try {
      await fs.promises.access(chatPath);
    } catch {
      return res.json({ actions: [], message: 'Chat path not accessible' });
    }

    const files = await fs.promises.readdir(chatPath);
    const chatFiles = files.filter(f => f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.txt'));

    const allActions = [];
    for (const file of chatFiles.slice(0, 20)) {
      const filePath = path.join(chatPath, file);
      const stats = await fs.promises.stat(filePath);

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (stats.mtime > weekAgo) {
        const actions = await parseClaudeChatFile(filePath);
        allActions.push(...actions);
      }
    }

    const unique = [...new Map(allActions.map(a => [a.text, a])).values()];
    res.json({ actions: unique.slice(0, 50) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let chatWatcher = null;
let pendingActions = [];

app.post('/api/claude/watch', async (req, res) => {
  const chatPath = req.body.path || CONFIG.claudeChatsPath;

  if (chatWatcher) {
    chatWatcher.close();
  }

  try {
    chatWatcher = chokidar.watch(chatPath, {
      ignored: /(^|[\/\\])\../,
      persistent: true,
    });

    chatWatcher.on('change', async (filePath) => {
      const actions = await parseClaudeChatFile(filePath);
      pendingActions.push(...actions);
    });

    res.json({ watching: chatPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/claude/pending', (req, res) => {
  const actions = [...pendingActions];
  pendingActions = [];
  res.json({ actions });
});

// ==================== GOOGLE CALENDAR API ====================

let oauth2Client = null;

if (CONFIG.google.clientId) {
  oauth2Client = new google.auth.OAuth2(
    CONFIG.google.clientId,
    CONFIG.google.clientSecret,
    CONFIG.google.redirectUri
  );
}

app.get('/api/calendar/auth', (req, res) => {
  if (!oauth2Client) {
    return res.status(400).json({ error: 'Google OAuth not configured' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  res.json({ authUrl: url });
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    await fs.promises.writeFile(
      path.join(CONFIG.dataDir, 'google-tokens.json'),
      JSON.stringify(tokens)
    );

    res.redirect('/?auth=success');
  } catch (error) {
    res.redirect('/?auth=error');
  }
});

const loadGoogleTokens = async () => {
  try {
    const tokensPath = path.join(CONFIG.dataDir, 'google-tokens.json');
    const tokens = JSON.parse(await fs.promises.readFile(tokensPath, 'utf8'));
    if (oauth2Client) {
      oauth2Client.setCredentials(tokens);
    }
  } catch {
    // No tokens stored
  }
};

app.get('/api/calendar/events', async (req, res) => {
  if (!oauth2Client || !oauth2Client.credentials.access_token) {
    return res.status(401).json({ error: 'Not authenticated', needsAuth: true });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: nextWeek.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = response.data.items.map(event => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      allDay: !event.start.dateTime,
      location: event.location,
      htmlLink: event.htmlLink,
      status: event.status,
    }));

    res.json({ events });
  } catch (error) {
    if (error.code === 401) {
      return res.status(401).json({ error: 'Token expired', needsAuth: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// ==================== GMAIL API ====================

app.get('/api/gmail/actions', async (req, res) => {
  if (!oauth2Client || !oauth2Client.credentials.access_token) {
    return res.status(401).json({ error: 'Not authenticated', needsAuth: true });
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const searchQueries = [
      'is:unread subject:(action required)',
      'is:unread subject:(todo)',
      'is:unread subject:(please review)',
      'is:unread subject:(urgent)',
      'is:starred is:unread',
    ];

    const allMessages = [];

    for (const query of searchQueries) {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 10,
      });

      if (response.data.messages) {
        for (const msg of response.data.messages) {
          const fullMsg = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date'],
          });

          const headers = fullMsg.data.payload.headers;
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const date = headers.find(h => h.name === 'Date')?.value;

          let actionText = subject
            .replace(/^(RE:|FW:|Fwd:)\s*/gi, '')
            .replace(/\[.*?\]/g, '')
            .trim();

          if (actionText.toLowerCase().includes('action required')) {
            actionText = actionText.replace(/action required:?\s*/gi, '');
          }

          allMessages.push({
            id: msg.id,
            threadId: fullMsg.data.threadId,
            subject,
            from,
            date,
            actionText: `Respond to: ${actionText}`,
            hasAction: true,
          });
        }
      }
    }

    const unique = [...new Map(allMessages.map(m => [m.threadId, m])).values()];
    res.json({ emails: unique.slice(0, 20) });
  } catch (error) {
    if (error.code === 401) {
      return res.status(401).json({ error: 'Token expired', needsAuth: true });
    }
    res.status(500).json({ error: error.message });
  }
});

// ==================== EXPORT API ====================

app.post('/api/export/markdown', (req, res) => {
  const { tasks, date } = req.body;
  const dateStr = new Date(date || Date.now()).toISOString().split('T')[0];

  const formatDate = (d) => new Date(d).toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short'
  });

  const formatTime = (d) => new Date(d).toLocaleTimeString('en-AU', {
    hour: '2-digit', minute: '2-digit'
  });

  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);

  let md = `# Daily Task Report - ${formatDate(date || Date.now())}\n\n`;
  md += `Generated: ${new Date().toLocaleString('en-AU')}\n\n`;
  md += `---\n\n`;

  md += `## Summary\n\n`;
  md += `- **Total Tasks:** ${tasks.length}\n`;
  md += `- **Completed:** ${completed.length}\n`;
  md += `- **Pending:** ${pending.length}\n`;
  md += `- **Completion Rate:** ${tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0}%\n\n`;

  md += `## Completed Tasks ✓\n\n`;
  if (completed.length === 0) {
    md += `_No tasks completed_\n\n`;
  } else {
    completed.forEach(task => {
      const sourceIcon = {
        docker: '🐳',
        claude: '🤖',
        calendar: '📅',
        gmail: '📧',
        manual: '✏️'
      }[task.source] || '📋';

      md += `- [x] ${sourceIcon} ${task.title}`;
      if (task.completedAt) md += ` _(completed ${formatTime(task.completedAt)})_`;
      md += `\n`;
      if (task.notes) md += `  > ${task.notes}\n`;
    });
  }
  md += `\n`;

  md += `## Pending Tasks\n\n`;
  if (pending.length === 0) {
    md += `_All tasks completed! 🎉_\n\n`;
  } else {
    pending.forEach(task => {
      const sourceIcon = {
        docker: '🐳',
        claude: '🤖',
        calendar: '📅',
        gmail: '📧',
        manual: '✏️'
      }[task.source] || '📋';
      const priority = { high: '🔴', medium: '🟡', low: '🟢' }[task.priority] || '⚪';

      md += `- [ ] ${priority} ${sourceIcon} ${task.title}\n`;
      if (task.dueDate) md += `  Due: ${formatDate(task.dueDate)}\n`;
      if (task.notes) md += `  > ${task.notes}\n`;
    });
  }

  res.json({
    content: md,
    filename: `tasks-${dateStr}.md`
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      docker: false,
      googleAuth: false,
      database: false,
    }
  };

  // Check Docker
  if (docker) {
    try {
      await docker.ping();
      health.services.docker = true;
    } catch {
      health.services.docker = false;
    }
  }

  // Check Google Auth
  health.services.googleAuth = !!(oauth2Client?.credentials?.access_token);

  // Check Database
  try {
    db.prepare('SELECT 1').get();
    health.services.database = true;
  } catch {
    health.services.database = false;
  }

  res.json(health);
});

// ==================== START SERVER ====================

loadGoogleTokens().then(() => {
  app.listen(CONFIG.port, () => {
    console.log(`DevTodo API server running on port ${CONFIG.port}`);
    console.log(`Database: ${path.join(CONFIG.dataDir, 'devtodo.db')}`);
    console.log(`Docker: ${CONFIG.docker.host || CONFIG.docker.socketPath}`);
    console.log(`Claude chats: ${CONFIG.claudeChatsPath}`);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});
```

**Step 2: Run all tests**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: All 13 tests pass

**Step 3: Test server manually**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm start &
sleep 2
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"Test task"}'
curl http://localhost:3001/api/tasks
kill %1
```

Expected: Health check shows database: true, task created and retrieved

**Step 4: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/server/src/index.js
git commit -m "feat: integrate SQLite database and task routes into server"
```

---

## Task 6: Create API Service for Frontend

**Files:**
- Create: `devtodo/src/api.js`
- Create: `devtodo/src/test/api.test.js`

**Step 1: Write the API service tests**

Create `devtodo/src/test/api.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

describe('API Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('getTasks fetches from /api/tasks', async () => {
    const mockTasks = [{ id: '1', title: 'Test' }];
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockTasks),
    });

    const tasks = await api.getTasks();

    expect(fetch).toHaveBeenCalledWith('/api/tasks');
    expect(tasks).toEqual(mockTasks);
  });

  it('createTask posts to /api/tasks', async () => {
    const newTask = { title: 'New task', priority: 'high' };
    const createdTask = { id: '1', ...newTask };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(createdTask),
    });

    const result = await api.createTask(newTask);

    expect(fetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask),
    });
    expect(result).toEqual(createdTask);
  });

  it('updateTask patches /api/tasks/:id', async () => {
    const updates = { completed: true };
    const updatedTask = { id: '1', title: 'Test', completed: true };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedTask),
    });

    const result = await api.updateTask('1', updates);

    expect(fetch).toHaveBeenCalledWith('/api/tasks/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    expect(result).toEqual(updatedTask);
  });

  it('deleteTask deletes /api/tasks/:id', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true });

    await api.deleteTask('1');

    expect(fetch).toHaveBeenCalledWith('/api/tasks/1', {
      method: 'DELETE',
    });
  });

  it('throws on non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    await expect(api.getTasks()).rejects.toThrow('Server error');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm test
```

Expected: FAIL - Cannot find module '../api'

**Step 3: Create the API service**

Create `devtodo/src/api.js`:

```javascript
const BASE_URL = '';

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Tasks
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.completed !== undefined) {
      params.set('completed', filters.completed);
    }
    if (filters.source) {
      params.set('source', filters.source);
    }

    const query = params.toString();
    const url = query ? `/api/tasks?${query}` : '/api/tasks';
    const response = await fetch(url);
    return handleResponse(response);
  },

  async createTask(task) {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    return handleResponse(response);
  },

  async updateTask(id, updates) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async deleteTask(id) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
    return handleResponse(response);
  },

  // Docker
  async getContainers() {
    const response = await fetch('/api/docker/containers');
    return handleResponse(response);
  },

  async performContainerAction(id, action) {
    const response = await fetch(`/api/docker/containers/${id}/${action}`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async getDockerActions() {
    const response = await fetch('/api/docker/actions');
    return handleResponse(response);
  },

  // Calendar
  async getCalendarAuthUrl() {
    const response = await fetch('/api/calendar/auth');
    return handleResponse(response);
  },

  async getCalendarEvents() {
    const response = await fetch('/api/calendar/events');
    return handleResponse(response);
  },

  // Gmail
  async getGmailActions() {
    const response = await fetch('/api/gmail/actions');
    return handleResponse(response);
  },

  // Claude
  async getClaudeActions() {
    const response = await fetch('/api/claude/actions');
    return handleResponse(response);
  },

  // Health
  async getHealth() {
    const response = await fetch('/api/health');
    return handleResponse(response);
  },

  // Export
  async exportMarkdown(tasks, date) {
    const response = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks, date }),
    });
    return handleResponse(response);
  },
};
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm test
```

Expected: All 5 API tests pass

**Step 5: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/src/api.js devtodo/src/test/api.test.js
git commit -m "feat: add API service layer for frontend-backend communication"
```

---

## Task 7: Connect Frontend to Backend APIs

**Files:**
- Modify: `devtodo/src/App.jsx`

**Step 1: Update App.jsx to use real API calls**

This is a large file. Key changes:
1. Import and use the api service
2. Replace localStorage with API calls
3. Replace mock data with real API responses
4. Add proper loading and error states

Replace the `syncAll` function and related state management in `devtodo/src/App.jsx`. Find and replace these sections:

**At the top of the file, add import:**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import {
  CheckCircle2, Circle, Plus, Calendar, Mail, Server,
  // ... rest of imports stay the same
```

**Remove the mock data constants** (lines ~20-37 in original):

Delete `mockDockerContainers`, `mockCalendarEvents`, and `mockEmails`.

**Replace the useEffect for loading tasks** (~lines 199-209):

```jsx
  // Load tasks from API on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const tasks = await api.getTasks();
        setTasks(tasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    };
    loadTasks();

    const savedDarkMode = localStorage.getItem('devtodo-darkmode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);
```

**Remove the localStorage save effect for tasks** (~lines 212-214). Tasks are now persisted on the server.

**Replace the syncAll function** (~lines 221-261):

```jsx
  // Sync all sources
  const syncAll = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch tasks from API
      const tasksData = await api.getTasks();
      setTasks(tasksData);

      // Fetch Docker containers
      try {
        const containers = await api.getContainers();
        setDockerContainers(containers);

        // Check for auto-completable tasks
        const dockerActions = await api.getDockerActions();

        // Auto-complete logic
        for (const task of tasksData) {
          if (task.source === 'docker' && !task.completed) {
            const container = containers.find(c =>
              task.title.toLowerCase().includes(c.name.toLowerCase()) ||
              task.dockerContainerId === c.id
            );

            if (container) {
              const action = dockerActions.find(a => a.containerId === container.id);
              if (action) {
                const actionCompleted =
                  (task.title.toLowerCase().includes('restart') && action.action === 'restart') ||
                  (task.title.toLowerCase().includes('stop') && container.status === 'exited') ||
                  (task.title.toLowerCase().includes('start') && container.status === 'running');

                if (actionCompleted && new Date(action.timestamp) > new Date(task.createdAt)) {
                  await api.updateTask(task.id, {
                    completed: true,
                    autoCompleted: true
                  });
                }
              }
            }
          }
        }

        // Refresh tasks after auto-completion
        const updatedTasks = await api.getTasks();
        setTasks(updatedTasks);
      } catch (dockerError) {
        console.warn('Docker not available:', dockerError.message);
        setDockerContainers([]);
      }

      // Fetch Calendar events
      try {
        const { events } = await api.getCalendarEvents();
        setCalendarEvents(events || []);
      } catch (calError) {
        if (calError.message.includes('Not authenticated')) {
          setCalendarEvents([]);
        } else {
          console.warn('Calendar error:', calError.message);
        }
      }

      // Fetch Gmail actions
      try {
        const { emails } = await api.getGmailActions();
        setEmailActions(emails || []);
      } catch (gmailError) {
        if (gmailError.message.includes('Not authenticated')) {
          setEmailActions([]);
        } else {
          console.warn('Gmail error:', gmailError.message);
        }
      }

      // Fetch Claude actions
      try {
        const { actions } = await api.getClaudeActions();
        setClaudeActions(actions || []);
      } catch (claudeError) {
        console.warn('Claude chats error:', claudeError.message);
        setClaudeActions([]);
      }

      setLastSync(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    }
    setIsLoading(false);
  }, []);
```

**Replace the addTask function** (~lines 272-289):

```jsx
  // Add task
  const addTask = async (taskData) => {
    try {
      const task = await api.createTask({
        title: taskData.title,
        priority: taskData.priority || 'medium',
        source: taskData.source || 'manual',
        dueDate: taskData.dueDate || null,
        notes: taskData.notes || '',
        dockerContainerId: taskData.dockerContainerId || null,
        calendarEventId: taskData.calendarEventId || null,
        emailId: taskData.emailId || null,
      });
      setTasks(prev => [task, ...prev]);
      setShowAddTask(false);
      setNewTask({ title: '', priority: 'medium', dueDate: '', notes: '' });
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };
```

**Replace the toggleTask function** (~lines 292-303):

```jsx
  // Toggle task completion
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const updated = await api.updateTask(taskId, {
        completed: !task.completed,
      });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };
```

**Replace the deleteTask function** (~lines 306-308):

```jsx
  // Delete task
  const deleteTask = async (taskId) => {
    try {
      await api.deleteTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };
```

**Replace the updateTask function** (~lines 311-316):

```jsx
  // Update task
  const updateTask = async (taskId, updates) => {
    try {
      const updated = await api.updateTask(taskId, updates);
      setTasks(prev => prev.map(task =>
        task.id === taskId ? updated : task
      ));
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };
```

**Replace the handleExport function** (~lines 378-387):

```jsx
  const handleExport = async () => {
    try {
      const { content, filename } = await api.exportMarkdown(tasks);
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };
```

**Step 2: Verify frontend still compiles**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm run dev
```

Expected: Vite starts without errors (Ctrl+C to stop)

**Step 3: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/src/App.jsx
git commit -m "feat: connect frontend to backend API, remove mock data"
```

---

## Task 8: Create Docker Build Files

**Files:**
- Create: `devtodo/server/Dockerfile`
- Create: `devtodo/Dockerfile.frontend`
- Create: `devtodo/nginx.conf`
- Update: `devtodo/docker-compose.yml`

**Step 1: Create backend Dockerfile**

Create `devtodo/server/Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "src/index.js"]
```

**Step 2: Create frontend Dockerfile**

Create `devtodo/Dockerfile.frontend`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Step 3: Create nginx.conf**

Create `devtodo/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy API requests to backend
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy auth callback
    location /auth {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback - serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Step 4: Update docker-compose.yml**

Replace `devtodo/docker-compose.yml`:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    networks:
      - devtodo-network
    restart: unless-stopped

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      # Mount Docker socket for container management
      - /var/run/docker.sock:/var/run/docker.sock:ro
      # Mount Claude chats folder
      - ${CLAUDE_CHATS_PATH:-~/.config/claude/chats}:/app/claude-chats:ro
      # Persist data (database and tokens)
      - devtodo-data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DOCKER_SOCKET=/var/run/docker.sock
      - CLAUDE_CHATS_PATH=/app/claude-chats
      - DATA_DIR=/app/data
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI:-http://localhost:3001/auth/google/callback}
    networks:
      - devtodo-network
    restart: unless-stopped

networks:
  devtodo-network:
    driver: bridge

volumes:
  devtodo-data:
```

**Step 5: Test Docker build**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
docker compose build
```

Expected: Both images build successfully

**Step 6: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add devtodo/server/Dockerfile devtodo/Dockerfile.frontend devtodo/nginx.conf devtodo/docker-compose.yml
git commit -m "feat: add Docker build configuration for frontend and backend"
```

---

## Task 9: Add Basic Authentication

**Files:**
- Create: `devtodo/server/src/middleware/auth.js`
- Create: `devtodo/server/tests/auth.test.js`
- Modify: `devtodo/server/src/index.js`
- Modify: `devtodo/src/api.js`
- Modify: `devtodo/src/App.jsx`

**Step 1: Write auth middleware tests**

Create `devtodo/server/tests/auth.test.js`:

```javascript
const request = require('supertest');
const express = require('express');
const { createAuthMiddleware, generateToken, hashPassword, verifyPassword } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let app;
  const TEST_PASSWORD = 'testpassword123';

  beforeEach(() => {
    process.env.AUTH_PASSWORD = TEST_PASSWORD;
    app = express();
    app.use(express.json());
  });

  test('hashPassword and verifyPassword work correctly', () => {
    const hash = hashPassword(TEST_PASSWORD);
    expect(verifyPassword(TEST_PASSWORD, hash)).toBe(true);
    expect(verifyPassword('wrongpassword', hash)).toBe(false);
  });

  test('generateToken returns a string', () => {
    const token = generateToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  test('auth middleware rejects requests without token', async () => {
    const auth = createAuthMiddleware();
    app.use(auth);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  test('auth middleware accepts valid token', async () => {
    const auth = createAuthMiddleware();
    const token = generateToken();
    auth.validTokens.add(token);

    app.use(auth);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('login endpoint returns token for correct password', async () => {
    const auth = createAuthMiddleware();
    app.post('/auth/login', (req, res) => {
      const { password } = req.body;
      if (verifyPassword(password, hashPassword(TEST_PASSWORD))) {
        const token = generateToken();
        auth.validTokens.add(token);
        return res.json({ token });
      }
      res.status(401).json({ error: 'Invalid password' });
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: FAIL - Cannot find module '../src/middleware/auth'

**Step 3: Create auth middleware**

```bash
mkdir -p /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server/src/middleware
```

Create `devtodo/server/src/middleware/auth.js`:

```javascript
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createAuthMiddleware() {
  const validTokens = new Set();

  const middleware = (req, res, next) => {
    // Skip auth for login and health endpoints
    if (req.path === '/auth/login' || req.path === '/api/health') {
      return next();
    }

    // Skip auth if no password is configured (development mode)
    if (!process.env.AUTH_PASSWORD) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    if (!validTokens.has(token)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    next();
  };

  // Attach token store to middleware for login handler
  middleware.validTokens = validTokens;

  return middleware;
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  createAuthMiddleware,
};
```

**Step 4: Run tests to verify they pass**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test
```

Expected: All tests pass (including 5 new auth tests)

**Step 5: Add auth to server index.js**

Add these changes to `devtodo/server/src/index.js`:

Near the top, add import:

```javascript
const { createAuthMiddleware, hashPassword, verifyPassword, generateToken } = require('./middleware/auth');
```

After the rate limiting setup, add:

```javascript
// Auth middleware
const auth = createAuthMiddleware();
app.use(auth);

// Login endpoint
app.post('/auth/login', (req, res) => {
  const { password } = req.body;

  if (!process.env.AUTH_PASSWORD) {
    return res.status(400).json({ error: 'Authentication not configured' });
  }

  const expectedHash = hashPassword(process.env.AUTH_PASSWORD);

  if (!password || !verifyPassword(password, expectedHash)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = generateToken();
  auth.validTokens.add(token);

  // Token expires in 24 hours
  setTimeout(() => {
    auth.validTokens.delete(token);
  }, 24 * 60 * 60 * 1000);

  res.json({ token });
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    auth.validTokens.delete(token);
  }
  res.json({ success: true });
});

// Check auth status
app.get('/auth/status', (req, res) => {
  res.json({
    authenticated: true,
    authRequired: !!process.env.AUTH_PASSWORD,
  });
});
```

**Step 6: Update frontend API service**

Update `devtodo/src/api.js` to include auth token:

```javascript
let authToken = localStorage.getItem('devtodo-auth-token');

async function handleResponse(response) {
  if (response.status === 401) {
    // Clear token and trigger re-login
    authToken = null;
    localStorage.removeItem('devtodo-auth-token');
    window.dispatchEvent(new Event('auth-required'));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(password) {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await handleResponse(response);
    authToken = data.token;
    localStorage.setItem('devtodo-auth-token', data.token);
    return data;
  },

  async logout() {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      headers: getHeaders(),
    });
    authToken = null;
    localStorage.removeItem('devtodo-auth-token');
    return handleResponse(response);
  },

  async getAuthStatus() {
    const response = await fetch('/auth/status', {
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  isAuthenticated() {
    return !!authToken;
  },

  // Tasks - update all methods to use getHeaders()
  async getTasks(filters = {}) {
    const params = new URLSearchParams();
    if (filters.completed !== undefined) {
      params.set('completed', filters.completed);
    }
    if (filters.source) {
      params.set('source', filters.source);
    }

    const query = params.toString();
    const url = query ? `/api/tasks?${query}` : '/api/tasks';
    const response = await fetch(url, { headers: getHeaders() });
    return handleResponse(response);
  },

  async createTask(task) {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    return handleResponse(response);
  },

  async updateTask(id, updates) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async deleteTask(id) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // Docker
  async getContainers() {
    const response = await fetch('/api/docker/containers', { headers: getHeaders() });
    return handleResponse(response);
  },

  async performContainerAction(id, action) {
    const response = await fetch(`/api/docker/containers/${id}/${action}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  async getDockerActions() {
    const response = await fetch('/api/docker/actions', { headers: getHeaders() });
    return handleResponse(response);
  },

  // Calendar
  async getCalendarAuthUrl() {
    const response = await fetch('/api/calendar/auth', { headers: getHeaders() });
    return handleResponse(response);
  },

  async getCalendarEvents() {
    const response = await fetch('/api/calendar/events', { headers: getHeaders() });
    return handleResponse(response);
  },

  // Gmail
  async getGmailActions() {
    const response = await fetch('/api/gmail/actions', { headers: getHeaders() });
    return handleResponse(response);
  },

  // Claude
  async getClaudeActions() {
    const response = await fetch('/api/claude/actions', { headers: getHeaders() });
    return handleResponse(response);
  },

  // Health (no auth required)
  async getHealth() {
    const response = await fetch('/api/health');
    return handleResponse(response);
  },

  // Export
  async exportMarkdown(tasks, date) {
    const response = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ tasks, date }),
    });
    return handleResponse(response);
  },
};
```

**Step 7: Add login UI to App.jsx**

Add a simple login screen. At the top of the DevTodo component, add state:

```jsx
const [isAuthenticated, setIsAuthenticated] = useState(api.isAuthenticated());
const [authRequired, setAuthRequired] = useState(false);
const [loginPassword, setLoginPassword] = useState('');
const [loginError, setLoginError] = useState('');
```

Add useEffect to check auth status:

```jsx
useEffect(() => {
  const checkAuth = async () => {
    try {
      const status = await api.getAuthStatus();
      setAuthRequired(status.authRequired);
      setIsAuthenticated(api.isAuthenticated() || !status.authRequired);
    } catch (error) {
      if (error.message.includes('Authentication required')) {
        setIsAuthenticated(false);
        setAuthRequired(true);
      }
    }
  };
  checkAuth();

  const handleAuthRequired = () => {
    setIsAuthenticated(false);
    setAuthRequired(true);
  };
  window.addEventListener('auth-required', handleAuthRequired);
  return () => window.removeEventListener('auth-required', handleAuthRequired);
}, []);
```

Add login handler:

```jsx
const handleLogin = async (e) => {
  e.preventDefault();
  setLoginError('');
  try {
    await api.login(loginPassword);
    setIsAuthenticated(true);
    setLoginPassword('');
    syncAll();
  } catch (error) {
    setLoginError(error.message);
  }
};

const handleLogout = async () => {
  await api.logout();
  setIsAuthenticated(false);
  setTasks([]);
};
```

Add login screen before main return (after theme definition):

```jsx
if (authRequired && !isAuthenticated) {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: theme.bgSecondary,
        border: `1px solid ${theme.border}`,
        borderRadius: '16px',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${theme.accent}, #8b5cf6)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <Zap size={32} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>DevTodo</h1>
          <p style={{ margin: '0.5rem 0 0', color: theme.textSecondary, fontSize: '0.875rem' }}>
            Enter password to continue
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Password"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${loginError ? theme.danger : theme.border}`,
              borderRadius: '8px',
              color: theme.text,
              fontSize: '1rem',
              marginBottom: '1rem',
              boxSizing: 'border-box',
            }}
            autoFocus
          />

          {loginError && (
            <p style={{ color: theme.danger, fontSize: '0.875rem', margin: '0 0 1rem' }}>
              {loginError}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: theme.accent,
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
```

Add logout button in header (near the theme toggle):

```jsx
{authRequired && (
  <button
    onClick={handleLogout}
    style={{
      padding: '0.5rem 1rem',
      backgroundColor: theme.bgTertiary,
      border: `1px solid ${theme.border}`,
      borderRadius: '8px',
      color: theme.text,
      cursor: 'pointer',
      fontSize: '0.875rem',
    }}
  >
    Logout
  </button>
)}
```

**Step 8: Update .env.example**

Add to `devtodo/.env.example`:

```env
# ==================== AUTHENTICATION ====================
# Set a password to enable authentication (optional)
# Leave empty for development without auth
AUTH_PASSWORD=
```

**Step 9: Test the complete flow**

```bash
# Terminal 1: Start backend
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
AUTH_PASSWORD=testpass npm start

# Terminal 2: Start frontend
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm run dev
```

Open http://localhost:3000 - should show login screen. Enter "testpass" to login.

**Step 10: Commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add -A
git commit -m "feat: add token-based authentication with login UI"
```

---

## Task 10: Final Integration Test

**Step 1: Run all tests**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo/server
npm test

cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
npm test
```

Expected: All tests pass

**Step 2: Test Docker Compose build**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app/devtodo
docker compose build
docker compose up -d
```

Expected: Both containers start successfully

**Step 3: Test the application**

Open http://localhost:3000

- Login works (if AUTH_PASSWORD set)
- Can create, edit, complete, delete tasks
- Tasks persist after refresh
- Docker containers show (if Docker available)
- Export to Markdown works

**Step 4: Clean up**

```bash
docker compose down
```

**Step 5: Final commit**

```bash
cd /home/andrew/Documents/Python/Git/Auto_todo_app
git add -A
git status
git commit -m "chore: complete Phase 1 - working full-stack application"
```

---

## Summary

Phase 1 is complete. You now have:

- **Backend**: Express server with SQLite database, REST API for tasks, Docker/Calendar/Gmail/Claude integrations, security middleware, rate limiting
- **Frontend**: React app with Vite, connected to real backend APIs, login UI
- **Infrastructure**: Docker Compose configuration for deployment
- **Tests**: Backend API tests, frontend API service tests

**Next steps** (Phase 2):
- Encrypt Google tokens at rest
- Add more comprehensive input validation
- Add React error boundaries
- Set up CI pipeline
