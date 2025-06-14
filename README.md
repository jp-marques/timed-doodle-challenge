# Timed Doodle Challenge 🎨

A real-time multiplayer drawing game where players join rooms, draw based on prompts within a time limit, and share their artwork with others. Features a modern React frontend with TypeScript and a robust Node.js backend with Socket.IO for real-time communication.

## ✨ Features

### 🎮 Core Gameplay
- **Room System**: Host or join rooms with unique 5-character codes
- **Multiplayer Support**: Real-time synchronization for multiple players
- **Timed Drawing**: 60-second rounds with categorized prompts
- **Results Gallery**: View all submitted drawings with player attribution
- **Continuous Play**: Host can start multiple rounds seamlessly

### 🎨 Drawing Tools
- **Responsive Canvas**: Adaptive 16:9 aspect ratio (max 1200px width)
- **Advanced Color Picker**: Hex color selection with popular color shortcuts
- **Brush Controls**: Adjustable size (2-40px) with live preview
- **Clear Canvas**: Quick reset functionality

### 💬 Social Features
- **Real-time Chat**: Room-based messaging during games
- **Player Management**: Ready/not ready status system
- **Nickname Validation**: Secure player identification (2-15 characters)
- **Connection Handling**: Graceful disconnect and reconnection

### 🎯 Prompt System
8 diverse categories with 200+ prompts:
- 🐾 Animals
- 📦 Objects  
- 🌳 Nature
- 🍎 Food
- 🚗 Vehicles
- 🦄 Fantasy
- 🏢 Buildings
- ⚽️ Sports

### 🎨 UI/UX
- **Modern Design**: Gradient backgrounds and smooth animations
- **Responsive Layout**: Optimized for desktop (mobile soon)
- **Three-Column Interface**: Tools, canvas, and chat during gameplay
- **Loading States**: Comprehensive error handling and feedback
- **Accessibility**: Keyboard and screen reader friendly

## 🏗️ Architecture

### Frontend Stack
- **React 19** + **TypeScript** + **Vite** - Modern development experience
- **Tailwind CSS 4** - Utility-first styling with custom components
- **Socket.IO Client** - Real-time WebSocket communication
- **React Colorful** - Advanced color picker component

### Backend Stack
- **Node.js** + **Express** - RESTful API and static serving
- **Socket.IO** - WebSocket server for real-time features
- **CORS** - Cross-origin resource sharing configuration

### Real-time Features
- **WebSocket Communication**: Instant updates for all game events
- **Room Management**: Isolated game sessions with player tracking
- **State Synchronization**: Consistent game state across all clients
- **Error Handling**: Graceful fallbacks and reconnection logic

## 📁 Project Structure

```
TimedDoodle/
├── public/                 # Static assets and favicon
├── src/
│   ├── App.tsx            # Main application component (1,787 lines)
│   ├── App.css            # Global styles and animations (1,092 lines)
│   ├── index.css          # Base Tailwind imports
│   ├── main.tsx           # Application entry point
│   └── assets/            # Images and icons
├── server/                # Backend application
│   ├── index.js           # Express + Socket.IO server (275 lines)
│   ├── prompts.js         # Categorized drawing prompts
│   └── package.json       # Server dependencies
├── package.json           # Frontend dependencies
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # Tailwind customization
└── tsconfig.*.json        # TypeScript configurations
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (LTS recommended)
- **npm** or **yarn** package manager

### 1. Clone and Install
```bash
git clone <repository-url>
cd TimedDoodle

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Development Setup
```bash
# Terminal 1: Start the backend server
cd server
npm start
# Server runs on http://localhost:3001

# Terminal 2: Start the frontend development server
npm run dev
# Frontend runs on http://localhost:5173
```

### 3. Production Build
```bash
# Build optimized frontend
npm run build

# Preview production build
npm run preview

# Deploy server (Node.js hosting required)
cd server
npm start
```

## 🎮 How to Play

1. **Start**: Enter your nickname (2-15 characters, alphanumeric + spaces/.-_)
2. **Create/Join**: Host a new room or join with a 5-character code
3. **Lobby**: Wait for players and set ready status (host is always ready)
4. **Draw**: Create artwork based on the prompt within 60 seconds
5. **Results**: View everyone's drawings in a paginated gallery
6. **Repeat**: Host can start new rounds with different prompts

## 🔧 Development

### Available Scripts

#### Frontend
```bash
npm run dev      # Start development server with HMR
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

#### Backend
```bash
npm start        # Start production server
```

### Socket.IO Events

#### Client → Server
- `host-room` - Create new room with validation
- `join-room` - Join existing room with nickname check
- `toggle-ready` - Toggle player ready status
- `start-round` - Begin new drawing round (host only)
- `submit-drawing` - Submit canvas as base64 image
- `chat-message` - Send room chat message

#### Server → Client
- `lobby-update` - Updated player list and ready states
- `round-start` - New round with prompt and 60s timer
- `round-end` - Round finished with all drawings
- `host-left` - Host disconnected, room closing
- `chat-message` - Broadcast chat message to room

### Key Components

#### App.tsx
Main application state machine handling:
- Socket.IO connection lifecycle
- Game state transitions (menu → lobby → drawing → results)
- Room management and player synchronization
- Drawing canvas integration and submission
- Chat system and message handling

#### Custom Hooks
- `useAutoSizedCanvas` - Maintains canvas aspect ratio and bitmap/CSS sync
- Real-time event listeners for Socket.IO
- Responsive design utilities

## 🔒 Security Features

- **Input Validation**: Comprehensive sanitization for nicknames, room codes, and chat
- **Rate Limiting**: Message throttling and connection limits
- **XSS Prevention**: Text content sanitization
- **CORS Configuration**: Restricted origins for production security
- **Room Isolation**: Players can only interact within their assigned rooms

## 🌐 Deployment

### Frontend (Vercel/Netlify)
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 18+

### Backend (Railway/Heroku/VPS)
- Start command: `npm start`
- Port: `process.env.PORT` or 3001
- CORS origins configured for production domains

### Environment Variables
```bash
# Backend
PORT=3001

# Frontend (build time)
VITE_SERVER_URL=https://your-backend-domain.com
```

## 📋 TODO & Roadmap

### 🔥 High Priority
- [ ] **Mobile UX**: Gesture controls, better touch interface
- [ ] **General Frontend**: Overall frontend fixes since it's not perfect

### 🎯 Medium Priority
- [ ] **Advanced Drawing Tools**: eraser, line/shape tools
- [ ] **Curated Color Palette**: Replace full hex picker with artist-selected colors
- [ ] **Room Settings**: Private rooms, custom time limits, player limits

### 💡 Future Ideas
- [ ] **Voting System**: Rate drawings, awards, leaderboards
- [ ] **Drawing Layers**: Advanced composition tools
- [ ] **Spectator Mode**: Watch games without participating  
- [ ] **Sound Design**: Background music, sound effects
- [ ] **Custom Prompts**: User-generated content, themed prompt packs
- [ ] **Replay System**: Save and share game sessions
- [ ] **AI Integration**: Prompt suggestions, drawing analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **React Team** for the excellent framework and TypeScript integration
- **Socket.IO** for reliable real-time communication
- **Vite** for blazing fast development experience
- **Tailwind CSS** for utility-first styling approach

---

Built with ❤️ for creative expression and multiplayer fun!
