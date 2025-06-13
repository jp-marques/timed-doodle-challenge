# Timed Doodle Challenge

A real-time multiplayer drawing game where users join rooms, draw based on prompts within a time limit, and share their artwork with other players. Built with React (Vite) frontend and Node.js/Express/Socket.IO backend.

## Features

### Current Features
- **Room System**: Host or join rooms with 5-character codes
- **Multiplayer Support**: Multiple players per room with real-time updates
- **Drawing Canvas**: 
  - Responsive canvas that adapts to screen size (16:9 aspect ratio, max 1200px width)
  - Color picker with hex color selection
  - Adjustable brush size (2-40px) with live preview
  - Clear canvas functionality
  - Touch/pointer support for mobile devices
- **Game Flow**:
  - Lobby system with ready/not ready status
  - 60-second drawing timer
  - Categorized prompts (animals, objects, nature, food, vehicles, fantasy, buildings, sports)
  - Category icons for visual feedback
- **Results Gallery**: 
  - View all submitted drawings after each round
  - Paginated gallery (9 drawings per page)
  - Player attribution for each drawing
- **Real-time Chat**: 
  - In-game chat during drawing phase
  - Message history with player identification
  - Chat input with 120 character limit
- **User Interface**:
  - Modern gradient backgrounds and styling
  - Responsive design for different screen sizes
  - Three-column layout during drawing (tools, canvas, chat)
  - Smooth animations and transitions
  - Loading states and error handling

### Architecture
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.IO
- **Real-time Communication**: WebSocket connections via Socket.IO
- **Canvas**: HTML5 Canvas API with pointer events
- **Styling**: CSS-in-JS with Tailwind utility classes

## Project Structure

```
TimedDoodle/
├── public/                 # Static assets
├── src/
│   ├── App.tsx            # Main application component
│   ├── App.css            # Global styles and animations
│   └── main.tsx           # Application entry point
├── server/                # Backend server (separate folder)
├── package.json           # Frontend dependencies
└── README.md             # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
Navigate to the `/server` folder and follow the backend setup instructions.

## Key Components

### App.tsx
Main application component handling:
- Socket.IO connection management
- Game state management (menu, lobby, drawing, results)
- Room creation and joining
- Drawing submission and canvas management
- Chat functionality
- Player management

### DrawingCanvas Component
Encapsulates all drawing functionality:
- Canvas drawing logic with pointer events
- Drawing tools (color picker, brush size)
- Timer and prompt display
- Chat interface
- Responsive canvas sizing

### Custom Hooks
- `useAutoSizedCanvas`: Automatically resizes canvas to maintain aspect ratio and sync CSS with bitmap dimensions

## Game Flow

1. **Menu**: Enter nickname and choose to host or join
2. **Host/Join**: Create room or enter room code
3. **Lobby**: Wait for players, set ready status
4. **Drawing**: 60-second timed drawing based on categorized prompt
5. **Results**: View all submitted drawings in gallery format
6. **Repeat**: Host can start new rounds

## Socket.IO Events

### Client → Server
- `host-room`: Create new room
- `join-room`: Join existing room
- `toggle-ready`: Toggle player ready status
- `start-round`: Start new drawing round (host only)
- `submit-drawing`: Submit canvas drawing as base64
- `chat-message`: Send chat message

### Server → Client
- `lobby-update`: Player list updates
- `round-start`: New round with prompt and timer
- `round-end`: Round finished with all drawings
- `host-left`: Host disconnected
- `chat-message`: Broadcast chat message

## TODO

### High Priority
- [ ] **Implement game chat backend**: Make chats unique to rooms and rounds, with proper message persistence and room isolation
- [ ] **Nickname character limit**: Implement proper validation and length restrictions for player nicknames
- [ ] **Improve UI**: Polish the user interface with better spacing, typography, and visual hierarchy

### Medium Priority
- [ ] **Add bucket fill feature**: Implement flood fill tool for easier coloring of large areas
- [ ] **Improve brush color picker**: Reduce color options to a curated palette instead of full hex picker
- [ ] **Improve drawing tools section**: Better organization and additional tools (eraser, different brush types)

### Low Priority
- [ ] Add undo/redo functionality
- [ ] Implement drawing layers
- [ ] Add more prompt categories
- [ ] Save drawing history
- [ ] Add spectator mode
- [ ] Implement voting system for drawings
- [ ] Add sound effects and animations
- [ ] Mobile-specific UI improvements
- [ ] Add drawing time extensions
- [ ] Implement room passwords

---

## Development Notes

This project evolved from a simple MVP to a full-featured multiplayer drawing game. The architecture emphasizes real-time communication and responsive design while maintaining clean, maintainable code structure.

The canvas implementation uses pointer events for cross-platform compatibility and includes automatic scaling to handle different screen sizes while maintaining drawing accuracy.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
