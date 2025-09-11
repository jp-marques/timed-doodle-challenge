// No React import needed for react-jsx runtime
import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Player } from '../../types';
import GameSettingsPanel from '../settings/GameSettingsPanel';

export function LobbyView({
  players,
  roomCode,
  isHost,
  roundDuration,
  category,
  onRoundDurationChange,
  onCategoryChange,
  onStart,
  onToggleReady,
  onQuit,
  myId,
  hostId: hostIdProp,
}: {
  players: Player[];
  roomCode: string;
  isHost: boolean;
  roundDuration: number;
  category?: string | null;
  onRoundDurationChange: (val: number) => void;
  onCategoryChange?: (cat: string | null) => void;
  onStart: () => void;
  onToggleReady: () => void;
  onQuit: () => void;
  myId?: string;
  hostId?: string;
}) {
  // Use explicit hostId from server, fallback to players[0] for backwards compatibility
  const hostId = hostIdProp ?? (players.length > 0 ? players[0].id : undefined);
  const allNonHostReady = useMemo(() => players.filter(p => p.id !== hostId).every(p => p.isReady), [players, hostId]);
  const totalPlayers = players.length;
  const readyIncludingHost = useMemo(() => {
    const nonHostReady = players.filter(p => p.id !== hostId && p.isReady).length;
    const hostPresent = players.some(p => p.id === hostId);
    return nonHostReady + (hostPresent ? 1 : 0);
  }, [players, hostId]);

  const [copied, setCopied] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const sortedPlayers = useMemo(() => {
    // Stable sort: host first, then ready users, then by nickname
    const list = [...players];
    return list.sort((a, b) => {
      const aIsHost = a.id === hostId ? 0 : 1;
      const bIsHost = b.id === hostId ? 0 : 1;
      if (aIsHost !== bIsHost) return aIsHost - bIsHost;
      const aReadyRank = a.isReady ? 0 : 1;
      const bReadyRank = b.isReady ? 0 : 1;
      if (aReadyRank !== bReadyRank) return aReadyRank - bReadyRank;
      return a.nickname.localeCompare(b.nickname);
    });
  }, [players, hostId]);

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    const initials: string[] = [];
    for (const part of parts) {
      const match = part.match(/[A-Za-z0-9]/);
      if (match) {
        initials.push(match[0]);
        if (initials.length === 2) break;
      }
    }
    if (initials.length === 0) return '?';
    return initials.join('').toUpperCase();
  }

  function colorForId(id: string): string {
    const palette = ['#dbeafe', '#fde68a', '#dcfce7', '#fee2e2', '#f5d0fe', '#e9d5ff', '#cffafe', '#fae8ff'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }


  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard?.writeText(text);
      return true;
    } catch (err) { console.warn('Clipboard write failed', err); }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      return true;
    } catch (err) {
      console.warn('Textarea copy fallback failed', err);
      return false;
    }
  }

  async function handleCopyRoomCode() {
    const ok = await copyText(roomCode);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="w-full text-center">
      <div className="mx-auto max-w-[640px]">
        <h1 className="font-bold text-[clamp(24px,3.5vw,32px)] leading-tight">Lobby</h1>
        <div className="text-slate-500 mt-1">Get ready to draw! The game will begin shortly.</div>
        <div className="mt-2 flex gap-2 justify-center">
          <div
            className="room-chip"
            aria-label={`Room code ${roomCode}`}
            role="button"
            tabIndex={0}
            title="Click to copy room code"
            onClick={handleCopyRoomCode}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCopyRoomCode(); }}
          >
            <span>Room</span>
            <code>{roomCode}</code>
          </div>
          <button className="copy-btn" title="Copy room code" onClick={handleCopyRoomCode}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 mx-auto mt-4 max-w-[1120px] md:grid-cols-[360px_1fr] items-stretch lobby-grid">
        {/* Players card */}
        <div className="card text-left flex flex-col h-full">
          <h3 className="m-0 mb-2">Players</h3>
          <div className="players">
            {sortedPlayers.map((p) => (
              <div key={p.id} className="player-row">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full border border-slate-200 grid place-items-center text-[12px] font-semibold" style={{ background: colorForId(p.id) }} aria-hidden>
                    {getInitials(p.nickname)}
                  </div>
                  <div className="truncate max-w-[200px]">
                    {p.nickname}
                    {p.id === myId ? ' (you)' : ''}
                  </div>
                </div>
                {p.id === hostId ? (
                  <div className="badge host">Host</div>
                ) : (
                  <div className={p.isReady ? 'badge ready' : 'badge waiting'}>{p.isReady ? 'Ready' : 'Not ready'}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game settings */}
        <div className={isHost ? 'card text-left h-full' : 'card text-left saturate-[0.85] h-full'}>
          <GameSettingsPanel
            isHost={isHost}
            roundDuration={roundDuration}
            category={category}
            onRoundDurationChange={onRoundDurationChange}
            onCategoryChange={onCategoryChange}
          />
        </div>
      </div>

      {/* Actions */}
      {/* Desktop actions */}
      <div className="hidden md:flex gap-3 justify-center max-w-[560px] mx-auto mt-6" role="group" aria-label="Lobby actions">
          {isHost ? (
            <>
              <button className="btn danger cta flex-1 min-w-[160px]" onClick={() => setConfirmOpen(true)}>
                Quit
              </button>
              <div className="label self-center min-w-[88px] text-center" aria-live="polite">
                {readyIncludingHost}/{totalPlayers} ready
              </div>
              <button className="btn primary cta flex-1 min-w-[160px]" onClick={onStart} disabled={!allNonHostReady}>Start Game</button>
            </>
          ) : (
            <>
              <button
                className="btn danger cta flex-1 min-w-[160px]"
                onClick={() => {
                  const othersPresent = players.length > 1;
                  if (othersPresent) setConfirmOpen(true); else onQuit();
                }}
              >
                Quit
              </button>
              <div className="label self-center min-w-[88px] text-center" aria-live="polite">
                {readyIncludingHost}/{totalPlayers} ready
              </div>
              <button className="btn primary cta flex-1 min-w-[160px]" onClick={onToggleReady}>
                {players.find((p) => p.id === myId)?.isReady ? 'Not ready' : "I'm ready"}
              </button>
            </>
          )}
      </div>

      {/* Mobile sticky actions */}
      <div className="md:hidden sticky bottom-0 bg-gradient-to-b from-transparent to-white/95 backdrop-blur border-t border-slate-200 z-10 pt-2" role="group" aria-label="Lobby actions">
        <div className="flex gap-3 items-stretch justify-center max-w-[560px] mx-auto pb-2 px-2">
          {isHost ? (
            <>
              <button className="btn danger cta flex-1 shrink" onClick={() => setConfirmOpen(true)}>
                Quit
              </button>
              <div className="label self-center min-w-0 text-center truncate" aria-live="polite">
                {readyIncludingHost}/{totalPlayers} ready
              </div>
              <button className="btn primary cta flex-1 shrink" onClick={onStart} disabled={!allNonHostReady}>Start Game</button>
            </>
          ) : (
            <>
              <button className="btn danger cta flex-1 shrink"
                onClick={() => {
                  const othersPresent = players.length > 1;
                  if (othersPresent) setConfirmOpen(true); else onQuit();
                }}
              >
                Quit
              </button>
              <div className="label self-center min-w-0 text-center truncate" aria-live="polite">
                {readyIncludingHost}/{totalPlayers} ready
              </div>
              <button className="btn primary cta flex-1 shrink" onClick={onToggleReady}>
                {players.find((p) => p.id === myId)?.isReady ? 'Not ready' : "I'm ready"}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={isHost ? 'Disband lobby?' : 'Leave lobby?'}
        description={isHost ? 'Leaving will disband the lobby for everyone.' : 'You can rejoin with the room code.'}
        confirmLabel={isHost ? 'Disband & Quit' : 'Leave'}
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          onQuit();
        }}
      />
    </div>
  );
}
