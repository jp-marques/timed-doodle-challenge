import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,   // ← added
} from 'react';
import './App.css';
import { io, Socket } from 'socket.io-client';
import { HexColorPicker } from 'react-colorful';

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

      /* Fill viewport width but cap on ultra-wide monitors */
      const MAX_W = 1200;
      const MARGIN = 32;
      const width = Math.min(window.innerWidth - MARGIN, MAX_W);

      /* 16 : 9 landscape ratio */
      const height = Math.round(width * 9 / 16);

      /* Sync both CSS size and the internal bitmap */
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = width;
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

  // Responsive canvas sizing
  useAutoSizedCanvas(canvasRef);

  // Drawing handlers
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
      // Handle bucket tool
      floodFill(x, y, color);
    } else {
      // Handle brush tool
      isDrawing.current = true;
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
    isDrawing.current = false;
    last.current = null;
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

    // If the target color is the same as fill color, no need to fill
    if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b) {
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
      
      // Check if this pixel matches the original color
      if (data[pos] === startR && data[pos + 1] === startG && 
          data[pos + 2] === startB && data[pos + 3] === startA) {
        
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
    <div
      className="draw-canvas-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 1800,
        margin: '0 auto',
        background: 'rgba(236,245,255,0.97)',
        borderRadius: '2rem',
        boxShadow: '0 12px 48px #60a5fa33',
        padding: '32px 32px 36px 32px',
      }}
    >
      {/* Main content area with three columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 260px',
          gap: 32,
          alignItems: 'end',
          width: '100%',
          minHeight: '500px',
        }}
      >
        {/* Controls */}
        <div
          className="draw-controls"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            alignItems: 'stretch',
            background: 'none',
            borderRadius: 0,
            padding: 0,
            boxShadow: 'none',
            alignSelf: 'start',
          }}
        >
        <div style={{ marginBottom: 8, fontWeight: 600, color: '#2563eb', fontSize: 17, textAlign: 'center', width: '100%' }}>
          Drawing Tools
        </div>
        
        {/* Tool Selection */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16 }}>
          <label style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginBottom: 8, display: 'block', textAlign: 'center' }}>
            Select Tool
          </label>
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <button
              onClick={() => onChangeTool('brush')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: selectedTool === 'brush' ? 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)' : '#e0e7ef',
                color: selectedTool === 'brush' ? '#fff' : '#2563eb',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              🖌️ Brush
            </button>
            <button
              onClick={() => onChangeTool('bucket')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: selectedTool === 'bucket' ? 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)' : '#e0e7ef',
                color: selectedTool === 'bucket' ? '#fff' : '#2563eb',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              🪣 Bucket
            </button>
          </div>
        </div>

        <div className="color-picker-outer" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginBottom: 4, display: 'block', textAlign: 'center' }}>
            Brush Color
          </label>
          <HexColorPicker color={color} onChange={onChangeColor} />
          <div
            className="color-preview"
            style={{
              background: color,
              width: 32,
              height: 32,
              borderRadius: 8,
              margin: '8px auto 0',
              border: '2px solid #bae6fd',
            }}
          />
        </div>
        {selectedTool === 'brush' && (
          <div className="brush-size-slider-area" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <label style={{ fontSize: 14, color: '#334155', fontWeight: 500, marginBottom: 4, display: 'block', textAlign: 'center' }}>
              Brush Size
            </label>
            <input
              type="range"
              min={2}
              max={40}
              value={brushSize}
              onChange={e => onChangeBrushSize(Number(e.target.value))}
              className="brush-size-slider"
              aria-label="Brush size"
              style={{ width: '100%' }}
            />
            <div
              className="brush-preview-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                justifyContent: 'center',
              }}
            >
              <div
                className="brush-preview-circle"
                style={{
                  width: brushSize,
                  height: brushSize,
                  background: color,
                  borderRadius: '50%',
                  border: '1.5px solid #2563eb33',
                }}
              />
              <span className="brush-size-label" style={{ fontSize: 14, color: '#334155' }}>
                {brushSize}px
              </span>
            </div>
          </div>
        )}
        <button
          className="clear-canvas-btn"
          onClick={onClear}
          type="button"
          style={{
            marginTop: 10,
            padding: '0.5rem 1.2rem',
            borderRadius: 8,
            background: '#e0e7ef',
            color: '#2563eb',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            fontSize: 15,
            transition: 'background 0.15s',
            alignSelf: 'center',
          }}
        >
          Clear Canvas
        </button>
        <div style={{ marginTop: 18, fontSize: 13, color: '#64748b', textAlign: 'center', width: '100%' }}>
          <span>
            {selectedTool === 'brush' 
              ? 'Pick a color and brush size, then draw on the canvas.' 
              : 'Pick a color and click on the canvas to fill areas.'
            }<br />Click "Clear Canvas" to start over.
          </span>
        </div>
        <button
          onClick={onQuit}
          style={{
            width: '100%',
            padding: '0.8rem 2.5rem',
            borderRadius: 10,
            background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.08rem',
            boxShadow: '0 2px 8px #ef444433',
            border: 'none',
            marginTop: '1.2rem',
            cursor: 'pointer',
            transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
            alignSelf: 'center',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 4px 12px #ef444466';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.boxShadow = '0 2px 8px #ef444433';
          }}
        >
          Quit Game
        </button>
      </div>

        {/* Canvas and prompt/timer */}
        <div
          className="canvas-area-outer"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 12,
            width: '100%',
          }}
        >
        <div
          className="draw-header"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {category && (
              <span className="prompt-icon" style={{ fontSize: 22 }}>
                {getCategoryIcon(category)}
              </span>
            )}
            <span style={{ fontWeight: 600, color: '#2563eb' }}>
              {category ? category.charAt(0).toUpperCase() + category.slice(1) : ''}
            </span>
          </div>
          <div className="draw-timer" style={{ fontSize: 18, fontWeight: 700, color: '#0ea5e9' }}>
            ⏰ {timer}s
          </div>
        </div>
        <div
          className="draw-prompt"
          style={{
            width: '100%',
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 8,
            color: '#334155',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          Draw: <b>{prompt}</b>
        </div>
        <canvas
          ref={canvasRef}
          className={`drawing-canvas ${selectedTool === 'brush' ? 'cursor-brush' : 'cursor-bucket'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          tabIndex={0}
          style={{
            background: '#fff',
            borderRadius: 18,
            // border: '2.5px solid #bae6fd',
            width: '100%',
            aspectRatio: '16/9',
            maxWidth: 900,
            minHeight: 350,
            boxShadow: '0 4px 24px #60a5fa22',
            display: 'block',
            touchAction: 'none',
          }}
        />
        <button
          className="submit-drawing-btn"
          onClick={onSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 18,
            fontSize: '1.15rem',
            fontWeight: 700,
            padding: '0.8rem 2.5rem',
            borderRadius: 10,
            background: submitted
              ? 'linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)'
              : 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)',
            color: '#fff',
            boxShadow: '0 2px 8px #60a5fa33',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
            width: '100%',
            maxWidth: 400,
            alignSelf: 'center',
          }}
          onMouseOver={e => {
            if (canSubmit && !submitted) {
              e.currentTarget.style.background = 'linear-gradient(90deg, #0ea5e9 0%, #5b21b6 100%)';
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 4px 12px #60a5fa66';
            }
          }}
          onMouseOut={e => {
            if (canSubmit && !submitted) {
              e.currentTarget.style.background = 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)';
            }
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px #60a5fa33';
          }}
        >
          {submitted ? 'Drawing Submitted!' : 'Submit Drawing'}
        </button>
      </div>
        {/* Chat panel */}
        <div
          className="draw-chat-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'stretch',
            background: 'none',
            borderRadius: 0,
            padding: 0,
            boxShadow: 'none',
            height: '100%',
          }}
        >
        <div style={{ fontWeight: 700, color: '#2563eb', fontSize: 17, textAlign: 'center', marginBottom: 4 }}>
          Game Chat
        </div>
        <div
          className="draw-chat-messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 8,
            padding: '8px 6px',
            marginBottom: 6,
            // border: '1.5px solid #bae6fd',
            boxShadow: '0 4px 24px #60a5fa22',
            fontSize: 15,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {chatMessages.length === 0 && (
            <div style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14, marginTop: 12 }}>
              No messages yet. Say hi!
            </div>
          )}
          {chatMessages.map((msg, i) => (
            msg.isSystem ? (
              // System message styling: green, no bubble, centered
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                marginTop: 8,
                marginBottom: 8,
              }}>
                <span style={{
                  color: '#059669', // Green color
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: 'center',
                  fontStyle: 'italic',
                }}>{msg.text}</span>
              </div>
            ) : (
              // Regular message styling
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.id === myId ? 'flex-end' : 'flex-start',
                gap: 1,
              }}>
                <span style={{
                  fontWeight: 600,
                  color: msg.id === myId ? '#38bdf8' : '#2563eb',
                  fontSize: 13,
                  marginBottom: 1,
                }}>{msg.nickname}</span>
                <span style={{
                  background: msg.id === myId ? 'linear-gradient(90deg, #bae6fd 0%, #38bdf8 100%)' : '#e0e7ef',
                  color: '#334155',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 15,
                  maxWidth: 180,
                  wordBreak: 'break-word',
                  display: 'inline-block',
                }}>{msg.text}</span>
              </div>
            )
          ))}
          <div ref={chatEndRef} />
        </div>
        <div
          style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            gap: 8, 
            alignItems: 'center', 
            width: '100%',
          }}
        >
          <form
            onSubmit={e => { e.preventDefault(); handleSendChat(); }}
            style={{ 
              display: 'flex', 
              flexDirection: 'row', 
              gap: 8, 
              alignItems: 'center', 
              flex: 1,
              background: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              boxShadow: '0 4px 24px #60a5fa22',
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={120}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: 15,
                background: 'transparent',
                color: '#334155',
                fontWeight: 500,
              }}
              disabled={!myId}
              autoComplete="off"
            />
          </form>
          <button
            type="button"
            onClick={e => { e.preventDefault(); handleSendChat(); }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: chatInput.trim() && myId
                ? 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)' 
                : '#e2e8f0',
              color: chatInput.trim() && myId ? '#fff' : '#94a3b8',
              border: 'none',
              cursor: (chatInput.trim() && myId) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 600,
              transition: 'all 0.15s ease',
              boxShadow: (chatInput.trim() && myId) ? '0 2px 8px #60a5fa33' : 'none',
            }}
            disabled={!chatInput.trim() || !myId}
            onMouseOver={e => {
              if (chatInput.trim() && myId) {
                e.currentTarget.style.background = 'linear-gradient(90deg, #0ea5e9 0%, #5b21b6 100%)';
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px #60a5fa66';
              }
            }}
            onMouseOut={e => {
              if (chatInput.trim() && myId) {
                e.currentTarget.style.background = 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)';
              }
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = (chatInput.trim() && myId) ? '0 2px 8px #60a5fa33' : 'none';
            }}
          >➤</button>
        </div>
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
    setDrawings({});
    setMyDrawing(null);
    setPlayers([]);
    setIsHost(false);
    setChatMessages([]); // Clear chat messages when leaving room
  };

  /* --------------- Socket initialisation -------------- */
  useEffect(() => {
    try {
      socketRef.current = io('http://localhost:3001', {
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
    if (isHost) socketRef.current?.emit('start-round', roomCode);
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-sky-100 to-indigo-100">
      {/* Header always at the top */}
      <header className="w-full flex items-center justify-center py-8 px-4 sm:px-16">
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto" style={{ minHeight: 64 }}>
          {/* Left: Back/Menu button */}
          <div className="flex-1 flex justify-center">
            {/* Menu button removed */}
          </div>
          {/* Center: Title */}
          <div className="flex-1 flex justify-center items-center">
            <h1 className="font-extrabold text-3xl sm:text-4xl text-blue-600 tracking-tight drop-shadow-md text-center mx-auto whitespace-nowrap overflow-hidden text-ellipsis" style={{ lineHeight: 'normal', padding: 0, margin: 0 }}>
              {view === 'draw' && 'Timed Doodle Challenge'}
            </h1>
          </div>
          {/* Right: Spacer for symmetry */}
          <div className="flex-1" />
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        {/* ---------- MENU ---------- */}
        {view === 'menu' && (
          <div className="w-full flex flex-col justify-center items-center">
            <div className="w-full max-w-md mx-auto bg-white/90 rounded-2xl shadow-xl flex flex-col items-center px-8 py-12 gap-8 animate-fade-in">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-700 mb-2 text-center">Timed Doodle Challenge</h1>
              <div className="w-full flex flex-col gap-4 items-center">
                <div className="w-full relative">
                  <input
                    className={`w-full px-4 py-3 rounded-lg border ${nicknameError ? 'border-red-400' : 'border-blue-200'} focus:ring-2 focus:ring-blue-400 outline-none text-lg transition`}
                    placeholder="Enter your nickname"
                    value={nickname}
                    onChange={handleNicknameChange}
                    maxLength={15}
                  />
                  <div className={`text-right text-xs mt-1 ${nickname.length >= 14 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {nickname.length}/15 characters
                  </div>
                </div>
                {nicknameError && <div className="w-full text-left text-red-500 text-sm font-medium">{nicknameError}</div>}
                <button
                  onClick={handleStartPlaying}
                  className="w-full py-3 game-btn"
                >
                  Start Playing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- HOST SCREEN ---------- */}
        {view === 'host' && (
          <div className="w-full flex flex-col justify-center items-center">
            <div className="w-full max-w-md mx-auto bg-white/90 rounded-2xl shadow-xl flex flex-col items-center px-8 py-12 gap-8 animate-fade-in">
              <h2 className="text-2xl font-bold text-blue-700 mb-2 text-center">Welcome, {nickname}!</h2>
              <div className="flex flex-col gap-4 w-full">
                <button
                  onClick={handleHostRoom}
                  className="w-full py-3 game-btn"
                >
                  Create Room
                </button>
                <button
                  onClick={() => setView('join')}
                  className="w-full py-3 game-btn"
                >
                  Join Room
                </button>
                <button
                  onClick={() => setView('menu')}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2rem',
                    borderRadius: 10,
                    background: 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)',
                    color: '#64748b',
                    fontWeight: 700,
                    fontSize: '1.08rem',
                    boxShadow: '0 1px 4px #64748b22',
                    border: 'none',
                    marginTop: '0.5rem',
                    cursor: 'pointer',
                    transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, #f1f5f9 0%, #e5e7eb 100%)';
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.boxShadow = '0 2px 8px #64748b33';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)';
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.boxShadow = '0 1px 4px #64748b22';
                  }}
                >
                  Back to Main Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---------- JOIN SCREEN ---------- */}
        {view === 'join' && (
          <div className="w-full flex flex-col justify-center items-center">
            <div className="w-full max-w-md mx-auto bg-white/90 rounded-2xl shadow-xl flex flex-col items-center px-8 py-12 gap-8 animate-fade-in">
              <h2 className="text-2xl font-bold text-blue-700 mb-2 text-center">Join Room</h2>
              <p className="text-slate-500 mb-2">Playing as: <b>{nickname}</b></p>
              <input
                className={`w-full px-4 py-3 rounded-lg border ${joinError ? 'border-red-400' : 'border-blue-200'} focus:ring-2 focus:ring-blue-400 outline-none text-lg transition`}
                placeholder="Enter room code"
                value={inputCode}
                onChange={(e) => { setInputCode(e.target.value.toUpperCase()); setJoinError(''); }}
                maxLength={5}
              />
              {joinError && <div className="w-full text-left text-red-500 text-sm font-medium">{joinError}</div>}
              <button
                onClick={handleJoinRoom}
                className="w-full py-3 game-btn"
              >
                Join Room
              </button>
              <button
                onClick={() => setView('host')}
                style={{
                  width: '100%',
                  padding: '0.75rem 2rem',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)',
                  color: '#64748b',
                  fontWeight: 700,
                  fontSize: '1.08rem',
                  boxShadow: '0 1px 4px #64748b22',
                  border: 'none',
                  marginTop: '0.5rem',
                  cursor: 'pointer',
                  transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'linear-gradient(90deg, #f1f5f9 0%, #e5e7eb 100%)';
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.boxShadow = '0 2px 8px #64748b33';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.boxShadow = '0 1px 4px #64748b22';
                }}
              >
                Back to Welcome
              </button>
            </div>
          </div>
        )}

        {/* ---------- LOBBY SCREEN ---------- */}
        {view === 'lobby' && (
          <div className="w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-sky-100 to-indigo-100">
            <div
              className="results-container"
              style={{
                background: 'rgba(236,245,255,0.97)',
                borderRadius: '2rem',
                boxShadow: '0 12px 48px #60a5fa33',
                padding: '8px 36px 44px 36px',
                maxWidth: 540,
                width: '96%',
                margin: '56px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <h1 className="text-4xl sm:text-5xl font-extrabold text-blue-700 text-center mb-6" style={{ letterSpacing: '-1px', lineHeight: 1.08 }}>
                Game Lobby
              </h1>
              <div className="text-xl text-slate-600 text-center mb-6 font-medium">
                Share this code to invite friends:
              </div>
              <LobbyRoomCodeRow roomCode={roomCode} />
              <div className="w-full flex flex-col items-center mb-6">
                <h2 className="text-2xl font-bold text-blue-600 mb-2">Players</h2>
                <div className="w-full flex flex-col gap-3 mb-2">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between bg-blue-50 rounded-xl px-5 py-3 shadow-sm" style={{minWidth:220}}>
                      <span className="font-semibold text-slate-700 text-lg">{player.nickname}</span>
                      {player.isReady ? (
                        <span className="text-emerald-500 font-bold text-base">Ready</span>
                      ) : (
                        <span className="text-slate-400 text-base">Not Ready</span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="text-slate-500 text-base mt-1">{players.length} {players.length === 1 ? 'player' : 'players'} in room</span>
              </div>
              <div className="w-full flex flex-col items-center mt-2">
                <h2 className="text-2xl font-bold text-blue-600 mb-2">Start the Game</h2>
                <p className="text-slate-600 mb-5 text-center text-lg">
                  {isHost
                    ? 'When everyone is ready, start the challenge!'
                    : 'Click ready when you are set to draw.'}
                </p>
                {isHost ? (
                  <>
                    <button
                      onClick={handleStartRound}
                      disabled={!players.every((p) => p.isReady)}
                      className={`w-full max-w-xs py-4 text-2xl font-extrabold game-btn ${
                        !players.every((p) => p.isReady) ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                      style={{
                        fontWeight: 700,
                        letterSpacing: '-0.5px',
                      }}
                    >
                      {players.every((p) => p.isReady) ? 'Start Drawing Challenge!' : 'Waiting for Players...'}
                    </button>
                    <button
                      onClick={() => setView('host')}
                      style={{
                        width: '100%',
                        padding: '0.75rem 2rem',
                        borderRadius: 10,
                        background: 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)',
                        color: '#64748b',
                        fontWeight: 700,
                        fontSize: '1.08rem',
                        boxShadow: '0 1px 4px #64748b22',
                        border: 'none',
                        marginTop: '0.5rem',
                        cursor: 'pointer',
                        transition: 'background 0.18s, color 0.18s, box-shadow 0.18s',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = 'linear-gradient(90deg, #f1f5f9 0%, #e5e7eb 100%)';
                        e.currentTarget.style.color = '#334155';
                        e.currentTarget.style.boxShadow = '0 2px 8px #64748b33';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = 'linear-gradient(90deg, #e5e7eb 0%, #cbd5e1 100%)';
                        e.currentTarget.style.color = '#64748b';
                        e.currentTarget.style.boxShadow = '0 1px 4px #64748b22';
                      }}
                    >
                      Back to Welcome
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleToggleReady}
                    className={`w-full max-w-xs py-4 text-2xl font-extrabold game-btn ${
                      players.find((p) => p.id === socketRef.current?.id)?.isReady ? 'ready' : ''
                    }`}
                    style={{
                      fontWeight: 800,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {players.find((p) => p.id === socketRef.current?.id)?.isReady ? 'Ready to Draw!' : 'I\'m Ready!'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- DRAWING SCREEN ---------- */}
        {view === 'draw' && (
          <div className="flex-1 flex flex-col items-center justify-center w-full relative">
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
          </div>
        )}

        {/* ---------- RESULTS / GALLERY SCREEN ---------- */}
        {view === 'results' && (
          <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-sky-100 to-indigo-100">
            <div
              className="results-container"
              style={{
                background: 'rgba(236,245,255,0.97)',
                borderRadius: '2rem',
                boxShadow: '0 12px 48px #60a5fa33',
                padding: '36px 36px 44px 36px',
                maxWidth: 900,
                width: '96%',
                margin: '56px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <h1 className="text-5xl sm:text-6xl font-extrabold text-blue-700 text-center mb-4" style={{ letterSpacing: '-2px', lineHeight: 1.05 }}>
                Results
              </h1>
              <div className="text-xl sm:text-2xl font-bold text-slate-700 text-center mb-10" style={{ letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                The prompt was: <span className="text-blue-600 font-extrabold">{prompt}</span>
              </div>
              <ResultsGrid
                drawings={drawings}
                players={players}
              />
              <div className="flex flex-col gap-6 w-full max-w-[340px]">
                {isHost && (
                  <button
                    onClick={handleStartRound}
                    style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      padding: '0.8rem 2.5rem',
                      borderRadius: 10,
                      background: 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)',
                      color: '#fff',
                      boxShadow: '0 2px 8px #60a5fa33',
                      cursor: 'pointer',
                      transition: 'background 0.2s, box-shadow 0.2s, transform 0.1s',
                      width: '100%',
                      border: 'none',
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'linear-gradient(90deg, #0ea5e9 0%, #5b21b6 100%)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 4px 12px #60a5fa66';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'linear-gradient(90deg, #38bdf8 0%, #6366f1 100%)';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 2px 8px #60a5fa33';
                    }}
                  >
                    Start Next Round
                  </button>
                )}
                <button
                  onClick={handleBack}
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    padding: '0.8rem 2.5rem',
                    borderRadius: 10,
                    background: 'linear-gradient(90deg, #f87171 0%, #dc2626 100%)',
                    color: '#fff',
                    boxShadow: '0 2px 8px #ef444433',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    border: 'none',
                    marginTop: isHost ? '0.5rem' : '0',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px #ef444466';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(90deg, #f87171 0%, #dc2626 100%)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px #ef444433';
                  }}
                >
                  Quit Game
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer always at the bottom */}
      <footer className="mt-4 mb-2 text-slate-400 text-center text-sm select-none w-full flex justify-center items-center" style={{ minHeight: '32px' }}>
        <span>
          Made with <span className="text-sky-400">♥</span> for doodlers • {new Date().getFullYear()}
        </span>
      </footer>

      {/* Loading overlay */}
      {loading && <div className="fixed inset-0 flex items-center justify-center bg-white/60 z-50"><span className="loader" /></div>}
    </div>
  );
}

function LobbyRoomCodeRow({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className="flex items-center justify-center mb-8 gap-3"
      style={{
        background: 'linear-gradient(90deg, #e0e7ef 0%, #bae6fd 100%)',
        borderRadius: '999px',
        padding: '0.7em 1.5em',
        marginTop: '10px',
        marginBottom: '10px',
        boxShadow: '0 2px 8px #60a5fa33',
        border: '2.5px solid #38bdf8',
        position: 'relative',
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 28, marginRight: 10 }}>🔗</span>
      <span
        className="font-mono font-extrabold text-blue-800"
        style={{
          fontSize: 32,
          letterSpacing: '0.18em',
          fontWeight: 900,
          userSelect: 'all',
          marginRight: 10,
        }}
      >
        {roomCode}
      </span>
      <button
        className="game-btn"
        style={{ lineHeight: 1, marginLeft: 6, fontSize: 22, display: 'flex', alignItems: 'center', position: 'relative', padding: '0.5em 0.9em' }}
        onClick={() => {
          navigator.clipboard.writeText(roomCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        title="Copy Room Code"
      >📋
        {copied && (
          <span style={{
            position: 'absolute',
            top: '-2.2em',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#38bdf8',
            color: '#fff',
            borderRadius: 8,
            padding: '2px 10px',
            fontSize: 15,
            fontWeight: 700,
            boxShadow: '0 2px 8px #60a5fa33',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>Copied!</span>
        )}
      </button>
    </div>
  );
}

function ResultsGrid({ drawings, players }: { drawings: Record<string, string>, players: Player[] }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 9;
  const entries = Object.entries(drawings);
  const pagedEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  return (
    <>
      <div className="results-grid" style={{ width: '100%' }}>
        {pagedEntries.map(([id, url], idx) => {
          const player = players.find(p => p.id === id);
          return (
            <div
              key={id}
              className="drawing-card"
              style={{
                background: '#fff',
                borderRadius: '1.4rem',
                boxShadow: '0 4px 20px #60a5fa22',
                padding: '22px 14px 16px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: '100%',
                minWidth: 0,
                maxWidth: 350,
                transition: 'box-shadow 0.18s, border-color 0.18s',
                cursor: 'pointer',
                border: '1.5px solid #e0e7ef',
              }}
            >
              <img
                src={url}
                alt="drawing"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderRadius: '1rem',
                  background: '#fff',
                  marginBottom: '16px',
                  boxShadow: '0 4px 10px #60a5fa11',
                }}
              />
              <div className="text-center mt-2">
                <span className="inline-block font-extrabold text-blue-700 text-lg" style={{ letterSpacing: '-0.5px', lineHeight: 1.1 }}>
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
