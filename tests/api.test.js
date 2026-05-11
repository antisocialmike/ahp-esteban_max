const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

const runId = `${process.pid}_${Date.now()}`;

process.env.NODE_ENV = 'test';
process.env.DB_FILE = path.join(os.tmpdir(), `ahp.test.${runId}.sqlite`);
process.env.SESSION_DB_DIR = os.tmpdir();
process.env.SESSION_DB_FILE = `sessions.test.${runId}.sqlite`;
process.env.RESEND_API_KEY = '';

const request = require('supertest');
const app = require('../server');

test('GET /api/health/db returns dbConnected', async () => {
  const res = await request(app).get('/api/health/db');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.dbConnected, 'boolean');
  assert.equal(res.body.dbConnected, true);
});

test('CSRF protects authenticated mutations and allows valid token', async () => {
  const agent = request.agent(app);
  const email = `tester_${Date.now()}@example.com`;

  const registerRes = await agent
    .post('/api/auth/register')
    .send({
      nombre: 'Tester QA',
      correo: email,
      telefono: '5551234567',
      campus: 'Campus Test',
      password: 'supersecure123'
    });

  assert.equal(registerRes.status, 200);
  assert.equal(registerRes.body.success, true);

  const missingTokenRes = await agent
    .post('/api/vacantes')
    .send({ titulo: 'Vacante sin CSRF', area: 'Tecnologia e Ingenieria' });

  assert.equal(missingTokenRes.status, 403);
  assert.equal(missingTokenRes.body.error, 'Invalid CSRF token');

  const tokenRes = await agent.get('/api/auth/csrf-token');
  assert.equal(tokenRes.status, 200);
  assert.equal(typeof tokenRes.body.csrfToken, 'string');
  assert.ok(tokenRes.body.csrfToken.length > 10);

  const createRes = await agent
    .post('/api/vacantes')
    .set('X-CSRF-Token', tokenRes.body.csrfToken)
    .send({ titulo: 'Vacante con CSRF', area: 'Tecnologia e Ingenieria' });

  assert.equal(createRes.status, 200);
  assert.equal(typeof createRes.body.id, 'number');
});

test('public pages and assets load successfully', async () => {
  const pages = [
    ['/', '<body>'],
    ['/login.html', 'Iniciar sesión'],
    ['/create-account.html', 'Crear cuenta'],
    ['/candidate.html', 'Enviar postulación'],
    ['/dashboard.html', 'Panel de reclutamiento'],
    ['/toast.js', 'window.Toast']
  ];

  for (const [url, expectedText] of pages) {
    const res = await request(app).get(url);
    assert.equal(res.status, 200, `${url} should return 200`);
    assert.match(res.text, new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});
