# Timed Doodle

A small multiplayer drawing game where friends join a room, get a prompt, and try to draw it before the timer runs out. React on the front; Node.js + Socket.IO on the back.

## Features

- Rooms with 5‑character codes, host or join
- Timed rounds with random prompts
- Real‑time drawing sync and chat
- Results gallery at round end

## Quick start

Prerequisites: Node 18+

```bash
git clone <repo>
cd TimedDoodle
npm install
cd server && npm install && cd ..

# terminal 1
cd server && npm start   # http://localhost:3001

# terminal 2
npm run dev               # http://localhost:5173
```

Env vars:

```bash
PORT=3001
VITE_SERVER_URL=http://localhost:3001
```

## How it works

- Backend (`server/index.js`)
  - Everything happens over sockets. One HTTP route (`GET /`) exists just as a health check.
  - Rooms are stored in memory, keyed by a 5‑character code. Each room tracks host, players, prompt, drawings, and duration.
  - Core events: `host-room`, `join-room`, `toggle-ready`, `start-round`, `submit-drawing`, `chat-message`.
  - Core broadcasts: `lobby-update`, `round-start`, `round-end`, `chat-message`, `host-left`.
  - Guard rails: nicknames (2–15, sane characters), room code (exactly 5), duration (15–300s), chat (1–120 chars). If the host leaves, the room closes so no one gets stuck.
  - CORS allows localhost and a small set of deploy domains.

- Frontend (`src/`)
  - React + Vite + TypeScript + Tailwind.
  - `src/App.tsx` manages game state (menu → lobby → drawing → results), canvas, and socket events.

Data sent for drawings is a base64 image string. Simple to ship, works everywhere. If you need to scale or store results, switching to binary blobs and object storage is the next step.


## Design choices and trade-offs

- Real‑time transport: I used Socket.IO for built‑in reconnection, rooms, and broadcasts so I can focus on the game rules. If I needed lower‑level control, I’d switch to raw WebSockets and add that logic.
- State: Rooms live in memory for low setup and fast iteration. To scale beyond one server, I’d move room state to Redis and use the Socket.IO adapter with sticky sessions.
- Drawings: Sent as base64 strings for simplicity. For storage and larger images, I’d switch to binary uploads and object storage (e.g., S3) with signed URLs.
- Frontend: React + Vite + TypeScript for fast feedback and type safety.
- Styling: Tailwind for quick, consistent UI without heavy CSS tooling.
- Room codes: 5 characters to be easy to share; collisions are retried.
- Validation: Guardrails on names, timers (15–300s), and chat length to prevent abuse and keep the UI stable.