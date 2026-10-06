import request from 'supertest';
import { connectDB, disconnectDB } from '../config/db.js';
import app from '../server.js';

describe('CodeHive Integration API Tests', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;
  let projectId;
  let projectJoinCode;
  let fileId;
  let versionId;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('1. Authentication Endpoints', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice_dev',
          email: 'alice@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.username).toBe('alice_dev');
      user1Token = res.body.token;
      user1Id = res.body._id;
    });

    it('should prevent registration with duplicate email or username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice_dev',
          email: 'alice@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toMatch(/already exists|taken/i);
    });

    it('should log in an existing user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.email).toBe('alice@example.com');
    });

    it('should register a second user for collaboration testing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'bob_dev',
          email: 'bob@example.com',
          password: 'password456',
        });

      expect(res.statusCode).toBe(201);
      user2Token = res.body.token;
      user2Id = res.body._id;
    });

    it('should get authenticated profile with /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe('alice_dev');
    });

    it('should reject unauthenticated profile request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('2. Project Lifecycle & Access Control', () => {
    it('should create a project for user 1', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Collab Workspace',
          description: 'A test collaboration workspace',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('Collab Workspace');
      expect(res.body).toHaveProperty('joinCode');
      projectId = res.body._id;
      projectJoinCode = res.body.joinCode;
    });

    it('should fetch the created project by ID', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(projectId);
    });

    it('should prevent unauthorized users from viewing the project before joining', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should allow user 2 to join project using joinCode', async () => {
      const res = await request(app)
        .post('/api/projects/join')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ joinCode: projectJoinCode });

      expect(res.statusCode).toBe(200);
      expect(res.body.members.length).toBe(2);
    });

    it('should now allow user 2 to view the project after joining', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(projectId);
    });

    it('should list project in both user 1 and user 2 project lists', async () => {
      const res1 = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`);
      const res2 = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res1.body.some((p) => p._id === projectId)).toBe(true);
      expect(res2.body.some((p) => p._id === projectId)).toBe(true);
    });
  });

  describe('3. File CRUD & Real-Time Versioning', () => {
    it('should create a file in the project', async () => {
      const res = await request(app)
        .post(`/api/files/project/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'main.js',
          path: '/',
          language: 'javascript',
          content: 'console.log("Hello CodeHive");',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.name).toBe('main.js');
      expect(res.body.content).toBe('console.log("Hello CodeHive");');
      fileId = res.body._id;
    });

    it('should allow member (user 2) to update the file content', async () => {
      const res = await request(app)
        .put(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'console.log("Collaborative edit from Bob!");',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.content).toContain('Collaborative edit from Bob');
    });

    it('should create a version snapshot for the file', async () => {
      const res = await request(app)
        .post(`/api/files/${fileId}/versions`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          message: 'Initial stable version',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Initial stable version');
      versionId = res.body._id;
    });

    it('should retrieve version snapshots for the file', async () => {
      const res = await request(app)
        .get(`/api/files/${fileId}/versions`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]._id).toBe(versionId);
    });

    it('should revert file to snapshot version', async () => {
      // First make a breaking edit
      await request(app)
        .put(`/api/files/${fileId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ content: 'broken code' });

      // Revert to stable version
      const res = await request(app)
        .post(`/api/files/${fileId}/revert/${versionId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.content).toContain('Collaborative edit from Bob');
    });
  });

  describe('4. Project Activity History', () => {
    it('should retrieve real database-backed project activity log', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/activities`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      // Verify actions were recorded
      const actions = res.body.map((a) => a.action);
      expect(actions).toContain('project_created');
      expect(actions).toContain('member_joined');
      expect(actions).toContain('file_created');
    });
  });

  describe('5. Code Execution & Terminal Runner', () => {
    it('should execute JavaScript code and return stdout', async () => {
      const res = await request(app)
        .post('/api/execute/run')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          projectId,
          filename: 'test_script.js',
          language: 'javascript',
          code: 'console.log("Hello from CodeHive Terminal!"); console.log(2 + 2);',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stdout).toContain('Hello from CodeHive Terminal!');
      expect(res.body.stdout).toContain('4');
      expect(res.body.exitCode).toBe(0);
    });

    it('should execute terminal command inside project workspace', async () => {
      const res = await request(app)
        .post('/api/execute/command')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          projectId,
          command: 'node -e "console.log(process.platform)"',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stdout.length).toBeGreaterThan(0);
    });

    it('should handle runtime syntax errors gracefully in stderr', async () => {
      const res = await request(app)
        .post('/api/execute/run')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          projectId,
          filename: 'error_script.js',
          language: 'javascript',
          code: 'throw new Error("Simulated runtime error");',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.stderr).toContain('Simulated runtime error');
      expect(res.body.exitCode).not.toBe(0);
    });
  });

  describe('6. Member Removal & Project Deletion', () => {
    it('should allow user 2 to leave or owner to remove user 2', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}/members/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.members.some((m) => m.user?._id === user2Id)).toBe(false);
    });

    it('should prevent non-owner from deleting project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(403);
    });

    it('should allow owner to delete project', async () => {
      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Project removed');
    });

    it('should return 404 after project is deleted', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(404);
    });
  });
});
