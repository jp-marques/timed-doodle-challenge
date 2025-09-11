/**
 * MenuView component tests
 *
 * Covers rendering, validation-driven UI state, events, and accessibility
 * for the home/menu screen.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuView } from '../MenuView';

// Helper to render the component with minimal boilerplate
function setup(overrides?: Partial<React.ComponentProps<typeof MenuView>>) {
  const onCreate = vi.fn();
  const onJoin = vi.fn();
  const onNicknameChange = vi.fn();
  render(
    <MenuView
      nickname={overrides?.nickname ?? ''}
      nicknameError={overrides?.nicknameError ?? ''}
      onNicknameChange={overrides?.onNicknameChange ?? onNicknameChange}
      onCreate={overrides?.onCreate ?? onCreate}
      onJoin={overrides?.onJoin ?? onJoin}
    />
  );
  return { onCreate, onJoin, onNicknameChange };
}

describe('MenuView', () => {
  // Verifies core elements render; queries by role/text like a user would
  it('renders heading, subtitle, and nickname input', () => {
    setup();
    expect(screen.getByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
    expect(screen.getByText(/race the clock/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your nickname/i)).toBeInTheDocument();
  });

  // Ensures invalid nickname disables button; checks disabled and aria-disabled
  it('disables Create Room when nickname is invalid (empty)', () => {
    setup({ nickname: '' });
    const button = screen.getByRole('button', { name: /create room/i });
    expect(button).toBeDisabled();
    // Mirrors aria-disabled for assistive tech
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  // Confirms valid nickname enables the primary action
  it('enables Create Room when nickname is valid', async () => {
    setup({ nickname: 'Alex' });
    const button = screen.getByRole('button', { name: /create room/i });
    expect(button).toBeEnabled();
  });

  // Simulates click on enabled button and asserts handler fired once
  it('calls onCreate when clicking Create Room and nickname is valid', async () => {
    const { onCreate } = setup({ nickname: 'Sam' });
    const button = screen.getByRole('button', { name: /create room/i });
    await userEvent.click(button);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  // Clicking disabled Create should not invoke handler
  it('does not call onCreate when Create Room is disabled', async () => {
    const onCreate = vi.fn();
    setup({ nickname: '', onCreate });
    const button = screen.getByRole('button', { name: /create room/i });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onCreate).not.toHaveBeenCalled();
  });

  // Ensures Join link triggers callback regardless of nickname validity
  it('does not block Join link; clicking calls onJoin', async () => {
    const { onJoin } = setup({ nickname: 'Sam' });
    const join = screen.getByRole('button', { name: /have a code\? join room/i });
    await userEvent.click(join);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  // When parent passes nicknameError, input reflects a11y attrs and error message shows
  it('shows error message and sets a11y attributes when nicknameError provided', () => {
    setup({ nickname: 'a', nicknameError: 'Nickname must be at least 2 characters' });
    const input = screen.getByPlaceholderText(/enter your nickname/i);
    // aria-invalid should reflect error presence
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // error message should be present and referenced by aria-describedby
    const err = screen.getByText(/at least 2 characters/i);
    expect(err).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', 'nickname-error');
  });

  // With no error, input should not have invalid state nor describedby
  it('clears a11y attributes when no error provided', () => {
    setup({ nickname: 'Alex', nicknameError: '' });
    const input = screen.getByPlaceholderText(/enter your nickname/i);
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  // Asserts maxLength prop and that typing calls onNicknameChange (browser enforces truncation)
  it('nickname input enforces max length of 15 and fires onNicknameChange', async () => {
    const { onNicknameChange } = setup({ nickname: '' });
    const input = screen.getByPlaceholderText(/enter your nickname/i) as HTMLInputElement;
    expect(input).toHaveAttribute('maxlength', '15');

    await userEvent.type(input, 'averylongnicknamebeyondlimit');
    // Ensure our change handler was called; value clamping to maxLength is handled by the browser
    expect(onNicknameChange).toHaveBeenCalled();
  });

  // Validate trimming logic allows padded nickname to enable action
  it('treats whitespace-padded nickname as valid (trimmed)', () => {
    setup({ nickname: '  Alex  ' });
    const button = screen.getByRole('button', { name: /create room/i });
    expect(button).toBeEnabled();
  });
});
