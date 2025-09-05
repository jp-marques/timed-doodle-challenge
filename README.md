# Timed Doodle

A small multiplayer drawing game where friends join a room, get a prompt, and try to draw it before the timer runs out. React on the front; Node.js + Socket.IO on the back.

## Run locally

Prerequisites: Node.js 18+ and npm

Backend (server):
- `cd server`
- `npm install`
- `npm start`

Frontend (client):
- Open a new terminal at the project root
- `npm install`
- `npm run dev`
- Open the URL shown (usually `http://localhost:5173`)

Notes:
- Dev client targets `http://localhost:3001` (see `src/config.ts`).
- CORS allows `5173` and `5174` locally; Vite may pick 5174 if 5173 is busy.

Troubleshooting:
- Port 3001 in use (Windows): `netstat -ano | findstr :3001` then `taskkill /PID <PID> /F`
- Run server directly if needed: `node index.js` from the `server/` directory

## Live

- Frontend (Vercel): [timed-doodle-challenge.vercel.app](https://timed-doodle-challenge.vercel.app) 
- Backend (Render): [timed-doodle-challenge.onrender.com](https://timed-doodle-challenge.onrender.com)

> Note: The backend runs on Render’s free tier. **Please be patient :)** - cold starts can take around 60 seconds. If it seems slow or times out at first, wait a moment and try again while the server spins up.

## Tech stack

- **Frontend**
  - React + TypeScript (Vite)
  - Socket.IO Client

- **Backend**
  - Node.js, Express
  - Socket.IO (real-time)
  - CORS

- **Architecture**
  - Real-time communication via Socket.IO
  - In-memory room store (single instance)

- **Hosting**
  - Frontend: Vercel
  - Backend: Render

## Features

- Rooms with 5‑character codes, host or join
- Timed rounds with random prompts
- Real‑time drawing sync and chat
- Results gallery at round end

## Performance Testing

The backend has been validated through comprehensive load testing to ensure reliability under real-world conditions:

### Load Capacity
- **250 concurrent clients** sustained over 15-minute soak test
- **100% connection success rate** with no dropped connections
- Stable CPU usage (~8.9%) and memory management under load

### Latency Performance
- **Connection handshake**: Average ~187ms, P95 ~198ms
- **Event round-trip**: Average ~1.8ms, P95 ~4.65ms
- **Throughput**: Processed ~237k Socket.IO events in synthetic tests

### Reliability
- **Zero dropped rooms** during churn simulations
- **Consistent state sync** across all clients under network stress
- **Automatic room cleanup** with TTL-based expiration

### Client Performance
- **Bundle size**: 82KB gzipped (excellent compression)
- **Time to Interactive**: ~765ms estimated
- **Asset optimization**: 69% gzip compression ratio

> 📊 **Test Environment**: All metrics from local load testing using custom test suite (`load-testing/`). Production performance may vary based on network conditions and server resources.

## How it works

### Components
1) React + Vite + TypeScript frontend (`src/`) for users to interact with.
2) Node.js + Socket.IO backend (`server/`) that manages rooms, rounds, chat, and broadcasts.
3) In‑memory room store (simple and fast for a single server). To scale horizontally, use Redis and the Socket.IO Redis adapter.

Architecture: Frontend communicates with the backend over Socket.IO; the backend maintains in-memory rooms.

### Backend architecture
- Everything happens over sockets. One HTTP route (`GET /`) exists for health checks.
- Rooms live in memory, keyed by a 5‑character code. Each room tracks host, players, prompt, drawings, duration, and category.
- CORS allows localhost and a small set of deploy domains.
- Drawings are sent as base64 data URLs. Simple to ship; switch to binary + object storage if you need persistence.

### Rooms and lifecycle
- Create room: host requests a new 5‑char code; server ensures uniqueness.
- Join room: players join with a nickname (unique per room, case‑insensitive).
- Ready state: host is always ready; non‑hosts can toggle ready in the lobby; all non‑host ready flags reset on round start.
- Round flow: host starts a round; server chooses a random prompt/category and broadcasts `round-start` with the selected duration.
- Submissions: each player submits one drawing per round; when all submissions are received, server broadcasts `round-end`.
- Room cleanup: if the host leaves, `host-left` is broadcast and the room is destroyed; if a room becomes empty, it’s deleted.

### Backend API (Socket.IO events)

Client → Server
- `host-room`: `{ nickname }` → ack `{ code | error }`
- `join-room`: `{ code, nickname }` → ack `{ success, error? }`
- `toggle-ready`: `code`
- `start-round`: `{ code, duration }`
- `submit-drawing`: `{ code, drawing }`  // drawing is a base64 data URL
- `chat-message`: `{ code, text }`       // server stamps nickname/id/time

Server → Clients
- `lobby-update`: `Player[]`
- `round-start`: `{ prompt, duration, category, endsAt }`
- `round-end`: `{ drawings: Record<socketId, dataUrl> }`
- `chat-message`: `{ text, nickname, id, time }`
- `host-left`

Validation and limits
- Nickname: 2–15 chars; allowed `[a-zA-Z0-9\s._-]`; excessive spaces rejected
- Room code: exactly 5 chars; `[A-Z0-9]+`
- Duration: integer 15–300 seconds
- Chat: 1–120 chars

Timer model
- The server enforces the deadline and emits `round-end` at `endsAt` if not all submissions arrive earlier. Clients should use `endsAt` to render the countdown.

### Round flow

1. Host sends `host-room { nickname }` → server acks `{ code }`. Host joins the socket room `(code)`. Server emits `lobby-update` with the host.
2. Player sends `join-room { code, nickname }` → server acks `{ success }`. Server emits `lobby-update` to the room. Players can `toggle-ready (code)`; server emits updated `lobby-update`.
3. Host sends `start-round { code, duration }` → server emits `round-start { prompt, duration, category }` to the room.
4. Clients draw locally; the timer is client-side. Each client sends `submit-drawing { code, drawing }`. When all submissions are received, server emits `round-end { drawings }`.
5. Host can start another round by sending `start-round` again. If the host disconnects, server emits `host-left` and deletes the room; empty rooms are also deleted.


## Design choices and trade-offs

- Real‑time transport: I used Socket.IO for built‑in reconnection, rooms, and broadcasts so I can focus on the game rules. If I needed lower‑level control, I’d switch to raw WebSockets and add that logic.
- State: Rooms live in memory for low setup and fast iteration. To scale beyond one server, I’d move room state to Redis and use the Socket.IO adapter with sticky sessions.
- Drawings: Sent as base64 strings for simplicity. For storage and larger images, I’d switch to binary uploads and object storage (e.g., S3) with signed URLs.
- Frontend: React + Vite + TypeScript for fast feedback and type safety.
- Styling: Simple hand-written CSS for a lightweight bundle.
- Room codes: 5 characters to be easy to share; collisions are retried.
- Validation: Guardrails on names, timers (15–300s), and chat length to prevent abuse and keep the UI stable.
