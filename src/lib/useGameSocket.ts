import { useEffect } from 'react';
import { Events } from './constants/events';
import { useGameStore } from '../stores/game';

// Binds socket events to the Zustand store. Call this once where the socket exists.
export function useGameSocket(socketRef: React.MutableRefObject<any>) {
  const setConnection = useGameStore((s) => s.setConnection);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const setMyId = useGameStore((s) => s.setMyId);
  const setHostId = useGameStore((s) => s.setHostId);
  const setToast = useGameStore((s) => s.setToast);
  const lobbyUpdate = useGameStore((s) => s.lobbyUpdate);
  const applySettingsUpdate = useGameStore((s) => s.applySettingsUpdate);
  const roundStart = useGameStore((s) => s.roundStart);
  const roundEnd = useGameStore((s) => s.roundEnd);
  const addChatMessage = useGameStore((s) => s.addChatMessage);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    // Initial connection status
    setConnection(!!socket.connected);
    const onConnect = () => setConnection(true);
    const onDisconnect = () => setConnection(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Auto rejoin on connect
    const tryRejoin = () => {
      try {
        const raw = sessionStorage.getItem('td.session');
        if (!raw) return;
        const session = JSON.parse(raw) as { code: string; myId: string; nickname: string; token: string };
        if (!session?.code || !session?.myId || !session?.token) return;
        socket.emit(
          Events.RejoinRoom,
          { code: session.code.trim().toUpperCase(), playerId: session.myId, token: session.token, nickname: session.nickname },
          (res: { ok: boolean; myId?: string; hostId?: string }) => {
            if (!res?.ok) {
              try { sessionStorage.removeItem('td.session'); } catch {}
              return;
            }
            const normalized = session.code.trim().toUpperCase();
            setRoomCode(normalized);
            setMyId(res.myId || session.myId);
            if (res.hostId) setHostId(res.hostId);
          }
        );
      } catch {}
    };
    if (socket.connected) tryRejoin();
    socket.on('connect', tryRejoin);

    // Event handlers
    function onLobbyUpdate(update: any) {
      lobbyUpdate(update);
    }
    function onSettingsUpdate(payload: any) {
      applySettingsUpdate(payload);
    }
    function onRoundStart(payload: any) {
      roundStart(payload);
    }
    function onRoundEnd(payload: any) {
      roundEnd(payload);
    }
    function onChatMessage(msg: any) {
      addChatMessage(msg);
    }

    socket.on(Events.LobbyUpdate, onLobbyUpdate);
    socket.on(Events.SettingsUpdate, onSettingsUpdate);
    socket.on(Events.RoundStart, onRoundStart);
    socket.on(Events.RoundEnd, onRoundEnd);
    socket.on(Events.ChatMessage, onChatMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect', tryRejoin);
      socket.off(Events.LobbyUpdate, onLobbyUpdate);
      socket.off(Events.SettingsUpdate, onSettingsUpdate);
      socket.off(Events.RoundStart, onRoundStart);
      socket.off(Events.RoundEnd, onRoundEnd);
      socket.off(Events.ChatMessage, onChatMessage);
    };
  }, [socketRef, setConnection, setRoomCode, setMyId, setHostId, lobbyUpdate, roundStart, roundEnd, addChatMessage, applySettingsUpdate, setToast]);
}

