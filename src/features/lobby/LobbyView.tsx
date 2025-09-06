// No React import needed for react-jsx runtime
import { useMemo, type JSX } from 'react';
import type { Player } from '../../types';

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
}) {
  const hostId = useMemo(() => (players.length > 0 ? players[0].id : undefined), [players]);
  const allNonHostReady = useMemo(() => players.filter(p => p.id !== hostId).every(p => p.isReady), [players, hostId]);

  const categories: Array<{ key: string; label: string; icon: JSX.Element }> = [
    { key: 'random', label: 'Random', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 5h3m8 0h3M5 19h3m8 0h3M8 5l8 8m0-8L8 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )},
    { key: 'animals', label: 'Animals', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12c1.5-1.5 3-3 6-3s4.5 1.5 6 3m-9 3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )},
    { key: 'objects', label: 'Objects', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
    )},
    { key: 'nature', label: 'Nature', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v18m6-12c0 3.314-2.686 6-6 6s-6-2.686-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )},
    { key: 'food', label: 'Food', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 12h12M8 7h8M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
    )},
    { key: 'vehicles', label: 'Vehicles', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13h18l-2-5H5l-2 5zm3 5a2 2 0 100-4 2 2 0 000 4zm12 0a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
    )},
    { key: 'fantasy', label: 'Fantasy', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
    )},
    { key: 'buildings', label: 'Buildings', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20h16V8l-4-3-4 3-4-3-4 3v12zM8 12h2m4 0h2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
    )},
    { key: 'sports', label: 'Sports', icon: (
      <svg className="chip-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 3a12 12 0 000 18M12 3a12 12 0 010 18M3 12h18" stroke="currentColor" strokeWidth="2"/></svg>
    )},
  ];

  const selectedKey = category ?? 'random';

  const sortedPlayers = useMemo(() => {
    const list = [...players];
    // Host first
    list.sort((a, b) => (a.id === hostId ? -1 : b.id === hostId ? 1 : 0));
    // Then ready, then waiting within non-hosts
    return list.map(p => p).sort((a, b) => {
      if (a.id === hostId || b.id === hostId) return 0;
      const ar = a.isReady ? 0 : 1;
      const br = b.isReady ? 0 : 1;
      if (ar !== br) return ar - br;
      return a.nickname.localeCompare(b.nickname);
    });
  }, [players, hostId]);

  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <div className="lobby-header">
        <h2>Lobby</h2>
        <div className="lobby-subhead">Get ready to draw! The game will begin shortly.</div>
        <div className="lobby-code">
          <div className="room-chip" aria-label={`Room code ${roomCode}`}>
            <span>Room</span>
            <code>{roomCode}</code>
          </div>
          <button className="copy-btn" onClick={() => navigator.clipboard?.writeText(roomCode)}>Copy</button>
        </div>
      </div>

      <div className="lobby-grid">
        {/* Players card (left) */}
        <div className="card" style={{ textAlign: 'left' }}>
          <h3>Players</h3>
          <div className="players">
            {sortedPlayers.map((p) => (
              <div key={p.id} className="player-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: '#eef2ff', border: '1px solid var(--line)' }} />
                  <div>
                    {p.nickname}
                    {p.id === myId ? ' (you)' : ''}
                  </div>
                </div>
                {p.id === hostId ? (
                  <div className="badge host">Host</div>
                ) : (
                  <div className={p.isReady ? 'badge ready' : 'badge waiting'}>{p.isReady ? 'Ready' : 'Waiting'}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Game settings card (right) */}
        <div className="card" style={{ textAlign: 'left' }}>
          <h3>Game settings</h3>
          <div className="label" style={{ marginBottom: 8 }}>Category</div>
          <div className="chip-rail" role="radiogroup" aria-label="Category">
            {categories.map((c) => {
              const checked = selectedKey === c.key;
              const disabled = !isHost;
              return (
                <button
                  key={c.key}
                  className="chip-item"
                  role="radio"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() => onCategoryChange?.(c.key === 'random' ? null : c.key)}
                >
                  {c.icon}
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ height: 12 }} />
          <div className="label" style={{ marginBottom: 8 }}>Duration (seconds)</div>
          <div className="preset-row" style={{ marginBottom: 8 }}>
            {[30, 60, 90, 120].map((v) => (
              <button key={v} className="preset" aria-pressed={roundDuration === v} onClick={() => isHost && onRoundDurationChange(v)} disabled={!isHost}>
                {v}
              </button>
            ))}
          </div>
          <input
            style={{ maxWidth: 140 }}
            className="input"
            type="number"
            min={15}
            max={300}
            step={15}
            value={roundDuration}
            onChange={(e) => isHost && onRoundDurationChange(parseInt(e.target.value))}
            disabled={!isHost}
          />
          <div className="label" style={{ marginTop: 6 }}>15–300s, step 15</div>
        </div>
      </div>

      {/* Actions */}
      <div className="card sticky-action" style={{ margin: '0 auto', maxWidth: 640, textAlign: 'center' }}>
        {isHost ? (
          <button className="btn primary" onClick={onStart} disabled={!allNonHostReady}>Start Game</button>
        ) : (
          <button className="btn primary" onClick={onToggleReady}>
            {players.find((p) => p.id === myId)?.isReady ? 'Unready' : "I'm ready"}
          </button>
        )}
        <div style={{ marginTop: 8 }}>
          <button className="btn danger" onClick={onQuit}>Quit</button>
        </div>
      </div>
    </div>
  );
}


