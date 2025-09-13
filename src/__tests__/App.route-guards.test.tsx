/**
 * Route guards and phase transitions (Join → Lobby → Draw → Results)
 *
 * Follows TESTING.md conventions: user-centric queries, Arrange/Act/Assert,
 * mock sockets/time/network, and reset state between tests.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useGameStore } from '../stores/game';

// Socket hooks mocked to keep tests fast and deterministic
vi.mock('../lib/useSocket', () => {
  const ref = {
    current: {
      on: vi.fn(),
      // Arrange: emit acks for join/host to drive Lobby
      emit: vi.fn((event: string, ...args: any[]) => {
        const cb = (args[1] ?? args[2]) as ((res: any) => void) | undefined;
        if (event === 'join-room' && typeof cb === 'function') {
          setTimeout(() => cb({ success: true, myId: 'me', token: 't' }), 0);
        } else if (event === 'host-room' && typeof cb === 'function') {
          setTimeout(() => cb({ code: 'ABCDE', myId: 'me', token: 't' }), 0);
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    },
  } as { current: { on: any; emit: any; connect: any; disconnect: any; connected: boolean } };
  return { useSocket: () => ref };
});
vi.mock('../lib/useGameSocket', () => ({ useGameSocket: () => {} }));

// Mock heavy views to keep guard tests fast and avoid DOM/canvas specifics
vi.mock('../features/draw/DrawingView', () => ({
  __esModule: true,
  default: (props: any) => (
    <div role="region" aria-label="Draw View">
      <button disabled={!props?.canSubmit}>Submit Drawing</button>
    </div>
  ),
}));
vi.mock('../features/results/ResultsView', () => ({
  __esModule: true,
  ResultsView: (props: any) => (
    <div>
      <h2>Results</h2>
      <button onClick={props?.onStartNext}>Start Next Round</button>
    </div>
  ),
}));

// Import App after mocks are registered
import App from '../App';

let initialState: ReturnType<typeof useGameStore.getState>;

beforeAll(() => {
  // Capture a snapshot to restore after each test
  initialState = useGameStore.getState();
});

beforeEach(() => {
  // JSDOM: stub canvas context and element.scrollIntoView to avoid runtime errors
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    // Minimal 2D context used by hooks/components
    value: vi.fn(() => ({
      // properties
      imageSmoothingEnabled: true,
      // methods used
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    })),
    configurable: true,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    value: vi.fn(() => 'data:image/png;base64,AAA'),
    configurable: true,
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    value: vi.fn(),
    configurable: true,
  });
});

afterEach(() => {
  // Reset store, timers, and storage
  useGameStore.setState(initialState, true);
  vi.useRealTimers();
  vi.restoreAllMocks();
  try { sessionStorage.clear(); } catch { /* no-op */ }
});

describe('App route guards (roomless redirects)', () => {
  it('redirects roomless user from /lobby to Menu', () => {
    // Arrange: ensure roomless state (default)
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <App />
      </MemoryRouter>
    );
    // Assert: Menu content renders
    expect(screen.getByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
  });

  it('redirects roomless user from /draw to Menu', () => {
    render(
      <MemoryRouter initialEntries={['/draw']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
  });

  it('redirects roomless user from /results to Menu', () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
  });

  it('allows /join when roomless and shows Join view', () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /join room/i })).toBeInTheDocument();
  });
});

describe('App guarded navigation (in-room phases)', () => {
  it('navigates to Lobby after successful Join', async () => {
    // Arrange: prefill valid nickname and code
    useGameStore.getState().setNickname('Alex');
    useGameStore.getState().setInputCode('ABCDE');

    render(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );

    // Act: click Join
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));

    // Assert: Lobby heading appears
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();
  });

  it('transitions to Draw when a round starts', async () => {
    // Arrange: join to reach Lobby first
    useGameStore.getState().setNickname('Alex');
    useGameStore.getState().setInputCode('ABCDE');
    render(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();

    // Act: server starts round (store-driven)
    const now = Date.now();
    useGameStore.getState().roundStart({ prompt: 'Cat', duration: 60, endsAt: now + 60000 });

    // Assert: Draw view placeholder is visible
    expect(await screen.findByRole('button', { name: /submit drawing/i })).toBeInTheDocument();
  });

  it('transitions to Results when the round ends', async () => {
    // Arrange: join to reach Lobby first
    useGameStore.getState().setNickname('Alex');
    useGameStore.getState().setInputCode('ABCDE');
    render(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();

    // Act: server ends round (store-driven)
    useGameStore.getState().roundEnd({ drawings: { me: 'data:image/png;base64,AAA' } });

    // Assert: Results heading visible
    expect(await screen.findByRole('heading', { name: /results/i })).toBeInTheDocument();
  });

  it('returns to Menu when leaving the room', async () => {
    // Arrange: join and start a round to be in Draw
    useGameStore.getState().setNickname('Alex');
    useGameStore.getState().setInputCode('ABCDE');
    render(
      <MemoryRouter initialEntries={['/join']}>
        <App />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: /^join$/i }));
    expect(await screen.findByRole('heading', { name: /lobby/i })).toBeInTheDocument();
    useGameStore.getState().roundStart({ prompt: 'Dog', duration: 60, endsAt: Date.now() + 60000 });
    await screen.findByRole('button', { name: /submit drawing/i });

    // Act: clear room (simulate leaving)
    useGameStore.getState().clearOnLeave();

    // Assert: Menu visible again
    expect(await screen.findByRole('heading', { name: /timed doodle/i })).toBeInTheDocument();
  });
});
