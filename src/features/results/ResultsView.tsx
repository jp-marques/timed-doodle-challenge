import ResultsGrid from './components/ResultsGrid';
import type { Player } from '../../types';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

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
  const [confirmQuit, setConfirmQuit] = useState(false);
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
        <button className="btn danger" onClick={() => setConfirmQuit(true)}>
          Quit
        </button>
      </div>
      <ConfirmDialog
        open={confirmQuit}
        title="Leave game?"
        description="You can rejoin with the room code."
        confirmLabel="Leave"
        cancelLabel="Cancel"
        tone="danger"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => { setConfirmQuit(false); onQuit(); }}
      />
    </div>
  );
}

