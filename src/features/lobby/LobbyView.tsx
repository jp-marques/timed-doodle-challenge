// No React import needed for react-jsx runtime
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Player } from '../../types';
import { categories } from '../../lib/category';

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

  // Local UI state
  const durationPresets = useMemo(() => [30, 60, 90, 120] as number[], []);
  // Derived: current duration is not one of the presets
  const isCustomDuration = !durationPresets.includes(roundDuration);
  // Keep custom input open for hosts until they explicitly choose a preset
  const [showCustomDuration, setShowCustomDuration] = useState<boolean>(isHost && isCustomDuration);

  const [copied, setCopied] = useState<boolean>(false);

  // If in custom mode and the value equals a preset for 5s, return to preset mode.
  const timersRef = useRef<number[]>([]);
  const [isAutoClosing, setIsAutoClosing] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  function clearTimers() {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
  }
  useEffect(() => {
    clearTimers();
    setIsAutoClosing(false);
    // Non-hosts never show the custom input
    if (!isHost) return;
    if (!showCustomDuration) return;
    if (!durationPresets.includes(roundDuration)) return;
    const idleTimer = window.setTimeout(() => {
      setIsAutoClosing(true);
      const closeTimer = window.setTimeout(() => {
        setShowCustomDuration(false);
        setIsAutoClosing(false);
      }, 220);
      timersRef.current.push(closeTimer as unknown as number);
    }, 5000);
    timersRef.current.push(idleTimer as unknown as number);
    return () => clearTimers();
  }, [showCustomDuration, roundDuration, isHost, durationPresets]);

  const selectedKey = category ?? 'random';

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
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase() || (name[0]?.toUpperCase() ?? '?');
  }

  function colorForId(id: string): string {
    const palette = ['#dbeafe', '#fde68a', '#dcfce7', '#fee2e2', '#f5d0fe', '#e9d5ff', '#cffafe', '#fae8ff'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
  }

  function clampDuration(value: number): number {
    if (Number.isNaN(value)) return roundDuration;
    const min = 15;
    const max = 300;
    const step = 15;
    const clamped = Math.max(min, Math.min(max, value));
    // Snap to nearest step
    const snapped = Math.round(clamped / step) * step;
    return snapped;
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
          <h3 className="flex items-center justify-between m-0 mb-2">
            <span>Game settings</span>
            {!isHost && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-black/70 text-white px-2 py-1 rounded-full">
                <Lock size={14} />
                <span>Host controls</span>
              </span>
            )}
          </h3>
          {!isHost && <div className="text-slate-500">Only hosts can change game settings.</div>}

          {/* Duration */}
          <div className="label mt-2 mb-2">Game duration</div>
          <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Game duration presets">
            {durationPresets.map((v) => {
              const isSelectedPreset = !isCustomDuration && roundDuration === v;
              return (
                <button
                  key={v}
                  className={`rounded-[12px] border px-2.5 py-1 ${isSelectedPreset ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  aria-pressed={isSelectedPreset}
                  onClick={() => {
                    if (!isHost) return;
                    setShowCustomDuration(false);
                    onRoundDurationChange(v);
                  }}
                  disabled={!isHost}
                >
                  {v} s
                </button>
              );
            })}
            <button
              className={`rounded-[12px] border px-2.5 py-1 ${isHost ? (showCustomDuration || isCustomDuration ? 'bg-blue-500 text-white border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900') : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              aria-pressed={isHost ? (showCustomDuration || isCustomDuration) : isCustomDuration}
              onClick={() => isHost && setShowCustomDuration(true)}
              disabled={!isHost}
              aria-label={!isHost && isCustomDuration ? `Custom duration ${roundDuration} seconds` : 'Custom duration'}
            >
              Custom…
            </button>
            {isCustomDuration && !isHost && (
              <span className="self-center text-slate-500 text-sm" aria-live="polite">{roundDuration} s</span>
            )}
          </div>
          {isHost && showCustomDuration && (
            <div className={`flex items-center gap-2 ${isAutoClosing ? 'opacity-0 translate-y-1 transition duration-200' : ''}`}>
              <input
                className="input max-w-[160px]"
                type="number"
                min={15}
                max={300}
                step={15}
                value={roundDuration}
                onChange={(e) => {
                  if (!isHost) return;
                  const value = clampDuration(parseInt(e.target.value));
                  onRoundDurationChange(value);
                }}
                disabled={!isHost}
                aria-label="Custom duration in seconds"
              />
              <div className="label">15–300s, step 15</div>
            </div>
          )}

          {/* Category */}
          <div className="label mt-4 mb-2" id="category-label">Category</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 fill-gap-last-in-2col" role="radiogroup" aria-labelledby="category-label">
            {categories.map((c) => {
              const checked = selectedKey === c.key;
              const disabled = !isHost;
              return (
                <button
                  key={c.key}
                  className={`inline-flex flex-col items-center justify-center gap-2 min-h-[72px] border rounded-[12px] px-2 py-2 ${checked ? 'border-blue-500 ring-2 ring-sky-300' : 'border-slate-200'} ${disabled ? 'opacity-75 cursor-not-allowed' : ''}`}
                role="radio"
                  aria-checked={checked}
                  aria-disabled={disabled}
                  disabled={disabled}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => onCategoryChange?.(c.key === 'random' ? null : c.key)}
                >
                  <span aria-hidden className="[&>*]:w-5 [&>*]:h-5">{c.icon}</span>
                  <span className="text-sm">{c.label}</span>
                </button>
              );
            })}
          </div>
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
