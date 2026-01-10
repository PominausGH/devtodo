import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, Plus, Calendar, Mail, Server,
  MessageSquare, Download, Settings, RefreshCw, Trash2,
  Clock, Tag, AlertCircle, ChevronDown, ChevronRight,
  Container, FileText, ExternalLink, Edit2, Save, X,
  Loader2, CheckCheck, Filter, Sun, Moon, Zap, LogIn, LogOut, User,
  Eye, EyeOff, RotateCcw, FolderOpen, Code, Hash, Link2
} from 'lucide-react';

// API helper with auth
const api = {
  getToken: () => localStorage.getItem('devtodo-token'),
  setToken: (token) => localStorage.setItem('devtodo-token', token),
  clearToken: () => localStorage.removeItem('devtodo-token'),

  async fetch(url, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };
    const response = await fetch(url, { ...options, headers });
    // Only logout if 401 is from auth endpoints (not Google OAuth endpoints)
    if (response.status === 401) {
      try {
        const data = await response.clone().json();
        // If needsAuth is true, it's a Google OAuth issue, not session issue
        if (!data.needsAuth) {
          this.clearToken();
          window.location.reload();
        }
      } catch {
        // If can't parse JSON, assume session issue
        this.clearToken();
        window.location.reload();
      }
    }
    return response;
  }
};

// Configuration - Update these for your setup
const CONFIG = {
  vpsHost: 'daintytrading.com',
  claudeChatsPath: '/mnt/user-data/uploads/claude-chats',
  dockerApiEndpoint: '/api/docker',
  googleCalendarApiEndpoint: '/api/calendar',
  gmailApiEndpoint: '/api/gmail'
};


// Task source types
const SOURCE_TYPES = {
  MANUAL: 'manual',
  DOCKER: 'docker',
  CLAUDE: 'claude',
  CALENDAR: 'calendar',
  GMAIL: 'gmail'
};

const SOURCE_ICONS = {
  [SOURCE_TYPES.MANUAL]: Plus,
  [SOURCE_TYPES.DOCKER]: Container,
  [SOURCE_TYPES.CLAUDE]: MessageSquare,
  [SOURCE_TYPES.CALENDAR]: Calendar,
  [SOURCE_TYPES.GMAIL]: Mail
};

const SOURCE_COLORS = {
  [SOURCE_TYPES.MANUAL]: '#6366f1',
  [SOURCE_TYPES.DOCKER]: '#0ea5e9',
  [SOURCE_TYPES.CLAUDE]: '#f97316',
  [SOURCE_TYPES.CALENDAR]: '#22c55e',
  [SOURCE_TYPES.GMAIL]: '#ef4444'
};

// Utility functions
const generateId = () => `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
};

const isToday = (date) => {
  const today = new Date();
  const d = new Date(date);
  return d.toDateString() === today.toDateString();
};

// Extract project name from container name
const getProjectName = (containerName) => {
  // Common patterns: project-component-1, project_component, project
  const patterns = [
    /^([a-z0-9]+)[-_](frontend|backend|app|db|redis|nginx|prometheus|watchtower|litellm)[-_]?\d*$/i,
    /^([a-z0-9]+)[-_]\d+$/i,
    /^([a-z0-9]+)[-_]/i,
  ];

  for (const pattern of patterns) {
    const match = containerName.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return containerName.toLowerCase();
};

// Group containers by project
const groupContainersByProject = (containers) => {
  const groups = {};
  containers.forEach(container => {
    const project = getProjectName(container.name);
    if (!groups[project]) {
      groups[project] = {
        name: project,
        containers: [],
        hasError: false,
        allRunning: true
      };
    }
    groups[project].containers.push(container);
    if (container.status !== 'running') {
      groups[project].allRunning = false;
    }
    if (container.status === 'exited' || container.health === 'unhealthy') {
      groups[project].hasError = true;
    }
  });
  return Object.values(groups).sort((a, b) => {
    // Sort by error status first, then by name
    if (a.hasError !== b.hasError) return a.hasError ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

// Parse Claude chat files for action items
const parseClaudeChats = (chatContent) => {
  const actionPatterns = [
    /TODO:?\s*(.+)/gi,
    /ACTION:?\s*(.+)/gi,
    /NEXT:?\s*(.+)/gi,
    /\[ \]\s*(.+)/g,
    /- \[ \]\s*(.+)/g,
    /(?:need to|should|must|will)\s+(.+?)(?:\.|$)/gi,
    /(?:create|build|implement|fix|update|deploy|configure)\s+(.+?)(?:\.|$)/gi
  ];
  
  const actions = [];
  actionPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(chatContent)) !== null) {
      const text = match[1].trim();
      if (text.length > 10 && text.length < 200) {
        actions.push(text);
      }
    }
  });
  
  return [...new Set(actions)].slice(0, 10);
};

// Export to Markdown
const exportToMarkdown = (tasks, date = new Date()) => {
  const dateStr = date.toISOString().split('T')[0];
  const completed = tasks.filter(t => t.completed);
  const pending = tasks.filter(t => !t.completed);
  
  let md = `# Daily Task Report - ${formatDate(date)}\n\n`;
  md += `Generated: ${new Date().toLocaleString('en-AU')}\n\n`;
  md += `---\n\n`;
  
  md += `## Summary\n\n`;
  md += `- **Total Tasks:** ${tasks.length}\n`;
  md += `- **Completed:** ${completed.length}\n`;
  md += `- **Pending:** ${pending.length}\n`;
  md += `- **Completion Rate:** ${tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0}%\n\n`;
  
  md += `## Completed Tasks ✓\n\n`;
  if (completed.length === 0) {
    md += `_No tasks completed today_\n\n`;
  } else {
    completed.forEach(task => {
      const sourceIcon = task.source === SOURCE_TYPES.DOCKER ? '🐳' :
                        task.source === SOURCE_TYPES.CLAUDE ? '🤖' :
                        task.source === SOURCE_TYPES.CALENDAR ? '📅' :
                        task.source === SOURCE_TYPES.GMAIL ? '📧' : '✏️';
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
      const sourceIcon = task.source === SOURCE_TYPES.DOCKER ? '🐳' :
                        task.source === SOURCE_TYPES.CLAUDE ? '🤖' :
                        task.source === SOURCE_TYPES.CALENDAR ? '📅' :
                        task.source === SOURCE_TYPES.GMAIL ? '📧' : '✏️';
      const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      md += `- [ ] ${priority} ${sourceIcon} ${task.title}\n`;
      if (task.dueDate) md += `  Due: ${formatDate(task.dueDate)}\n`;
      if (task.notes) md += `  > ${task.notes}\n`;
    });
  }
  md += `\n`;
  
  md += `## Task Sources Breakdown\n\n`;
  const sourceCounts = {};
  Object.values(SOURCE_TYPES).forEach(source => {
    sourceCounts[source] = tasks.filter(t => t.source === source).length;
  });
  md += `| Source | Count |\n|--------|-------|\n`;
  Object.entries(sourceCounts).forEach(([source, count]) => {
    if (count > 0) {
      md += `| ${source.charAt(0).toUpperCase() + source.slice(1)} | ${count} |\n`;
    }
  });
  
  md += `\n---\n\n`;
  md += `_Generated by DevTodo - Your Infrastructure-Aware Task Manager_\n`;
  
  return { content: md, filename: `tasks-${dateStr}.md` };
};

// Login Component
function LoginPage({ onLogin, darkMode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const theme = darkMode ? {
    bg: '#0f172a', card: '#1e293b', text: '#f1f5f9', textMuted: '#94a3b8',
    border: '#334155', primary: '#6366f1', danger: '#ef4444'
  } : {
    bg: '#f8fafc', card: '#ffffff', text: '#0f172a', textMuted: '#64748b',
    border: '#e2e8f0', primary: '#6366f1', danger: '#ef4444'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      api.setToken(data.token);
      onLogin(data.username);
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.bg, padding: '20px'
    }}>
      <div style={{
        backgroundColor: theme.card, borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px', backgroundColor: theme.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
          }}>
            <Zap size={32} color="white" />
          </div>
          <h1 style={{ color: theme.text, fontSize: '24px', margin: 0 }}>DevTodo</h1>
          <p style={{ color: theme.textMuted, marginTop: '8px' }}>
            {isRegister ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: theme.textMuted, fontSize: '14px', display: 'block', marginBottom: '6px' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`,
                backgroundColor: theme.bg, color: theme.text, fontSize: '16px', boxSizing: 'border-box'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: theme.textMuted, fontSize: '14px', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${theme.border}`,
                backgroundColor: theme.bg, color: theme.text, fontSize: '16px', boxSizing: 'border-box'
              }}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: `${theme.danger}20`, color: theme.danger, padding: '12px',
              borderRadius: '8px', marginBottom: '16px', fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
              backgroundColor: theme.primary, color: 'white', fontSize: '16px',
              fontWeight: '600', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {loading ? <Loader2 size={20} className="spin" /> : <LogIn size={20} />}
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: theme.textMuted, fontSize: '14px' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{
              background: 'none', border: 'none', color: theme.primary,
              cursor: 'pointer', fontSize: '14px', fontWeight: '600'
            }}
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}

// Main App Component
export default function DevTodo() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', dueDate: '', notes: '' });
  const [editingTask, setEditingTask] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    docker: true,
    claude: true,
    calendar: true,
    gmail: true
  });
  const [dockerContainers, setDockerContainers] = useState([]);
  const [expandedProjects, setExpandedProjects] = useState({});
  const [claudeActions, setClaudeActions] = useState([]);
  const [claudeTaskState, setClaudeTaskState] = useState({});
  const [claudeTodos, setClaudeTodos] = useState([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [expandedOriginal, setExpandedOriginal] = useState({});
  const [conversationModal, setConversationModal] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [emailActions, setEmailActions] = useState([]);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = api.getToken();
      if (!token) {
        setAuthChecked(true);
        return;
      }

      try {
        const res = await api.fetch('/api/auth/verify');
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(true);
          setCurrentUser(data.username);
        }
      } catch {
        api.clearToken();
      }
      setAuthChecked(true);
    };

    checkAuth();
  }, []);

  const handleLogin = useCallback((username) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
  }, []);

  const handleLogout = useCallback(() => {
    api.clearToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
  }, []);

  // Load tasks from localStorage on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem('devtodo-tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    const savedDarkMode = localStorage.getItem('devtodo-darkmode');
    if (savedDarkMode !== null) {
      setDarkMode(JSON.parse(savedDarkMode));
    }
  }, []);

  // Save tasks to localStorage when changed
  useEffect(() => {
    localStorage.setItem('devtodo-tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('devtodo-darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Sync all sources
  const syncAll = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch real Docker containers from API
      const dockerRes = await api.fetch('/api/docker/containers');
      if (dockerRes.ok) {
        const containers = await dockerRes.json();
        setDockerContainers(containers);
      } else {
        setDockerContainers([]);
      }

      // Fetch real Calendar events
      try {
        const calRes = await api.fetch('/api/calendar/events');
        if (calRes.ok) {
          const calData = await calRes.json();
          setCalendarEvents(calData.events || []);
        } else {
          setCalendarEvents([]);
        }
      } catch {
        setCalendarEvents([]);
      }

      // Fetch real Gmail actions
      try {
        const gmailRes = await api.fetch('/api/gmail/actions');
        if (gmailRes.ok) {
          const gmailData = await gmailRes.json();
          setEmailActions(gmailData.emails || []);
        } else {
          setEmailActions([]);
        }
      } catch {
        setEmailActions([]);
      }

      // Fetch Claude extracted tasks (LLM-summarized)
      try {
        const claudeRes = await api.fetch('/api/claude/extracted-tasks');
        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          setClaudeActions(claudeData.tasks || []);
          setClaudeTaskState(claudeData.taskState || {});
        } else {
          setClaudeActions([]);
          setClaudeTaskState({});
        }
      } catch {
        setClaudeActions([]);
        setClaudeTaskState({});
      }

      // Fetch Claude Code todos for sync status
      try {
        const todosRes = await api.fetch('/api/claude/todos');
        if (todosRes.ok) {
          const todosData = await todosRes.json();
          setClaudeTodos(todosData.todos || []);
        } else {
          setClaudeTodos([]);
        }
      } catch {
        setClaudeTodos([]);
      }

      setLastSync(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    }
    setIsLoading(false);
  }, []);

  // Initial sync - only when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    syncAll();
    // Auto-sync every 5 minutes
    const interval = setInterval(syncAll, 300000);
    return () => clearInterval(interval);
  }, [syncAll, isAuthenticated]);

  // Add task
  const addTask = (taskData) => {
    const task = {
      id: generateId(),
      title: taskData.title,
      completed: false,
      priority: taskData.priority || 'medium',
      source: taskData.source || SOURCE_TYPES.MANUAL,
      createdAt: new Date().toISOString(),
      dueDate: taskData.dueDate || null,
      notes: taskData.notes || '',
      dockerContainerId: taskData.dockerContainerId || null,
      calendarEventId: taskData.calendarEventId || null,
      emailId: taskData.emailId || null
    };
    setTasks(prev => [task, ...prev]);
    setShowAddTask(false);
    setNewTask({ title: '', priority: 'medium', dueDate: '', notes: '' });
  };

  // Toggle task completion
  const toggleTask = (taskId) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          completed: !task.completed,
          completedAt: !task.completed ? new Date().toISOString() : null
        };
      }
      return task;
    }));
  };

  // Delete task
  const deleteTask = (taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  // Update task
  const updateTask = (taskId, updates) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
    setEditingTask(null);
  };

  // Import from source
  const importFromDocker = (container, action) => {
    const title = `${action} ${container.name} container`;
    if (!tasks.some(t => t.title === title && !t.completed)) {
      addTask({
        title,
        source: SOURCE_TYPES.DOCKER,
        priority: 'high',
        dockerContainerId: container.id
      });
    }
  };

  const importFromCalendar = (event) => {
    const title = event.title;
    if (!tasks.some(t => t.calendarEventId === event.id)) {
      addTask({
        title,
        source: SOURCE_TYPES.CALENDAR,
        priority: 'medium',
        dueDate: event.start,
        calendarEventId: event.id
      });
    }
  };

  const importFromEmail = (email) => {
    if (!tasks.some(t => t.emailId === email.id)) {
      addTask({
        title: email.actionText,
        source: SOURCE_TYPES.GMAIL,
        priority: 'medium',
        notes: `From: ${email.from}\nSubject: ${email.subject}`,
        emailId: email.id
      });
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    const statusMatch = filter === 'all' || 
      (filter === 'active' && !task.completed) ||
      (filter === 'completed' && task.completed);
    const sourceMatch = sourceFilter === 'all' || task.source === sourceFilter;
    return statusMatch && sourceMatch;
  });

  // Group tasks by date
  const todayTasks = filteredTasks.filter(t => !t.dueDate || isToday(t.dueDate));
  const upcomingTasks = filteredTasks.filter(t => t.dueDate && !isToday(t.dueDate) && new Date(t.dueDate) > new Date());
  const overdueTasks = filteredTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !isToday(t.dueDate) && !t.completed);

  // Stats
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    active: tasks.filter(t => !t.completed).length,
    todayCompleted: tasks.filter(t => t.completed && t.completedAt && isToday(t.completedAt)).length
  };

  const handleExport = () => {
    const { content, filename } = exportToMarkdown(tasks);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Theme styles
  const theme = {
    bg: darkMode ? '#0a0a0f' : '#f8fafc',
    bgSecondary: darkMode ? '#12121a' : '#ffffff',
    bgTertiary: darkMode ? '#1a1a24' : '#f1f5f9',
    text: darkMode ? '#e2e8f0' : '#1e293b',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#2d2d3a' : '#e2e8f0',
    accent: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444'
  };

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.bg
      }}>
        <Loader2 size={40} color={theme.accent} className="spin" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} darkMode={darkMode} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: theme.bg,
      color: theme.text,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      transition: 'all 0.3s ease'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: theme.bgSecondary,
        borderBottom: `1px solid ${theme.border}`,
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${theme.accent}, #8b5cf6)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap size={24} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>DevTodo</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: theme.textSecondary }}>
              Infrastructure-Aware Task Manager
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {lastSync && (
            <span style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
              Last sync: {formatTime(lastSync)}
            </span>
          )}
          <button
            onClick={syncAll}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              color: theme.text,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem'
            }}
          >
            <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            Sync
          </button>
          <button
            onClick={handleExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: theme.accent,
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            <Download size={16} />
            Export .md
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: '0.5rem',
              backgroundColor: theme.bgTertiary,
              border: `1px solid ${theme.border}`,
              borderRadius: '8px',
              color: theme.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: `1px solid ${theme.border}` }}>
            <User size={16} color={theme.textSecondary} />
            <span style={{ fontSize: '0.875rem', color: theme.textSecondary }}>{currentUser}</span>
            <button
              onClick={handleLogout}
              style={{
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.danger,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main style={{ display: 'flex', maxWidth: '1600px', margin: '0 auto' }}>
        {/* Sidebar - Sources */}
        <aside style={{
          width: '320px',
          backgroundColor: theme.bgSecondary,
          borderRight: `1px solid ${theme.border}`,
          padding: '1.5rem',
          height: 'calc(100vh - 80px)',
          overflowY: 'auto',
          position: 'sticky',
          top: '80px'
        }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textSecondary }}>
            Data Sources
          </h2>
          
          {/* Docker Containers - Grouped by Project */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, docker: !prev.docker }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              {expandedSections.docker ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Container size={16} color={SOURCE_COLORS[SOURCE_TYPES.DOCKER]} />
              Docker Containers
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: theme.textSecondary }}>
                {dockerContainers.length}
              </span>
            </button>
            {expandedSections.docker && (
              <div style={{ marginTop: '0.5rem', marginLeft: '0.5rem' }}>
                {groupContainersByProject(dockerContainers).map(project => {
                  const isExpanded = expandedProjects[project.name] ?? project.hasError;
                  return (
                    <div key={project.name} style={{ marginBottom: '0.5rem' }}>
                      {/* Project Header */}
                      <button
                        onClick={() => setExpandedProjects(prev => ({
                          ...prev,
                          [project.name]: !isExpanded
                        }))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: project.hasError ? `${theme.danger}10` : theme.bgTertiary,
                          border: project.hasError ? `1px solid ${theme.danger}30` : `1px solid ${theme.border}`,
                          borderRadius: '6px',
                          color: theme.text,
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textTransform: 'capitalize'
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{project.name}</span>
                        <span style={{
                          marginLeft: 'auto',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          backgroundColor: project.allRunning ? `${theme.success}20` : `${theme.warning}20`,
                          color: project.allRunning ? theme.success : theme.warning
                        }}>
                          {project.containers.length} container{project.containers.length > 1 ? 's' : ''}
                        </span>
                        {project.hasError && (
                          <AlertCircle size={14} color={theme.danger} />
                        )}
                      </button>

                      {/* Project Containers */}
                      {isExpanded && (
                        <div style={{ marginTop: '0.25rem', marginLeft: '1rem' }}>
                          {project.containers.map(container => (
                            <div key={container.id} style={{
                              padding: '0.5rem',
                              backgroundColor: theme.bgTertiary,
                              borderRadius: '6px',
                              marginBottom: '0.25rem',
                              fontSize: '0.75rem',
                              borderLeft: container.status === 'running' ? `3px solid ${theme.success}` : `3px solid ${theme.danger}`
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontWeight: 500 }}>{container.name}</span>
                                  {container.webUrl && (
                                    <a
                                      href={container.webUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ color: theme.accent, display: 'flex' }}
                                      title={`Open ${container.webUrl}`}
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                </div>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.65rem',
                                  backgroundColor: container.status === 'running' ? `${theme.success}20` : `${theme.danger}20`,
                                  color: container.status === 'running' ? theme.success : theme.danger
                                }}>
                                  {container.status}
                                </span>
                              </div>
                              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                {['restart', 'stop', 'logs'].map(action => (
                                  <button
                                    key={action}
                                    onClick={() => importFromDocker(container, action)}
                                    style={{
                                      padding: '2px 6px',
                                      backgroundColor: theme.border,
                                      border: 'none',
                                      borderRadius: '4px',
                                      fontSize: '0.65rem',
                                      color: theme.textSecondary,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    + {action}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Calendar Events */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, calendar: !prev.calendar }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              {expandedSections.calendar ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Calendar size={16} color={SOURCE_COLORS[SOURCE_TYPES.CALENDAR]} />
              Calendar Events
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: theme.textSecondary }}>
                {calendarEvents.length}
              </span>
            </button>
            {expandedSections.calendar && (
              <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                {calendarEvents.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    <p style={{ marginBottom: '0.5rem' }}>No calendar events or not connected.</p>
                    <button
                      onClick={async () => {
                        const res = await api.fetch('/api/calendar/auth');
                        if (res.ok) {
                          const { authUrl } = await res.json();
                          window.open(authUrl, '_blank');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CALENDAR],
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      Connect Google Calendar
                    </button>
                  </div>
                ) : (
                  calendarEvents.map(event => (
                    <div key={event.id} style={{
                      padding: '0.5rem',
                      backgroundColor: theme.bgTertiary,
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      fontSize: '0.8rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 500 }}>{event.title}</span>
                          {event.htmlLink && (
                            <a
                              href={event.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: theme.accent, display: 'flex' }}
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>
                          {formatDate(event.start)} {!event.allDay && formatTime(event.start)}
                        </div>
                      </div>
                      <button
                        onClick={() => importFromCalendar(event)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CALENDAR],
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Email Actions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, gmail: !prev.gmail }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              {expandedSections.gmail ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Mail size={16} color={SOURCE_COLORS[SOURCE_TYPES.GMAIL]} />
              Email Actions
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: theme.textSecondary }}>
                {emailActions.length}
              </span>
            </button>
            {expandedSections.gmail && (
              <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                {emailActions.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: theme.textSecondary }}>
                    <p style={{ marginBottom: '0.5rem' }}>No action emails or not connected.</p>
                    <button
                      onClick={async () => {
                        const res = await api.fetch('/api/gmail/auth');
                        if (res.ok) {
                          const { authUrl } = await res.json();
                          window.open(authUrl, '_blank');
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: SOURCE_COLORS[SOURCE_TYPES.GMAIL],
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: 'white',
                        cursor: 'pointer'
                      }}
                    >
                      Connect Gmail
                    </button>
                  </div>
                ) : (
                  emailActions.map(email => (
                    <div key={email.id} style={{
                      padding: '0.5rem',
                      backgroundColor: theme.bgTertiary,
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 500 }}>{email.subject}</span>
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${email.threadId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: theme.accent, display: 'flex' }}
                          title="Open in Gmail"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
                        From: {email.from}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
                        {email.actionText}
                      </div>
                      <button
                        onClick={() => importFromEmail(email)}
                        style={{
                          padding: '4px 8px',
                          backgroundColor: SOURCE_COLORS[SOURCE_TYPES.GMAIL],
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          color: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus size={12} /> Add as task
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Claude Code Conversations - Enhanced */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setExpandedSections(prev => ({ ...prev, claude: !prev.claude }))}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.text,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              {expandedSections.claude ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <MessageSquare size={16} color={SOURCE_COLORS[SOURCE_TYPES.CLAUDE]} />
              Claude Code Chats
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: theme.textSecondary }}>
                {claudeActions.length}
              </span>
            </button>
            {expandedSections.claude && (
              <div style={{ marginTop: '0.5rem', marginLeft: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() => {
                      let imported = 0;
                      claudeActions.forEach(task => {
                        const exists = tasks.some(t =>
                          t.source === SOURCE_TYPES.CLAUDE &&
                          t.title === task.title
                        );
                        if (!exists) {
                          const notes = [
                            `Project: ${task.project}`,
                            task.description && `\n${task.description}`,
                            task.context && `\nContext: ${task.context}`,
                            task.originalMessage && `\n\nOriginal request:\n${task.originalMessage}`
                          ].filter(Boolean).join('');
                          addTask({
                            title: task.title,
                            source: SOURCE_TYPES.CLAUDE,
                            priority: 'medium',
                            notes
                          });
                          // Mark as imported in backend
                          api.fetch(`/api/claude/tasks/${task.id}/import`, {
                            method: 'POST',
                            body: JSON.stringify({ linkedTaskId: task.id })
                          });
                          imported++;
                        }
                      });
                      if (imported > 0) syncAll();
                      alert(`Imported ${imported} tasks`);
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CLAUDE],
                      border: 'none',
                      borderRadius: '6px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 500
                    }}
                  >
                    <Plus size={14} />
                    Import All
                  </button>
                  <button
                    onClick={async () => {
                      await api.fetch('/api/claude/extract-tasks', { method: 'POST' });
                      alert('Refreshing tasks with LLM... This may take a minute.');
                      setTimeout(syncAll, 5000);
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: theme.bgTertiary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.text,
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: 500
                    }}
                  >
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                </div>

                {/* Claude Code Active Todos */}
                {claudeTodos.filter(t => t.status === 'in_progress').length > 0 && (
                  <div style={{
                    marginBottom: '0.75rem',
                    padding: '0.5rem',
                    backgroundColor: `${theme.warning}15`,
                    border: `1px solid ${theme.warning}30`,
                    borderRadius: '6px'
                  }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: theme.warning, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Loader2 size={12} className="spinning" />
                      Active in Claude Code
                    </div>
                    {claudeTodos.filter(t => t.status === 'in_progress').slice(0, 3).map((todo, idx) => (
                      <div key={idx} style={{ fontSize: '0.7rem', color: theme.text, marginBottom: '0.25rem' }}>
                        {todo.activeForm || todo.content}
                      </div>
                    ))}
                  </div>
                )}

                {claudeActions.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginLeft: '1rem' }}>
                    No tasks extracted yet. Click Refresh to run LLM extraction.
                  </p>
                ) : (
                  // Group tasks by project, then by topic
                  Object.entries(claudeActions.reduce((acc, task) => {
                    const project = task.project || 'Unknown Project';
                    if (!acc[project]) acc[project] = { topics: {} };
                    const topicKey = task.topic || 'General';
                    if (!acc[project].topics[topicKey]) {
                      acc[project].topics[topicKey] = {
                        tasks: []
                      };
                    }
                    acc[project].topics[topicKey].tasks.push(task);
                    return acc;
                  }, {}))
                  .sort(([, a], [, b]) => {
                    const aTasks = Object.values(a.topics).flatMap(t => t.tasks);
                    const bTasks = Object.values(b.topics).flatMap(t => t.tasks);
                    const aTime = Math.max(...aTasks.map(t => new Date(t.timestamp || 0).getTime()));
                    const bTime = Math.max(...bTasks.map(t => new Date(t.timestamp || 0).getTime()));
                    return bTime - aTime;
                  })
                  .map(([project, { topics }]) => {
                    const projectTasks = Object.values(topics).flatMap(t => t.tasks);
                    const isProjectExpanded = expandedProjects[`claude-${project}`] ?? true;

                    // Topic colors for visual distinction
                    const topicColors = [
                      '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
                    ];
                    const getTopicColor = (topic) => {
                      const hash = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                      return topicColors[hash % topicColors.length];
                    };

                    return (
                      <div key={project} style={{ marginBottom: '0.75rem' }}>
                        {/* Project Header */}
                        <button
                          onClick={() => setExpandedProjects(prev => ({
                            ...prev,
                            [`claude-${project}`]: !isProjectExpanded
                          }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: theme.bgTertiary,
                            border: `1px solid ${theme.border}`,
                            borderRadius: '6px',
                            color: theme.text,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {isProjectExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <FolderOpen size={14} color={SOURCE_COLORS[SOURCE_TYPES.CLAUDE]} />
                          <span style={{ flex: 1, textAlign: 'left' }}>{project}</span>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            backgroundColor: `${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}20`,
                            color: SOURCE_COLORS[SOURCE_TYPES.CLAUDE]
                          }}>
                            {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Topics within project */}
                        {isProjectExpanded && Object.entries(topics)
                          .sort(([, a], [, b]) => b.tasks.length - a.tasks.length)
                          .map(([topicName, topicData]) => {
                            const isTopicExpanded = expandedProjects[`claude-${project}-${topicName}`] ?? true;
                            const topicColor = getTopicColor(topicName);

                            return (
                              <div key={topicName} style={{ marginLeft: '1rem', marginTop: '0.5rem' }}>
                                {/* Topic header */}
                                <button
                                  onClick={() => setExpandedProjects(prev => ({
                                    ...prev,
                                    [`claude-${project}-${topicName}`]: !isTopicExpanded
                                  }))}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    width: '100%',
                                    padding: '0.4rem 0.5rem',
                                    backgroundColor: `${topicColor}10`,
                                    border: `1px solid ${topicColor}30`,
                                    borderRadius: '6px',
                                    color: theme.text,
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                  }}
                                >
                                  {isTopicExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <Hash size={12} color={topicColor} />
                                  <span style={{ flex: 1, textAlign: 'left', color: topicColor }}>{topicName}</span>
                                  <span style={{
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontSize: '0.6rem',
                                    backgroundColor: `${topicColor}20`,
                                    color: topicColor
                                  }}>
                                    {topicData.tasks.length}
                                  </span>
                                </button>

                                {/* Tasks in topic */}
                                {isTopicExpanded && topicData.tasks.map((task) => {
                                const isExpanded = expandedOriginal[task.id];
                                const todoMatch = claudeTodos.find(t =>
                                  t.matchedExtractedTask?.id === task.id
                                );
                                const isImported = claudeTaskState[task.id]?.status === 'imported';

                                // Category colors
                                const categoryColors = {
                                  feature: '#22c55e',
                                  bugfix: '#ef4444',
                                  refactor: '#8b5cf6',
                                  config: '#06b6d4',
                                  docs: '#3b82f6',
                                  research: '#f59e0b'
                                };

                                return (
                                  <div key={task.id} style={{
                                    padding: '0.75rem',
                                    marginBottom: '0.5rem',
                                    backgroundColor: isImported ? `${theme.success}10` : theme.bgSecondary,
                                    borderRadius: '8px',
                                    border: `1px solid ${isImported ? theme.success + '30' : theme.border}`,
                                    borderLeft: `4px solid ${categoryColors[task.category] || SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}`
                                  }}>
                                    {/* Title and actions */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'flex-start',
                                      gap: '0.5rem',
                                      marginBottom: '0.5rem'
                                    }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4, color: theme.text }}>
                                          {task.title}
                                        </div>
                                        {task.similarCount > 1 && (
                                          <span style={{
                                            fontSize: '0.6rem',
                                            padding: '1px 4px',
                                            backgroundColor: theme.bgTertiary,
                                            borderRadius: '3px',
                                            color: theme.textSecondary,
                                            marginLeft: '0.5rem'
                                          }}>
                                            ×{task.similarCount}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        {/* View conversation */}
                                        <button
                                          onClick={async () => {
                                            try {
                                              const res = await api.fetch(`/api/claude/conversation/${task.sessionId}`);
                                              if (res.ok) {
                                                const data = await res.json();
                                                setConversationModal({
                                                  ...data,
                                                  highlightIndex: task.messageIndex
                                                });
                                              }
                                            } catch (e) {
                                              console.error('Failed to load conversation:', e);
                                            }
                                          }}
                                          style={{
                                            padding: '4px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: theme.textSecondary,
                                            cursor: 'pointer'
                                          }}
                                          title="View conversation"
                                        >
                                          <Eye size={14} />
                                        </button>
                                        {/* Dismiss */}
                                        <button
                                          onClick={async () => {
                                            await api.fetch(`/api/claude/tasks/${task.id}/dismiss`, { method: 'POST' });
                                            syncAll();
                                          }}
                                          style={{
                                            padding: '4px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderRadius: '4px',
                                            color: theme.textSecondary,
                                            cursor: 'pointer'
                                          }}
                                          title="Dismiss"
                                        >
                                          <X size={14} />
                                        </button>
                                        {/* Import */}
                                        {!isImported && (
                                          <button
                                            onClick={() => {
                                              const exists = tasks.some(t => t.title === task.title);
                                              if (!exists) {
                                                const notes = [
                                                  `Project: ${task.project}`,
                                                  task.description && `\n${task.description}`,
                                                  task.context && `\nContext: ${task.context}`,
                                                  task.originalMessage && `\n\nOriginal request:\n${task.originalMessage}`
                                                ].filter(Boolean).join('');
                                                addTask({
                                                  title: task.title,
                                                  source: SOURCE_TYPES.CLAUDE,
                                                  priority: task.category === 'bugfix' ? 'high' : 'medium',
                                                  notes
                                                });
                                                api.fetch(`/api/claude/tasks/${task.id}/import`, {
                                                  method: 'POST',
                                                  body: JSON.stringify({ linkedTaskId: task.id })
                                                });
                                                syncAll();
                                              }
                                            }}
                                            style={{
                                              padding: '4px 8px',
                                              backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CLAUDE],
                                              border: 'none',
                                              borderRadius: '4px',
                                              fontSize: '0.65rem',
                                              color: 'white',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '2px'
                                            }}
                                          >
                                            <Plus size={10} /> Add
                                          </button>
                                        )}
                                        {isImported && (
                                          <span style={{
                                            padding: '4px 8px',
                                            backgroundColor: `${theme.success}20`,
                                            borderRadius: '4px',
                                            fontSize: '0.65rem',
                                            color: theme.success,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}>
                                            <CheckCircle2 size={10} /> Added
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Description */}
                                    {task.description && (
                                      <div style={{
                                        fontSize: '0.75rem',
                                        color: theme.textSecondary,
                                        lineHeight: 1.5,
                                        marginBottom: '0.5rem'
                                      }}>
                                        {task.description}
                                      </div>
                                    )}

                                    {/* Context */}
                                    {task.context && (
                                      <div style={{
                                        fontSize: '0.7rem',
                                        color: theme.textSecondary,
                                        fontFamily: 'monospace',
                                        backgroundColor: theme.bgTertiary,
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem'
                                      }}>
                                        <Code size={10} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                                        {task.context}
                                      </div>
                                    )}

                                    {/* Badges row */}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                      {/* Category badge */}
                                      <span style={{
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.6rem',
                                        fontWeight: 500,
                                        backgroundColor: `${categoryColors[task.category] || '#888'}20`,
                                        color: categoryColors[task.category] || '#888'
                                      }}>
                                        {task.category}
                                      </span>

                                      {/* Todo sync status */}
                                      {todoMatch && (
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.6rem',
                                          fontWeight: 500,
                                          backgroundColor: todoMatch.status === 'completed'
                                            ? `${theme.success}20`
                                            : todoMatch.status === 'in_progress'
                                            ? `${theme.warning}20`
                                            : `${theme.textSecondary}20`,
                                          color: todoMatch.status === 'completed'
                                            ? theme.success
                                            : todoMatch.status === 'in_progress'
                                            ? theme.warning
                                            : theme.textSecondary,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '3px'
                                        }}>
                                          {todoMatch.status === 'in_progress' && <Loader2 size={8} className="spinning" />}
                                          {todoMatch.status === 'completed' && <CheckCircle2 size={8} />}
                                          {todoMatch.status === 'in_progress' ? 'In Progress' : todoMatch.status === 'completed' ? 'Done in Claude' : 'Pending'}
                                        </span>
                                      )}

                                      {/* Recent session badge */}
                                      {claudeTodos.some(t => t.sessionId === task.sessionId && t.isRecentSession) && (
                                        <span style={{
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontSize: '0.6rem',
                                          fontWeight: 500,
                                          backgroundColor: `${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}20`,
                                          color: SOURCE_COLORS[SOURCE_TYPES.CLAUDE]
                                        }}>
                                          Active Session
                                        </span>
                                      )}
                                    </div>

                                    {/* Expandable original message */}
                                    {task.originalMessage && (
                                      <div style={{ marginTop: '0.5rem' }}>
                                        <button
                                          onClick={() => setExpandedOriginal(prev => ({
                                            ...prev,
                                            [task.id]: !prev[task.id]
                                          }))}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            backgroundColor: 'transparent',
                                            border: `1px solid ${theme.border}`,
                                            borderRadius: '4px',
                                            color: theme.textSecondary,
                                            cursor: 'pointer',
                                            fontSize: '0.65rem',
                                            width: '100%'
                                          }}
                                        >
                                          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                          Original Request
                                        </button>
                                        {isExpanded && (
                                          <div style={{
                                            marginTop: '0.5rem',
                                            padding: '0.75rem',
                                            backgroundColor: theme.bgTertiary,
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            color: theme.text,
                                            lineHeight: 1.6,
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            fontFamily: 'inherit'
                                          }}>
                                            {task.originalMessage}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                                })}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })
                )}

                {/* Show dismissed toggle */}
                {Object.values(claudeTaskState).some(s => s.status === 'dismissed') && (
                  <button
                    onClick={() => setShowDismissed(!showDismissed)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: 'transparent',
                      border: `1px dashed ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.textSecondary,
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      width: '100%',
                      marginTop: '0.5rem'
                    }}
                  >
                    {showDismissed ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showDismissed ? 'Hide' : 'Show'} Dismissed ({Object.values(claudeTaskState).filter(s => s.status === 'dismissed').length})
                  </button>
                )}

                {/* Dismissed tasks */}
                {showDismissed && (
                  <div style={{ marginTop: '0.5rem', opacity: 0.6 }}>
                    {Object.entries(claudeTaskState)
                      .filter(([, state]) => state.status === 'dismissed')
                      .map(([id, state]) => (
                        <div key={id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem',
                          backgroundColor: theme.bgTertiary,
                          borderRadius: '6px',
                          marginBottom: '0.25rem',
                          fontSize: '0.7rem'
                        }}>
                          <span style={{ color: theme.textSecondary }}>
                            {id.slice(0, 20)}... (dismissed {new Date(state.dismissedAt).toLocaleDateString()})
                          </span>
                          <button
                            onClick={async () => {
                              await api.fetch(`/api/claude/tasks/${id}/restore`, { method: 'POST' });
                              setTimeout(syncAll, 2000);
                            }}
                            style={{
                              padding: '2px 6px',
                              backgroundColor: theme.bgSecondary,
                              border: `1px solid ${theme.border}`,
                              borderRadius: '4px',
                              color: theme.text,
                              cursor: 'pointer',
                              fontSize: '0.65rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <RotateCcw size={10} /> Restore
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '1.5rem' }}>
          {/* Stats Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            {[
              { label: 'Total Tasks', value: stats.total, color: theme.accent },
              { label: 'Active', value: stats.active, color: theme.warning },
              { label: 'Completed', value: stats.completed, color: theme.success },
              { label: 'Done Today', value: stats.todayCompleted, color: '#8b5cf6' }
            ].map(stat => (
              <div key={stat.label} style={{
                backgroundColor: theme.bgSecondary,
                border: `1px solid ${theme.border}`,
                borderRadius: '12px',
                padding: '1rem',
                borderLeft: `4px solid ${stat.color}`
              }}>
                <div style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.25rem' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Filters & Add Task */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: filter === f ? theme.accent : theme.bgSecondary,
                    border: `1px solid ${filter === f ? theme.accent : theme.border}`,
                    borderRadius: '8px',
                    color: filter === f ? 'white' : theme.text,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Filter size={16} color={theme.textSecondary} />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{
                  padding: '0.5rem',
                  backgroundColor: theme.bgSecondary,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '8px',
                  color: theme.text,
                  fontSize: '0.875rem'
                }}
              >
                <option value="all">All Sources</option>
                {Object.values(SOURCE_TYPES).map(source => (
                  <option key={source} value={source}>
                    {source.charAt(0).toUpperCase() + source.slice(1)}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: theme.accent,
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                <Plus size={18} />
                Add Task
              </button>
            </div>
          </div>

          {/* Add Task Form */}
          {showAddTask && (
            <div style={{
              backgroundColor: theme.bgSecondary,
              border: `1px solid ${theme.border}`,
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>New Task</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <input
                  type="text"
                  placeholder="Task title..."
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: theme.bgTertiary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    color: theme.text,
                    fontSize: '1rem',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: theme.bgTertiary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: theme.bgTertiary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '0.875rem'
                    }}
                  />
                  <button
                    onClick={() => newTask.title && addTask(newTask)}
                    disabled={!newTask.title}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: newTask.title ? theme.accent : theme.border,
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: newTask.title ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: 600
                    }}
                  >
                    Add Task
                  </button>
                </div>
                <textarea
                  placeholder="Notes (optional)..."
                  value={newTask.notes}
                  onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                  style={{
                    padding: '0.75rem',
                    backgroundColor: theme.bgTertiary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '8px',
                    color: theme.text,
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    minHeight: '60px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          )}

          {/* Claude Code Tasks - Main View */}
          {claudeActions.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem'
              }}>
                <h3 style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: SOURCE_COLORS[SOURCE_TYPES.CLAUDE],
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  margin: 0
                }}>
                  <MessageSquare size={16} />
                  Claude Code Tasks ({claudeActions.length})
                </h3>
                <button
                  onClick={async () => {
                    await api.fetch('/api/claude/extract-tasks', { method: 'POST' });
                    setTimeout(syncAll, 5000);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.border}`,
                    borderRadius: '4px',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  <RefreshCw size={12} />
                  Refresh
                </button>
              </div>

              {/* Group by project then topic */}
              {Object.entries(claudeActions.reduce((acc, task) => {
                const project = task.project || 'Unknown Project';
                if (!acc[project]) acc[project] = { topics: {} };
                const topicKey = task.topic || 'General';
                if (!acc[project].topics[topicKey]) {
                  acc[project].topics[topicKey] = { tasks: [] };
                }
                acc[project].topics[topicKey].tasks.push(task);
                return acc;
              }, {}))
              .sort(([, a], [, b]) => {
                const aTasks = Object.values(a.topics).flatMap(t => t.tasks);
                const bTasks = Object.values(b.topics).flatMap(t => t.tasks);
                return bTasks.length - aTasks.length;
              })
              .map(([project, { topics }]) => {
                const projectTasks = Object.values(topics).flatMap(t => t.tasks);
                const isExpanded = expandedProjects[`main-${project}`] ?? true;

                const topicColors = [
                  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
                  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
                ];
                const getTopicColor = (topic) => {
                  const hash = topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  return topicColors[hash % topicColors.length];
                };

                return (
                  <div key={project} style={{
                    backgroundColor: theme.bgSecondary,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '12px',
                    marginBottom: '0.75rem',
                    overflow: 'hidden'
                  }}>
                    {/* Project Header */}
                    <button
                      onClick={() => setExpandedProjects(prev => ({
                        ...prev,
                        [`main-${project}`]: !isExpanded
                      }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '1rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: isExpanded ? `1px solid ${theme.border}` : 'none',
                        color: theme.text,
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <FolderOpen size={16} color={SOURCE_COLORS[SOURCE_TYPES.CLAUDE]} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{project}</span>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        backgroundColor: `${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}15`,
                        color: SOURCE_COLORS[SOURCE_TYPES.CLAUDE]
                      }}>
                        {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {/* Topics */}
                    {isExpanded && (
                      <div style={{ padding: '0.75rem' }}>
                        {Object.entries(topics)
                          .sort(([, a], [, b]) => b.tasks.length - a.tasks.length)
                          .map(([topicName, topicData]) => {
                            const topicColor = getTopicColor(topicName);
                            const isTopicExpanded = expandedProjects[`main-${project}-${topicName}`] ?? true;

                            return (
                              <div key={topicName} style={{ marginBottom: '0.5rem' }}>
                                {/* Topic Header */}
                                <button
                                  onClick={() => setExpandedProjects(prev => ({
                                    ...prev,
                                    [`main-${project}-${topicName}`]: !isTopicExpanded
                                  }))}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    width: '100%',
                                    padding: '0.5rem 0.75rem',
                                    backgroundColor: `${topicColor}10`,
                                    border: `1px solid ${topicColor}25`,
                                    borderRadius: '8px',
                                    color: theme.text,
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    marginBottom: isTopicExpanded ? '0.5rem' : 0
                                  }}
                                >
                                  {isTopicExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  <Hash size={14} color={topicColor} />
                                  <span style={{ flex: 1, textAlign: 'left', color: topicColor }}>{topicName}</span>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    backgroundColor: `${topicColor}20`,
                                    color: topicColor
                                  }}>
                                    {topicData.tasks.length}
                                  </span>
                                </button>

                                {/* Tasks */}
                                {isTopicExpanded && (
                                  <div style={{ marginLeft: '1.5rem' }}>
                                    {topicData.tasks.map((task) => {
                                      const isImported = claudeTaskState[task.id]?.status === 'imported';
                                      const categoryColors = {
                                        feature: '#22c55e',
                                        bugfix: '#ef4444',
                                        refactor: '#8b5cf6',
                                        config: '#06b6d4',
                                        docs: '#3b82f6',
                                        research: '#f59e0b'
                                      };

                                      return (
                                        <div key={task.id} style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '0.75rem',
                                          padding: '0.75rem',
                                          backgroundColor: isImported ? `${theme.success}08` : theme.bgTertiary,
                                          border: `1px solid ${isImported ? theme.success + '30' : theme.border}`,
                                          borderLeft: `3px solid ${categoryColors[task.category] || topicColor}`,
                                          borderRadius: '8px',
                                          marginBottom: '0.5rem'
                                        }}>
                                          <div style={{ flex: 1 }}>
                                            <div style={{
                                              fontSize: '0.875rem',
                                              fontWeight: 500,
                                              color: theme.text,
                                              marginBottom: '0.25rem'
                                            }}>
                                              {task.title}
                                            </div>
                                            {task.description && (
                                              <div style={{
                                                fontSize: '0.8rem',
                                                color: theme.textSecondary,
                                                marginBottom: '0.5rem',
                                                lineHeight: 1.4
                                              }}>
                                                {task.description}
                                              </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              <span style={{
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                backgroundColor: `${categoryColors[task.category] || '#888'}20`,
                                                color: categoryColors[task.category] || '#888'
                                              }}>
                                                {task.category}
                                              </span>
                                              <span style={{
                                                fontSize: '0.65rem',
                                                color: theme.textSecondary
                                              }}>
                                                {task.timestamp && new Date(task.timestamp).toLocaleDateString('en-AU')}
                                              </span>
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            {!isImported ? (
                                              <button
                                                onClick={() => {
                                                  const notes = [
                                                    `Project: ${task.project}`,
                                                    task.description && `\n${task.description}`,
                                                    task.context && `\nContext: ${task.context}`,
                                                    task.originalMessage && `\n\nOriginal request:\n${task.originalMessage}`
                                                  ].filter(Boolean).join('');
                                                  addTask({
                                                    title: task.title,
                                                    source: SOURCE_TYPES.CLAUDE,
                                                    priority: task.category === 'bugfix' ? 'high' : 'medium',
                                                    notes
                                                  });
                                                  api.fetch(`/api/claude/tasks/${task.id}/import`, {
                                                    method: 'POST',
                                                    body: JSON.stringify({ linkedTaskId: task.id })
                                                  });
                                                  syncAll();
                                                }}
                                                style={{
                                                  padding: '6px 12px',
                                                  backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CLAUDE],
                                                  border: 'none',
                                                  borderRadius: '6px',
                                                  fontSize: '0.75rem',
                                                  color: 'white',
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '4px'
                                                }}
                                              >
                                                <Plus size={12} /> Add
                                              </button>
                                            ) : (
                                              <span style={{
                                                padding: '6px 12px',
                                                backgroundColor: `${theme.success}15`,
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                color: theme.success,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                <CheckCircle2 size={12} /> Added
                                              </span>
                                            )}
                                            <button
                                              onClick={async () => {
                                                await api.fetch(`/api/claude/tasks/${task.id}/dismiss`, { method: 'POST' });
                                                syncAll();
                                              }}
                                              style={{
                                                padding: '6px',
                                                backgroundColor: 'transparent',
                                                border: `1px solid ${theme.border}`,
                                                borderRadius: '6px',
                                                color: theme.textSecondary,
                                                cursor: 'pointer'
                                              }}
                                              title="Dismiss"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: theme.danger,
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                Overdue ({overdueTasks.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {overdueTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    theme={theme}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                    editingTask={editingTask}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: theme.textSecondary,
              marginBottom: '0.75rem'
            }}>
              Today ({todayTasks.length})
            </h3>
            {todayTasks.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: theme.textSecondary,
                backgroundColor: theme.bgSecondary,
                borderRadius: '12px',
                border: `1px dashed ${theme.border}`
              }}>
                <CheckCheck size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>No tasks for today. Add one or import from sources!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {todayTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    theme={theme}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                    editingTask={editingTask}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          {upcomingTasks.length > 0 && (
            <div>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: theme.textSecondary,
                marginBottom: '0.75rem'
              }}>
                Upcoming ({upcomingTasks.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {upcomingTasks.map(task => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    theme={theme}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                    onEdit={setEditingTask}
                    editingTask={editingTask}
                    onUpdate={updateTask}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Conversation Modal */}
      {conversationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }} onClick={() => setConversationModal(null)}>
          <div style={{
            backgroundColor: theme.bgSecondary,
            borderRadius: '12px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: `1px solid ${theme.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: theme.text }}>
                  Conversation
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: theme.textSecondary }}>
                  {conversationModal.project} • {conversationModal.messages?.length || 0} messages
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {conversationModal.filePath && (
                  <a
                    href={`vscode://file${conversationModal.filePath}`}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: theme.bgTertiary,
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.text,
                      fontSize: '0.75rem',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Code size={14} />
                    Open in VS Code
                  </a>
                )}
                <button
                  onClick={() => setConversationModal(null)}
                  style={{
                    padding: '0.5rem',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    borderRadius: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.5rem'
            }}>
              {conversationModal.messages?.map((msg, idx) => {
                const isHighlighted = idx === conversationModal.highlightIndex;
                const isUser = msg.role === 'user';

                return (
                  <div
                    key={idx}
                    id={isHighlighted ? 'highlighted-message' : undefined}
                    style={{
                      marginBottom: '1rem',
                      padding: '1rem',
                      backgroundColor: isHighlighted
                        ? `${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}15`
                        : isUser
                        ? theme.bgTertiary
                        : 'transparent',
                      borderRadius: '8px',
                      border: isHighlighted
                        ? `2px solid ${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}`
                        : `1px solid ${theme.border}`,
                      borderLeft: isUser
                        ? `4px solid ${theme.accent}`
                        : `4px solid ${SOURCE_COLORS[SOURCE_TYPES.CLAUDE]}`
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: isUser ? theme.accent : SOURCE_COLORS[SOURCE_TYPES.CLAUDE]
                      }}>
                        {isUser ? 'You' : 'Claude'}
                      </span>
                      {msg.timestamp && (
                        <span style={{ fontSize: '0.65rem', color: theme.textSecondary }}>
                          {new Date(msg.timestamp).toLocaleString('en-AU', {
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      )}
                      {isHighlighted && (
                        <span style={{
                          fontSize: '0.6rem',
                          padding: '2px 6px',
                          backgroundColor: SOURCE_COLORS[SOURCE_TYPES.CLAUDE],
                          color: 'white',
                          borderRadius: '4px'
                        }}>
                          Task Source
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: theme.text,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      maxHeight: isUser ? 'none' : '300px',
                      overflowY: isUser ? 'visible' : 'auto'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .spinning {
          animation: spin 1s linear infinite;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: ${theme.bgTertiary};
        }
        
        ::-webkit-scrollbar-thumb {
          background: ${theme.border};
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: ${theme.textSecondary};
        }
        
        input, select, textarea, button {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }
        
        button:hover {
          opacity: 0.9;
        }
        
        input:focus, select:focus, textarea:focus {
          outline: 2px solid ${theme.accent};
          outline-offset: -2px;
        }
      `}</style>
    </div>
  );
}

// Task Item Component
function TaskItem({ task, theme, onToggle, onDelete, onEdit, editingTask, onUpdate }) {
  const [editTitle, setEditTitle] = useState(task.title);
  const isEditing = editingTask === task.id;
  const SourceIcon = SOURCE_ICONS[task.source];
  
  const priorityColors = {
    high: theme.danger,
    medium: theme.warning,
    low: theme.success
  };

  return (
    <div style={{
      backgroundColor: theme.bgSecondary,
      border: `1px solid ${theme.border}`,
      borderRadius: '10px',
      padding: '1rem',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '1rem',
      opacity: task.completed ? 0.7 : 1,
      borderLeft: `4px solid ${SOURCE_COLORS[task.source]}`,
      transition: 'all 0.2s ease'
    }}>
      <button
        onClick={() => onToggle(task.id)}
        style={{
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: task.completed ? theme.success : theme.textSecondary,
          flexShrink: 0,
          marginTop: '2px'
        }}
      >
        {task.completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem',
                backgroundColor: theme.bgTertiary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                fontSize: '0.9rem'
              }}
              autoFocus
            />
            <button
              onClick={() => onUpdate(task.id, { title: editTitle })}
              style={{
                padding: '0.5rem',
                backgroundColor: theme.success,
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              <Save size={16} />
            </button>
            <button
              onClick={() => onEdit(null)}
              style={{
                padding: '0.5rem',
                backgroundColor: theme.bgTertiary,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div style={{
              fontSize: '0.95rem',
              fontWeight: 500,
              textDecoration: task.completed ? 'line-through' : 'none',
              color: task.completed ? theme.textSecondary : theme.text,
              marginBottom: '0.5rem',
              lineHeight: 1.4
            }}>
              {task.title}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: `${SOURCE_COLORS[task.source]}20`,
                color: SOURCE_COLORS[task.source],
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 500
              }}>
                <SourceIcon size={12} />
                {task.source}
              </span>
              
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                backgroundColor: `${priorityColors[task.priority]}20`,
                color: priorityColors[task.priority],
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 500
              }}>
                {task.priority}
              </span>
              
              {task.dueDate && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  backgroundColor: theme.bgTertiary,
                  color: theme.textSecondary,
                  borderRadius: '4px',
                  fontSize: '0.7rem'
                }}>
                  <Clock size={12} />
                  {formatDate(task.dueDate)}
                </span>
              )}
              
              {task.autoCompleted && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  backgroundColor: `${theme.success}20`,
                  color: theme.success,
                  borderRadius: '4px',
                  fontSize: '0.7rem'
                }}>
                  <Zap size={12} />
                  auto-completed
                </span>
              )}
            </div>
            
            {task.notes && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: theme.bgTertiary,
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: theme.textSecondary,
                whiteSpace: 'pre-wrap'
              }}>
                {task.notes}
              </div>
            )}
          </>
        )}
      </div>
      
      {!isEditing && (
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <button
            onClick={() => onEdit(task.id)}
            style={{
              padding: '0.4rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.textSecondary,
              borderRadius: '4px'
            }}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            style={{
              padding: '0.4rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.danger,
              borderRadius: '4px'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
