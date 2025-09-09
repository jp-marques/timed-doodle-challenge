// No React import needed for react-jsx runtime
import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { categories } from '../../lib/category';

export function GameSettingsPanel({
  isHost,
  roundDuration,
  category,
  onRoundDurationChange,
  onCategoryChange,
  hideHeader = false,
}: {
  isHost: boolean;
  roundDuration: number;
  category?: string | null;
  onRoundDurationChange: (val: number) => void;
  onCategoryChange?: (cat: string | null) => void;
  hideHeader?: boolean;
}) {
  const durationPresets = useMemo(() => [30, 60, 90, 120] as number[], []);
  const isCustomDuration = !durationPresets.includes(roundDuration);
  const [showCustomDuration, setShowCustomDuration] = useState<boolean>(isHost && isCustomDuration);
  const timersRef = useRef<number[]>([]);
  const [isAutoClosing, setIsAutoClosing] = useState<boolean>(false);

  function clearTimers() {
    for (const id of timersRef.current) clearTimeout(id);
    timersRef.current = [];
  }

  useEffect(() => {
    clearTimers();
    setIsAutoClosing(false);
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

  function clampDuration(value: number): number {
    if (Number.isNaN(value)) return roundDuration;
    const min = 15;
    const max = 300;
    const step = 15;
    const clamped = Math.max(min, Math.min(max, value));
    const snapped = Math.round(clamped / step) * step;
    return snapped;
  }

  return (
    <div className="text-left">
      {!hideHeader && (
        <h3 className="flex items-center justify-between m-0 mb-2">
          <span>Game settings</span>
          {!isHost && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-black/70 text-white px-2 py-1 rounded-full">
              <Lock size={14} />
              <span>Host controls</span>
            </span>
          )}
        </h3>
      )}
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
  );
}

export default GameSettingsPanel;
