import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';

dotenv.config(); // Load from current dir

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.VITE_API_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());

// Connect Database (Local fallback if URI is empty for now)
if (process.env.MONGODB_URI) {
  connectDB();
}

import authRoutes from './routes/authRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

// Basic route
app.get('/', (req, res) => {
  res.send('CodeHive API is running...');
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/ai', aiRoutes);

// Track active users in projects: { projectId: [{ socketId, userId, username }] }
const activeProjectUsers = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins a project workspace
  socket.on('join-project', ({ projectId, user }) => {
    socket.join(projectId);
    
    if (!activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = [];
    }
    
    // Add user to active list if not already there
    const existingUser = activeProjectUsers[projectId].find(u => u.userId === user._id);
    if (!existingUser) {
      activeProjectUsers[projectId].push({
        socketId: socket.id,
        userId: user._id,
        username: user.username,
      });
    }

    // Broadcast updated active users list to everyone in the project
    io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
    
    socket.projectId = projectId; // Store for disconnect handling
    socket.userId = user._id;
  });

  // User leaves a project workspace
  socket.on('leave-project', ({ projectId }) => {
    socket.leave(projectId);
    if (activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = activeProjectUsers[projectId].filter(u => u.socketId !== socket.id);
      io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
    }
  });

  // Handle Yjs document updates (binary data)
  // We use a specific room for each file to limit broadcast scope: `${projectId}-${fileId}`
  socket.on('join-file', ({ projectId, fileId }) => {
    const fileRoom = `${projectId}-${fileId}`;
    socket.join(fileRoom);
  });

  socket.on('leave-file', ({ projectId, fileId }) => {
    const fileRoom = `${projectId}-${fileId}`;
    socket.leave(fileRoom);
  });

  socket.on('yjs-update', ({ projectId, fileId, update }) => {
    const fileRoom = `${projectId}-${fileId}`;
    // Broadcast the update to everyone else in the file room
    socket.to(fileRoom).emit('yjs-update', { fileId, update });
  });

  socket.on('yjs-awareness-update', ({ projectId, fileId, update }) => {
    const fileRoom = `${projectId}-${fileId}`;
    socket.to(fileRoom).emit('yjs-awareness-update', { fileId, update });
  });

  // --- Presence Updates ---
  const updateProjectUser = (projectId, socketId, updates) => {
    if (activeProjectUsers[projectId]) {
      const userIndex = activeProjectUsers[projectId].findIndex(u => u.socketId === socketId);
      if (userIndex !== -1) {
        activeProjectUsers[projectId][userIndex] = { ...activeProjectUsers[projectId][userIndex], ...updates };
        io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
      }
    }
  };

  socket.on('active-file-change', ({ projectId, fileId }) => {
    updateProjectUser(projectId, socket.id, { activeFileId: fileId });
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
    console.log(`User disconnected: ${socket.id}`);
    
    const { projectId, userId } = socket;
    if (projectId && activeProjectUsers[projectId]) {
      activeProjectUsers[projectId] = activeProjectUsers[projectId].filter(u => u.socketId !== socket.id);
      io.to(projectId).emit('project-users-updated', activeProjectUsers[projectId]);
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
