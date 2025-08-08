import ResultsGrid from '../../components/ResultsGrid';
import type { Player } from '../../types';

export function ResultsView({
  drawings,
  players,
  prompt,
  isHost,
  onStartNext,
  onQuit,
}: {
  drawings: Record<string, string>;
  players: Player[];
  prompt: string;
  isHost: boolean;
  onStartNext: () => void;
  onQuit: () => void;
}) {
  return (
    <div className="panel" style={{ textAlign: 'center' }}>
      <h2>Results</h2>
      <div className="muted">
        Prompt: <b>{prompt}</b>
      </div>
      <ResultsGrid drawings={drawings} players={players} />
      {isHost && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
          <button className="btn primary" onClick={onStartNext}>
            Start Next Round
          </button>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
        <button className="btn danger" onClick={onQuit}>
          Quit
        </button>
      </div>
    </div>
  );
}


