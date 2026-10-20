const request = require('supertest');

const BASE = 'http://localhost:5000';

describe('Project API', () => {
  let token;

  beforeAll(async () => {
    const res = await request(BASE)
      .post('/api/auth/login')
      .send({
        email: 'pavana@gmail.com',
        password: 'pavana'
      });

    token = res.body.token;
  });

  test('TC8: authenticated user can access projects', async () => {
    const res = await request(BASE)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
  });

  test('TC9: unauthenticated user cannot create a project', async () => {
    const res = await request(BASE)
      .post('/api/projects')
      .send({
        name: 'Unauthorized Test Project',
        description: 'This project should not be created'
      });

    expect(res.statusCode).toBe(401);
  });
});