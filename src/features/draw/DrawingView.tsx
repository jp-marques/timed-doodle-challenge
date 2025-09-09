import React, { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useAutoSizedCanvas } from '../../lib/useAutoSizedCanvas';
import type { ChatMessage } from '../../types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Brush, PaintBucket, Clock, ChevronDown } from 'lucide-react';
import { ColorPicker } from '../../components/ui/ColorPicker';

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

  // No offscreen master; draw directly to visible canvas

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
    const w = canvas.width | 0;
    const h = canvas.height | 0;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data; // Uint8ClampedArray

    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
        : null;
    };
    const fillRgb = hexToRgb(fillColor);
    if (!fillRgb) return;

    const startIdx = (startY * w + startX) | 0;
    if (startIdx < 0 || startIdx >= w * h) return;
    const startPos = startIdx * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    // If starting color already matches fill, nothing to do
    const TOLERANCE = 32;
    const TOL_SQ = TOLERANCE * TOLERANCE;
    const matches = (r: number, g: number, b: number, a: number) => {
      // Handle transparency similarity
      if (startA === 0 && a === 0) return true;
      if ((startA === 0) !== (a === 0)) return false;
      const dr = r - startR;
      const dg = g - startG;
      const db = b - startB;
      const da = Math.abs(a - startA);
      return (dr * dr + dg * dg + db * db) <= TOL_SQ && da <= TOLERANCE;
    };
    if (matches(fillRgb.r, fillRgb.g, fillRgb.b, 255)) return;

    // Visited bitmap to avoid string allocs
    const visited = new Uint8Array(w * h);
    const stack: number[] = [startIdx];
    visited[startIdx] = 1;

    const FR = fillRgb.r | 0;
    const FG = fillRgb.g | 0;
    const FB = fillRgb.b | 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const pos = idx * 4;
      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      const a = data[pos + 3];
      if (!matches(r, g, b, a)) continue;

      // Paint
      data[pos] = FR;
      data[pos + 1] = FG;
      data[pos + 2] = FB;
      data[pos + 3] = 255;

      // Neighbors: left, right, up, down
      const x = idx % w;
      const y = (idx / w) | 0;
      // left
      if (x > 0) {
        const n = idx - 1;
        if (!visited[n]) { visited[n] = 1; stack.push(n); }
      }
      // right
      if (x + 1 < w) {
        const n = idx + 1;
        if (!visited[n]) { visited[n] = 1; stack.push(n); }
      }
      // up
      if (y > 0) {
        const n = idx - w;
        if (!visited[n]) { visited[n] = 1; stack.push(n); }
      }
      // down
      if (y + 1 < h) {
        const n = idx + w;
        if (!visited[n]) { visited[n] = 1; stack.push(n); }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  useEffect(() => {
    // Default to collapsed on small screens to save space
    try {
      if (window?.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
        setChatCollapsed(true);
      }
    } catch {}
  }, []);

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      {/* Header */}
      <div className="grid grid-cols-[80px_1fr_80px] md:grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="justify-self-start">
          {category && (
            <div aria-label="Category" className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2">
              <div className="[&>*]:h-6 [&>*]:w-6">{getCategoryIcon(category)}</div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="text-xs text-slate-500">Prompt</div>
          <div className="font-semibold text-[clamp(18px,4vw,26px)] leading-tight">{prompt}</div>
          <div className="h-1 w-full max-w-xl rounded bg-slate-200 overflow-hidden" aria-hidden>
            <div
              className={`h-full ${timer <= 10 ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.max(0, Math.min(100, (totalDuration > 0 ? (timer / totalDuration) : 0) * 100))}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700"><Clock size={16} /> {timer}s</div>
          {submitted && <div className="hidden md:inline-flex rounded-full bg-green-100 text-green-700 text-xs px-2 py-1">Submitted</div>}
        </div>
      </div>

      {/* Main grid: tools / canvas / chat */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch w-full">
        {/* Tools (left on desktop, below canvas on mobile) */}
        <div className="order-2 md:order-1 md:col-span-3 hidden md:flex">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm w-full flex flex-col gap-2">
          <div className="flex gap-2">
            <button className={`btn icon ${selectedTool === 'brush' ? 'primary' : ''}`} onClick={() => onChangeTool('brush')} aria-label="Brush">
              <Brush size={18} />
            </button>
            <button className={`btn icon ${selectedTool === 'bucket' ? 'primary' : ''}`} onClick={() => onChangeTool('bucket')} aria-label="Bucket">
              <PaintBucket size={18} />
            </button>
          </div>
          <ColorPicker
            label="Color"
            value={color}
            onChange={onChangeColor}
            isEyedropperActive={eyedropperActive}
            onEyedropperToggle={() => setEyedropperActive(v => !v)}
          />
          {selectedTool === 'brush' && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-slate-600">Brush size: {brushSize}px</div>
                <div className="brush-preview" aria-hidden>
                  <span
                    className="brush-dot"
                    style={{
                      width: Math.max(2, Math.min(brushSize, 40)),
                      height: Math.max(2, Math.min(brushSize, 40)),
                      background: color,
                    }}
                  />
                </div>
              </div>
              <input
                className="range"
                type="range"
                min={2}
                max={40}
                value={brushSize}
                onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                aria-label="Brush size"
              />
            </div>
          )}
            <button className="btn" onClick={() => setConfirmClear(true)}>Clear</button>
            <button className="btn" onClick={handleUndo} disabled={canvasHistory.length === 0}>Undo</button>
          </div>
        </div>

        {/* Mobile tools (compact) */}
        <div className="order-2 md:hidden">
          <div className="card w-full flex flex-col gap-2">
            <div className="flex gap-2">
              <button className={`btn icon ${selectedTool === 'brush' ? 'primary' : ''}`} onClick={() => onChangeTool('brush')} aria-label="Brush">
                <Brush size={18} />
              </button>
              <button className={`btn icon ${selectedTool === 'bucket' ? 'primary' : ''}`} onClick={() => onChangeTool('bucket')} aria-label="Bucket">
                <PaintBucket size={18} />
              </button>
            </div>
            <ColorPicker
              label="Color"
              value={color}
              onChange={onChangeColor}
              isEyedropperActive={eyedropperActive}
              onEyedropperToggle={() => setEyedropperActive(v => !v)}
            />
            {selectedTool === 'brush' && (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-600">Brush size: {brushSize}px</div>
                  <div className="brush-preview" aria-hidden>
                    <span className="brush-dot" style={{ width: Math.max(2, Math.min(brushSize, 40)), height: Math.max(2, Math.min(brushSize, 40)), background: color }} />
                  </div>
                </div>
                <input className="range" type="range" min={2} max={40} value={brushSize} onChange={(e) => onChangeBrushSize(Number(e.target.value))} aria-label="Brush size" />
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn" onClick={() => setConfirmClear(true)}>Clear</button>
              <button className="btn" onClick={handleUndo} disabled={canvasHistory.length === 0}>Undo</button>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="order-1 md:order-2 md:col-span-6 min-w-0">
          <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm w-full grid place-items-center">
            <div className="w-full max-w-[min(100%,1024px)] aspect-[4/3]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="block w-full h-full rounded-md bg-white"
              />
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="order-3 md:col-span-3 flex min-w-0">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm w-full flex flex-col gap-2 min-w-0 overflow-hidden">
            {/* Header with mobile collapse toggle */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">Chat</div>
              <button
                type="button"
                className="md:hidden inline-flex items-center justify-center rounded p-1 text-slate-600 hover:text-slate-800"
                aria-label={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
                aria-expanded={!chatCollapsed}
                aria-controls="chat-content"
                onClick={() => setChatCollapsed((v) => !v)}
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${chatCollapsed ? '' : 'rotate-180'}`} />
              </button>
            </div>
            <div id="chat-content" className={`${chatCollapsed ? 'hidden md:block' : ''} overflow-auto p-2 flex flex-col gap-1 rounded-md bg-slate-50 h-48 md:h-[calc(100svh-360px)]`}>
              {chatMessages.length === 0 && <div className="text-slate-400 text-center text-sm">No messages yet</div>}
              {chatMessages.map((msg, i) =>
                msg.isSystem ? (
                  <div key={i} className="text-slate-400 text-center text-xs py-1">{msg.text}</div>
                ) : (
                  <div key={i} className={`flex flex-col ${msg.id === myId ? 'items-end' : 'items-start'}`}>
                    <div className="text-[11px] text-slate-400">{msg.nickname}</div>
                    <div className={`inline-block rounded-md px-2 py-1 text-[13px] max-w-[240px] ${msg.id === myId ? 'bg-sky-100' : 'bg-slate-100'}`}>{msg.text}</div>
                  </div>
                )
              )}
              <div ref={chatEndRef} />
            </div>
            <form
              className={`${chatCollapsed ? 'hidden md:flex' : 'flex'} gap-2 min-w-0`}
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
            >
              <input
                className="input flex-1 min-w-0 w-0"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                aria-label="Chat message"
                maxLength={120}
                disabled={!myId}
                autoComplete="off"
              />
              <button type="submit" className="btn primary small shrink-0" disabled={!chatInput.trim() || !myId}>Send</button>
            </form>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 w-full max-w-md mx-auto">
        <button className="btn danger cta flex-1" onClick={() => setConfirmQuit(true)}>Quit</button>
        <button className="btn primary cta flex-1" onClick={onSubmit} disabled={!canSubmit}>{submitted ? 'Submitted' : 'Submit Drawing'}</button>
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
