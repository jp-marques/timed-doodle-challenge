import { useMemo } from 'react';
import type { JSX } from 'react';
import { Palette, Pipette } from 'lucide-react';

type ColorPickerProps = {
  value: string;
  onChange: (hexColor: string) => void;
  label?: string;
  palette?: string[];
  isEyedropperActive?: boolean;
  onEyedropperToggle?: () => void;
};

export function ColorPicker({ value, onChange, label = 'Color', palette, isEyedropperActive, onEyedropperToggle }: ColorPickerProps): JSX.Element {
  const defaultPalette = useMemo(() => (
    [
      '#EF4444', '#F97316', '#F59E0B', '#10B981', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6',
      '#FECACA', '#FDE68A', '#DCFCE7', /* removed '#CFFAFE' for 5x3 */ '#DBEAFE', '#E9D5FF', '#111827', '#6B7280',
    ]
  ), []);
  const colors = palette ?? defaultPalette;

  function renderSwatches(): JSX.Element {
    return (
      <div className="cp-swatches" role="list" aria-label="Color swatches">
        {colors.map((c) => {
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              className={selected ? 'cp-swatch selected' : 'cp-swatch'}
              style={{ backgroundColor: c }}
              aria-label={`Select ${c}`}
              aria-pressed={selected}
              onClick={() => onChange(c)}
              title={c}
            >
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="colorpicker">
      <div className="cp-header">
        <div className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Palette size={16} /> {label}
        </div>
        <div className="cp-actions">
          <button
            type="button"
            className={isEyedropperActive ? 'btn icon primary' : 'btn icon'}
            onClick={onEyedropperToggle}
            title="Eyedropper (Alt)"
            aria-pressed={!!isEyedropperActive}
            aria-label="Eyedropper"
          >
            <Pipette size={16} />
          </button>
          <div className="cp-chip" style={{ backgroundColor: value }} aria-label={`Current color ${value}`} title={value} />
        </div>
      </div>
      {renderSwatches()}
    </div>
  );
}

export default ColorPicker;


