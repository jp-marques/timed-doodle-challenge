# Timed Doodle

A small multiplayer drawing game where friends join a room, get a prompt, and try to draw it before the timer runs out. React on the front; Node.js + Socket.IO on the back.

## Run Locally

- Prereqs: Node 18+ and npm.
- Install deps: `npm install`
- Start backend: `npm run server` (serves on `http://localhost:3001`)
- Start frontend: `npm run dev` (Vite on `http://localhost:5173`)
- Optional: set `VITE_SOCKET_URL` to your server URL if different; otherwise the app uses `http://localhost:3001` in dev and your Render URL in prod.

Build + preview (prod mode):
- `npm run build && npm run preview` (serves static build at `http://localhost:4173`)
- If previewing against a remote server, set `VITE_SOCKET_URL=https://your-render-service.onrender.com`

## Features

- Rooms with 5-character codes, host or join
- Timed rounds with random prompts
- Real-time chat; drawings are submitted at round end (no mid-round drawing sync)
- Results gallery at round end
- Resilient reconnects: rejoin the same lobby identity after a brief reload/network blip

## How It Works

### Components
1) React + Vite + TypeScript frontend (`src/`) for users to interact with.
2) Node.js + Socket.IO backend (`server/`) that manages rooms, rounds, chat, and broadcasts.
3) In-memory room store (simple and fast for a single server). To scale horizontally, use Redis and the Socket.IO Redis adapter.

Architecture: Frontend communicates with the backend over Socket.IO; the backend maintains in-memory rooms.

## Frontend Architecture (Updated)

This project uses URL-based routing, a lightweight global store, and a single socket lifecycle binding.

### Routing
- `/` → Menu (nickname + host)
- `/join` → Join by code
- `/lobby` → Lobby and settings
- `/draw` → Drawing screen
- `/results` → Results gallery

Guards and behavior:
- Deep-linking to `/lobby`, `/draw`, or `/results` without an active room redirects to `/`.
- When in a room, the current game phase is authoritative; browser back/forward cannot “time travel” to other phases. The URL snaps back to the active phase.
- Leaving a room is done via UI controls, not the browser back button.

### State Store (Zustand)
- Store file: `src/stores/game.ts`
- Tracks: `roomCode`, `inputCode`, `nickname`, `myId`, `hostId`, `players`, `prompt`, `roundDuration`, `category`, `roundCategory`, `endsAtMs`, `drawings`, `isConnected`, `toastMessage`, `chatMessages`.
- Key actions: `lobbyUpdate`, `applySettingsUpdate`, `roundStart`, `roundEnd`, `addChatMessage`, `setConnection`, `clearPerRoomState`, `clearOnLeave`.
- Host-change toasts are emitted in `lobbyUpdate` and auto-hide after 3s.

### Socket Integration
- Low-level socket: `src/lib/useSocket.ts` (singleton ref per app).
- Store wiring: `src/lib/useGameSocket.ts` attaches one set of event handlers and updates the store. Also handles auto-rejoin on reconnect using `sessionStorage`.
- Socket events centralized in `src/lib/constants/events.ts` to avoid string literals.

### Views and Features
- Lobby: `src/features/lobby/LobbyView.tsx` (still uses a small CSS file; Tailwind migration in progress).
- Draw: `src/features/draw/DrawingView.tsx` (moved from `components/DrawingCanvas.tsx`).
- Results: `src/features/results/ResultsView.tsx` with `features/results/components/ResultsGrid.tsx`.
- Menu/Join: `src/features/menu/MenuView.tsx`, `src/features/join/JoinView.tsx`.
- Categories helper: `src/lib/category.tsx` (`categories`, `getCategoryIcon`).

### Styling Approach
- Tailwind-first in components for layout and small UI pieces. Minimal global CSS in `src/index.css` and feature-scoped styles.
- `src/features/lobby/lobby.css` will be progressively migrated to Tailwind utilities.

### Developer Notes
- Added dependencies: `react-router-dom@6`, `zustand`, `clsx`.
- URL is synchronized with phase changes driven by server/store. Refresh on any route restores state when a valid session is present (auto-rejoin).
- To adjust route guards, see the navigation effects in `src/App.tsx`.

### Backend Architecture
- Everything happens over sockets. HTTP routes: `GET /` (info), `GET /healthz`, `GET /readyz`, `GET /version`.
- Rooms live in memory, keyed by a 5-character code. Each room tracks host, players, prompt, drawings, duration, and category.
- CORS allows localhost and a small set of deploy domains.
- Drawings are sent as base64 data URLs. Simple to ship; switch to binary + object storage if you need persistence.

### Rooms and Lifecycle
- Create room: host requests a new 5-char code; server ensures uniqueness.
- Join room: players join with a nickname (unique per room, case-insensitive).
- Ready state: host is always ready; non-hosts can toggle ready in the lobby; all non-host ready flags reset on round start.
- Round flow: host starts a round; server chooses a random prompt/category and broadcasts `round-start` with the selected duration.
- Submissions: each player submits one drawing per round; when all submissions are received, server broadcasts `round-end`.
- Disconnects: a short grace period allows players to reload and rejoin without losing their seat; host reassignment and room deletion are deferred by a short grace period. Empty rooms are deleted.

### Backend API (Socket.IO Events)

Client <-> Server
- `host-room`: `{ nickname }` + ack `{ code, myId, token | error }`
- `join-room`: `{ code, nickname }` + ack `{ success, myId?, token?, error? }`
- `rejoin-room`: `{ code, playerId, token, nickname? }` + ack `{ ok, myId?, hostId?, error? }`
- `toggle-ready`: `code`
- `start-round`: `{ code }`  // server uses authoritative settings for duration/category
- `update-settings`: `{ code, roundDuration?, category? }`  // host-only; ignored mid-round
- `submit-drawing`: `{ code, drawing }`  // drawing is a base64 data URL (size-limited)
- `chat-message`: `{ code, text }`       // server stamps nickname/id/time
- `leave-room`: `code`                   // explicitly leave the room without disconnecting

Server -> Clients
- `lobby-update`: `{ players: Player[], hostId: string }`
- `settings-update`: `{ roundDuration: number, category: string | null }`
- `round-start`: `{ prompt, duration, category, endsAt }`
- `round-end`: `{ drawings: Record<playerId, dataUrl> }`
- `chat-message`: `{ text, nickname, id: playerId, time }`

Validation and Limits
- Nickname: 2-15 chars; allowed `[a-zA-Z0-9\s._-]`; excessive spaces rejected
- Room code: exactly 5 chars; `[A-Z0-9]+`
- Duration: integer 15-300 seconds
- Chat: 1-120 chars; per-user rate limits
- Drawing: data URL image (png/jpeg/webp), capped by server (env)

Timer Model
- The server enforces the deadline and emits `round-end` at `endsAt` if not all submissions arrive earlier. Clients use the provided `duration` for the countdown; `endsAt` is included for reference and reconnection.

### Round Flow

1. Host sends `host-room { nickname }` + server acks `{ code, myId, token }`. Host joins the socket room `(code)`. Server emits `lobby-update` with the host.
2. Player sends `join-room { code, nickname }` + server acks `{ success, myId, token }`. Server emits `lobby-update` to the room. Players can `toggle-ready (code)`; server emits updated `lobby-update`.
3. Host sends `start-round { code }` + server emits `round-start { prompt, duration, category, endsAt }` to the room (duration/category from server settings).
4. Clients draw locally; the timer is client-side. Each client sends `submit-drawing { code, drawing }`. When all submissions are received, server emits `round-end { drawings }`.
5. If a client reloads or briefly disconnects, the client calls `rejoin-room` with its token to reclaim the same seat. Host reassignment and room deletion are deferred by a short grace period.

## Design Choices and Trade-offs

- Real-time transport: Socket.IO for built-in reconnection, rooms, and broadcasts.
- State: Rooms live in memory for low setup and fast iteration. To scale beyond one server, move room state to Redis and use the Socket.IO adapter with sticky sessions.
- Drawings: Sent as base64 strings for simplicity. For storage and larger images, switch to binary uploads and object storage (e.g., S3) with signed URLs.
- Frontend: React + Vite + TypeScript for fast feedback and type safety.
- Styling: Tailwind for quick, consistent UI without heavy CSS tooling.
- Room codes: 5 characters to be easy to share; collisions are retried.
- Validation: Guardrails on names, timers (15-300s), and chat length to prevent abuse and keep the UI stable.

### Scaling Notes
- Single instance: in-memory rooms are fine and very fast.
- Multiple instances: move room state to Redis and use the Socket.IO Redis adapter with sticky sessions at the load balancer.
- Persistence: if you need to save drawings, store binary blobs in object storage and keep only metadata in your DB.
