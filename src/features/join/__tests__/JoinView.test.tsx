/**
 * JoinView component tests
 *
 * Covers rendering, validation-driven UI state, user interactions,
 * input behavior (uppercase, maxLength), and error display.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinView } from '../JoinView';

// Minimal controlled wrapper to exercise input behavior
function ControlledJoin(
  props?: Partial<React.ComponentProps<typeof JoinView>> & { onCodeChangeSpy?: (v: string) => void }
) {
  const [code, setCode] = useState(props?.inputCode ?? '');
  const handleSet = (v: string) => {
    setCode(v);
    props?.onCodeChangeSpy?.(v);
  };
  return (
    <JoinView
      nickname={props?.nickname ?? 'Alex'}
      inputCode={code}
      joinError={props?.joinError ?? ''}
      setInputCode={props?.setInputCode ?? handleSet}
      onJoin={props?.onJoin ?? vi.fn()}
      onBack={props?.onBack ?? vi.fn()}
    />
  );
}

// Helper to render with plain props (no controlled state needed)
function setup(overrides?: Partial<React.ComponentProps<typeof JoinView>>) {
  const onJoin = vi.fn();
  const onBack = vi.fn();
  const setInputCode = vi.fn();
  render(
    <JoinView
      nickname={overrides?.nickname ?? 'Alex'}
      inputCode={overrides?.inputCode ?? ''}
      joinError={overrides?.joinError ?? ''}
      setInputCode={overrides?.setInputCode ?? setInputCode}
      onJoin={overrides?.onJoin ?? onJoin}
      onBack={overrides?.onBack ?? onBack}
    />
  );
  return { onJoin, onBack, setInputCode };
}

describe('JoinView', () => {
  // Render and a11y basics
  it('renders heading, nickname summary, room code input, and actions', () => {
    setup({ nickname: 'Sam' });
    expect(screen.getByRole('heading', { name: /join room/i })).toBeInTheDocument();
    expect(screen.getByText(/playing as:/i)).toBeInTheDocument();
    expect(screen.getByText(/sam/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ABCDE')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  // Disabled states
  it('disables Join when nickname is invalid', () => {
    setup({ nickname: '' });
    const join = screen.getByRole('button', { name: /join/i });
    expect(join).toBeDisabled();
    expect(join).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables Join when room code is not 5 chars (trimmed)', () => {
    setup({ nickname: 'Alex', inputCode: 'AB' });
    const join = screen.getByRole('button', { name: /join/i });
    expect(join).toBeDisabled();
    expect(join).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables Join when nickname valid and code is 5 chars', () => {
    setup({ nickname: 'Alex', inputCode: 'ABCDE' });
    const join = screen.getByRole('button', { name: /join/i });
    expect(join).toBeEnabled();
  });

  // Uppercase + maxlength behavior
  it('uppercases typed code and enforces max length of 5', async () => {
    render(<ControlledJoin nickname="Alex" inputCode="" />);
    const input = screen.getByPlaceholderText('ABCDE') as HTMLInputElement;
    expect(input).toHaveAttribute('maxlength', '5');

    await userEvent.type(input, 'abcde');
    expect(input.value).toBe('ABCDE');

    await userEvent.type(input, 'f');
    expect(input.value).toBe('ABCDE');
  });

  it('calls setInputCode with uppercased value', async () => {
    const onCodeChangeSpy = vi.fn();
    render(<ControlledJoin nickname="Alex" inputCode="" onCodeChangeSpy={onCodeChangeSpy} />);
    const input = screen.getByPlaceholderText('ABCDE');
    await userEvent.type(input, 'a1b2c');
    // The last call reflects full uppercased content
    expect(onCodeChangeSpy).toHaveBeenLastCalledWith('A1B2C');
  });

  it('trims whitespace-only codes to length 0 and keeps Join disabled', async () => {
    render(<ControlledJoin nickname="Alex" inputCode="" />);
    const input = screen.getByPlaceholderText('ABCDE');
    await userEvent.type(input, '     ');
    const join = screen.getByRole('button', { name: /join/i });
    expect(join).toBeDisabled();
  });

  // Interactions
  it('calls onJoin once when enabled', async () => {
    const { onJoin } = setup({ nickname: 'Alex', inputCode: 'ABCDE' });
    const join = screen.getByRole('button', { name: /join/i });
    await userEvent.click(join);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('does not call onJoin when disabled', async () => {
    const onJoin = vi.fn();
    setup({ nickname: '', inputCode: 'ABCDE', onJoin });
    const join = screen.getByRole('button', { name: /join/i });
    expect(join).toBeDisabled();
    await userEvent.click(join);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('calls onBack once when clicking Back', async () => {
    const { onBack } = setup({ nickname: 'Alex' });
    const back = screen.getByRole('button', { name: /back/i });
    await userEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // Error rendering
  it('renders joinError message when provided', () => {
    setup({ nickname: 'Alex', joinError: 'Room not found' });
    expect(screen.getByText(/room not found/i)).toBeInTheDocument();
  });
});

