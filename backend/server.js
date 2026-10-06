import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Connect Database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import executionRoutes from './routes/executionRoutes.js';

// Basic health check route
app.get('/', (req, res) => {
  res.send('CodeHive API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/execute', executionRoutes);

// Track active users in projects: { projectId: [{ socketId, userId, username, inVoice, isMuted, isSpeaking, activeFileId }] }
const activeProjectUsers = {};

io.on('connection', (socket) => {
  // User joins a project workspace
  socket.on('join-project', ({ projectId, user }) => {
    if (!projectId || !user) return;
    socket.join(projectId);

    if (!activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = [];
    }

    // Remove any stale entry for this socket or user
    activeProjectUsers[projectId] = activeProjectUsers[projectId].filter(
      (u) => u.socketId !== socket.id && u.userId !== user._id
    );

    activeProjectUsers[projectId].push({
      socketId: socket.id,
      userId: user._id,
      username: user.username,
      inVoice: false,
      isMuted: false,
      isSpeaking: false,
      activeFileId: null,
    });

    socket.projectId = projectId;
    socket.userId = user._id;
    socket.username = user.username;

    // Broadcast updated active users list
    io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
  });

  // User leaves a project workspace
  socket.on('leave-project', ({ projectId }) => {
    if (!projectId) return;
    socket.leave(projectId);
    if (activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = activeProjectUsers[projectId].filter(
        (u) => u.socketId !== socket.id
      );
      io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
    }
  });

  // Handle Yjs document rooms
  socket.on('join-file', ({ projectId, fileId }, callback) => {
    if (!projectId || !fileId) return;
    const fileRoom = `${projectId}-${fileId}`;
    socket.join(fileRoom);

    const socketsInRoom = io.sockets.adapter.rooms.get(fileRoom);
    console.log(`[Socket] ${socket.id} joined fileRoom ${fileRoom}. Sockets in room:`, socketsInRoom ? Array.from(socketsInRoom) : 0);

    // Ask other peers in the room to send current doc state to the new joiner
    socket.to(fileRoom).emit('yjs-sync-request', {
      fileId,
      requesterSocketId: socket.id,
    });

    if (typeof callback === 'function') {
      callback({ success: true, room: fileRoom });
    }
  });

  socket.on('leave-file', ({ projectId, fileId }) => {
    if (!projectId || !fileId) return;
    const fileRoom = `${projectId}-${fileId}`;
    socket.leave(fileRoom);
  });

  socket.on('yjs-sync-response', ({ targetSocketId, fileId, state }) => {
    if (targetSocketId && state) {
      io.to(targetSocketId).emit('yjs-sync-response', { fileId, state });
    }
  });

  socket.on('yjs-update', ({ projectId, fileId, update }) => {
    if (!projectId || !fileId) return;
    const fileRoom = `${projectId}-${fileId}`;
    socket.to(fileRoom).emit('yjs-update', { fileId, update });
  });

  socket.on('yjs-awareness-update', ({ projectId, fileId, update }) => {
    if (!projectId || !fileId) return;
    const fileRoom = `${projectId}-${fileId}`;
    socket.to(fileRoom).emit('yjs-awareness-update', { fileId, update });
  });

  // --- Presence Updates ---
  const updateProjectUser = (projectId, socketId, updates) => {
    if (activeProjectUsers[projectId]) {
      const userIndex = activeProjectUsers[projectId].findIndex(
        (u) => u.socketId === socketId
      );
      if (userIndex !== -1) {
        activeProjectUsers[projectId][userIndex] = {
          ...activeProjectUsers[projectId][userIndex],
          ...updates,
        };
        io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
      }
    }
  };

  socket.on('active-file-change', ({ projectId, fileId }) => {
    updateProjectUser(projectId, socket.id, { activeFileId: fileId });
  });

  // Voice lifecycle
  socket.on('join-voice', ({ projectId }) => {
    updateProjectUser(projectId, socket.id, { inVoice: true, isMuted: false, isSpeaking: false });
    socket.to(projectId).emit('user-joined-voice', {
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username,
    });
  });

  socket.on('leave-voice', ({ projectId }) => {
    updateProjectUser(projectId, socket.id, { inVoice: false, isSpeaking: false });
    socket.to(projectId).emit('user-left-voice', { socketId: socket.id });
  });

  socket.on('voice-status', ({ projectId, isMuted }) => {
    updateProjectUser(projectId, socket.id, { isMuted });
  });

  socket.on('voice-activity', ({ projectId, isSpeaking }) => {
    updateProjectUser(projectId, socket.id, { isSpeaking });
  });

  // --- WebRTC Signaling ---
  socket.on('webrtc-offer', ({ targetSocketId, offer, fromSocketId, fromUserId }) => {
    socket.to(targetSocketId).emit('webrtc-offer', { offer, fromSocketId, fromUserId });
  });

  socket.on('webrtc-answer', ({ targetSocketId, answer, fromSocketId }) => {
    socket.to(targetSocketId).emit('webrtc-answer', { answer, fromSocketId });
  });

  socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate, fromSocketId }) => {
    socket.to(targetSocketId).emit('webrtc-ice-candidate', { candidate, fromSocketId });
  });

  socket.on('disconnect', () => {
    const { projectId } = socket;
    if (projectId && activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = activeProjectUsers[projectId].filter(
        (u) => u.socketId !== socket.id
      );
      io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
      socket.to(projectId).emit('user-left-voice', { socketId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
