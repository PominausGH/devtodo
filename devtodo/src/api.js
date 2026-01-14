const BASE_URL = '';

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
