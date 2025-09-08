import React, { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useAutoSizedCanvas } from '../lib/useAutoSizedCanvas';
import type { ChatMessage } from '../types';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Brush, PaintBucket, Clock, Check } from 'lucide-react';
import { ColorPicker } from './ui/ColorPicker';

export type DrawingTool = 'brush' | 'bucket';

export type DrawingCanvasProps = {
  color: string;
  brushSize: number;
  selectedTool: DrawingTool;
  onChangeColor: (color: string) => void;
  onChangeBrushSize: (size: number) => void;
  onChangeTool: (tool: DrawingTool) => void;
  onClear: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitted: boolean;
  timer: number;
  totalDuration: number;
  prompt: string;
  category: string | null;
  getCategoryIcon: (cat: string) => JSX.Element;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onQuit: () => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: () => void;
  myId?: string;
};

export default function DrawingCanvas(props: DrawingCanvasProps) {
  const {
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
    totalDuration,
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
  } = props;

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const MAX_HISTORY = 20;
  const hasMoved = useRef(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);

  useAutoSizedCanvas(canvasRef);

  const getScale = () => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 1, sy: 1 };
    const rect = canvas.getBoundingClientRect();
    return { sx: canvas.width / rect.width, sy: canvas.height / rect.height };
  };

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    setCanvasHistory((prev) => [...prev, dataUrl].slice(-MAX_HISTORY));
  };

  const rgbaToHex = (r: number, g: number, b: number) => {
    const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const sampleCanvasColor = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = getScale();
    const x = Math.floor((clientX - rect.left) * sx);
    const y = Math.floor((clientY - rect.top) * sy);
    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
    const data = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbaToHex(data[0], data[1], data[2]);
    onChangeColor(hex);
  };

  const handleClearWithHistory = () => {
    setCanvasHistory([]);
    onClear();
  };

  const handleUndo = () => {
    if (canvasHistory.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lastState = canvasHistory[canvasHistory.length - 1];
    setCanvasHistory((prev) => prev.slice(0, -1));
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = lastState;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = getScale();
    const x = Math.floor((e.clientX - rect.left) * sx);
    const y = Math.floor((e.clientY - rect.top) * sy);
    // Eyedropper: Alt-click or active mode samples color instead of drawing
    if (e.altKey || eyedropperActive) {
      sampleCanvasColor(e.clientX, e.clientY);
      setEyedropperActive(false);
      return;
    }
    if (selectedTool === 'bucket') {
      saveCanvasState();
      floodFill(x, y, color);
    } else {
      saveCanvasState();
      isDrawing.current = true;
      hasMoved.current = false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      lastPoint.current = { x, y };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (eyedropperActive) {
      // Show hover sampling when eyedropper is active (do not change color until click)
      return;
    }
    if (!isDrawing.current || selectedTool !== 'brush') return;
    const canvas = canvasRef.current;
    if (!canvas || !lastPoint.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const { sx, sy } = getScale();
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    hasMoved.current = true;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize * sx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint.current = { x, y };
  };

  const handlePointerUp = () => {
    if (isDrawing.current && !hasMoved.current && selectedTool === 'brush' && lastPoint.current) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { sx } = getScale();
          ctx.strokeStyle = color;
          ctx.lineWidth = brushSize * sx;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(lastPoint.current.x, lastPoint.current.y, (brushSize / 2) * sx, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }
    isDrawing.current = false;
    lastPoint.current = null;
    hasMoved.current = false;
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
    };
    const fillRgb = hexToRgb(fillColor);
    if (!fillRgb) return;
    const startPos = (startY * canvas.width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];
    const TOLERANCE = 32;
    const colorMatches = (r: number, g: number, b: number, a: number) => {
      if (startA === 0 && a === 0) return true;
      if (startA === 0 && a > 0) return false;
      if (startA > 0 && a === 0) return false;
      const deltaR = Math.abs(r - startR);
      const deltaG = Math.abs(g - startG);
      const deltaB = Math.abs(b - startB);
      const deltaA = Math.abs(a - startA);
      const colorDistance = Math.sqrt(deltaR * deltaR + deltaG * deltaG + deltaB * deltaB);
      return colorDistance <= TOLERANCE && deltaA <= TOLERANCE;
    };
    if (colorMatches(fillRgb.r, fillRgb.g, fillRgb.b, 255)) return;
    const pixelStack: Array<[number, number]> = [[startX, startY]];
    const visited = new Set<string>();
    while (pixelStack.length > 0) {
      const [x, y] = pixelStack.pop()!;
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const pos = (y * canvas.width + x) * 4;
      if (colorMatches(data[pos], data[pos + 1], data[pos + 2], data[pos + 3])) {
        data[pos] = fillRgb.r;
        data[pos + 1] = fillRgb.g;
        data[pos + 2] = fillRgb.b;
        data[pos + 3] = 255;
        pixelStack.push([x + 1, y]);
        pixelStack.push([x - 1, y]);
        pixelStack.push([x, y + 1]);
        pixelStack.push([x, y - 1]);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="dc-root panel">
      <div className="section draw-topbar">
        <div className="left">
          {category && (
            <div className="card category-card" aria-label="Category">
              <div className="category-icon">{getCategoryIcon(category)}</div>
            </div>
          )}
        </div>
        <div className="center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div className="label">Prompt</div>
          <div className="prompt-title">{prompt}</div>
          <div className="time-progress" aria-hidden>
            <div
              className="bar"
              style={{
                width: `${Math.max(0, Math.min(100, (totalDuration > 0 ? (timer / totalDuration) : 0) * 100))}%`,
                background: timer <= 10 ? 'var(--danger)' : 'var(--primary)',
              }}
            />
          </div>
        </div>
        <div className="right" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <div className="timer-chip"><Clock size={16} /> {timer}s</div>
          {submitted && <div className="tag ready">Submitted</div>}
        </div>
      </div>
      <div className="section wide draw-grid" style={{ marginLeft: 'auto', marginRight: 'auto', alignItems: 'stretch' }}>
        <div className="card tools-rail">
          <button className={`btn icon ${selectedTool === 'brush' ? 'primary' : ''}`} onClick={() => onChangeTool('brush')} aria-label="Brush">
            <Brush size={18} />
          </button>
          <button className={`btn icon ${selectedTool === 'bucket' ? 'primary' : ''}`} onClick={() => onChangeTool('bucket')} aria-label="Bucket">
            <PaintBucket size={18} />
          </button>
          <ColorPicker
            label="Color"
            value={color}
            onChange={onChangeColor}
            isEyedropperActive={eyedropperActive}
            onEyedropperToggle={() => setEyedropperActive(v => !v)}
          />
          <div>
            <div className="row between" style={{ alignItems: 'center' }}>
              <div className="label">Brush size: {brushSize}px</div>
              <div className="brush-preview" aria-hidden>
                <span
                  className="brush-dot"
                  style={{
                    width: Math.max(8, Math.min(brushSize, 32)),
                    height: Math.max(8, Math.min(brushSize, 32)),
                    background: color,
                  }}
                />
              </div>
            </div>
            <input className="range" type="range" min={2} max={40} value={brushSize} onChange={(e) => onChangeBrushSize(Number(e.target.value))} />
          </div>
          <button className="btn" onClick={() => setConfirmClear(true)}>Clear</button>
          <button className="btn" onClick={handleUndo} disabled={canvasHistory.length === 0}>Undo</button>
        </div>

        <div className="card canvas-col" style={{ height: '100%' }}>
          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              className={`canvas ${eyedropperActive ? 'cursor-pipette' : (selectedTool === 'brush' ? 'cursor-brush' : 'cursor-bucket')}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              tabIndex={0}
            />
            <button className="btn primary submit-fab" onClick={onSubmit} disabled={!canSubmit}>
              {submitted ? <Check size={16} /> : 'Submit'}
            </button>
          </div>
          <div className="tools-grid">
            <button className={`btn ${selectedTool === 'brush' ? 'primary' : ''}`} onClick={() => onChangeTool('brush')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Brush size={16} /> Brush</span>
            </button>
            <div style={{ gridColumn: 'span 2' }}>
              <ColorPicker
                label="Color"
                value={color}
                onChange={onChangeColor}
                isEyedropperActive={eyedropperActive}
                onEyedropperToggle={() => setEyedropperActive(v => !v)}
              />
            </div>
            <button className={`btn ${selectedTool === 'bucket' ? 'primary' : ''}`} onClick={() => onChangeTool('bucket')}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PaintBucket size={16} /> Bucket</span>
            </button>
            <input className="range" type="range" min={2} max={40} value={brushSize} onChange={(e) => onChangeBrushSize(Number(e.target.value))} />
            <button className="btn" onClick={() => setConfirmClear(true)}>Clear</button>
            <button className="btn" onClick={handleUndo} disabled={canvasHistory.length === 0}>Undo</button>
            <div />
            <button className="btn danger quit" onClick={() => setConfirmQuit(true)}>Quit</button>
          </div>
        </div>

        <div className="card chat-col">
          <div className="label">Chat</div>
          <div className="chat-messages">
            {chatMessages.length === 0 && <div className="muted" style={{ textAlign: 'center' }}>No messages yet</div>}
            {chatMessages.map((msg, i) =>
              msg.isSystem ? (
                <div key={i} className="muted" style={{ textAlign: 'center' }}>
                  {msg.text}
                </div>
              ) : (
                <div key={i} className={`chat-msg ${msg.id === myId ? 'me' : ''}`}>
                  <div className="chat-name">{msg.nickname}</div>
                  <div className="chat-bubble">{msg.text}</div>
                </div>
              )
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
          >
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
            <button type="submit" className="btn primary" disabled={!chatInput.trim() || !myId}>
              Send
            </button>
          </form>
        </div>
      </div>
      <div className="section wide draw-actions">
        <button className="btn primary" onClick={onSubmit} disabled={!canSubmit}>{submitted ? 'Submitted' : 'Submit Drawing'}</button>
        <button className="btn danger" onClick={() => setConfirmQuit(true)}>Quit</button>
      </div>
      <ConfirmDialog
        open={confirmClear}
        title="Clear drawing?"
        description="This cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          handleClearWithHistory();
        }}
      />
      <ConfirmDialog
        open={confirmQuit}
        title="Leave round?"
        description="You can rejoin with the room code."
        confirmLabel="Leave"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          onQuit();
        }}
      />
    </div>
  );
}


