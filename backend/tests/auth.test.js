const request = require('supertest');

const BASE = 'http://localhost:5000';

describe('Authentication Validation', () => {
  test('TC6: login fails with invalid email', async () => {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({
        email: 'invaliduser@gmail.com',
        password: '123456'
      });

    expect(res.statusCode).toBe(404);
  });

  test('TC7: protected /me endpoint rejects request without token', async () => {
    const res = await request(BASE)
      .get('/api/auth/me');

    expect(res.statusCode).toBe(401);
  });
});