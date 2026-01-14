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
