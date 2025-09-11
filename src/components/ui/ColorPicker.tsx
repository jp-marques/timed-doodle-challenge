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
      // Row 1: Primaries & brights
      '#DC2626', // Red
      '#F97316', // Orange
      '#F59E0B', // Yellow-Orange
      '#16A34A', // Green
      '#2563EB', // Blue
    
      // Row 2: Vibrant cools & purples
      '#0EA5E9', // Cyan
      '#14B8A6', // Teal
      '#8B5CF6', // Violet
      '#7C3AED', // Deep Purple
      '#DB2777', // Magenta
    
      // Row 3: Lights & pastels
      '#FFFFFF', // White
      '#FECACA', // Light Pink
      '#FDBA74', // Peach
      '#FEF08A', // Light Yellow
      '#E0F2FE', // Pale Blue
    
      // Row 4: Neutrals & dark grounding tones
      '#111827', // Charcoal
      '#6B7280', // Medium Gray
      '#1E3A8A', // Navy Blue
      '#065F46', // Forest Green
      '#7C2D12', // Dark Brown
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


