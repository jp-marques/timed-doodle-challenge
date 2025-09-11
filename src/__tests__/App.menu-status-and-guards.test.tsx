/**
 * Integration tests for Menu status tag and guarded navigation.
 */
// import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useGameStore } from '../stores/game';

// Reuse socket mocks to avoid network activity
vi.mock('../lib/useSocket', () => ({
  useSocket: () => ({ current: { on: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: true } }),
}));
vi.mock('../lib/useGameSocket', () => ({ useGameSocket: () => {} }));

describe('App (menu status + guards)', () => {
  // Sets isConnected=true and expects the "Server Connected" tag to render
  it('shows Server Connected tag when online', () => {
    useGameStore.getState().setConnection(true);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText(/server connected/i)).toBeInTheDocument();
  });

  // Sets isConnected=false and expects the "Server Offline" tag to render
  it('shows Server Offline tag when offline', () => {
    useGameStore.getState().setConnection(false);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText(/server offline/i)).toBeInTheDocument();
  });

  // Leaves nickname empty, clicks Join, and asserts we remain on Menu (no Join heading)
  it('does not navigate to Join when nickname is invalid', async () => {
    // Ensure nickname is empty/invalid
    useGameStore.getState().setNickname('');
    useGameStore.getState().setConnection(true);

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /have a code\? join room/i }));

    // Should remain on menu; Join heading should not render
    expect(screen.getByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /join/i })).not.toBeInTheDocument();
  });
});
