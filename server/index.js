const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Docker = require('dockerode');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'https://daintytrading.com',
    credentials: true
}));

app.use(express.json());

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// ==================== UTILITY FUNCTIONS ====================

// Simple Levenshtein distance for fuzzy matching
const levenshteinDistance = (a, b) => {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
};

// Configuration
const CONFIG = {
  port: process.env.PORT || 3001,
  docker: {
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    // For remote Docker host (like your VPS)
    host: process.env.DOCKER_HOST || null,
    port: process.env.DOCKER_PORT || 2375,
  },
  claudeChatsPath: process.env.CLAUDE_CHATS_PATH || '/home/user/.config/claude/chats',
  google: {
    // Gmail account
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback',
  },
  googleCalendar: {
    // Separate Calendar account
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/calendar/callback',
  }
};

// Initialize Docker client
let docker;
if (CONFIG.docker.host) {
  docker = new Docker({
    host: CONFIG.docker.host,
    port: CONFIG.docker.port,
  });
} else {
  docker = new Docker({ socketPath: CONFIG.docker.socketPath });
}

// Store for container actions (for auto-completion detection)
const containerActions = new Map();

// ==================== AUTHENTICATION ====================

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const TOKENS_DIR = path.join(__dirname, 'tokens');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data and tokens directories exist
const ensureDataDir = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(TOKENS_DIR, { recursive: true });
  } catch {}
};
ensureDataDir();

// Load users from file
const loadUsers = async () => {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
};

// Save users to file
const saveUsers = async (users) => {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
};

// Auth middleware
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters' });
  }

  const users = await loadUsers();

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  users.push({ username, password: hashedPassword, createdAt: new Date().toISOString() });
  await saveUsers(users);

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const users = await loadUsers();
  const user = users.find(u => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username });
});

// Verify token
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

// ==================== DOCKER API (Protected) ====================

// Container to URL mapping - update with your domains
const CONTAINER_URLS = {
  'npm-app-1': 'https://daintytrading.com',
  'devtodo-frontend-1': 'https://daintytrading.com',
  'devtodo-backend-1': null,
  'meditation_frontend': 'https://meditation.daintytrading.com',
  'meditation_backend': 'https://meditation-api.daintytrading.com',
  'meditation_db': null,
  'meditation_redis': null,
  'cv-matcher-auth': 'https://cv.daintytrading.com',
  'n8n': 'https://n8n.daintytrading.com',
  'open-webui': 'https://ai.daintytrading.com',
  'litellm-litellm-1': 'https://llm.daintytrading.com',
  'litellm_db': null,
  'litellm-prometheus-1': null,
  'timerforge-nginx': 'https://timerforge.app',
  'timerforge-app': 'https://timerforge.app',
  'timerforge-db': null,
  'n8n-watchtower-1': null,
};

// Get all containers
app.get('/api/docker/containers', authMiddleware, async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    const enrichedContainers = await Promise.all(
      containers.map(async (container) => {
        const inspect = await docker.getContainer(container.Id).inspect();
        const name = container.Names[0].replace('/', '');
        return {
          id: container.Id.substring(0, 12),
          name,
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
          webUrl: CONTAINER_URLS[name] || null,
        };
      })
    );
    res.json(enrichedContainers);
  } catch (error) {
    console.error('Docker API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get container logs
app.get('/api/docker/containers/:id/logs', authMiddleware, async (req, res) => {
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
app.post('/api/docker/containers/:id/:action', authMiddleware, async (req, res) => {
  const { id, action } = req.params;
  const validActions = ['start', 'stop', 'restart', 'pause', 'unpause'];
  
  if (!validActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  
  try {
    const container = docker.getContainer(id);
    await container[action]();
    
    // Record the action for auto-completion detection
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
app.get('/api/docker/containers/:id/stats', authMiddleware, async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const stats = await container.stats({ stream: false });
    
    // Calculate CPU and memory percentages
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;
    
    const memUsage = stats.memory_stats.usage;
    const memLimit = stats.memory_stats.limit;
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

// Check for completed Docker tasks
app.get('/api/docker/actions', authMiddleware, async (req, res) => {
  const actions = Array.from(containerActions.entries()).map(([id, data]) => ({
    containerId: id,
    ...data,
  }));
  res.json(actions);
});

// ==================== N8N API ====================

const N8N_API_URL = process.env.N8N_API_URL || 'http://localhost:5678';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

// Get n8n workflows
app.get('/api/n8n/workflows', authMiddleware, async (req, res) => {
  if (!N8N_API_KEY) {
    return res.status(400).json({ error: 'N8N API key not configured' });
  }

  try {
    const response = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch n8n workflows');
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get n8n workflow executions
app.get('/api/n8n/executions', authMiddleware, async (req, res) => {
  if (!N8N_API_KEY) {
    return res.status(400).json({ error: 'N8N API key not configured' });
  }

  try {
    const response = await fetch(`${N8N_API_URL}/api/v1/executions?limit=50`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch n8n executions');
    }

    const data = await response.json();

    // Group by workflow and calculate stats
    const workflowStats = {};
    (data.data || []).forEach(exec => {
      const wfId = exec.workflowId;
      if (!workflowStats[wfId]) {
        workflowStats[wfId] = {
          workflowId: wfId,
          workflowName: exec.workflowData?.name || 'Unknown',
          total: 0,
          success: 0,
          error: 0,
          running: 0,
          lastRun: null
        };
      }
      workflowStats[wfId].total++;
      if (exec.status === 'success') workflowStats[wfId].success++;
      if (exec.status === 'error') workflowStats[wfId].error++;
      if (exec.status === 'running') workflowStats[wfId].running++;
      if (!workflowStats[wfId].lastRun || new Date(exec.startedAt) > new Date(workflowStats[wfId].lastRun)) {
        workflowStats[wfId].lastRun = exec.startedAt;
      }
    });

    res.json({ stats: Object.values(workflowStats), raw: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLAUDE DATA API ====================

const CLAUDE_DATA_PATH = process.env.CLAUDE_DATA_PATH || '/app/claude-data';

// Get Claude todos from all sessions with matching to extracted tasks
app.get('/api/claude/todos', authMiddleware, async (req, res) => {
  try {
    const todosPath = path.join(CLAUDE_DATA_PATH, 'todos');

    try {
      await fs.access(todosPath);
    } catch {
      return res.json({ todos: [], message: 'Claude todos path not accessible' });
    }

    const files = await fs.readdir(todosPath);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    // Load extracted tasks for matching
    let extractedTasks = [];
    try {
      const extractedContent = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
      extractedTasks = JSON.parse(extractedContent).tasks || [];
    } catch {}

    const allTodos = [];
    for (const file of jsonFiles) {
      try {
        const filePath = path.join(todosPath, file);
        const fileStat = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const todos = JSON.parse(content);

        if (Array.isArray(todos) && todos.length > 0) {
          const sessionId = file.split('-agent-')[0];
          const isRecentSession = (Date.now() - fileStat.mtimeMs) < 60 * 60 * 1000; // < 1 hour

          todos.forEach(todo => {
            // Try to match with extracted tasks
            let matchedTask = null;
            for (const task of extractedTasks) {
              const distance = levenshteinDistance(
                todo.content.toLowerCase(),
                task.title.toLowerCase()
              );
              if (distance < todo.content.length * 0.3) {
                matchedTask = task;
                break;
              }
            }

            allTodos.push({
              ...todo,
              sessionId,
              source: 'claude-todo',
              lastModified: fileStat.mtime,
              isRecentSession,
              matchedExtractedTask: matchedTask ? {
                id: matchedTask.id,
                title: matchedTask.title,
                project: matchedTask.project
              } : null
            });
          });
        }
      } catch (e) {
        // Skip invalid files
      }
    }

    // Sort by last modified (most recent first)
    allTodos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    res.json({ todos: allTodos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync status between Claude Code todos and extracted tasks
app.get('/api/claude/sync-status', authMiddleware, async (req, res) => {
  try {
    const todosPath = path.join(CLAUDE_DATA_PATH, 'todos');

    // Load Claude Code todos
    let claudeTodos = [];
    try {
      const files = await fs.readdir(todosPath);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        const content = await fs.readFile(path.join(todosPath, file), 'utf8');
        const todos = JSON.parse(content);
        if (Array.isArray(todos)) {
          claudeTodos.push(...todos.map(t => ({ ...t, file })));
        }
      }
    } catch {}

    // Load extracted tasks
    let extractedTasks = [];
    try {
      const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
      extractedTasks = JSON.parse(content).tasks || [];
    } catch {}

    // Match todos to extracted tasks
    const matches = [];
    for (const todo of claudeTodos) {
      for (const task of extractedTasks) {
        const distance = levenshteinDistance(
          todo.content.toLowerCase(),
          task.title.toLowerCase()
        );
        if (distance < todo.content.length * 0.3) {
          matches.push({
            todoContent: todo.content,
            todoStatus: todo.status,
            taskId: task.id,
            taskTitle: task.title,
            shouldSync: todo.status === 'completed'
          });
          break;
        }
      }
    }

    res.json({
      totalClaudeTodos: claudeTodos.length,
      totalExtractedTasks: extractedTasks.length,
      matches,
      completedInClaude: matches.filter(m => m.shouldSync).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Claude command history
app.get('/api/claude/history', authMiddleware, async (req, res) => {
  try {
    const historyPath = path.join(CLAUDE_DATA_PATH, 'history.jsonl');

    try {
      await fs.access(historyPath);
    } catch {
      return res.json({ history: [], message: 'Claude history not accessible' });
    }

    const content = await fs.readFile(historyPath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);

    const history = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse().slice(0, 100); // Most recent 100

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Claude conversations (full chats with both user and assistant messages)
app.get('/api/claude/conversations', authMiddleware, async (req, res) => {
  try {
    const projectsPath = path.join(CLAUDE_DATA_PATH, 'projects');

    try {
      await fs.access(projectsPath);
    } catch {
      return res.json({ conversations: [], message: 'Claude projects not accessible' });
    }

    const projectDirs = await fs.readdir(projectsPath);
    const allConversations = [];

    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;

      const projectPath = path.join(projectsPath, dir);
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(projectPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        try {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(l => l);

          const messages = [];
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'user' && entry.message?.content) {
                messages.push({
                  role: 'user',
                  content: typeof entry.message.content === 'string' ? entry.message.content : JSON.stringify(entry.message.content),
                  timestamp: entry.timestamp
                });
              } else if (entry.type === 'assistant' && entry.message?.content) {
                // Extract text from assistant response
                const content = entry.message.content;
                let text = '';
                if (Array.isArray(content)) {
                  text = content
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
                } else if (typeof content === 'string') {
                  text = content;
                }
                if (text) {
                  messages.push({
                    role: 'assistant',
                    content: text.slice(0, 500) + (text.length > 500 ? '...' : ''),
                    timestamp: entry.timestamp
                  });
                }
              }
            } catch {}
          }

          if (messages.length > 0) {
            allConversations.push({
              project: dir.replace(/^-/, '').replace(/-/g, '/'),
              sessionId: file.replace('.jsonl', ''),
              messages: messages.slice(-20), // Last 20 messages
              lastActivity: messages[messages.length - 1]?.timestamp
            });
          }
        } catch {}
      }
    }

    // Sort by last activity
    allConversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

    res.json({ conversations: allConversations.slice(0, 10) }); // Last 10 conversations
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Legacy endpoint - returns combined data
app.get('/api/claude/actions', authMiddleware, async (req, res) => {
  try {
    const todosPath = path.join(CLAUDE_DATA_PATH, 'todos');
    const allActions = [];

    try {
      const files = await fs.readdir(todosPath);
      for (const file of files.filter(f => f.endsWith('.json'))) {
        try {
          const content = await fs.readFile(path.join(todosPath, file), 'utf8');
          const todos = JSON.parse(content);
          if (Array.isArray(todos)) {
            todos.forEach(todo => {
              if (todo.status === 'pending' || todo.status === 'in_progress') {
                allActions.push({
                  text: todo.content,
                  status: todo.status,
                  source: 'claude-todo'
                });
              }
            });
          }
        } catch {}
      }
    } catch {}

    res.json({ actions: allActions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Watch Claude chats folder for changes
let chatWatcher = null;
let pendingActions = [];

app.post('/api/claude/watch', authMiddleware, async (req, res) => {
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

// Get pending actions from watcher
app.get('/api/claude/pending', authMiddleware, (req, res) => {
  const actions = [...pendingActions];
  pendingActions = [];
  res.json({ actions });
});

// ==================== GOOGLE API ====================

// Gmail OAuth client
let oauth2ClientGmail = null;
if (CONFIG.google.clientId) {
  oauth2ClientGmail = new google.auth.OAuth2(
    CONFIG.google.clientId,
    CONFIG.google.clientSecret,
    CONFIG.google.redirectUri
  );
}

// Calendar OAuth client (separate account)
let oauth2ClientCalendar = null;
if (CONFIG.googleCalendar.clientId) {
  oauth2ClientCalendar = new google.auth.OAuth2(
    CONFIG.googleCalendar.clientId,
    CONFIG.googleCalendar.clientSecret,
    CONFIG.googleCalendar.redirectUri
  );
}

// Generate Gmail auth URL
app.get('/api/gmail/auth', authMiddleware, (req, res) => {
  if (!oauth2ClientGmail) {
    return res.status(400).json({ error: 'Gmail OAuth not configured' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const url = oauth2ClientGmail.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  res.json({ authUrl: url });
});

// Generate Calendar auth URL (uses separate account)
app.get('/api/calendar/auth', authMiddleware, (req, res) => {
  if (!oauth2ClientCalendar) {
    return res.status(400).json({ error: 'Calendar OAuth not configured' });
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
  ];

  const url = oauth2ClientCalendar.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
  });

  res.json({ authUrl: url });
});

// Gmail OAuth callback
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2ClientGmail.getToken(code);
    oauth2ClientGmail.setCredentials(tokens);

    // Store Gmail tokens
    await fs.writeFile(
      path.join(__dirname, 'tokens', 'gmail-tokens.json'),
      JSON.stringify(tokens)
    );

    res.redirect('/?auth=gmail-success');
  } catch (error) {
    console.error('Gmail auth error:', error);
    res.redirect('/?auth=gmail-error');
  }
});

// Calendar OAuth callback (separate account)
app.get('/api/auth/google/calendar/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2ClientCalendar.getToken(code);
    oauth2ClientCalendar.setCredentials(tokens);

    // Store Calendar tokens
    await fs.writeFile(
      path.join(__dirname, 'tokens', 'calendar-tokens.json'),
      JSON.stringify(tokens)
    );

    res.redirect('/?auth=calendar-success');
  } catch (error) {
    console.error('Calendar auth error:', error);
    res.redirect('/?auth=calendar-error');
  }
});

// Load stored tokens on startup
const loadGoogleTokens = async () => {
  // Load Gmail tokens
  try {
    const gmailTokensPath = path.join(__dirname, 'tokens', 'gmail-tokens.json');
    const gmailTokens = JSON.parse(await fs.readFile(gmailTokensPath, 'utf8'));
    if (oauth2ClientGmail) {
      oauth2ClientGmail.setCredentials(gmailTokens);
    }
  } catch {
    // No Gmail tokens stored
  }

  // Load Calendar tokens
  try {
    const calendarTokensPath = path.join(__dirname, 'tokens', 'calendar-tokens.json');
    const calendarTokens = JSON.parse(await fs.readFile(calendarTokensPath, 'utf8'));
    if (oauth2ClientCalendar) {
      oauth2ClientCalendar.setCredentials(calendarTokens);
    }
  } catch {
    // No Calendar tokens stored
  }

  // Also try to load legacy tokens (for backwards compatibility)
  try {
    const legacyTokensPath = path.join(__dirname, 'tokens', 'google-tokens.json');
    const legacyTokens = JSON.parse(await fs.readFile(legacyTokensPath, 'utf8'));
    // Apply legacy tokens to Gmail client if not already set
    if (oauth2ClientGmail && !oauth2ClientGmail.credentials?.access_token) {
      oauth2ClientGmail.setCredentials(legacyTokens);
    }
  } catch {
    // No legacy tokens
  }
};

// Get calendar events
app.get('/api/calendar/events', authMiddleware, async (req, res) => {
  if (!oauth2ClientCalendar || !oauth2ClientCalendar.credentials?.access_token) {
    return res.status(401).json({ error: 'Calendar not authenticated', needsAuth: true });
  }

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2ClientCalendar });
    
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

// Get action items from emails
app.get('/api/gmail/actions', authMiddleware, async (req, res) => {
  if (!oauth2ClientGmail || !oauth2ClientGmail.credentials?.access_token) {
    return res.status(401).json({ error: 'Gmail not authenticated', needsAuth: true });
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2ClientGmail });
    
    // Search for actionable emails
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
          
          // Extract potential action from subject
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
    
    // Deduplicate by thread
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

// Export tasks to markdown
app.post('/api/export/markdown', authMiddleware, (req, res) => {
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
      gmailAuth: false,
      calendarAuth: false,
    }
  };

  // Check Docker
  try {
    await docker.ping();
    health.services.docker = true;
  } catch {
    health.services.docker = false;
  }

  // Check Gmail Auth
  health.services.gmailAuth = !!(oauth2ClientGmail?.credentials?.access_token);

  // Check Calendar Auth
  health.services.calendarAuth = !!(oauth2ClientCalendar?.credentials?.access_token);

  res.json(health);
});

// ==================== LLM TASK EXTRACTION ====================

const LITELLM_URL = process.env.LITELLM_URL || 'http://172.17.0.1:4000';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || '';
const EXTRACTED_TASKS_PATH = path.join(DATA_DIR, 'extracted-tasks.json');

// Generate stable hash-based ID for a task
const generateTaskId = (message, project) => {
  const hash = crypto.createHash('md5')
    .update(message.slice(0, 500) + project)
    .digest('hex')
    .slice(0, 12);
  return `claude-${hash}`;
};

// Parse JSON with multiple fallback strategies
const parseJSONSafe = (text) => {
  if (!text) return null;

  // Strategy 1: Direct parse
  try {
    return JSON.parse(text);
  } catch {}

  // Strategy 2: Strip markdown code fences
  try {
    const stripped = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(stripped);
  } catch {}

  // Strategy 3: Extract JSON object from text
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  // Strategy 4: Try to fix common issues (trailing commas, unquoted keys)
  try {
    const fixed = text
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
    const match = fixed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return null;
};

// LLM system prompt for task extraction
const TASK_EXTRACTION_PROMPT = `You extract actionable development tasks from chat messages.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Clear actionable title starting with verb (max 150 chars)",
  "description": "2-3 sentences explaining what was requested and why. Include key requirements.",
  "context": "Files, technologies, APIs, or dependencies mentioned",
  "category": "feature|bugfix|refactor|config|docs|research",
  "topic": "Short topic name (1-3 words) describing the feature area"
}

Rules:
- Title MUST start with action verb (Add, Fix, Update, Implement, Configure, Create, Build, Remove, etc.)
- Description should capture the full intent, not just summarize
- Context extracts technical specifics (file paths, package names, API endpoints)
- Omit sensitive data (API keys, passwords, tokens, secrets)
- Category: feature (new functionality), bugfix (fixing issues), refactor (code improvement), config (setup/configuration), docs (documentation), research (investigation/exploration)
- Topic: A short label for the feature area (e.g., "Authentication", "Docker Integration", "UI Components", "API Endpoints", "Database", "Testing", "Claude Parsing", "Calendar Sync", "Email Import", "Export", "Settings", "Performance", "Security")
- If unclear, set category to "research" and topic to "General"`;

// Extract and summarize tasks from Claude chats using LLM (runs in background)
const extractTasksFromChats = async () => {
  console.log('Extracting tasks from Claude chats...');
  try {
    const projectsPath = path.join(CLAUDE_DATA_PATH, 'projects');
    await fs.access(projectsPath);

    // Load existing task state
    let existingData = { tasks: [], taskState: {}, lastUpdated: null };
    try {
      const existing = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
      existingData = JSON.parse(existing);
      if (!existingData.taskState) existingData.taskState = {};
    } catch {}

    const projectDirs = await fs.readdir(projectsPath);
    const allMessages = [];

    // Collect user messages from all conversations
    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;
      const projectPath = path.join(projectsPath, dir);
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(projectPath);
      for (const file of files.filter(f => f.endsWith('.jsonl'))) {
        try {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(l => l);
          const sessionId = file.replace('.jsonl', '');

          // Get first user message as chat title hint
          let chatTitle = null;
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'user' && entry.message?.content) {
                const msg = typeof entry.message.content === 'string' ? entry.message.content : '';
                if (msg.length > 10) {
                  chatTitle = msg.slice(0, 100);
                  break;
                }
              }
            } catch {}
          }

          let messageIndex = 0;
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'user' && entry.message?.content) {
                const msg = typeof entry.message.content === 'string' ? entry.message.content : '';
                // Filter: >20 chars, has action words, not just commands
                if (msg.length > 20 &&
                    /(add|create|fix|update|remove|change|make|build|implement|configure|setup|can you|help|how|install|check|show|find|deploy|enable|write|refactor|improve|optimize)/i.test(msg) &&
                    !/^(yes|no|ok|ls|cd|pwd|y|n|\d+)$/i.test(msg.trim())) {
                  allMessages.push({
                    content: msg,
                    project: dir.replace(/^-/, '').replace(/-/g, '/'),
                    timestamp: entry.timestamp,
                    sessionId,
                    messageIndex,
                    chatTitle,
                    conversationPath: filePath
                  });
                }
                messageIndex++;
              }
            } catch {}
          }
        } catch {}
      }
    }

    // Sort by timestamp, take latest 50
    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentMessages = allMessages.slice(0, 50);

    // Summarize each with LLM and deduplicate
    const tasks = [];
    const seenTitles = [];

    for (const msg of recentMessages) {
      const taskId = generateTaskId(msg.content, msg.project);

      // Skip if dismissed
      if (existingData.taskState[taskId]?.status === 'dismissed') {
        continue;
      }

      let title = msg.content.replace(/\n/g, ' ').slice(0, 80);
      let description = '';
      let context = '';
      let category = 'research';
      let topic = 'General';

      // Try LLM extraction with retry
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`${LITELLM_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(LITELLM_API_KEY && { 'Authorization': `Bearer ${LITELLM_API_KEY}` })
            },
            body: JSON.stringify({
              model: 'chatgpt-4o-latest',
              messages: [
                { role: 'system', content: TASK_EXTRACTION_PROMPT },
                { role: 'user', content: msg.content.slice(0, 1500) }
              ],
              max_tokens: 350,
              temperature: 0.2
            })
          });

          if (response.ok) {
            const data = await response.json();
            const llmResponse = data.choices?.[0]?.message?.content?.trim();
            const parsed = parseJSONSafe(llmResponse);

            if (parsed?.title) {
              title = parsed.title.slice(0, 150);
              description = parsed.description || '';
              context = parsed.context || '';
              category = ['feature', 'bugfix', 'refactor', 'config', 'docs', 'research'].includes(parsed.category)
                ? parsed.category
                : 'research';
              topic = parsed.topic || 'General';
              break; // Success, no need to retry
            }
          }
        } catch (e) {
          console.error(`LLM extraction attempt ${attempt + 1} failed:`, e.message);
        }
      }

      // Deduplication: check for similar titles
      const isDuplicate = seenTitles.some(seen => {
        const distance = levenshteinDistance(seen.title.toLowerCase(), title.toLowerCase());
        const threshold = Math.min(seen.title.length, title.length) * 0.25;
        if (distance < threshold) {
          seen.similarCount = (seen.similarCount || 1) + 1;
          if (!seen.relatedSessions.includes(msg.sessionId)) {
            seen.relatedSessions.push(msg.sessionId);
          }
          return true;
        }
        return false;
      });

      if (!isDuplicate) {
        const task = {
          id: taskId,
          title,
          description,
          context,
          category,
          topic,
          originalMessage: msg.content.slice(0, 1500),
          project: msg.project,
          timestamp: msg.timestamp,
          sessionId: msg.sessionId,
          messageIndex: msg.messageIndex,
          chatTitle: msg.chatTitle,
          conversationPath: msg.conversationPath,
          similarCount: 1,
          relatedSessions: [msg.sessionId]
        };

        tasks.push(task);
        seenTitles.push(task);
      }
    }

    // Preserve existing taskState, add new tasks
    const newData = {
      tasks,
      taskState: existingData.taskState,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(EXTRACTED_TASKS_PATH, JSON.stringify(newData, null, 2));
    console.log(`Extracted ${tasks.length} tasks from Claude chats (${Object.keys(existingData.taskState).length} with saved state)`);
  } catch (error) {
    console.error('Task extraction failed:', error.message);
  }
};

// Get extracted tasks
app.get('/api/claude/extracted-tasks', authMiddleware, async (req, res) => {
  try {
    const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
    const data = JSON.parse(content);

    // Include taskState in response for frontend
    res.json({
      tasks: data.tasks || [],
      taskState: data.taskState || {},
      lastUpdated: data.lastUpdated
    });
  } catch {
    res.json({ tasks: [], taskState: {}, lastUpdated: null });
  }
});

// Trigger extraction manually
app.post('/api/claude/extract-tasks', authMiddleware, async (req, res) => {
  extractTasksFromChats();
  res.json({ message: 'Task extraction started' });
});

// Dismiss a task
app.post('/api/claude/tasks/:id/dismiss', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
    const data = JSON.parse(content);

    if (!data.taskState) data.taskState = {};
    data.taskState[id] = {
      status: 'dismissed',
      dismissedAt: new Date().toISOString()
    };

    // Remove from active tasks list
    data.tasks = (data.tasks || []).filter(t => t.id !== id);

    await fs.writeFile(EXTRACTED_TASKS_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore a dismissed task
app.post('/api/claude/tasks/:id/restore', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
    const data = JSON.parse(content);

    if (data.taskState?.[id]) {
      delete data.taskState[id];
    }

    await fs.writeFile(EXTRACTED_TASKS_PATH, JSON.stringify(data, null, 2));

    // Trigger re-extraction to get the task back
    extractTasksFromChats();

    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark task as imported (linked to a DevTodo task)
app.post('/api/claude/tasks/:id/import', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { linkedTaskId } = req.body;

    const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
    const data = JSON.parse(content);

    if (!data.taskState) data.taskState = {};
    data.taskState[id] = {
      status: 'imported',
      importedAt: new Date().toISOString(),
      linkedTaskId
    };

    await fs.writeFile(EXTRACTED_TASKS_PATH, JSON.stringify(data, null, 2));
    res.json({ success: true, id, linkedTaskId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dismissed tasks
app.get('/api/claude/tasks/dismissed', authMiddleware, async (req, res) => {
  try {
    const content = await fs.readFile(EXTRACTED_TASKS_PATH, 'utf8');
    const data = JSON.parse(content);

    const dismissed = Object.entries(data.taskState || {})
      .filter(([_, state]) => state.status === 'dismissed')
      .map(([id, state]) => ({ id, ...state }));

    res.json({ dismissed });
  } catch {
    res.json({ dismissed: [] });
  }
});

// Get full conversation for a session
app.get('/api/claude/conversation/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const projectsPath = path.join(CLAUDE_DATA_PATH, 'projects');

    // Find the session file across all projects
    const projectDirs = await fs.readdir(projectsPath);

    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;
      const projectPath = path.join(projectsPath, dir);
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) continue;

      const sessionFile = path.join(projectPath, `${sessionId}.jsonl`);
      try {
        await fs.access(sessionFile);
        const content = await fs.readFile(sessionFile, 'utf8');
        const lines = content.trim().split('\n').filter(l => l);

        const messages = [];
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'user' && entry.message?.content) {
              messages.push({
                role: 'user',
                content: typeof entry.message.content === 'string'
                  ? entry.message.content
                  : JSON.stringify(entry.message.content),
                timestamp: entry.timestamp
              });
            } else if (entry.type === 'assistant' && entry.message?.content) {
              const msgContent = entry.message.content;
              let text = '';
              if (Array.isArray(msgContent)) {
                text = msgContent
                  .filter(c => c.type === 'text')
                  .map(c => c.text)
                  .join('\n');
              } else if (typeof msgContent === 'string') {
                text = msgContent;
              }
              if (text) {
                messages.push({
                  role: 'assistant',
                  content: text,
                  timestamp: entry.timestamp
                });
              }
            }
          } catch {}
        }

        return res.json({
          sessionId,
          project: dir.replace(/^-/, '').replace(/-/g, '/'),
          messages,
          filePath: sessionFile
        });
      } catch {
        // Session file not in this project, continue searching
      }
    }

    res.status(404).json({ error: 'Session not found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CLAUDE CHAT EXPORT ====================

const CLAUDE_CHATS_MD_PATH = path.join(DATA_DIR, 'claude-chats.md');

// Export Claude conversations to markdown
const exportClaudeChatsToMarkdown = async () => {
  try {
    const projectsPath = path.join(CLAUDE_DATA_PATH, 'projects');

    try {
      await fs.access(projectsPath);
    } catch {
      console.log('Claude projects path not accessible');
      return;
    }

    const projectDirs = await fs.readdir(projectsPath);
    let markdown = `# Claude Code Conversations\n\n`;
    markdown += `*Last updated: ${new Date().toLocaleString('en-AU')}*\n\n`;
    markdown += `---\n\n`;

    for (const dir of projectDirs) {
      if (dir.startsWith('.')) continue;

      const projectPath = path.join(projectsPath, dir);
      const stat = await fs.stat(projectPath);
      if (!stat.isDirectory()) continue;

      const projectName = dir.replace(/^-/, '').replace(/-/g, '/');
      const files = await fs.readdir(projectPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

      for (const file of jsonlFiles) {
        try {
          const filePath = path.join(projectPath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(l => l);

          const messages = [];
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (entry.type === 'user' && entry.message?.content) {
                messages.push({
                  role: 'user',
                  content: typeof entry.message.content === 'string' ? entry.message.content : '',
                  timestamp: entry.timestamp
                });
              } else if (entry.type === 'assistant' && entry.message?.content) {
                const msgContent = entry.message.content;
                let text = '';
                if (Array.isArray(msgContent)) {
                  text = msgContent
                    .filter(c => c.type === 'text')
                    .map(c => c.text)
                    .join('\n');
                } else if (typeof msgContent === 'string') {
                  text = msgContent;
                }
                if (text) {
                  messages.push({
                    role: 'assistant',
                    content: text,
                    timestamp: entry.timestamp
                  });
                }
              }
            } catch {}
          }

          if (messages.length > 0) {
            const lastActivity = messages[messages.length - 1]?.timestamp;
            markdown += `## ${projectName}\n\n`;
            markdown += `*Session: ${file.replace('.jsonl', '')}*\n`;
            markdown += `*Last activity: ${lastActivity ? new Date(lastActivity).toLocaleString('en-AU') : 'Unknown'}*\n\n`;

            // Show last 10 messages
            for (const msg of messages.slice(-10)) {
              if (msg.role === 'user') {
                markdown += `### You\n\n`;
                markdown += `${msg.content}\n\n`;
              } else {
                markdown += `### Claude\n\n`;
                markdown += `${msg.content.slice(0, 1000)}${msg.content.length > 1000 ? '\n\n*[truncated...]*' : ''}\n\n`;
              }
            }
            markdown += `---\n\n`;
          }
        } catch {}
      }
    }

    await fs.writeFile(CLAUDE_CHATS_MD_PATH, markdown);
    console.log('Claude chats exported to markdown');
  } catch (error) {
    console.error('Failed to export Claude chats:', error.message);
  }
};

// Get the saved markdown file
app.get('/api/claude/chats-md', authMiddleware, async (req, res) => {
  try {
    const content = await fs.readFile(CLAUDE_CHATS_MD_PATH, 'utf8');
    res.json({ content, lastUpdated: (await fs.stat(CLAUDE_CHATS_MD_PATH)).mtime });
  } catch {
    res.json({ content: 'No Claude chats exported yet.', lastUpdated: null });
  }
});

// ==================== START SERVER ====================

loadGoogleTokens().then(() => {
  app.listen(CONFIG.port, () => {
    console.log(`DevTodo API server running on port ${CONFIG.port}`);
    console.log(`Docker socket: ${CONFIG.docker.socketPath}`);
    console.log(`Claude chats path: ${CONFIG.claudeChatsPath}`);

    // Export Claude chats on startup and every 10 minutes
    exportClaudeChatsToMarkdown();
    setInterval(exportClaudeChatsToMarkdown, 10 * 60 * 1000);

    // Extract tasks with LLM on startup and every 10 minutes
    setTimeout(extractTasksFromChats, 5000); // Wait 5s for LiteLLM to be ready
    setInterval(extractTasksFromChats, 10 * 60 * 1000);
  });
});
