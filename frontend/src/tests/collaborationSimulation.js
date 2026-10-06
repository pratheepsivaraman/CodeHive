import { io } from 'socket.io-client';
import * as Y from 'yjs';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function runCollaborationSimulation() {
  console.log('--- Starting Two-Client Real-Time Collaboration Test ---');

  // 1. Register User A and User B
  const timestamp = Date.now();
  const userAEmail = `alice_${timestamp}@example.com`;
  const userBEmail = `bob_${timestamp}@example.com`;

  console.log('1. Registering User A (Alice) and User B (Bob)...');
  const userARes = await axios.post(`${API_URL}/api/auth/register`, {
    username: `alice_${timestamp.toString().slice(-4)}`,
    email: userAEmail,
    password: 'password123',
  });
  const userA = userARes.data;

  const userBRes = await axios.post(`${API_URL}/api/auth/register`, {
    username: `bob_${timestamp.toString().slice(-4)}`,
    email: userBEmail,
    password: 'password123',
  });
  const userB = userBRes.data;

  console.log(`User A: ${userA.username} (${userA._id})`);
  console.log(`User B: ${userB.username} (${userB._id})`);

  // 2. User A creates Project X
  console.log('2. User A creates Project X...');
  const projectRes = await axios.post(
    `${API_URL}/api/projects`,
    { name: 'Collab Test Project', description: 'Real-time test' },
    { headers: { Authorization: `Bearer ${userA.token}` } }
  );
  const project = projectRes.data;
  console.log(`Project created: "${project.name}" (Join Code: ${project.joinCode})`);

  // 3. User B joins Project X using joinCode
  console.log('3. User B joins Project X using joinCode...');
  const joinRes = await axios.post(
    `${API_URL}/api/projects/join`,
    { joinCode: project.joinCode },
    { headers: { Authorization: `Bearer ${userB.token}` } }
  );
  console.log(`User B joined project. Total members: ${joinRes.data.members.length}`);

  // 4. User A creates file "collaborative.js"
  console.log('4. User A creates file collaborative.js...');
  const fileRes = await axios.post(
    `${API_URL}/api/files/project/${project._id}`,
    {
      name: 'collaborative.js',
      path: '/',
      language: 'javascript',
      content: '// Base code header\n',
    },
    { headers: { Authorization: `Bearer ${userA.token}` } }
  );
  const file = fileRes.data;
  console.log(`File created: ${file.name} (ID: ${file._id})`);

  // 5. Connect Sockets
  console.log('5. Connecting Sockets for User A and User B...');
  const socketA = io(API_URL);
  const socketB = io(API_URL);

  await new Promise((resolve) => {
    let count = 0;
    const onConn = () => {
      count++;
      if (count === 2) resolve();
    };
    socketA.on('connect', onConn);
    socketB.on('connect', onConn);
  });
  console.log(`Connected: Socket A (${socketA.id}), Socket B (${socketB.id})`);

  // Join Project
  socketA.emit('join-project', { projectId: project._id, user: userA });
  socketB.emit('join-project', { projectId: project._id, user: userB });

  // Presence check
  await new Promise((resolve) => {
    socketA.on('project-users-updated', (users) => {
      if (users.length >= 2) {
        console.log(`Presence verified: ${users.length} users active in project.`);
        resolve();
      }
    });
  });

  // 6. Setup Yjs documents
  const docA = new Y.Doc();
  const textA = docA.getText('monaco');
  textA.insert(0, file.content);

  const docB = new Y.Doc();
  const textB = docB.getText('monaco');

  // Handshake handlers matching CodeEditor.jsx
  socketA.on('yjs-sync-request', ({ fileId, requesterSocketId }) => {
    const state = Y.encodeStateAsUpdate(docA);
    socketA.emit('yjs-sync-response', {
      targetSocketId: requesterSocketId,
      fileId,
      state: Array.from(state),
    });
  });

  // User A joins file room first
  await new Promise((r) =>
    socketA.emit('join-file', { projectId: project._id, fileId: file._id }, r)
  );
  console.log('User A joined file room.');

  // User B joins file room (server notifies A to send sync)
  const syncPromise = new Promise((resolve) => {
    socketB.once('yjs-sync-response', ({ fileId, state }) => {
      if (fileId === file._id && state) {
        Y.applyUpdate(docB, new Uint8Array(state), 'sync-response');
        console.log('User B received initial sync from User A! Initial text:', textB.toString());
      }
      resolve();
    });
  });

  await new Promise((r) =>
    socketB.emit('join-file', { projectId: project._id, fileId: file._id }, r)
  );
  await syncPromise;
  console.log('Both clients synchronized on file room.');

  // Wire Socket updates
  docA.on('update', (update) => {
    socketA.emit('yjs-update', {
      projectId: project._id,
      fileId: file._id,
      update: Array.from(update),
    });
  });

  docB.on('update', (update) => {
    socketB.emit('yjs-update', {
      projectId: project._id,
      fileId: file._id,
      update: Array.from(update),
    });
  });

  socketA.on('yjs-update', ({ fileId, update }) => {
    console.log('[Socket A received yjs-update]', fileId, update?.length);
    if (fileId === file._id) {
      const arr = new Uint8Array(update);
      Y.applyUpdate(docA, arr, 'remote');
    }
  });

  socketB.on('yjs-update', ({ fileId, update }) => {
    console.log('[Socket B received yjs-update]', fileId, update?.length);
    if (fileId === file._id) {
      const arr = new Uint8Array(update);
      Y.applyUpdate(docB, arr, 'remote');
    }
  });

  // 7. Client A types code
  console.log('6. User A types code: "const x = 100;"');
  textA.insert(textA.length, 'const x = 100;\n');

  // Wait for propagation
  await new Promise((r) => setTimeout(r, 400));
  console.log('User B text content:\n' + textB.toString());
  if (!textB.toString().includes('const x = 100;')) {
    throw new Error('Synchronization failed: User B did not receive User A edits!');
  }
  console.log('SUCCESS: User B received User A edit in real time!');

  // 8. Client B types code
  console.log('7. User B types code: "const y = 200;"');
  textB.insert(textB.length, 'const y = 200;\n');

  // Wait for propagation
  await new Promise((r) => setTimeout(r, 400));
  console.log('User A text content:\n' + textA.toString());
  if (!textA.toString().includes('const y = 200;')) {
    throw new Error('Synchronization failed: User A did not receive User B edits!');
  }
  console.log('SUCCESS: User A received User B edit in real time!');

  // Check equality
  if (textA.toString() !== textB.toString()) {
    throw new Error('Text mismatch between User A and User B!');
  }
  console.log('PERFECT CONVERGENCE: Text A and Text B match 100%!');

  // 9. User A saves
  console.log('8. User A saves file...');
  await axios.put(
    `${API_URL}/api/files/${file._id}`,
    { content: textA.toString() },
    { headers: { Authorization: `Bearer ${userA.token}` } }
  );

  // 10. Check Project Activity Log
  console.log('9. Verifying Project Activity Log...');
  const actRes = await axios.get(`${API_URL}/api/projects/${project._id}/activities`, {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  console.log(`Activity events count: ${actRes.data.length}`);
  actRes.data.forEach((act) => {
    console.log(` - [${act.action}] ${act.details} (by ${act.user?.username})`);
  });

  socketA.disconnect();
  socketB.disconnect();

  console.log('\n--- ALL TWO-CLIENT REAL-TIME COLLABORATION TESTS PASSED! ---');
  process.exit(0);
}

runCollaborationSimulation().catch((err) => {
  console.error('COLLABORATION TEST FAILED:', err);
  process.exit(1);
});
