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
  const socketRef = useSocket();

  /* --------------- Chat state ------------------------- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  /* --------------- Navigation ------------------------- */
  const handleBack = useCallback(() => {
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
  }, []);

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
  }, [view, timer, handleSubmitDrawing]);

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
        <MenuView nickname={nickname} nicknameError={nicknameError} onNicknameChange={handleNicknameChange} onContinue={handleStartPlaying} />
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
    </div>
  );
}
export default App;