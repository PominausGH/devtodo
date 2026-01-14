const request = require('supertest');
const express = require('express');
const { authMiddleware } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  test('allows request with valid token', async () => {
    process.env.API_TOKEN = 'test-secret-token';
    app.use(authMiddleware);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer test-secret-token');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('rejects request with invalid token', async () => {
    process.env.API_TOKEN = 'test-secret-token';
    app.use(authMiddleware);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer wrong-token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid token');
  });

  test('rejects request with no token when API_TOKEN is set', async () => {
    process.env.API_TOKEN = 'test-secret-token';
    app.use(authMiddleware);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No token provided');
  });

  test('allows request when API_TOKEN is not set', async () => {
    delete process.env.API_TOKEN;
    app.use(authMiddleware);
    app.get('/test', (req, res) => res.json({ ok: true }));

    const res = await request(app).get('/test');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  afterEach(() => {
    delete process.env.API_TOKEN;
  });
});
