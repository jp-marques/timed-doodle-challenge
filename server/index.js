// Simple Express + Socket.IO server for Timed Doodle Challenge
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Explicit CORS allowlist (remove permissive wildcard domains)
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "https://timed-doodle-challenge.vercel.app"
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({ origin: allowedOrigins, methods: ["GET", "POST"], credentials: true }));
app.use(express.json());

const { getRandomPrompt } = require('./prompts');
const { validateNickname, validateRoomCode, validateRoundDuration } = require('./validation');
const { v4: uuidv4 } = require('uuid');
const rooms = {};

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

      // Create the room
      const sessionId = uuidv4();
      rooms[code] = {
        host: socket.id,
        players: [{
          id: socket.id,
          nickname: trimmedNickname,
          isReady: true // host is always ready
        }],
        drawings: {},
        prompt: null,
        roundDuration: 60, // Default round duration
        createdAt: Date.now()
      };

      // Join the socket room
      socket.join(code);
      
      console.log('Created room:', code, 'with host:', trimmedNickname);
      
      if (typeof callback === 'function') {
        callback({ code, sessionId });
      }
      
      // Send initial lobby state
      io.to(code).emit('lobby-update', rooms[code].players);
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

      const trimmedCode = code.trim().toUpperCase();
      const trimmedNickname = nickname.trim();

      if (rooms[trimmedCode]) {
        // Check if nickname is already taken in this room
        const existingPlayer = rooms[trimmedCode].players.find(p => 
          p.nickname.toLowerCase() === trimmedNickname.toLowerCase()
        );
        if (existingPlayer) {
          throw new Error('Nickname is already taken in this room');
        }

        const sessionId = uuidv4();
        const player = {
          id: socket.id,
          nickname: trimmedNickname,
          isReady: false,
          sessionId
        };
        rooms[trimmedCode].players.push(player);
        socket.join(trimmedCode);
        io.to(trimmedCode).emit('lobby-update', rooms[trimmedCode].players);
        if (typeof callback === 'function') {
          callback({ success: true, sessionId });
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

  socket.on('resume-session', ({ sessionId }, callback) => {
    try {
      let playerRestored = false;
      for (const code in rooms) {
        const room = rooms[code];
        const player = room.players.find(p => p.sessionId === sessionId);
        if (player) {
          // Clear any existing disconnect timeout
          if (player.disconnectTimeout) {
            clearTimeout(player.disconnectTimeout);
            delete player.disconnectTimeout;
          }
          
          player.id = socket.id; // Update socket ID
          player.disconnected = false; // Mark as reconnected
          socket.join(code);
          
          console.log(`Session resumed: ${player.nickname} in room ${code}`);
          io.to(code).emit('lobby-update', room.players);
          
          if (typeof callback === 'function') {
            callback({ success: true, roomCode: code, nickname: player.nickname });
          }
          playerRestored = true;
          break;
        }
      }
      if (!playerRestored && typeof callback === 'function') {
        callback({ success: false, error: 'Session not found or expired' });
      }
    } catch (error) {
      console.error('Error in resume-session:', error);
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Failed to resume session' });
      }
    }
  });

  socket.on('toggle-ready', (code) => {
    if (rooms[code]) {
      const player = rooms[code].players.find(p => p.id === socket.id);
      if (player && player.id !== rooms[code].host) { // host is always ready
        player.isReady = !player.isReady;
        io.to(code).emit('lobby-update', rooms[code].players);
      }
    }
  });
  socket.on('start-round', ({ code, duration }) => {
    try {
      // Validate room code
      const codeValidationError = validateRoomCode(code);
      if (codeValidationError) {
        console.error('Invalid room code in start-round:', codeValidationError);
        return;
      }

      // Validate duration
      const durationValidationError = validateRoundDuration(duration);
      if (durationValidationError) {
        console.error('Invalid duration in start-round:', durationValidationError);
        return;
      }

      const trimmedCode = code.trim().toUpperCase();

      if (rooms[trimmedCode] && socket.id === rooms[trimmedCode].host) {
        const room = rooms[trimmedCode];
        const { prompt, category } = getRandomPrompt();
        room.prompt = prompt;
        room.category = category;
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

        io.to(trimmedCode).emit('round-start', { prompt, duration, category, endsAt });
        console.log(`Round started in room ${trimmedCode} with duration ${duration}s (endsAt=${endsAt})`);
      } else {
        console.error('Unauthorized start-round attempt or room not found');
      }
    } catch (error) {
      console.error('Error in start-round:', error);
    }
  });

  socket.on('submit-drawing', ({ code, drawing }, callback) => {
    const room = rooms[code];
    if (!room) return typeof callback === 'function' ? callback({ error: 'room_not_found' }) : undefined;
    const now = Date.now();
    // Ignore late submissions
    if (room.endsAt && now > room.endsAt) return typeof callback === 'function' ? callback({ error: 'late_submission' }) : undefined;
    // Only accept from players in the room
    if (!room.players.find(p => p.id === socket.id)) return typeof callback === 'function' ? callback({ error: 'not_in_room' }) : undefined;
    room.drawings[socket.id] = drawing;
    maybeEndRoundEarly(code);
    if (typeof callback === 'function') callback({ ok: true });
  });

  socket.on('chat-message', ({ code, text, nickname, id, time }, callback) => {
    try {
      if (!rooms[code]) {
        return typeof callback === 'function' ? callback({ error: 'room_not_found' }) : undefined; // Room doesn't exist
      }

      // Validate message text
      if (!text || typeof text !== 'string') {
        return typeof callback === 'function' ? callback({ error: 'invalid_message' }) : undefined; // Invalid message
      }

      const trimmedText = text.trim();
      if (!trimmedText || trimmedText.length > 120) {
        return typeof callback === 'function' ? callback({ error: 'invalid_message' }) : undefined; // Empty or too long message
      }

      // Check if sender is actually in the room
      const player = rooms[code].players.find(p => p.id === socket.id);
      if (!player) {
        return typeof callback === 'function' ? callback({ error: 'not_in_room' }) : undefined; // Player not in room
      }

      // Broadcast the chat message to all players in the room
      io.to(code).emit('chat-message', { 
        text: trimmedText, 
        nickname: player.nickname, // Use server-stored nickname for security
        id: socket.id, 
        time: Date.now() // Use server time
      });

      if (typeof callback === 'function') callback({ ok: true });
    } catch (error) {
      console.error('Error in chat-message:', error);
      if (typeof callback === 'function') callback({ error: 'server_error' });
    }
  });

  // Allow clients to explicitly leave a room without disconnecting entirely
  socket.on('leave-room', (code) => {
    try {
      if (!code || typeof code !== 'string') return;
      const trimmedCode = code.trim().toUpperCase();
      const room = rooms[trimmedCode];
      if (!room) return;

      // Remove the player from the room state
      room.players = room.players.filter((p) => p.id !== socket.id);

      // Remove from required participants if a round is active
      if (room.participants && Array.isArray(room.participants)) {
        room.participants = room.participants.filter((id) => id !== socket.id);
        // If everyone remaining has already submitted, end early
        maybeEndRoundEarly(trimmedCode);
      }

      // Make the socket leave the Socket.IO room so it no longer receives events
      socket.leave(trimmedCode);

      // Handle host leaving or room cleanup
      if (socket.id === room.host) {
        io.to(trimmedCode).emit('host-left');
        delete rooms[trimmedCode];
      } else if (room.players.length > 0) {
        io.to(trimmedCode).emit('lobby-update', room.players);
      } else {
        delete rooms[trimmedCode];
      }
    } catch (error) {
      console.error('Error in leave-room:', error);
    }
  });

  socket.on('disconnecting', () => {
    for (const code of socket.rooms) {
      if (rooms[code]) {
        const room = rooms[code];
        const player = room.players.find(p => p.id === socket.id);
        if (player) {
          player.disconnected = true;
          console.log(`Player ${player.nickname} disconnected from room ${code}, starting 30s grace period`);
          
          // Set a timeout to remove the player if they don't reconnect
          player.disconnectTimeout = setTimeout(() => {
            if (player.disconnected) {
              console.log(`Removing ${player.nickname} from room ${code} after grace period`);
              room.players = room.players.filter(p => p.sessionId !== player.sessionId);
              
              // Handle host leaving or empty room cleanup
              if (player.id === room.host) {
                io.to(code).emit('host-left');
                delete rooms[code];
              } else if (room.players.length > 0) {
                io.to(code).emit('lobby-update', room.players);
              } else {
                delete rooms[code];
              }
            }
          }, 30000); // 30-second grace period
        }
      }
    }
  });
});

app.get('/', (req, res) => {
  res.send('Timed Doodle Challenge backend running.');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
