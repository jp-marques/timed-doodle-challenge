// No React import needed for react-jsx runtime
import type { Player } from '../../types';

export function LobbyView({
  players,
  roomCode,
  isHost,
  roundDuration,
  onRoundDurationChange,
  onStart,
  onToggleReady,
  onQuit,
  myId,
}: {
  players: Player[];
  roomCode: string;
  isHost: boolean;
  roundDuration: number;
  onRoundDurationChange: (val: number) => void;
  onStart: () => void;
  onToggleReady: () => void;
  onQuit: () => void;
  myId?: string;
}) {
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <h2>Lobby</h2>
      <div>
        Room code: <code>{roomCode}</code>
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {players.map((p) => (
          <div key={p.id} className="list-item row between">
            <div>
              {p.nickname}
              {p.id === myId ? ' (you)' : ''}
            </div>
            <div className={p.isReady ? 'tag ready' : 'tag'}>{p.isReady ? 'Ready' : 'Waiting'}</div>
          </div>
        ))}
      </div>
      {isHost ? (
        <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 8 }}>
          <div className="label">Round duration (s)</div>
          <input
            style={{ maxWidth: 120 }}
            className="input"
            type="number"
            min={15}
            max={300}
            step={15}
            value={roundDuration}
            onChange={(e) => onRoundDurationChange(parseInt(e.target.value))}
          />
          <button className="btn primary" onClick={onStart} disabled={!players.every((p) => p.isReady)}>
            Start
          </button>
        </div>
      ) : (
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button className="btn primary" onClick={onToggleReady}>
            {players.find((p) => p.id === myId)?.isReady ? 'Unready' : "I'm ready"}
          </button>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
        <button className="btn danger" onClick={onQuit}>
          Quit
        </button>
      </div>
    </div>
  );
}


