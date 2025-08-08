import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import './App.css';
import { io, Socket } from 'socket.io-client';
import config from './config';

/* ─────────────────────────────────────────────────── */
/*                     Types                           */
/* ─────────────────────────────────────────────────── */
type Player = {
  id: string;
  nickname: string;
  isReady?: boolean;
};

// Add chat message type
type ChatMessage = {
  id: string; // player id
  nickname: string;
  text: string;
  time: number;
  isSystem?: boolean; // For system messages like round start
};

/* ─────────────────────────────────────────────────── */
/*    Hook: keep the canvas bitmap in sync with CSS    */
/* ─────────────────────────────────────────────────── */
const useAutoSizedCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement>
) => {
  useLayoutEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const MAX_W = 1350;
      const parent = canvas.parentElement;
      const available = parent ? parent.clientWidth : window.innerWidth;
      const width = Math.min(available, MAX_W);

      const height = Math.round(width * 9 / 16);

      // CSS size: let it fill the column; exact pixels on the bitmap
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width);
      canvas.height = height;
    };

    resize();                    // first run
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [canvasRef]);
};

/* ─────────────────────────────────────────────────── */
/* DrawingCanvas: encapsulates drawing logic & UI      */
/* ─────────────────────────────────────────────────── */
type DrawingCanvasProps = {
  color: string;
  brushSize: number;
  selectedTool: 'brush' | 'bucket';
  onChangeColor: (color: string) => void;
  onChangeBrushSize: (size: number) => void;
  onChangeTool: (tool: 'brush' | 'bucket') => void;
  onClear: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitted: boolean;
  timer: number;
  prompt: string;
  category: string | null;
  getCategoryIcon: (cat: string) => string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onQuit: () => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: () => void;
  myId?: string;
};

function DrawingCanvas({
  color,
  brushSize,
  selectedTool,
  onChangeColor,
  onChangeBrushSize,
  onChangeTool,
  onClear,
  onSubmit,
  canSubmit,
  submitted,
  timer,
  prompt,
  category,
  getCategoryIcon,
  canvasRef,
  onQuit,
  chatMessages,
  chatInput,
  setChatInput,
  handleSendChat,
  myId,
}: DrawingCanvasProps) {
  // Drawing logic
  const isDrawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Canvas history for undo functionality
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const MAX_HISTORY = 20; // Limit history to prevent memory issues

  // Responsive canvas sizing
  useAutoSizedCanvas(canvasRef);

  // Save canvas state to history
  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL();
    setCanvasHistory(prev => {
      const newHistory = [...prev, dataUrl];
      // Keep only the last MAX_HISTORY states
      return newHistory.slice(-MAX_HISTORY);
    });
  };

  // Clear history when canvas is cleared
  const handleClearWithHistory = () => {
    setCanvasHistory([]);
    onClear();
  };

  // Undo functionality
  const handleUndo = () => {
    if (canvasHistory.length === 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the last state from history
    const lastState = canvasHistory[canvasHistory.length - 1];
    
    // Remove the last state from history
    setCanvasHistory(prev => prev.slice(0, -1));
    
    // Restore the canvas to the previous state
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = lastState;
  };

  // Drawing handlers
  const hasMoved = useRef(false);
  
  const getScale = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 1, sy: 1 };
    const rect = canvas.getBoundingClientRect();
    return { sx: canvas.width / rect.width, sy: canvas.height / rect.height };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = getScale();
    const x = Math.floor((e.clientX - rect.left) * sx);
    const y = Math.floor((e.clientY - rect.top) * sy);
    
    if (selectedTool === 'bucket') {
      // Save state before bucket fill
      saveCanvasState();
      // Handle bucket tool
      floodFill(x, y, color);
    } else {
      // Save state before starting to draw
      saveCanvasState();
      // Handle brush tool
      isDrawing.current = true;
      hasMoved.current = false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      last.current = { x, y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || selectedTool !== 'brush') return;
    const canvas = canvasRef.current;
    if (!canvas || !last.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = getScale();
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    
    hasMoved.current = true;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    last.current = { x, y };
  };

  const handlePointerUp = () => {
    // If we didn't move (just a click), draw a dot
    if (isDrawing.current && !hasMoved.current && selectedTool === 'brush' && last.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = color;
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(last.current.x, last.current.y, brushSize / 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }
    
    isDrawing.current = false;
    last.current = null;
    hasMoved.current = false;
  };

  // Flood fill algorithm for bucket tool
  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Convert hex color to RGB
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    };

    const fillRgb = hexToRgb(fillColor);
    if (!fillRgb) return;

    const startPos = (startY * canvas.width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // Color matching with tolerance to handle anti-aliasing
    const TOLERANCE = 32; // Adjustable tolerance value (0-255)
    
    const colorMatches = (r: number, g: number, b: number, a: number) => {
      // Handle transparent pixels - don't fill them unless we started on transparency
      if (startA === 0 && a === 0) return true;
      if (startA === 0 && a > 0) return false;
      if (startA > 0 && a === 0) return false;
      
      // For opaque pixels, use color distance with tolerance
      const deltaR = Math.abs(r - startR);
      const deltaG = Math.abs(g - startG);
      const deltaB = Math.abs(b - startB);
      const deltaA = Math.abs(a - startA);
      
      // Use Euclidean distance for better color matching
      const colorDistance = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
      
      return colorDistance <= TOLERANCE && deltaA <= TOLERANCE;
    };

    // If the target color is very similar to fill color, no need to fill
    if (colorMatches(fillRgb.r, fillRgb.g, fillRgb.b, 255)) {
      return;
    }

    const pixelStack = [[startX, startY]];
    const visited = new Set<string>();

    while (pixelStack.length > 0) {
      const [x, y] = pixelStack.pop()!;
      
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const pos = (y * canvas.width + x) * 4;
      
      // Check if this pixel matches the original color using tolerance
      if (colorMatches(data[pos], data[pos + 1], data[pos + 2], data[pos + 3])) {
        
        // Fill this pixel
        data[pos] = fillRgb.r;
        data[pos + 1] = fillRgb.g;
        data[pos + 2] = fillRgb.b;
        data[pos + 3] = 255; // alpha

        // Add adjacent pixels to stack
        pixelStack.push([x + 1, y]);
        pixelStack.push([x - 1, y]);
        pixelStack.push([x, y + 1]);
        pixelStack.push([x, y - 1]);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Chat scroll ref
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="dc-root panel">
      {/* Header */}
      <div className="row center section narrow" style={{ gap: 12 }}>
        {category && <div>{getCategoryIcon(category)}</div>}
        <div>Draw: <strong>{prompt}</strong></div>
        <div className="muted">⏰ {timer}s</div>
      </div>

      {/* Three-column workspace */}
      <div className="section wide draw-grid" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Tools column */}
        <div className="tools">
          <div className="row">
            <button className={`btn ${selectedTool === 'brush' ? 'primary' : ''}`} onClick={() => onChangeTool('brush')}>🖌️ Brush</button>
            <button className={`btn ${selectedTool === 'bucket' ? 'primary' : ''}`} onClick={() => onChangeTool('bucket')}>🪣 Bucket</button>
          </div>
          <div className="label">Color</div>
          <input className="input" type="color" value={color} onChange={(e) => onChangeColor(e.target.value)} />
          {selectedTool === 'brush' && (
            <div>
              <div className="label">Brush size: {brushSize}px</div>
              <input className="range" type="range" min={2} max={40} value={brushSize} onChange={(e) => onChangeBrushSize(Number(e.target.value))} />
            </div>
          )}
          <button className="btn" onClick={handleClearWithHistory}>Clear</button>
          <button className="btn" onClick={handleUndo} disabled={canvasHistory.length === 0}>Undo</button>
          <button className="btn danger" onClick={onQuit}>Quit</button>
        </div>

        {/* Canvas column */}
        <div className="canvas-col">
          <canvas
            ref={canvasRef}
            className={`canvas ${selectedTool === 'brush' ? 'cursor-brush' : 'cursor-bucket'}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            tabIndex={0}
          />
          <div className="row center">
            <button className="btn primary" onClick={onSubmit} disabled={!canSubmit}>
              {submitted ? 'Submitted' : 'Submit Drawing'}
            </button>
          </div>
        </div>

        {/* Chat column */}
        <div className="chat-col">
          <div className="label">Chat</div>
          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="muted" style={{ textAlign: 'center' }}>No messages yet</div>
            )}
            {chatMessages.map((msg, i) => (
              msg.isSystem ? (
                <div key={i} className="muted" style={{ textAlign: 'center' }}>{msg.text}</div>
              ) : (
                <div key={i} className={`chat-msg ${msg.id === myId ? 'me' : ''}`}>
                  <div className="chat-name">{msg.nickname}</div>
                  <div className="chat-bubble">{msg.text}</div>
                </div>
              )
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); handleSendChat(); }}>
            <input
              className="input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={120}
              disabled={!myId}
              autoComplete="off"
            />
            <button type="submit" className="btn primary" disabled={!chatInput.trim() || !myId}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────── */
/*                    Component                       */
/* ─────────────────────────────────────────────────── */
function App() {
  /* --------------- Global / lobby state --------------- */
  const [view, setView] = useState<
    'menu' | 'nickname' | 'host' | 'join' | 'lobby' | 'draw' | 'results'
  >('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [prompt, setPrompt] = useState('');
  const [timer, setTimer] = useState(60);
  const [roundDuration, setRoundDuration] = useState(60); // Round duration setting for hosts
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [isHost, setIsHost] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* --------------- Canvas / drawing state ------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;
  const [myDrawing, setMyDrawing] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState('#2563eb');
  const [brushSize, setBrushSize] = useState(8);
  const [selectedTool, setSelectedTool] = useState<'brush' | 'bucket'>('brush');
  // const isDrawingRef = useRef(false);
  // const lastPoint = useRef<{ x: number; y: number } | null>(null);

  /* --------------- Socket ----------------------------- */
  const socketRef = useRef<Socket | null>(null);

  /* --------------- Chat state ------------------------- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  /* --------------- Helpers ---------------------------- */
  // const getScale = () => {
  //   const canvas = canvasRef.current;
  //   if (!canvas) return { sx: 1, sy: 1 };
  //   const rect = canvas.getBoundingClientRect();
  //   return { sx: canvas.width / rect.width, sy: canvas.height / rect.height };
  // };

  /* --------------- Navigation ------------------------- */
  const handleBack = () => {
    setView('menu');
    setRoomCode('');
    setInputCode('');
    setPrompt('');
    setTimer(60);
    setRoundDuration(60);
    setDrawings({});
    setMyDrawing(null);
    setPlayers([]);
    setIsHost(false);
    setChatMessages([]); // Clear chat messages when leaving room
  };

  /* --------------- Socket initialisation -------------- */
  useEffect(() => {
    try {
      socketRef.current = io(config.socketUrl, {
        transports: ['websocket', 'polling'],
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 10000,
        forceNew: true,
        autoConnect: false,
      });

      const socket = socketRef.current;
      console.log('Connecting to server...');
      socket.connect();

      socket.on('connect', () => {
        console.log('Successfully connected to server');
      });

      socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        alert('Unable to connect to game server. Please try again later.');
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      return () => {
        socket.disconnect();
      };
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      alert('Failed to initialize game connection');
    }
  }, []);

  /* --------------- Socket event listeners ------------- */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onLobbyUpdate(updatedPlayers: Player[]) {
      setPlayers(updatedPlayers);
    }

    function onRoundStart({
      prompt,
      duration,
      category,
    }: {
      prompt: string;
      duration: number;
      category?: string;
    }) {
      setPrompt(prompt);
      setCategory(category || null);
      setTimer(duration);
      setMyDrawing(null);
      setView('draw');
      
      // Add system message with the prompt
      const systemMessage: ChatMessage = {
        id: 'system',
        nickname: 'System',
        text: `New round started! Draw: ${prompt}`,
        time: Date.now(),
        isSystem: true,
      };
      setChatMessages((prev) => [...prev, systemMessage]);
      
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }

    function onRoundEnd({ drawings }: { drawings: Record<string, string> }) {
      setDrawings(drawings);
      setView('results');
    }

    function onHostLeft() {
      alert('Host has left the game');
      handleBack();
    }

    function onChatMessage(msg: ChatMessage) {
      setChatMessages((prev) => [...prev.slice(-49), msg]); // keep last 50
    }

    socket.on('lobby-update', onLobbyUpdate);
    socket.on('round-start', onRoundStart);
    socket.on('round-end', onRoundEnd);
    socket.on('host-left', onHostLeft);
    socket.on('chat-message', onChatMessage);

    return () => {
      socket.off('lobby-update', onLobbyUpdate);
      socket.off('round-start', onRoundStart);
      socket.off('round-end', onRoundEnd);
      socket.off('host-left', onHostLeft);
      socket.off('chat-message', onChatMessage);
    };
  }, [handleBack]);

  /* --------------- Timer effect ----------------------- */
  useEffect(() => {
    let interval: number;
    if (view === 'draw' && timer > 0) {
      interval = window.setInterval(() => {
        setTimer((t) => {
          const newTime = t - 1;
          if (newTime <= 0) handleSubmitDrawing();
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [view, timer]);

  /* --------------- Validation helpers ---------------- */
  const validateNickname = (nickname: string): string | null => {
    const trimmed = nickname.trim();
    
    if (!trimmed) {
      return 'Please enter your nickname';
    }
    
    if (trimmed.length < 2) {
      return 'Nickname must be at least 2 characters';
    }
    
    if (trimmed.length > 15) {
      return 'Nickname must be 15 characters or less';
    }
    
    // Check for only whitespace/special characters
    if (!/^[a-zA-Z0-9\s._-]+$/.test(trimmed)) {
      return 'Nickname can only contain letters, numbers, spaces, dots, hyphens, and underscores';
    }
    
    // Check for excessive whitespace
    if (trimmed !== trimmed.replace(/\s+/g, ' ')) {
      return 'Please avoid excessive spaces in your nickname';
    }
    
    return null; // Valid nickname
  };

  const validateRoundDuration = (duration: number): string | null => {
    if (!Number.isInteger(duration)) {
      return 'Duration must be a whole number';
    }
    
    if (duration < 15) {
      return 'Duration must be at least 15 seconds';
    }
    
    if (duration > 300) {
      return 'Duration cannot exceed 5 minutes (300 seconds)';
    }
    
    return null; // Valid duration
  };

  const handleRoundDurationChange = (newDuration: number) => {
    const error = validateRoundDuration(newDuration);
    if (!error) {
      setRoundDuration(newDuration);
    }
  };

  /* --------------- Room helpers ---------------------- */
  const handleStartPlaying = () => {
    const error = validateNickname(nickname);
    if (error) {
      setNicknameError(error);
      return;
    }
    setNicknameError('');
    setView('host');
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    
    // Clear error immediately if user starts typing valid input
    if (nicknameError && value.trim().length >= 2) {
      setNicknameError('');
    }
  };

  const handleHostRoom = () => {
    const error = validateNickname(nickname);
    if (error) {
      setNicknameError(error);
      return;
    }
    setNicknameError('');
    const socket = socketRef.current;
    if (!socket || !nickname) {
      alert('Please enter a nickname first');
      return;
    }
    if (!socket.connected) {
      alert('Not connected to server. Please try again.');
      return;
    }
    setLoading(true);
    socket.emit('host-room', { nickname: nickname.trim() }, (response: { code?: string; error?: string }) => {
      setLoading(false);
      if (response.error || !response.code) {
        setNicknameError(response.error || 'Failed to create room');
        return;
      }
      setRoomCode(response.code);
      setIsHost(true);
      setChatMessages([]); // Clear chat messages when joining new room
      setView('lobby');
    });
  };

  const handleJoinRoom = () => {
    setJoinError('');
    if (!inputCode.trim()) {
      setJoinError('Please enter a room code');
      return;
    }
    
    // Validate nickname before joining
    const nicknameError = validateNickname(nickname);
    if (nicknameError) {
      setJoinError(nicknameError);
      return;
    }
    
    const socket = socketRef.current;
    if (!socket || !nickname || !inputCode) return;
    setLoading(true);
    socket.emit(
      'join-room',
      { code: inputCode.trim().toUpperCase(), nickname: nickname.trim() },
      (res: { success: boolean; error?: string }) => {
        setLoading(false);
        if (res.success) {
          setRoomCode(inputCode);
          setIsHost(false);
          setChatMessages([]); // Clear chat messages when joining new room
          setView('lobby');
        } else {
          setJoinError(res.error || 'Failed to join room');
        }
      }
    );
  };

  const handleToggleReady = () => {
    socketRef.current?.emit('toggle-ready', roomCode);
  };

  const handleStartRound = () => {
    if (isHost) socketRef.current?.emit('start-round', { code: roomCode, duration: roundDuration });
  };

  // /* --------------- Drawing handlers (patched) --------- */
  // const handlePointerDown = (e: React.PointerEvent) => {
  //   isDrawingRef.current = true;
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;
  //   const ctx = canvas.getContext('2d');
  //   if (!ctx) return;

  //   const rect = canvas.getBoundingClientRect();
  //   const { sx, sy } = getScale();
  //   const x = (e.clientX - rect.left) * sx;
  //   const y = (e.clientY - rect.top) * sy;

  //   ctx.beginPath();
  //   ctx.moveTo(x, y);
  //   lastPoint.current = { x, y };
  // };

  // const handlePointerMove = (e: React.PointerEvent) => {
  //   if (!isDrawingRef.current) return;
  //   const canvas = canvasRef.current;
  //   if (!canvas || !lastPoint.current) return;
  //   const ctx = canvas.getContext('2d');
  //   if (!ctx) return;

  //   const rect = canvas.getBoundingClientRect();
  //   const { sx, sy } = getScale();
  //   const x = (e.clientX - rect.left) * sx;
  //   const y = (e.clientY - rect.top) * sy;

  //   ctx.strokeStyle = brushColor;
  //   ctx.lineWidth = brushSize;
  //   ctx.lineCap = 'round';
  //   ctx.lineJoin = 'round';
  //   ctx.beginPath();
  //   ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
  //   ctx.lineTo(x, y);
  //   ctx.stroke();
  //   lastPoint.current = { x, y };
  // };

  // const handlePointerUp = () => {
  //   isDrawingRef.current = false;
  //   lastPoint.current = null;
  // };

  const handleClearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setMyDrawing(null);
  };

  const handleSubmitDrawing = () => {
    if (!canvasRef.current || !socketRef.current || !roomCode) return;
    const dataUrl = canvasRef.current.toDataURL();
    setMyDrawing(dataUrl);
    socketRef.current.emit('submit-drawing', { code: roomCode, drawing: dataUrl });
  };

  /* --------------- Canvas autoresize hook ------------- */
  useAutoSizedCanvas(canvasRef);  // ← activate

  /* --------------- Utility ---------------------------- */
  function getCategoryIcon(category: string) {
    switch (category) {
      case 'animals':
        return '🐾';
      case 'objects':
        return '📦';
      case 'nature':
        return '🌳';
      case 'food':
        return '🍕';
      case 'vehicles':
        return '🚗';
      case 'fantasy':
        return '🧙';
      case 'buildings':
        return '🏠';
      case 'sports':
        return '🏀';
      default:
        return '🎨';
    }
  }

  /* --------------- Error state ------------------------- */
  const [nicknameError, setNicknameError] = useState('');
  const [joinError, setJoinError] = useState('');

  /* --------------- Modal state ------------------------- */
  const [focusedDrawing, setFocusedDrawing] = useState<null | { id: string; url: string }> (null);

  /* --------------- Modal effect ------------------------- */
  useEffect(() => {
    if (!focusedDrawing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusedDrawing(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [focusedDrawing]);

  /* --------------- Send chat message --------------------- */
  const handleSendChat = () => {
    if (!chatInput.trim() || !socketRef.current || !roomCode) return;
    socketRef.current.emit('chat-message', {
      code: roomCode,
      text: chatInput,
      nickname,
      id: socketRef.current.id,
      time: Date.now(),
    });
    setChatInput('');
  };

  /* --------------- Render ----------------------------- */
  return (
    <div className="page">
      {/* MENU */}
      {view === 'menu' && (
        <div className="panel small" style={{ textAlign: 'center' }}>
          <h1>Timed Doodle</h1>
          <div style={{ marginBottom: 8 }} className="label">Nickname</div>
          <input className="input" placeholder="Enter your nickname" value={nickname} onChange={handleNicknameChange} maxLength={15} />
          {nicknameError && <div className="error">{nicknameError}</div>}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button className="btn primary" onClick={handleStartPlaying}>Continue</button>
          </div>
          {/* How to play with friends */}
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <h3 style={{ margin: '12px 0 8px' }}>How to play with friends</h3>
            <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              <li>Click Continue, then choose Create Room or Join Room.</li>
              <li>If hosting, share the 5-letter room code with your friends.</li>
              <li>Friends join using the code and set their nicknames.</li>
              <li>Everyone clicks I'm ready; the host starts the round.</li>
              <li>Draw the prompt before the timer runs out.</li>
              <li>View the results together and start the next round!</li>
            </ol>
          </div>
        </div>
      )}

      {/* HOST SCREEN */}
      {view === 'host' && (
        <div className="panel small" style={{ textAlign: 'center' }}>
          <h2>Welcome, {nickname}!</h2>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={handleHostRoom}>Create Room</button>
            <button className="btn" onClick={() => setView('join')}>Join Room</button>
            <button className="btn secondary" onClick={() => setView('menu')}>Back</button>
          </div>
        </div>
      )}

      {/* JOIN SCREEN */}
      {view === 'join' && (
        <div className="panel small" style={{ textAlign: 'center' }}>
          <h2>Join Room</h2>
          <div className="muted">Playing as: <b>{nickname}</b></div>
          <div className="label" style={{ marginBottom: 8 }}>Room code</div>
          <input className="input" placeholder="ABCDE" value={inputCode} onChange={(e) => { setInputCode(e.target.value.toUpperCase()); setJoinError(''); }} maxLength={5} />
          {joinError && <div className="error">{joinError}</div>}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={handleJoinRoom}>Join</button>
            <button className="btn secondary" onClick={() => setView('host')}>Back</button>
          </div>
        </div>
      )}

      {/* LOBBY */}
      {view === 'lobby' && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2>Lobby</h2>
          <div>Room code: <code>{roomCode}</code></div>
          <div className="list" style={{ marginTop: 12 }}>
            {players.map((p) => (
              <div key={p.id} className="list-item row between">
                <div>{p.nickname}{p.id === socketRef.current?.id ? ' (you)' : ''}</div>
                <div className={p.isReady ? 'tag ready' : 'tag'}>{p.isReady ? 'Ready' : 'Waiting'}</div>
              </div>
            ))}
          </div>
          {isHost ? (
            <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 8 }}>
              <div className="label">Round duration (s)</div>
              <input style={{ maxWidth: 120 }} className="input" type="number" min={15} max={300} step={15} value={roundDuration} onChange={(e) => handleRoundDurationChange(parseInt(e.target.value))} />
              <button className="btn primary" onClick={handleStartRound} disabled={!players.every((p) => p.isReady)}>Start</button>
            </div>
          ) : (
            <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn primary" onClick={handleToggleReady}>{players.find((p) => p.id === socketRef.current?.id)?.isReady ? 'Unready' : 'I\'m ready'}</button>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn danger" onClick={handleBack}>Quit</button>
          </div>
        </div>
      )}

      {/* DRAWING */}
      {view === 'draw' && (
        <DrawingCanvas
          color={brushColor}
          brushSize={brushSize}
          selectedTool={selectedTool}
          onChangeColor={setBrushColor}
          onChangeBrushSize={setBrushSize}
          onChangeTool={setSelectedTool}
          onClear={handleClearCanvas}
          onSubmit={handleSubmitDrawing}
          canSubmit={!myDrawing && timer > 0}
          submitted={!!myDrawing}
          timer={timer}
          prompt={prompt}
          category={category}
          getCategoryIcon={getCategoryIcon}
          canvasRef={canvasRef}
          onQuit={handleBack}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleSendChat={handleSendChat}
          myId={socketRef.current?.id}
        />
      )}

      {/* RESULTS */}
      {view === 'results' && (
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2>Results</h2>
          <div className="muted">Prompt: <b>{prompt}</b></div>
          <ResultsGrid drawings={drawings} players={players} />
          {isHost && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button className="btn primary" onClick={handleStartRound}>Start Next Round</button>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button className="btn danger" onClick={handleBack}>Quit</button>
          </div>
        </div>
      )}

      {loading && <div className="overlay">Loading…</div>}
    </div>
  );
}

// (room code copy row removed in minimal UI)

function ResultsGrid({ drawings, players }: { drawings: Record<string, string>, players: Player[] }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;
  const entries = Object.entries(drawings);
  const pagedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  return (
    <>
      <div className="results-grid" style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {pagedEntries.map(([id, url], idx) => {
          const player = players.find(p => p.id === id);
          return (
            <div
              key={id}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 380 }}
            >
              <img
                src={url}
                alt="drawing"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  marginBottom: '8px',
                  border: '1px solid var(--line)'
                }}
              />
              <div className="text-center mt-2">
                <span style={{ fontWeight: 600 }}>
                  {player?.nickname || `Player ${idx + 1 + page * PAGE_SIZE}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', margin: '18px 0 0 0' }}>
          <button
            className="game-btn"
            style={{ minWidth: 80 }}
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontWeight: 600, color: '#2563eb' }}>
            Page {page + 1} / {totalPages}
          </span>
          <button
            className="game-btn"
            style={{ minWidth: 80 }}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}

export default App;