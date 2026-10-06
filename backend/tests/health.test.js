import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import app from '../server.js';

describe('Health Check API', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('should return 200 OK for the root API endpoint', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('CodeHive API is running');
  });
});

