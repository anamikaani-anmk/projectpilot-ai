const request = require('supertest');

const BASE = 'http://localhost:5000'; // your backend PORT from .env

describe('Authentication', () => {
  test('TC1: login fails with wrong password', async () => {
    const res = await request(BASE)
      .post('/api/auth/login') // check your route file for the exact path
      .send({ email: 'pavana@gmail.com', password: 'wrongpassword' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test('TC2: login succeeds and returns a JWT token', async () => {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({ email: 'pavana@gmail.com', password: 'pavana' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

describe('Route protection', () => {
  test('TC3: projects endpoint rejects requests without a token', async () => {
    const res = await request(BASE).get('/api/projects');
    expect(res.statusCode).toBe(401);
  });

  test('TC4: tasks endpoint rejects requests without a token', async () => {
    const res = await request(BASE).get('/api/tasks');
    expect([401, 404]).toContain(res.statusCode);
  });
});

describe('Authorized access', () => {
  let token;
  beforeAll(async () => {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({ email: 'pavana@gmail.com', password: 'pavana' });
    token = res.body.token;
  });

  test('TC5: logged-in user can fetch their projects', async () => {
    const res = await request(BASE)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });
});