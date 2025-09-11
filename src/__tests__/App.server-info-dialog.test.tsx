/**
 * Integration tests for the server offline informational dialog.
 */
// import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useGameStore } from '../stores/game';

// Mock sockets
vi.mock('../lib/useSocket', () => ({
  useSocket: () => ({ current: { on: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: false } }),
}));
vi.mock('../lib/useGameSocket', () => ({ useGameSocket: () => {} }));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('App (server info dialog)', () => {
  // Offline + no opt-out should show popup after ~3s (waits 3.1s and queries dialog)
  it('shows after 3s when offline and not opted out', async () => {
    useGameStore.getState().setConnection(false);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Wait real time to allow the 3s dialog delay
    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /server starting up/i })).toBeInTheDocument();
  }, 10000);

  // When localStorage opt-out flag is set, dialog should not appear after waiting
  it('does not show if user opted out previously', async () => {
    localStorage.setItem('td.hideServerInfo', '1');
    useGameStore.getState().setConnection(false);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10000);

  // After dialog shows offline, toggling store to online should close it
  it('auto-closes when connection appears after showing', async () => {
    useGameStore.getState().setConnection(false);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Flip to online
    useGameStore.getState().setConnection(true);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 10000);

  // Clicking "Don't show again" sets opt-out flag and suppresses future dialogs
  it('confirm button hides forever and persists preference', async () => {
    useGameStore.getState().setConnection(false);

    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /don't show again/i }));

    expect(localStorage.getItem('td.hideServerInfo')).toBe('1');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Re-render offline; dialog should not show
    unmount();
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10000);

  // If app starts online, the dialog should never appear
  it('does not show when already online', async () => {
    useGameStore.getState().setConnection(true);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await new Promise((r) => setTimeout(r, 3100));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }, 10000);
});
