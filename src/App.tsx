import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import DrawingCanvas from './components/DrawingCanvas';
import { MenuView } from './features/menu/MenuView';
import { HostView } from './features/host/HostView';
import { JoinView } from './features/join/JoinView';
import { LobbyView } from './features/lobby/LobbyView';
import { ResultsView } from './features/results/ResultsView';
import type { Player, ChatMessage } from './types';
import { validateNickname, validateRoundDuration } from './lib/validation';
import { useSocket } from './lib/useSocket';

/* ─────────────────────────────────────────────────── */
/*                    Component                       */
/* ─────────────────────────────────────────────────── */
function App() {
  /* --------------- Global / lobby state --------------- */
  const [view, setView] = useState<
    'menu' | 'nickname' | 'host' | 'join' | 'lobby' | 'draw' | 'results'
  >('menu');
  const [roomCode, setRoomCode] = useState('');
  // Keep a ref of the current room to avoid race conditions with async events
  const currentRoomRef = useRef<string>('');
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
  const [isConnected, setIsConnected] = useState(false);
  const [showColdStartTip, setShowColdStartTip] = useState(false);
  // Used to force re-binding of socket listeners after explicit cleanup
  const [listenerKey, setListenerKey] = useState(0);
  // Server-synchronized deadline for current round
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  /* --------------- Canvas / drawing state ------------- */
  const canvasRef = useRef<HTMLCanvasElement>(null) as React.RefObject<HTMLCanvasElement>;
  const [myDrawing, setMyDrawing] = useState<string | null>(null);
  const myDrawingRef = useRef<string | null>(null);
  useEffect(() => {
    myDrawingRef.current = myDrawing;
  }, [myDrawing]);
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
  }, []);

  // Show a one-time tip if backend is waking up (cold start)
  useEffect(() => {
    let timer: number | undefined;
    const dismissed = localStorage.getItem('coldStartTipDismissed') === 'true';
    if (!dismissed && view === 'menu' && !isConnected) {
      timer = window.setTimeout(() => {
        if (!isConnected) setShowColdStartTip(true);
      }, 2000);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [view, isConnected]);

  useEffect(() => {
    if (isConnected) setShowColdStartTip(false);
  }, [isConnected]);

  const dismissColdStartTip = (dontShowAgain?: boolean) => {
    setShowColdStartTip(false);
    if (dontShowAgain) localStorage.setItem('coldStartTipDismissed', 'true');
  };

  /* --------------- Chat state ------------------------- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  /* --------------- Navigation ------------------------- */
  const handleBack = useCallback(() => {
    // Proactively leave the socket room so server stops sending round events
    const socket = socketRef.current;
    const code = currentRoomRef.current;
    if (socket && code) {
      try {
        socket.emit('leave-room', code);
        // Also remove listeners so no further events trigger alerts/UI
        socket.removeAllListeners('lobby-update');
        socket.removeAllListeners('round-start');
        socket.removeAllListeners('round-end');
        socket.removeAllListeners('host-left');
        socket.removeAllListeners('chat-message');
      } catch {}
    }
    // Clear ref immediately so any in-flight events are ignored
    currentRoomRef.current = '';
    // Force rebind of listeners on next tick
    setListenerKey((k) => k + 1);
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
    // Clear any in-flight timers
    if (autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setEndsAt(null);
  }, [socketRef]);

  // Socket lifecycle is handled by useSocket

  // Submit current canvas drawing to server
  const handleSubmitDrawing = useCallback(() => {
    if (!canvasRef.current || !socketRef.current || !roomCode) return;
    const dataUrl = canvasRef.current.toDataURL();
    setMyDrawing(dataUrl);
    socketRef.current.emit('submit-drawing', { code: roomCode, drawing: dataUrl });
  }, [roomCode]);

  /* --------------- Socket event listeners ------------- */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function onLobbyUpdate(updatedPlayers: Player[]) {
      // Accept lobby updates even if currentRoomRef is not yet set.
      // This avoids a race where the server emits immediately after join,
      // before we store the room code locally.
      setPlayers(updatedPlayers);
    }

    function onRoundStart({
      prompt,
      duration,
      category,
      endsAt: serverEndsAt,
    }: {
      prompt: string;
      duration: number;
      category?: string;
      endsAt?: number;
    }) {
      // Ignore if we've left the room
      if (!currentRoomRef.current) return;
      setPrompt(prompt);
      setCategory(category || null);
      // Prefer server-provided deadline when available
      if (typeof serverEndsAt === 'number' && Number.isFinite(serverEndsAt)) {
        setEndsAt(serverEndsAt);
        const secondsRemaining = Math.max(0, Math.ceil((serverEndsAt - Date.now()) / 1000));
        setTimer(secondsRemaining);
      } else {
        setEndsAt(null);
        setTimer(duration);
      }
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
      // Ignore if we've left the room
      if (!currentRoomRef.current) return;
      setDrawings(drawings);
      setView('results');
      // Cleanup timers at round end
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setEndsAt(null);
    }

    function onHostLeft() {
      if (!currentRoomRef.current) return;
      alert('Host has left the game');
      handleBack();
    }

    function onChatMessage(msg: ChatMessage) {
      if (!currentRoomRef.current) return;
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
  }, [handleBack, listenerKey]);

  /* --------------- Server-synced timer ----------------- */
  useEffect(() => {
    // Clear any prior interval
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (view === 'draw' && endsAt) {
      // Initialize immediately
      setTimer(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      countdownIntervalRef.current = window.setInterval(() => {
        setTimer(Math.max(0, Math.ceil(((endsAt as number) - Date.now()) / 1000)));
      }, 500);
    }
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [view, endsAt]);

  // Auto-submit slightly before the server deadline to avoid late rejection
  useEffect(() => {
    if (autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
    if (view === 'draw' && endsAt) {
      const cushionMs = 1500; // submit early to beat server cutoff and timer clamping
      const delay = Math.max(0, endsAt - Date.now() - cushionMs);
      autoSubmitTimeoutRef.current = window.setTimeout(() => {
        if (!currentRoomRef.current) return;
        if (!myDrawingRef.current) {
          handleSubmitDrawing();
        }
      }, delay);
    }
    return () => {
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
    };
  }, [view, endsAt, handleSubmitDrawing]);

  // If user submits early, no need to run the auto-submit later
  useEffect(() => {
    if (myDrawing && autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
  }, [myDrawing]);

  // Fallback local timer if server-sent endsAt is unavailable
  useEffect(() => {
    if (endsAt || view !== 'draw' || timer <= 0) return;
    const id = window.setInterval(() => {
      setTimer((t) => {
        const newTime = t - 1;
        if (newTime <= 0 && !myDrawingRef.current) {
          handleSubmitDrawing();
        }
        return newTime;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [view, endsAt, timer, handleSubmitDrawing]);

  /* --------------- Validation helpers ---------------- */
  // Imported from lib/validation

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
      currentRoomRef.current = response.code;
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
          currentRoomRef.current = inputCode;
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

  const handleClearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setMyDrawing(null);
  };

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
      {view === 'menu' && (
        <>
          <div className="row center" style={{ justifyContent: 'center' }}>
            <div className={isConnected ? 'tag online' : 'tag offline'}>
              {isConnected ? 'Connected' : 'Offline'}
            </div>
          </div>
          <MenuView
            nickname={nickname}
            nicknameError={nicknameError}
            onNicknameChange={handleNicknameChange}
            onContinue={handleStartPlaying}
          />
        </>
      )}

      {view === 'host' && (
        <HostView nickname={nickname} toJoin={() => setView('join')} toMenu={() => setView('menu')} onCreate={handleHostRoom} />
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
          onBack={() => setView('host')}
        />
      )}

      {view === 'lobby' && (
        <LobbyView
          players={players}
          roomCode={roomCode}
          isHost={isHost}
          roundDuration={roundDuration}
          onRoundDurationChange={handleRoundDurationChange}
          onStart={handleStartRound}
          onToggleReady={handleToggleReady}
          onQuit={handleBack}
          myId={socketRef.current?.id}
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

      {view === 'results' && (
        <ResultsView drawings={drawings} players={players} prompt={prompt} isHost={isHost} onStartNext={handleStartRound} onQuit={handleBack} />
      )}

      {loading && <div className="overlay">Loading…</div>}

      {showColdStartTip && (
        <div className="toast" role="status" aria-live="polite">
          <div className="toast-title">Server is waking up</div>
          <div className="toast-body">
            If you see "Offline" briefly, the backend may be starting up on the free tier. It can take up to ~60 seconds and will connect automatically.
          </div>
          <div className="toast-actions">
            <button className="btn" onClick={() => dismissColdStartTip(false)}>Got it</button>
            <button className="btn secondary" onClick={() => dismissColdStartTip(true)}>Don't show again</button>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;