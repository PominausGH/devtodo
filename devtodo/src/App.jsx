import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Circle, Plus, Calendar, Mail, Server,
  MessageSquare, Download, Settings, RefreshCw, Trash2,
  Clock, Tag, AlertCircle, ChevronDown, ChevronRight,
  Container, FileText, ExternalLink, Edit2, Save, X,
  Loader2, CheckCheck, Filter, Sun, Moon, Zap
} from 'lucide-react';
import { api } from './api';

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

// Main App Component
export default function DevTodo() {
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
  const [claudeActions, setClaudeActions] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [emailActions, setEmailActions] = useState([]);

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

  useEffect(() => {
    localStorage.setItem('devtodo-darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

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

  // Initial sync
  useEffect(() => {
    syncAll();
    // Auto-sync every 5 minutes
    const interval = setInterval(syncAll, 300000);
    return () => clearInterval(interval);
  }, [syncAll]);

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

  // Delete task
  const deleteTask = async (taskId) => {
    try {
      await api.deleteTask(taskId);
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

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
          
          {/* Docker Containers */}
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
              <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                {dockerContainers.map(container => (
                  <div key={container.id} style={{
                    padding: '0.5rem',
                    backgroundColor: theme.bgTertiary,
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 500 }}>{container.name}</span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        backgroundColor: container.status === 'running' ? `${theme.success}20` : `${theme.danger}20`,
                        color: container.status === 'running' ? theme.success : theme.danger
                      }}>
                        {container.status}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {['restart', 'stop', 'update', 'check logs'].map(action => (
                        <button
                          key={action}
                          onClick={() => importFromDocker(container, action)}
                          style={{
                            padding: '2px 6px',
                            backgroundColor: theme.border,
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
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
                {calendarEvents.map(event => (
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
                      <div style={{ fontWeight: 500 }}>{event.title}</div>
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
                ))}
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
                {emailActions.map(email => (
                  <div key={email.id} style={{
                    padding: '0.5rem',
                    backgroundColor: theme.bgTertiary,
                    borderRadius: '6px',
                    marginBottom: '0.5rem',
                    fontSize: '0.8rem'
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{email.subject}</div>
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
                ))}
              </div>
            )}
          </div>

          {/* Claude Chats */}
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
              Claude Chats
            </button>
            {expandedSections.claude && (
              <div style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                <p style={{ fontSize: '0.75rem', color: theme.textSecondary, marginBottom: '0.5rem' }}>
                  Configure path to Claude/Claude Code saved chats folder to auto-extract action items.
                </p>
                <code style={{
                  display: 'block',
                  padding: '0.5rem',
                  backgroundColor: theme.bgTertiary,
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  wordBreak: 'break-all'
                }}>
                  {CONFIG.claudeChatsPath}
                </code>
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
