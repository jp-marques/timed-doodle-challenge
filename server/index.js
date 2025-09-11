// Simple Express + Socket.IO server for Timed Doodle Challenge
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// Env-driven config
const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : ["http://localhost:5173", "http://127.0.0.1:5173"]).slice(0, 20);
const SOCKET_MAX_HTTP_BUFFER_SIZE = Number(process.env.MAX_HTTP_BUFFER_SIZE || 128 * 1024);
const JSON_LIMIT = process.env.JSON_LIMIT || '64kb';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: false
  },
  maxHttpBufferSize: SOCKET_MAX_HTTP_BUFFER_SIZE,
  perMessageDeflate: false
});

app.use(helmet());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: false
}));
app.use(express.json({ limit: JSON_LIMIT }));

const { prompts, getRandomPrompt, getRandomPromptFromCategory } = require('./prompts');
const { validateNickname, validateRoomCode, validateRoundDuration } = require('./validation');
const rooms = {};

// Nickname normalization and disambiguation helpers
function normalizeNickname(name) {
  if (!name || typeof name !== 'string') return '';
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}
function stripSuffix(raw) {
  // Remove trailing " (n)" if present for base comparison
  if (!raw || typeof raw !== 'string') return '';
  const m = raw.match(/^(.*)\s*\((\d+)\)\s*$/);
  return (m ? m[1] : raw).trim().replace(/\s+/g, ' ');
}
function assignUniqueNickname(preferred, existingList) {
  // existingList: array of player objects with .nickname
  const baseRaw = preferred || 'Player';
  const baseDisplay = baseRaw.trim().replace(/\s+/g, ' ');
  const baseNorm = normalizeNickname(stripSuffix(baseRaw));

  // Collect taken numbers for this base (1 = unsuffixed, 2+ = with suffix)
  const taken = new Set();
  for (const p of Array.isArray(existingList) ? existingList : []) {
    const n = (p && typeof p.nickname === 'string') ? p.nickname : '';
    const pBaseDisplay = stripSuffix(n).trim().replace(/\s+/g, ' ');
    const pBaseNorm = normalizeNickname(pBaseDisplay);
    if (pBaseNorm !== baseNorm) continue;
    const m = n.match(/^(.*)\s*\((\d+)\)\s*$/);
    if (m) {
      const num = parseInt(m[2], 10);
      if (Number.isFinite(num) && num >= 2) taken.add(num);
    } else {
      taken.add(1);
    }
  }

  // Find the smallest available number
  if (!taken.has(1)) return baseDisplay; // "Joe"
  let k = 2;
  while (taken.has(k)) k++;
  return `${baseDisplay} (${k})`; // "Joe (2)", "Joe (3)", ...
}

function publicPlayers(list) {
  return (Array.isArray(list) ? list : []).map(p => ({
    id: p.id,
    nickname: p.nickname,
    isReady: !!p.isReady,
  }));
}

// Helpers and state
function normalizeCode(code) {
  if (!code || typeof code !== 'string') return null;
  return code.trim().toUpperCase();
}
function generateId() {
  return Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 6);
}

// Session token signing
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret';
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(String(value)).digest('hex');
}
function safeEqualHex(a, b) {
  try {
    const aBuf = Buffer.from(String(a), 'hex');
    const bBuf = Buffer.from(String(b), 'hex');
    if (aBuf.length !== bBuf.length || aBuf.length === 0) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

// Helper: end a round and broadcast results
function endRound(code) {
  const room = rooms[code];
  if (!room) return;
  if (room.roundTimeout) {
    clearTimeout(room.roundTimeout);
    room.roundTimeout = null;
  }
  // Emit results once
  io.to(code).emit('round-end', { drawings: room.drawings });
  // Cleanup round-specific fields
  room.endsAt = null;
  room.participants = null;
  room.prompt = null;
}

// Helper: check if all required participants have submitted
function maybeEndRoundEarly(code) {
  const room = rooms[code];
  if (!room) return;
  const requiredIds = room.participants || (room.players ? room.players.map(p => p.id) : []);
  if (requiredIds.length === 0) return;
  let submittedCount = 0;
  for (const participantId of requiredIds) {
    if (room.drawings && room.drawings[participantId]) submittedCount++;
  }
  if (submittedCount >= requiredIds.length) {
    endRound(code);
  }
}

// Validation helpers imported from ./validation

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  const ip = socket.handshake.address || 'unknown';

  socket.on('host-room', ({ nickname }, callback) => {
    try {
      const validationError = validateNickname(nickname);
      if (validationError) {
        throw new Error(validationError);
      }

      const trimmedNickname = nickname.trim();
      console.log('Host room request from:', trimmedNickname);
      
      // Generate a unique room code
      let code;
      let attempts = 0;
      do {
        code = Math.random().toString(36).substring(2, 7).toUpperCase();
        attempts++;
      } while (rooms[code] && attempts < 10);

      if (attempts >= 10) {
        throw new Error('Unable to generate unique room code');
      }

      // Create the room with stable playerId
      const playerId = generateId();
      rooms[code] = {
        host: playerId,
        hostSocketId: socket.id,
        players: [{
          id: playerId,
          socketId: socket.id,
          nickname: trimmedNickname,
          isReady: true // host is always ready
        }],
        drawings: {},
        prompt: null,
        category: null,
        roundDuration: 60, // Default round duration
        createdAt: Date.now()
      };

      // Join the socket room
      socket.join(code);
      // Store stable player id on the socket for lifecycle cleanup
      try { socket.data.playerId = playerId; } catch {}
      
      console.log('Created room:', code, 'with host:', trimmedNickname);
      
      if (typeof callback === 'function') {
        const token = sign(`${code}|${playerId}`);
        callback({ code, myId: playerId, token });
      }
      
      // Send initial lobby state
      io.to(code).emit('lobby-update', {
        players: publicPlayers(rooms[code].players),
        hostId: rooms[code].host
      });
      // Send initial settings only to the host socket
      socket.emit('settings-update', {
        roundDuration: rooms[code].roundDuration,
        category: rooms[code].category
      });
    } catch (error) {
      console.error('Error in host-room:', error);
      if (typeof callback === 'function') {
        callback({ error: error.message || 'Failed to create room' });
      }
    }
  });

  socket.on('join-room', ({ code, nickname }, callback) => {
    try {
      // Validate room code
      const codeValidationError = validateRoomCode(code);
      if (codeValidationError) {
        throw new Error(codeValidationError);
      }

      // Validate nickname
      const nicknameValidationError = validateNickname(nickname);
      if (nicknameValidationError) {
        throw new Error(nicknameValidationError);
      }

      const trimmedCode = normalizeCode(code);
      const trimmedNickname = nickname.trim();

      if (rooms[trimmedCode]) {
        // Per-IP join rate limit
        const key = `join:${ip}`;
        if (!socket.rateBuckets) socket.rateBuckets = {};
        if (!socket.rateBuckets[key]) socket.rateBuckets[key] = [];
        const now = Date.now();
        socket.rateBuckets[key] = socket.rateBuckets[key].filter(t => now - t < (Number(process.env.JOIN_RATE_WINDOW_MS || 60000)));
        if (socket.rateBuckets[key].length >= Number(process.env.JOIN_RATE_LIMIT || 5)) {
          throw new Error('Too many join attempts');
        }
        socket.rateBuckets[key].push(now);
        if (rooms[trimmedCode].players.length >= Number(process.env.MAX_PLAYERS_PER_ROOM || 12)) {
          throw new Error('Room is full');
        }
        // Determine an available nickname deterministically: "Name", "Name (2)", ...
        const assignedNickname = assignUniqueNickname(trimmedNickname, rooms[trimmedCode].players);

        // Prevent duplicate by socketId
        const dup = rooms[trimmedCode].players.find(p => p.socketId === socket.id);
        if (dup) {
          throw new Error('Already joined');
        }

        const player = {
          id: generateId(),
          socketId: socket.id,
          nickname: assignedNickname,
          isReady: false
        };
        rooms[trimmedCode].players.push(player);
        socket.join(trimmedCode);
        // Store stable player id on the socket for lifecycle cleanup
        try { socket.data.playerId = player.id; } catch {}
        io.to(trimmedCode).emit('lobby-update', {
          players: publicPlayers(rooms[trimmedCode].players),
          hostId: rooms[trimmedCode].host
        });
        // Send current settings only to the newly joined socket
        socket.emit('settings-update', {
          roundDuration: rooms[trimmedCode].roundDuration,
          category: rooms[trimmedCode].category
        });
        if (typeof callback === 'function') {
          const token = sign(`${trimmedCode}|${player.id}`);
          callback({ success: true, myId: player.id, token, assignedNickname });
        }
      } else {
        throw new Error('Room not found');
      }
    } catch (error) {
      console.error('Error in join-room:', error);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message || 'Failed to join room' });
      }
    }
  });

  // Allow previously joined players to rebind after a reload/network blip
  socket.on('rejoin-room', ({ code, playerId, token, nickname }, ack) => {
    try {
      const trimmedCode = normalizeCode(code);
      const room = trimmedCode ? rooms[trimmedCode] : null;
      if (!room) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Room not found' });
        return;
      }
      if (!playerId || !token) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Missing credentials' });
        return;
      }
      const expected = sign(`${trimmedCode}|${playerId}`);
      if (!safeEqualHex(token, expected)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid token' });
        return;
      }

      let player = room.players.find(p => p.id === playerId);
      if (!player) {
        // If the player was pruned earlier, restore their seat with the same id
        player = {
          id: playerId,
          socketId: socket.id,
          nickname: (typeof nickname === 'string' && nickname.trim()) ? nickname.trim() : 'Player',
          isReady: false
        };
        room.players.push(player);
      } else {
        // If an old socket is still connected for this player, disconnect it to avoid duplicates
        const prevSocketId = player.socketId;
        player.socketId = socket.id;
        if (prevSocketId && prevSocketId !== socket.id) {
          const prevSocket = io.sockets.sockets.get(prevSocketId);
          try { prevSocket?.disconnect(true); } catch {}
        }
      }

      socket.join(trimmedCode);
      try { socket.data.playerId = player.id; } catch {}

      // Cancel any pending removal scheduled for this player
      if (!room.pending) room.pending = {};
      if (room.pending.playerRemoval && room.pending.playerRemoval[player.id]) {
        try { clearTimeout(room.pending.playerRemoval[player.id]); } catch {}
        delete room.pending.playerRemoval[player.id];
      }

      // If host, update host socket id
      if (room.host === player.id) {
        room.hostSocketId = socket.id;
      }

      // Catch this socket up with settings and (optionally) round
      socket.emit('settings-update', {
        roundDuration: room.roundDuration,
        category: room.category
      });

      if (room.endsAt && Date.now() < room.endsAt) {
        const remaining = Math.max(0, Math.ceil((room.endsAt - Date.now()) / 1000));
        io.to(socket.id).emit('round-start', { prompt: room.prompt, duration: remaining, category: room.category, endsAt: room.endsAt });
      }

      io.to(trimmedCode).emit('lobby-update', {
        players: publicPlayers(room.players),
        hostId: room.host
      });

      if (typeof ack === 'function') ack({ ok: true, myId: player.id, hostId: room.host });
    } catch (err) {
      console.error('Error in rejoin-room:', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Failed to rejoin' });
    }
  });

  socket.on('toggle-ready', (code) => {
    const trimmedCode = normalizeCode(code);
    if (trimmedCode && rooms[trimmedCode]) {
      const room = rooms[trimmedCode];
      const player = room.players.find(p => p.socketId === socket.id);
      if (player && player.id !== room.host) { // host is always ready
        player.isReady = !player.isReady;
        io.to(trimmedCode).emit('lobby-update', {
          players: room.players,
          hostId: room.host
        });
      }
    }
  });
  socket.on('start-round', ({ code }) => {
    try {
      // Validate room code
      const codeValidationError = validateRoomCode(code);
      if (codeValidationError) {
        console.error('Invalid room code in start-round:', codeValidationError);
        return;
      }

      const trimmedCode = normalizeCode(code);

      const room = rooms[trimmedCode];
      if (room) {
        // Authorize by player id and tolerate reconnects
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.id !== room.host) {
          console.error('Unauthorized start-round attempt or not host');
          return;
        }
        // Refresh host binding to current socket
        room.hostSocketId = socket.id;
        // Use server authoritative settings
        const duration = room.roundDuration;
        // Determine category for this round only (preference can be null = random)
        let chosenCategory = room.category;
        let chosenPrompt;
        if (chosenCategory && typeof chosenCategory === 'string' && prompts[chosenCategory]) {
          chosenPrompt = getRandomPromptFromCategory(chosenCategory);
        } else {
          const random = getRandomPrompt();
          chosenCategory = random.category;
          chosenPrompt = random.prompt;
        }
        room.prompt = chosenPrompt;
        room.drawings = {};
        // Snapshot participants at round start
        room.participants = room.players.map(p => p.id);
        // Reset ready status for next round (non-host only)
        room.players.forEach(p => {
          if (p.id !== room.host) p.isReady = false;
        });
        // Server-enforced deadline
        const endsAt = Date.now() + duration * 1000;
        room.endsAt = endsAt;
        if (room.roundTimeout) clearTimeout(room.roundTimeout);
        room.roundTimeout = setTimeout(() => endRound(trimmedCode), duration * 1000);
        io.to(trimmedCode).emit('round-start', { prompt: room.prompt, duration, category: chosenCategory, endsAt });
        console.log(`Round started in room ${trimmedCode} with duration ${duration}s (endsAt=${endsAt})`);
      } else {
        console.error('Unauthorized start-round attempt or room not found');
      }
    } catch (error) {
      console.error('Error in start-round:', error);
    }
  });

  // Host-only settings updates. Dropped while a round is active.
  socket.on('update-settings', ({ code, roundDuration, category }) => {
    try {
      const trimmedCode = normalizeCode(code);
      if (!trimmedCode || !rooms[trimmedCode]) return;
      const room = rooms[trimmedCode];
      // Only host can update settings (authorize by player id)
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.id !== room.host) return;
      // Refresh host binding to current socket
      room.hostSocketId = socket.id;
      // Do not allow edits mid-round to avoid confusion
      if (room.endsAt) return;

      // Update duration if provided and valid
      if (typeof roundDuration !== 'undefined') {
        const err = validateRoundDuration(roundDuration);
        if (err) return;
        room.roundDuration = roundDuration;
      }

      // Update category if provided and valid
      if (typeof category !== 'undefined') {
        if (category === null) {
          room.category = null;
        } else if (typeof category === 'string' && Object.prototype.hasOwnProperty.call(prompts, category)) {
          room.category = category;
        } else {
          return;
        }
      }

      room.lastActivityAt = Date.now();
      io.to(trimmedCode).emit('settings-update', {
        roundDuration: room.roundDuration,
        category: room.category
      });
    } catch (err) {
      console.error('Error in update-settings:', err);
    }
  });

  socket.on('submit-drawing', ({ code, drawing }, ack) => {
    const trimmedCode = normalizeCode(code);
    const room = trimmedCode ? rooms[trimmedCode] : null;
    if (!room) { if (typeof ack === 'function') ack({ ok: false, error: 'room-not-found' }); return; }
    const now = Date.now();
    // Round must be active and within time window
    if (!room.endsAt || now > room.endsAt) {
      if (typeof ack === 'function') ack({ ok: false, error: 'round-inactive-or-ended' });
      return;
    }
    // Only accept from players in the room
    const player = room.players.find(p => p.socketId === socket.id);
    if (!player) { if (typeof ack === 'function') ack({ ok: false, error: 'not-in-room' }); return; }
    // Validate payload size and type
    if (typeof drawing !== 'string' || !drawing.startsWith('data:image/')) { if (typeof ack === 'function') ack({ ok: false, error: 'invalid-type' }); return; }
    const mime = drawing.slice(5, drawing.indexOf(';'));
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) { if (typeof ack === 'function') ack({ ok: false, error: 'unsupported-mime' }); return; }
    const b64 = drawing.slice(drawing.indexOf(',') + 1);
    const approxBytes = Math.floor(b64.length * 3 / 4);
    if (approxBytes <= 0 || approxBytes > (Number(process.env.MAX_DRAWING_BYTES || 200 * 1024))) { if (typeof ack === 'function') ack({ ok: false, error: 'too-large' }); return; }
    room.drawings[player.id] = drawing;
    if (typeof ack === 'function') ack({ ok: true });
    maybeEndRoundEarly(trimmedCode);
  });

  socket.on('chat-message', ({ code, text }) => {
    try {
      const trimmedCode = normalizeCode(code);
      if (!trimmedCode || !rooms[trimmedCode]) {
        return; // Room doesn't exist
      }

      // Validate message text
      if (!text || typeof text !== 'string') {
        return; // Invalid message
      }

      const trimmedText = text.trim();
      if (!trimmedText || trimmedText.length > 120) {
        return; // Empty or too long message
      }

      // Check if sender is actually in the room
      const player = rooms[trimmedCode].players.find(p => p.socketId === socket.id);
      if (!player) {
        return; // Player not in room
      }
      // Simple per-player rate limit
      const key = `chat:${player.id}`;
      if (!socket.rateBuckets) socket.rateBuckets = {};
      if (!socket.rateBuckets[key]) socket.rateBuckets[key] = [];
      const now = Date.now();
      socket.rateBuckets[key] = socket.rateBuckets[key].filter(t => now - t < (Number(process.env.CHAT_RATE_WINDOW_MS || 5000)));
      if (socket.rateBuckets[key].length >= Number(process.env.CHAT_RATE_LIMIT || 5)) {
        return; // drop silently
      }
      socket.rateBuckets[key].push(now);

      // Broadcast the chat message to all players in the room
      io.to(trimmedCode).emit('chat-message', { 
        text: trimmedText, 
        nickname: player.nickname, // Use server-stored nickname for security
        id: player.id, 
        time: Date.now() // Use server time
      });
    } catch (error) {
      console.error('Error in chat-message:', error);
    }
  });

  // Explicitly allow clients to leave a room without disconnecting the socket
  socket.on('leave-room', (code) => {
    const trimmedCode = normalizeCode(code);
    const room = trimmedCode ? rooms[trimmedCode] : null;
    if (!room) return;

    const leavingPlayer = room.players.find(p => p.socketId === socket.id) || null;
    const wasHost = socket.id === room.hostSocketId;

    // Remove from players list
    room.players = room.players.filter(p => p.socketId !== socket.id);

    // Remove from active participants if a round is running
    if (Array.isArray(room.participants) && leavingPlayer) {
      room.participants = room.participants.filter(id => id !== leavingPlayer.id);
      maybeEndRoundEarly(trimmedCode);
    }

    // Ensure this socket stops receiving broadcasts for this room
    try { socket.leave(trimmedCode); } catch {}

    // Host reassignment or room cleanup
    if (wasHost) {
      if (room.players.length > 0) {
        const newHost = room.players[0];
        room.host = newHost.id;
        room.hostSocketId = newHost.socketId;
      } else {
        if (room.roundTimeout) { try { clearTimeout(room.roundTimeout); } catch {} room.roundTimeout = null; }
        delete rooms[trimmedCode];
        return;
      }
    } else if (room.players.length === 0) {
      if (room.roundTimeout) { try { clearTimeout(room.roundTimeout); } catch {} room.roundTimeout = null; }
      delete rooms[trimmedCode];
      return;
    }

    // Notify remaining players
    io.to(trimmedCode).emit('lobby-update', {
      players: publicPlayers(room.players),
      hostId: room.host
    });
  });

  const REJOIN_GRACE_MS = Number(process.env.REJOIN_GRACE_MS || 15000);
  socket.on('disconnecting', () => {
    for (const code of socket.rooms) {
      const room = rooms[code];
      if (!room) continue;
      const leavingPlayer = room.players.find(p => p.socketId === socket.id) || null;
      if (!leavingPlayer) continue;

      // Schedule delayed removal to allow page reloads to rebind
      if (!room.pending) room.pending = {};
      if (!room.pending.playerRemoval) room.pending.playerRemoval = {};
      if (room.pending.playerRemoval[leavingPlayer.id]) {
        try { clearTimeout(room.pending.playerRemoval[leavingPlayer.id]); } catch {}
      }
      room.pending.playerRemoval[leavingPlayer.id] = setTimeout(() => {
        const r = rooms[code];
        if (!r) return;
        const idx = r.players.findIndex(p => p.id === leavingPlayer.id);
        if (idx === -1) return;

        const removedPlayer = r.players[idx];
        const wasHost = r.host === removedPlayer.id;
        // Remove player from list
        r.players.splice(idx, 1);

        // If a round is running, remove from required participants now
        if (r.participants && Array.isArray(r.participants)) {
          r.participants = r.participants.filter(id => id !== removedPlayer.id);
          maybeEndRoundEarly(code);
        }

        // Host reassignment or room cleanup
        if (wasHost) {
          if (r.players.length > 0) {
            const newHost = r.players[0];
            r.host = newHost.id;
            r.hostSocketId = newHost.socketId;
            io.to(code).emit('lobby-update', { players: publicPlayers(r.players), hostId: r.host });
          } else {
            if (r.roundTimeout) { try { clearTimeout(r.roundTimeout); } catch {} r.roundTimeout = null; }
            delete rooms[code];
            return;
          }
        } else if (r.players.length > 0) {
          io.to(code).emit('lobby-update', { players: publicPlayers(r.players), hostId: r.host });
        } else {
          if (r.roundTimeout) { try { clearTimeout(r.roundTimeout); } catch {} r.roundTimeout = null; }
          delete rooms[code];
        }
      }, REJOIN_GRACE_MS);
    }
  });
});

app.get('/', (req, res) => {
  res.send('Timed Doodle Challenge backend running.');
});

// Simple health/ready endpoints
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/readyz', (req, res) => res.status(200).json({ ready: true }));

// Version endpoint: helps verify deployed server build
try {
  const pkg = require('./package.json');
  app.get('/version', (req, res) => {
    res.status(200).json({
      name: pkg.name || 'timed-doodle-server',
      version: pkg.version || null,
      commit:
        process.env.RENDER_GIT_COMMIT ||
        process.env.VERCEL_GIT_COMMIT ||
        process.env.GIT_COMMIT || null,
    });
  });
} catch {}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Idle room GC
const ROOM_IDLE_MS = Number(process.env.ROOM_IDLE_MS || 30 * 60 * 1000);
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    if (!room) continue;
    const lastActive = room.lastActivityAt || room.createdAt || 0;
    if (now - lastActive > ROOM_IDLE_MS) {
      if (room.roundTimeout) { try { clearTimeout(room.roundTimeout); } catch {} }
      delete rooms[code];
    }
  }
}, Math.min(ROOM_IDLE_MS, 5 * 60 * 1000));
