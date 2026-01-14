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
