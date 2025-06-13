// Simple Express + Socket.IO server for Timed Doodle Challenge
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

const { getRandomPrompt } = require('./prompts');
const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('host-room', ({ nickname }, callback) => {
    try {
      if (!nickname || typeof nickname !== 'string') {
        throw new Error('Invalid nickname');
      }

      console.log('Host room request from:', nickname);
      
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
      rooms[code] = {
        host: socket.id,
        players: [{
          id: socket.id,
          nickname,
          isReady: true // host is always ready
        }],
        drawings: {},
        prompt: null,
        createdAt: Date.now()
      };

      // Join the socket room
      socket.join(code);
      
      console.log('Created room:', code, 'with host:', nickname);
      
      if (typeof callback === 'function') {
        callback({ code });
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
    if (rooms[code]) {
      const player = {
        id: socket.id,
        nickname,
        isReady: false
      };
      rooms[code].players.push(player);
      socket.join(code);
      io.to(code).emit('lobby-update', rooms[code].players);
      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Room not found' });
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
  socket.on('start-round', (code) => {
    if (rooms[code] && socket.id === rooms[code].host) {
      const { prompt, category } = getRandomPrompt();
      rooms[code].prompt = prompt;
      rooms[code].category = category;
      rooms[code].drawings = {};
      // Reset ready status for next round
      rooms[code].players.forEach(p => {
        if (p.id !== rooms[code].host) p.isReady = false;
      });
      io.to(code).emit('round-start', { prompt, duration: 60 });
    }
  });

  socket.on('submit-drawing', ({ code, drawing }) => {
    if (rooms[code]) {
      rooms[code].drawings[socket.id] = drawing;
      if (Object.keys(rooms[code].drawings).length === rooms[code].players.length) {
        io.to(code).emit('round-end', { drawings: rooms[code].drawings });
      }
    }
  });

  socket.on('disconnecting', () => {
    for (const code of socket.rooms) {
      if (rooms[code]) {
        rooms[code].players = rooms[code].players.filter(p => p.id !== socket.id);
        // If host left, delete the room
        if (socket.id === rooms[code].host) {
          io.to(code).emit('host-left');
          delete rooms[code];
        } else if (rooms[code].players.length > 0) {
          // Update lobby for remaining players
          io.to(code).emit('lobby-update', rooms[code].players);
        } else {
          delete rooms[code];
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
