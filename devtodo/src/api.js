const BASE_URL = '';

// Get auth token from localStorage or environment
function getAuthHeaders() {
  const token = localStorage.getItem('devtodo-api-token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle no-content responses
  if (response.status === 204 || !response.json) {
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
    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async createTask(task) {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(task),
    });
    return handleResponse(response);
  },

  async updateTask(id, updates) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async deleteTask(id) {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Docker
  async getContainers() {
    const response = await fetch('/api/docker/containers', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async performContainerAction(id, action) {
    const response = await fetch(`/api/docker/containers/${id}/${action}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getDockerActions() {
    const response = await fetch('/api/docker/actions', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Calendar
  async getCalendarAuthUrl() {
    const response = await fetch('/api/calendar/auth', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async getCalendarEvents() {
    const response = await fetch('/api/calendar/events', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Gmail
  async getGmailActions() {
    const response = await fetch('/api/gmail/actions', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Claude
  async getClaudeActions() {
    const response = await fetch('/api/claude/actions', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Git
  async getGitRepos() {
    const response = await fetch('/api/git/repos', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  async deleteGitRepo(name) {
    const response = await fetch(`/api/git/repos/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  getHookScriptUrl() {
    return `${window.location.origin}/api/git/hook-script`;
  },

  // Health
  async getHealth() {
    const response = await fetch('/api/health', {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // Export
  async exportMarkdown(tasks, date) {
    const response = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ tasks, date }),
    });
    return handleResponse(response);
  },

  // Set auth token
  setToken(token) {
    if (token) {
      localStorage.setItem('devtodo-api-token', token);
    } else {
      localStorage.removeItem('devtodo-api-token');
    }
  },
};
