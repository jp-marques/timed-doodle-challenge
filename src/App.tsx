import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import DrawingView from './features/draw/DrawingView';
import { MenuView } from './features/menu/MenuView';
import { JoinView } from './features/join/JoinView';
import { LobbyView } from './features/lobby/LobbyView';
import { ResultsView } from './features/results/ResultsView';
import { validateNickname, validateRoundDuration } from './lib/validation';
import { Events } from './lib/constants/events';
import { getCategoryIcon } from './lib/category';
import { useSocket } from './lib/useSocket';
import { useGameStore } from './stores/game';
import { useGameSocket } from './lib/useGameSocket';
import { usePortraitLock } from './lib/usePortraitLock';

/* ─────────────────────────────────────────────────── */
/*                    Component                       */
/* ─────────────────────────────────────────────────── */
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  /* --------------- Global / lobby state --------------- */
  const [view, setView] = useState<'menu' | 'join' | 'lobby' | 'draw' | 'results'>(() => {
    try {
      const p = typeof window !== 'undefined' ? window.location.pathname : '/';
      return p === '/join' ? 'join' : 'menu';
    } catch {
      return 'menu';
    }
  });
  const roomCode = useGameStore((s) => s.roomCode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const inputCode = useGameStore((s) => s.inputCode);
  const setInputCode = useGameStore((s) => s.setInputCode);
  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const players = useGameStore((s) => s.players);
  const prompt = useGameStore((s) => s.prompt);
  const [timer, setTimer] = useState(60);
  const endsAtMs = useGameStore((s) => s.endsAtMs);
  const roundDuration = useGameStore((s) => s.roundDuration);
  const drawings = useGameStore((s) => s.drawings);
  const category = useGameStore((s) => s.category);
  const roundCategory = useGameStore((s) => s.roundCategory);
  const [loading, setLoading] = useState(false);
  const isConnected = useGameStore((s) => s.isConnected);
  const hostId = useGameStore((s) => s.hostId);
  const myId = useGameStore((s) => s.myId);
  const toastMessage = useGameStore((s) => s.toastMessage);

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

  /* --------------- Chat state ------------------------- */
  const chatMessages = useGameStore((s) => s.chatMessages);
  const [chatInput, setChatInput] = useState('');

  // Bind socket -> store
  useGameSocket(socketRef);

  // Drive view changes from store state (server-authoritative)
  useEffect(() => {
    if (roomCode && endsAtMs) {
      setView('draw');
    }
  }, [roomCode, endsAtMs]);
  useEffect(() => {
    if (roomCode && !endsAtMs && drawings && Object.keys(drawings).length > 0) {
      setView('results');
    }
  }, [roomCode, endsAtMs, drawings]);

  /* --------------- Navigation ------------------------- */
  // Navigation + guards
  useEffect(() => {
    const path = location.pathname;
    // Outside a room: allow only menu/join to be controlled by URL
    if (!roomCode) {
      const nextView = path === '/' ? 'menu' : path === '/join' ? 'join' : 'menu';
      setView((prev) => (prev !== nextView ? nextView : prev));
      if (path === '/lobby' || path === '/draw' || path === '/results') {
        navigate('/', { replace: true });
      }
      return;
    }

    // In a room: the phase (view) is authoritative; keep URL in sync
    if (view === 'lobby' || view === 'draw' || view === 'results') {
      const desired = `/${view}`;
      if (path !== desired) navigate(desired, { replace: true });
      return;
    }

    // Edge: have a room but view is menu/join (e.g., rejoin in progress)
    if (path === '/' || path === '/join') {
      if (view !== 'menu' && view !== 'join') navigate('/lobby', { replace: true });
    }
  }, [location.pathname, roomCode, view, navigate]);

  // Sync view -> URL only for in-room phases; outside a room the URL drives the view
  // The in-room navigation is already handled in the guard effect above; avoid double-sync here.
  // Intentionally no-op to prevent race loops between view<->URL for menu/join.

  const handleBack = useCallback(() => {
    const socket = socketRef.current;
    if (socket && roomCode) {
      socket.emit(Events.LeaveRoom, roomCode);
    }
    try { sessionStorage.removeItem('td.session'); } catch (err) { void err; }
    setView('menu');
    setRoomCode('');
    setInputCode('');
    setTimer(60);
    // roundDuration stays as last setting until host changes it
    // drawings cleared by store.clearPerRoomState
    setMyDrawing(null);
    useGameStore.getState().clearPerRoomState();
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
      socketRef.current.emit(Events.SubmitDrawing, { code: roomCode, drawing: dataUrl });
    } catch {
      // Fallback: send whatever is on the main canvas
      const dataUrl = canvasRef.current.toDataURL('image/webp', 0.8);
      setMyDrawing(dataUrl);
      socketRef.current.emit(Events.SubmitDrawing, { code: roomCode, drawing: dataUrl });
    }
  }, [roomCode]);

  // Auto rejoin handled in useGameSocket

  // Socket event listeners handled in useGameSocket

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

  /* --------------- Reset per-round local state -------- */
  // When a new round starts (server sets endsAtMs), clear my local submission and canvas
  useEffect(() => {
    if (!endsAtMs) return;
    setMyDrawing(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [endsAtMs]);

  /* --------------- Validation helpers ---------------- */
  // Imported from lib/validation

  const debounceRef = useRef<number | null>(null);
  const setRoundDurationAction = useGameStore((s) => s.applySettingsUpdate);
  const handleRoundDurationChange = (newDuration: number) => {
    const error = validateRoundDuration(newDuration);
    if (error) return;
    setRoundDurationAction({ roundDuration: newDuration });
    if (/* derived host check */ (myId && hostId && myId === hostId) && socketRef.current && roomCode) {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        socketRef.current?.emit(Events.UpdateSettings, { code: roomCode, roundDuration: newDuration });
      }, 200);
    }
  };

  const handleCategoryPrefChange = (cat: string | null) => {
    useGameStore.getState().applySettingsUpdate({ category: cat ?? null });
    if ((myId && hostId && myId === hostId) && socketRef.current && roomCode) {
      socketRef.current.emit(Events.UpdateSettings, { code: roomCode, category: cat });
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
    // Clear per-room ephemeral state before the server sends lobby updates
    // to avoid wiping freshly received players/host after ACK.
    useGameStore.getState().clearPerRoomState();
    socket.emit(Events.HostRoom, { nickname: nickname.trim() }, (response: { code?: string; myId?: string; token?: string; error?: string } & Record<string, unknown>) => {
      setLoading(false);
      if (response.error || !response.code) {
        setNicknameError(response.error || 'Failed to create room');
        return;
      }
      setRoomCode(response.code.trim().toUpperCase());
      {
        const respMyId = (response.myId as string | undefined)
          ?? (response.playerId as string | undefined)
          ?? (response.id as string | undefined);
        if (respMyId) useGameStore.getState().setMyId(respMyId);
      }
      // Do not rely on local isHost; derive from myId and hostId.
      // Persist session for auto-rejoin
      try {
        const respMyId = (response.myId as string | undefined)
          ?? (response.playerId as string | undefined)
          ?? (response.id as string | undefined);
        if (respMyId && response.token) {
          sessionStorage.setItem('td.session', JSON.stringify({
            code: response.code,
            myId: respMyId,
            nickname: nickname.trim(),
            token: response.token,
            isHost: true,
          }));
        }
      } catch (err) { void err; }
      setView('lobby');
    });
  };

  const handleGoToJoin = () => {
    const error = validateNickname(nickname);
    if (error) {
      setNicknameError(error);
      return;
    }
    // Update local view immediately, then push URL
    setView('join');
    navigate('/join');
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
    // Clear per-room ephemeral state before the server sends lobby updates
    // to avoid wiping freshly received players/host after ACK.
    useGameStore.getState().clearPerRoomState();
    socket.emit(
      Events.JoinRoom,
      { code: inputCode.trim().toUpperCase(), nickname: nickname.trim() },
      (res: { success: boolean; error?: string; myId?: string; token?: string } & Record<string, unknown>) => {
        setLoading(false);
        if (res.success) {
          {
            const respMyId = (res.myId as string | undefined)
              ?? (res.playerId as string | undefined)
              ?? (res.id as string | undefined);
            if (respMyId) useGameStore.getState().setMyId(respMyId);
          }
          setRoomCode(inputCode.trim().toUpperCase());
          // Do not rely on local isHost; derive from myId and hostId.
          // Persist session for auto-rejoin
          try {
            const respMyId = (res.myId as string | undefined)
              ?? (res.playerId as string | undefined)
              ?? (res.id as string | undefined);
            if (respMyId && res.token) {
              sessionStorage.setItem('td.session', JSON.stringify({
                code: inputCode.trim().toUpperCase(),
                myId: respMyId,
                nickname: nickname.trim(),
                token: res.token,
                isHost: false,
              }));
            }
          } catch (err) { void err; }
          setView('lobby');
        } else {
          setJoinError(res.error || 'Failed to join room');
        }
      }
    );
  };

  const handleToggleReady = () => {
    socketRef.current?.emit(Events.ToggleReady, roomCode);
  };

  const handleStartRound = () => {
    if (myId && hostId && myId === hostId) socketRef.current?.emit(Events.StartRound, { code: roomCode });
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
  // getCategoryIcon moved to lib/category

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
    socketRef.current.emit(Events.ChatMessage, { code: roomCode, text: chatInput });
    setChatInput('');
  };

  /* --------------- Render ----------------------------- */
  const { orientationBlocked } = usePortraitLock();
  return (
    <div className="page">
      {orientationBlocked && (
        <div className="overlay" style={{ zIndex: 2000 }}>
          <div className="card" role="alert" aria-live="assertive">
            <h2 style={{ margin: 0 }}>Rotate your device to portrait to continue.</h2>
          </div>
        </div>
      )}
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
          onBack={() => { setView('menu'); navigate('/'); }}
        />
      )}

      {view === 'lobby' && (
        <LobbyView
          players={players}
          roomCode={roomCode}
          isHost={!!myId && !!hostId && myId === hostId}
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
        <DrawingView
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
        <ResultsView
          drawings={drawings}
          players={players}
          prompt={prompt}
          isHost={!!myId && !!hostId && myId === hostId}
          roundDuration={roundDuration}
          category={category}
          onRoundDurationChange={handleRoundDurationChange}
          onCategoryChange={handleCategoryPrefChange}
          onStartNext={handleStartRound}
          onQuit={handleBack}
        />
      )}

      {loading && <div className="overlay">Loading…</div>}
    </div>
  );
}
export default App;
