# CodeHive

> **"Where Teams Build Together."**

CodeHive is a production-quality, AI-powered collaborative software development platform designed for students and development teams. It enables seamless, real-time code collaboration directly in the browser.

## Features

- **Real-Time Collaboration**: Google Docs-style concurrent editing powered by Socket.IO and Yjs (Conflict-Free Replicated Data Types).
- **Integrated Voice Chat**: WebRTC-powered voice channels let you talk to your teammates instantly while editing.
- **AI Code Assistant**: Integrated Google Gemini AI to analyze, refactor, and generate code based on your active context.
- **GitHub Integration**: Push commits and pull repositories directly from the workspace using your Personal Access Token.
- **Version History**: Git-style snapshots for individual files. Commit changes and effortlessly revert back to previous states.
- **Modern Workspace**: A sleek, dark-themed UI built with Vite, React, and TailwindCSS, utilizing the Monaco Editor (VS Code engine).

## Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS (v4), Monaco Editor, Lucide React.
- **Backend**: Node.js, Express, MongoDB, Socket.IO, `@google/genai`.
- **Real-Time Engine**: Yjs (CRDT) + `y-monaco`.
- **Peer-to-Peer**: WebRTC (`RTCPeerConnection`).

## Prerequisites

- Node.js (v18+ recommended)
- MongoDB running locally or a MongoDB Atlas URI.
- Google Gemini API Key.
- GitHub Personal Access Token (for syncing repos).

## Getting Started

1. **Clone the repository:**
   \`\`\`bash
   git clone <repo-url>
   cd CodeHive
   \`\`\`

2. **Install all dependencies:**
   \`\`\`bash
   npm run install:all
   \`\`\`

3. **Configure Environment Variables:**
   Create a `.env` file in the `backend` directory:
   \`\`\`env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/codehive
   JWT_SECRET=your_jwt_secret
   GEMINI_API_KEY=your_gemini_api_key
   \`\`\`

4. **Run the Application (Development Mode):**
   \`\`\`bash
   npm run dev
   \`\`\`
   This will start both the frontend Vite server and the backend Express server concurrently.

5. **Open in Browser:**
   Navigate to `http://localhost:5173`

## Testing

The backend includes a basic integration test suite using `jest` and `supertest`.
To run tests:
\`\`\`bash
cd backend
npm test
\`\`\`

## Architecture Notes

- **CRDTs over OTs**: We opted for Yjs over standard Operational Transformation to guarantee conflict-free mathematical merging without a centralized resolution bottleneck.
- **WebRTC Signaling**: Voice chat negotiates P2P handshakes exclusively through our Socket.IO server (`webrtc-offer`, `webrtc-answer`, `webrtc-ice-candidate`), ensuring secure and direct audio streams.
