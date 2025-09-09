import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import './App.css';
import DrawingCanvas from './components/DrawingCanvas';
import { MenuView } from './features/menu/MenuView';
import { JoinView } from './features/join/JoinView';
import { LobbyView } from './features/lobby/LobbyView';
import { ResultsView } from './features/results/ResultsView';
import type { Player, ChatMessage, LobbyUpdate, SettingsUpdate } from './types';
import { validateNickname, validateRoundDuration } from './lib/validation';
import { Shuffle, PawPrint, Box, Leaf, Utensils, Car, Wand2, Building2, Trophy } from 'lucide-react';
import { useSocket } from './lib/useSocket';

/* ─────────────────────────────────────────────────── */
/*                    Component                       */
/* ─────────────────────────────────────────────────── */
function App() {
  /* --------------- Global / lobby state --------------- */
  const [view, setView] = useState<'menu' | 'join' | 'lobby' | 'draw' | 'results'>('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [prompt, setPrompt] = useState('');
  const [timer, setTimer] = useState(60);
  const [endsAtMs, setEndsAtMs] = useState<number | null>(null);
  const [roundDuration, setRoundDuration] = useState(60); // Round duration setting for hosts
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [isHost, setIsHost] = useState(false);
  // Lobby preference; null means Random
  const [category, setCategory] = useState<string | null>(null);
  // Active round category (for the drawing screen)
  const [roundCategory, setRoundCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hostId, setHostId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  /* --------------- Canvas / drawing state ------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;
  const [myDrawing, setMyDrawing] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState('#2563eb');
  const [brushSize, setBrushSize] = useState(8);
  const [selectedTool, setSelectedTool] = useState<'brush' | 'bucket'>('brush');
  // const isDrawingRef = useRef(false);
  // const lastPoint = useRef<{ x: number; y: number } | null>(null);

  /* --------------- Socket ----------------------------- */
  const socketRef = useSocket();

  // Track socket connection status for UI badge
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    // Initialize current state
    setIsConnected(socket.connected);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socketRef]);

  /* --------------- Chat state ------------------------- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Reflect socket connection status in UI
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const update = () => setIsConnected(!!socket.connected);
    update();
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socketRef]);

  /* --------------- Navigation ------------------------- */
  const handleBack = useCallback(() => {
    const socket = socketRef.current;
    if (socket && roomCode) {
      socket.emit('leave-room', roomCode);
    }
    try { sessionStorage.removeItem('td.session'); } catch (err) { void err; }
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
    setHostId(null);
    setEndsAtMs(null);
    setChatMessages([]); // Clear chat messages when leaving room
  }, [roomCode]);

  // Socket lifecycle is handled by useSocket

  // Submit current canvas drawing to server
  const handleSubmitDrawing = useCallback(() => {
    if (!canvasRef.current || !socketRef.current || !roomCode) return;
    try {
      const src = canvasRef.current;
      // Downscale to a fixed 4:3 export to keep size within server limits
      const EXPORT_W = 800;
      const EXPORT_H = 600;
      const off = document.createElement('canvas');
      off.width = EXPORT_W;
      off.height = EXPORT_H;
      const ctx = off.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      try { (ctx as any).imageSmoothingQuality = 'high'; } catch {}
      ctx.clearRect(0, 0, EXPORT_W, EXPORT_H);
      // Draw whole source onto target with scaling
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, EXPORT_W, EXPORT_H);
      const dataUrl = off.toDataURL('image/webp', 0.8);
      setMyDrawing(dataUrl);
      socketRef.current.emit('submit-drawing', { code: roomCode, drawing: dataUrl });
    } catch (err) {
      // Fallback: send whatever is on the main canvas
      const dataUrl = canvasRef.current.toDataURL('image/webp', 0.8);
      setMyDrawing(dataUrl);
      socketRef.current.emit('submit-drawing', { code: roomCode, drawing: dataUrl });
    }
  }, [roomCode]);

  /* --------------- Auto rejoin on connect -------------- */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const tryRejoin = () => {
      try {
        const raw = sessionStorage.getItem('td.session');
        if (!raw) return;
        const session = JSON.parse(raw) as { code: string; myId: string; nickname: string; token: string; isHost: boolean };
        if (!session?.code || !session?.myId || !session?.token) return;
        socket.emit('rejoin-room', { code: session.code.trim().toUpperCase(), playerId: session.myId, token: session.token, nickname: session.nickname }, (res: { ok: boolean; myId?: string; hostId?: string; error?: string }) => {
          if (!res?.ok) {
            try { sessionStorage.removeItem('td.session'); } catch (err) { void err; }
            return;
          }
          setRoomCode(session.code.trim().toUpperCase());
          setMyId(res.myId || session.myId);
          setIsHost((res.hostId || '') === (res.myId || session.myId));
          setChatMessages([]);
          setView('lobby');
        });
      } catch (err) { void err; }
    };

    // If already connected (e.g., hot reload), attempt immediately
    if (socket.connected) tryRejoin();
    socket.on('connect', tryRejoin);
    return () => {
      socket.off('connect', tryRejoin);
    };
  }, [socketRef]);

  /* --------------- Socket event listeners ------------- */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onLobbyUpdate(update: LobbyUpdate) {
      let nextPlayers: Player[] = players;
      let nextHostId: string | null = hostId;
      if (Array.isArray(update)) {
        nextPlayers = update as unknown as Player[];
        nextHostId = update[0]?.id ?? null; // fallback for backwards compatibility
      } else {
        nextPlayers = update.players;
        nextHostId = update.hostId;
      }

      // Detect host change and show toast with new host nickname
      if (hostId && nextHostId && nextHostId !== hostId) {
        const newHost = nextPlayers.find(p => p.id === nextHostId);
        const name = newHost?.nickname || 'Unknown';
        setToastMessage(`New host: ${name}`);
        // Auto-hide after 3 seconds
        window.setTimeout(() => setToastMessage(null), 3000);
      }

      setPlayers(nextPlayers);
      setHostId(nextHostId);
    }

    function onRoundStart({
      prompt,
      duration,
      category,
      endsAt,
    }: {
      prompt: string;
      duration: number;
      category?: string;
      endsAt?: number;
    }) {
      setPrompt(prompt);
      setRoundCategory(category || null);
      const serverEnds = typeof endsAt === 'number' ? endsAt : (Date.now() + duration * 1000);
      setEndsAtMs(serverEnds);
      const remainingNow = Math.max(0, Math.ceil((serverEnds - Date.now()) / 1000));
      setTimer(remainingNow);
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
        const vis = canvasRef.current;
        const ctx = vis.getContext('2d');
        ctx?.clearRect(0, 0, vis.width, vis.height);
        // visible canvas is the drawing surface; nothing else to clear
      }
    }

    function onRoundEnd({ drawings }: { drawings: Record<string, string> }) {
      // Guard against race: if user has left the room, ignore stale round-end
      if (!roomCode) return;
      setDrawings(drawings);
      setEndsAtMs(null);
      setView('results');
    }

    function onChatMessage(msg: ChatMessage) {
      setChatMessages((prev) => [...prev.slice(-49), msg]); // keep last 50
    }

    function onSettingsUpdate(payload: SettingsUpdate) {
      if (typeof payload.roundDuration === 'number') setRoundDuration(payload.roundDuration);
      if (typeof payload.category !== 'undefined') setCategory(payload.category ?? null);
    }

    socket.on('lobby-update', onLobbyUpdate);
    socket.on('settings-update', onSettingsUpdate);
    socket.on('round-start', onRoundStart);
    socket.on('round-end', onRoundEnd);
    socket.on('chat-message', onChatMessage);

    return () => {
      socket.off('lobby-update', onLobbyUpdate);
      socket.off('settings-update', onSettingsUpdate);
      socket.off('round-start', onRoundStart);
      socket.off('round-end', onRoundEnd);
      socket.off('chat-message', onChatMessage);
    };
  }, [handleBack]);

  /* --------------- Timer effect ----------------------- */
  useEffect(() => {
    if (view !== 'draw') return;
    // Prefer server-authoritative endsAt when available to avoid drift
    if (endsAtMs) {
      const interval = window.setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
        setTimer(remaining);
        if (remaining <= 0) {
          window.clearInterval(interval);
          if (!myDrawing) handleSubmitDrawing();
        }
      }, 1000);
      return () => window.clearInterval(interval);
    } else {
      // Fallback to local countdown if endsAt is missing
      const interval = window.setInterval(() => {
        setTimer((t) => {
          const newTime = t - 1;
          if (newTime <= 0) {
            if (!myDrawing) handleSubmitDrawing();
          }
          return newTime;
        });
      }, 1000);
      return () => window.clearInterval(interval);
    }
  }, [view, endsAtMs, handleSubmitDrawing, myDrawing]);

  /* --------------- Validation helpers ---------------- */
  // Imported from lib/validation

  const debounceRef = useRef<number | null>(null);
  const handleRoundDurationChange = (newDuration: number) => {
    const error = validateRoundDuration(newDuration);
    if (error) return;
    setRoundDuration(newDuration);
    if (isHost && socketRef.current && roomCode) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        socketRef.current?.emit('update-settings', { code: roomCode, roundDuration: newDuration });
      }, 200);
    }
  };

  const handleCategoryPrefChange = (cat: string | null) => {
    setCategory(cat);
    if (isHost && socketRef.current && roomCode) {
      socketRef.current.emit('update-settings', { code: roomCode, category: cat });
    }
  };

  /* --------------- Room helpers ---------------------- */
  

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);
    const error = validateNickname(value);
    setNicknameError(error ?? '');
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
    socket.emit('host-room', { nickname: nickname.trim() }, (response: { code?: string; myId?: string; token?: string; error?: string }) => {
      setLoading(false);
      if (response.error || !response.code) {
        setNicknameError(response.error || 'Failed to create room');
        return;
      }
      setRoomCode(response.code);
      if (response.myId) setMyId(response.myId);
      setIsHost(true);
      // Persist session for auto-rejoin
      try {
        if (response.myId && response.token) {
          sessionStorage.setItem('td.session', JSON.stringify({
            code: response.code,
            myId: response.myId,
            nickname: nickname.trim(),
            token: response.token,
            isHost: true,
          }));
        }
      } catch (err) { void err; }
      setChatMessages([]); // Clear chat messages when joining new room
      setView('lobby');
    });
  };

  const handleGoToJoin = () => {
    const error = validateNickname(nickname);
    if (error) {
      setNicknameError(error);
      return;
    }
    setView('join');
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
      (res: { success: boolean; error?: string; myId?: string; token?: string }) => {
        setLoading(false);
        if (res.success) {
          if (res.myId) setMyId(res.myId);
          setRoomCode(inputCode);
          setIsHost(false);
          // Persist session for auto-rejoin
          try {
            if (res.myId && res.token) {
              sessionStorage.setItem('td.session', JSON.stringify({
                code: inputCode.trim().toUpperCase(),
                myId: res.myId,
                nickname: nickname.trim(),
                token: res.token,
                isHost: false,
              }));
            }
          } catch (err) { void err; }
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
    if (isHost) socketRef.current?.emit('start-round', { code: roomCode });
  };

  const handleClearCanvas = () => {
    if (canvasRef.current) {
      const vis = canvasRef.current;
      const ctx = vis.getContext('2d');
      ctx?.clearRect(0, 0, vis.width, vis.height);
      // visible canvas is the drawing surface; nothing else to clear
    }
    setMyDrawing(null);
  };

  /* --------------- Utility ---------------------------- */
  function getCategoryIcon(category: string): JSX.Element {
    switch (category) {
      case 'animals':
        return (<PawPrint size={32} />);
      case 'objects':
        return (<Box size={32} />);
      case 'nature':
        return (<Leaf size={32} />);
      case 'food':
        return (<Utensils size={32} />);
      case 'vehicles':
        return (<Car size={32} />);
      case 'fantasy':
        return (<Wand2 size={32} />);
      case 'buildings':
        return (<Building2 size={32} />);
      case 'sports':
        return (<Trophy size={32} />);
      default:
        return (<Shuffle size={32} />);
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
    socketRef.current.emit('chat-message', { code: roomCode, text: chatInput });
    setChatInput('');
  };

  /* --------------- Render ----------------------------- */
  return (
    <div className="page">
      {toastMessage && (
        <div className="overlay" style={{ pointerEvents: 'none', background: 'transparent' }}>
          <div className="tag online" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
            {toastMessage}
          </div>
        </div>
      )}
      {view === 'menu' && (
        <>
          <div className="row center" style={{ justifyContent: 'center' }}>
            <div className={isConnected ? 'tag online' : 'tag offline'}>
              {isConnected ? 'Server Connected' : 'Server Offline'}
            </div>
          </div>
          <MenuView
            nickname={nickname}
            nicknameError={nicknameError}
            onNicknameChange={handleNicknameChange}
            onCreate={handleHostRoom}
            onJoin={handleGoToJoin}
          />
        </>
      )}

      {view === 'join' && (
        <JoinView
          nickname={nickname}
          inputCode={inputCode}
          joinError={joinError}
          setInputCode={(v) => {
            setJoinError('');
            setInputCode(v);
          }}
          onJoin={handleJoinRoom}
          onBack={() => setView('menu')}
        />
      )}

      {view === 'lobby' && (
        <LobbyView
          players={players}
          roomCode={roomCode}
          isHost={isHost}
          roundDuration={roundDuration}
          category={category}
          onRoundDurationChange={handleRoundDurationChange}
          onCategoryChange={handleCategoryPrefChange}
          onStart={handleStartRound}
          onToggleReady={handleToggleReady}
          onQuit={handleBack}
          myId={myId ?? undefined}
          hostId={hostId ?? undefined}
        />
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
          totalDuration={roundDuration}
          prompt={prompt}
          category={roundCategory}
          getCategoryIcon={getCategoryIcon}
          canvasRef={canvasRef}
          onQuit={handleBack}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          handleSendChat={handleSendChat}
          myId={myId ?? undefined}
        />
      )}

      {view === 'results' && (
        <ResultsView drawings={drawings} players={players} prompt={prompt} isHost={isHost} onStartNext={handleStartRound} onQuit={handleBack} />
      )}

      {loading && <div className="overlay">Loading…</div>}
    </div>
  );
}
export default App;
