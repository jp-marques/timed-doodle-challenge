import ResultsGrid from './components/ResultsGrid';
import type { Player } from '../../types';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import GameSettingsPanel from '../settings/GameSettingsPanel';

export function ResultsView({
  drawings,
  players,
  prompt,
  isHost,
  roundDuration,
  category,
  onRoundDurationChange,
  onCategoryChange,
  onStartNext,
  onQuit,
}: {
  drawings: Record<string, string>;
  players: Player[];
  prompt: string;
  isHost: boolean;
  roundDuration: number;
  category: string | null;
  onRoundDurationChange: (val: number) => void;
  onCategoryChange?: (cat: string | null) => void;
  onStartNext: () => void;
  onQuit: () => void;
}) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <div className="w-full text-center">
      <h2 className="text-[clamp(24px,3.5vw,32px)] font-bold">Results</h2>
      <div className="text-slate-500">Prompt: <b>{prompt}</b></div>
      <ResultsGrid drawings={drawings} players={players} />
      <div className="flex flex-col items-center mt-2 gap-2">
        {isHost && (
          <button className="btn primary cta min-w-[220px]" onClick={onStartNext}>Start Next Round</button>
        )}
        {isHost && (
          <button className="btn cta min-w-[220px]" onClick={() => setSettingsOpen(true)}>Edit Settings</button>
        )}
        <button className="btn danger cta min-w-[220px]" onClick={() => setConfirmQuit(true)}>Quit</button>
      </div>
      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="settings-title" className="modal-title">Game settings</h2>
            </div>
            <div className="modal-body">
              <GameSettingsPanel
                isHost={isHost}
                roundDuration={roundDuration}
                category={category}
                onRoundDurationChange={onRoundDurationChange}
                onCategoryChange={onCategoryChange}
                hideHeader
              />
            </div>
            <div className="modal-footer">
              <button className="btn inline ghost" onClick={() => setSettingsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
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
