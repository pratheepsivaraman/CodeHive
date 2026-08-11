import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// We create a single socket instance for the app to reuse
export const socket = io(URL, {
  autoConnect: false, // Don't connect until requested (e.g., entering a workspace)
});
