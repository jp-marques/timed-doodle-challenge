/**
 * Integration test: Menu → Join navigation
 *
 * Renders the real App under a MemoryRouter, with socket hooks mocked.
 * Ensures clicking the Join action from the Menu navigates to /join and
 * the Join view renders when the nickname is valid.
 */
// import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useGameStore } from '../stores/game';

// Mock socket hooks to avoid actual socket activity during tests
vi.mock('../lib/useSocket', () => ({
  useSocket: () => ({ current: { on: vi.fn(), emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), connected: true } }),
}));
vi.mock('../lib/useGameSocket', () => ({ useGameSocket: () => {} }));

describe('App (menu navigation)', () => {
  // Preloads a valid nickname, clicks Join, and expects Join view heading to appear
  it('navigates to join when nickname is valid and Join clicked', async () => {
    // Preload a valid nickname in the store
    useGameStore.getState().setNickname('Alex');

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    // Click the "Have a code? Join room" action
    await userEvent.click(screen.getByRole('button', { name: /have a code\? join room/i }));

    // Join view should render
    expect(await screen.findByRole('heading', { name: /join/i })).toBeInTheDocument();
  });
});
