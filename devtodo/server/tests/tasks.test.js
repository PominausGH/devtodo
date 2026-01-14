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
