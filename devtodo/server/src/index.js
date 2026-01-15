const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const { google } = require('googleapis');
const chokidar = require('chokidar');

const { createDb } = require('./db');
const createTasksRouter = require('./routes/tasks');
const createGitRouter = require('./routes/git');
const { authMiddleware } = require('./middleware/auth');

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

// Auth middleware - protects all /api routes
app.use('/api/', authMiddleware);

// Mount task routes
app.use('/api/tasks', createTasksRouter(db));

// Mount git routes
app.use('/api/git', createGitRouter(db));

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
