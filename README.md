# Sangam: Real-Time Communication App

CodeAlpha Full Stack Development Internship, Task 4.

A video meeting app where logged-in users can start a meeting, send an invite link, and talk with up to
6 people. It includes screen sharing, file sharing, a shared whiteboard and a chat, all with encryption.

## Features
- **Multi-user video calling** with WebRTC (camera and microphone, mute and camera toggles)
- **Screen sharing** (replaces your camera feed for everyone, and switches back when you stop)
- **File sharing** up to 8 MB, encrypted before it leaves your browser
- **Whiteboard** with pen colours, size, eraser and clear, synced live; late joiners receive the current board
- **Chat** inside the meeting
- **Data encryption** (see below)
- **User authentication** with bcrypt-hashed passwords and JWT; sockets also require a valid token

## How the encryption works
- **Video and audio** travel directly between browsers over WebRTC, which encrypts media with DTLS-SRTP.
- **Chat, files and whiteboard drawings** are end-to-end encrypted with AES-256-GCM using the Web Crypto API.
  When a meeting starts, the browser creates a random 256-bit key and puts it in the invite link after the `#`.
  Browsers never send that part of a link to a server, so the server only relays ciphertext it cannot read.
- Passwords are hashed with bcrypt, and API and socket access need a signed JWT.

## Tech stack
- Frontend: React 18, Vite, React Router, socket.io-client, WebRTC, Canvas, Web Crypto
- Backend: Node.js, Express.js, Socket.io (signalling and relay)
- Database: MongoDB with Mongoose (users and meeting rooms)

## Project structure
```
server/   Express API, auth, rooms, Socket.io signalling (socket.js)
client/   React app
  src/hooks/useWebRTC.js     camera, peer connections, screen sharing
  src/lib/crypto.js          AES-GCM encryption helpers
  src/components/            VideoTile, Whiteboard, ChatPanel
  src/pages/                 Login, Register, Home, Room
```

## Run it locally
You need Node.js 18+ and MongoDB (local, or a free MongoDB Atlas connection string).

### Backend
```bash
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env: set MONGO_URI and JWT_SECRET
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```
Open http://localhost:5173.

### Try it
1. Register two users (use a normal window and a private window, or two browsers).
2. User 1 clicks **Start a meeting**, then **Copy invite link**.
3. User 2 pastes the link under **Join a meeting**.
4. Try video, screen share, the whiteboard, chat and file sharing.

Use `localhost` for testing. Browsers only allow the camera and encryption APIs on `localhost` or HTTPS.

## Limitations
- Video uses a mesh, so meetings are limited to 6 people.
- Only STUN servers are configured. On strict networks, a TURN server would be needed.
- Chat history, files and the board are not stored. People who join later only get the current whiteboard.
- Screen sharing replaces the camera track, so it needs a working camera.

## Author
Pallavi Tavva
