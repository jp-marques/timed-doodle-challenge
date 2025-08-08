# Timed Doodle

A small multiplayer drawing game where friends join a room, get a prompt, and try to draw it before the timer runs out. React on the front; Node.js + Socket.IO on the back.

## Features

- Rooms with 5‑character codes, host or join
- Timed rounds with random prompts
- Real‑time drawing sync and chat
- Results gallery at round end

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
- Styling: Tailwind for quick, consistent UI without heavy CSS tooling.
- Room codes: 5 characters to be easy to share; collisions are retried.
- Validation: Guardrails on names, timers (15–300s), and chat length to prevent abuse and keep the UI stable.

### Scaling notes
- Single instance: in‑memory rooms are fine and very fast.
- Multiple instances: move room state to Redis and use the Socket.IO Redis adapter with sticky sessions at the load balancer.
- Persistence: if you need to save drawings, store binary blobs in object storage and keep only metadata in your DB.