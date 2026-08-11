import request from 'supertest';
import { disconnectDB } from '../config/db.js';
import app from '../server.js';

describe('Health Check API', () => {
  // Since we use in-memory app testing, we don't need a real DB connection for the root health check,
  // but if the app attempts to connect to MongoDB on load, we should close it after tests.
  
  afterAll(async () => {
    // Close mongoose connection and stop in-memory server if it was opened by server.js
    await disconnectDB();
  });

  it('should return 200 OK for the root API endpoint', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('CodeHive API is running');
  });
});
