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
    <div className="w-full text-center">
      <h2 className="text-[clamp(24px,3.5vw,32px)] font-bold">Results</h2>
      <div className="text-slate-500">Prompt: <b>{prompt}</b></div>
      <ResultsGrid drawings={drawings} players={players} />
      {isHost && (
        <div className="flex justify-center mt-2">
          <button className="btn primary cta min-w-[220px]" onClick={onStartNext}>Start Next Round</button>
        </div>
      )}
      <div className="flex justify-center mt-2">
        <button className="btn danger cta min-w-[220px]" onClick={() => setConfirmQuit(true)}>Quit</button>
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
