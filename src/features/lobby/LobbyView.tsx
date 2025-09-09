// No React import needed for react-jsx runtime
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Shuffle, PawPrint, Box, Leaf, Utensils, Car, Wand2, Building2, Trophy, Lock } from 'lucide-react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Player } from '../../types';
import './lobby.css';

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
  const [highlightPreset, setHighlightPreset] = useState<boolean>(false);
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
        setHighlightPreset(true);
        const highlightTimer = window.setTimeout(() => setHighlightPreset(false), 240);
        timersRef.current.push(highlightTimer as unknown as number);
      }, 220);
      timersRef.current.push(closeTimer as unknown as number);
    }, 5000);
    timersRef.current.push(idleTimer as unknown as number);
    return () => clearTimers();
  }, [showCustomDuration, roundDuration, isHost, durationPresets]);

  const categories: Array<{ key: string; label: string; icon: JSX.Element }> = [
    { key: 'random', label: 'Random', icon: (<Shuffle size={20} />) },
    { key: 'animals', label: 'Animals', icon: (<PawPrint size={20} />) },
    { key: 'objects', label: 'Objects', icon: (<Box size={20} />) },
    { key: 'nature', label: 'Nature', icon: (<Leaf size={20} />) },
    { key: 'food', label: 'Food', icon: (<Utensils size={20} />) },
    { key: 'vehicles', label: 'Vehicles', icon: (<Car size={20} />) },
    { key: 'fantasy', label: 'Fantasy', icon: (<Wand2 size={20} />) },
    { key: 'buildings', label: 'Buildings', icon: (<Building2 size={20} />) },
    { key: 'sports', label: 'Sports', icon: (<Trophy size={20} />) },
  ];

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
    <div className="panel" style={{ textAlign: 'center' }}>
      <div className="lobby-header">
        <h1>Lobby</h1>
        <div className="lobby-subhead">Get ready to draw! The game will begin shortly.</div>
        <div className="lobby-code">
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
          <button
            className="copy-btn"
            title="Copy room code"
            onClick={handleCopyRoomCode}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="lobby-grid">
        {/* Players card (left) */}
        <div className="card players-card" style={{ textAlign: 'left' }}>
          <h3>Players</h3>
          <div className="players">
            {sortedPlayers.map((p) => (
              <div key={p.id} className="player-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    className="avatar"
                    style={{ background: colorForId(p.id) }}
                    aria-hidden
                  >
                    {getInitials(p.nickname)}
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
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

        {/* Game settings card (right) */}
        <div className={isHost ? 'card' : 'card card-disabled'} style={{ textAlign: 'left' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Game settings</span>
            {!isHost && (
              <span className="disabled-badge">
                <Lock size={14} />
                <span>Host controls</span>
              </span>
            )}
          </h3>
          {!isHost && <div className="muted">Only hosts can change game settings.</div>}

          {/* Duration */}
          <div className="label" style={{ marginBottom: 8 }}>Game duration</div>
          <div className="segment-row" role="group" aria-label="Game duration presets" style={{ marginBottom: 8 }}>
            {durationPresets.map((v) => {
              const isSelectedPreset = !isCustomDuration && roundDuration === v;
              return (
                <button
                  key={v}
                  className={isSelectedPreset && highlightPreset ? 'segment highlight-in' : 'segment'}
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
              className="segment"
              aria-pressed={isHost ? (showCustomDuration || isCustomDuration) : isCustomDuration}
              onClick={() => isHost && setShowCustomDuration(true)}
              disabled={!isHost}
              aria-label={!isHost && isCustomDuration ? `Custom duration ${roundDuration} seconds` : 'Custom duration'}
            >
              Custom…
            </button>
            {isCustomDuration && !isHost && (
              <span className="segment-value" aria-live="polite">{roundDuration} s</span>
            )}
          </div>
          {isHost && showCustomDuration && (
            <div className={isAutoClosing ? 'row fade-out' : 'row'} style={{ gap: 8, alignItems: 'center' }}>
              <input
                style={{ maxWidth: 160 }}
                className="input"
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
          <div className="label" id="category-label" style={{ marginTop: 16, marginBottom: 8 }}>Category</div>
          <div className="category-grid" role="radiogroup" aria-labelledby="category-label">
            {categories.map((c) => {
              const checked = selectedKey === c.key;
              const disabled = !isHost;
              return (
                <button
                  key={c.key}
                  className={checked ? 'category-tile selected' : 'category-tile'}
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={disabled}
                  disabled={disabled}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => onCategoryChange?.(c.key === 'random' ? null : c.key)}
                >
                  <span className="tile-icon" aria-hidden>{c.icon}</span>
                  <span className="tile-label">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="lobby-actions sticky-action" role="group" aria-label="Lobby actions">
        {isHost ? (
          <>
            <button className="btn primary" onClick={onStart} disabled={!allNonHostReady}>Start Game</button>
            <div className="label ready-counter" aria-live="polite" style={{ alignSelf: 'center' }}>
              {readyIncludingHost}/{totalPlayers} ready
            </div>
            <button
              className="btn danger"
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              Quit
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={onToggleReady}>
              {players.find((p) => p.id === myId)?.isReady ? 'Not ready' : "I'm ready"}
            </button>
            <div className="label ready-counter" aria-live="polite" style={{ alignSelf: 'center' }}>
              {readyIncludingHost}/{totalPlayers} ready
            </div>
            <button
              className="btn danger"
              onClick={() => {
                const othersPresent = players.length > 1;
                if (othersPresent) setConfirmOpen(true); else onQuit();
              }}
            >
              Quit
            </button>
          </>
        )}
      </div>

      {/* Toast removed: inline button state provides feedback */}

      {/* Confirm quit dialog */}
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


