/**
 * LobbyView component tests
 *
 * Covers players list ordering and badges, ready counts and actions,
 * quit flows with confirmation dialog, room code copy interactions
 * (click and keyboard), settings panel host vs non-host behavior,
 * and mobile action group parity.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LobbyView } from '../LobbyView';

type Player = React.ComponentProps<typeof LobbyView>["players"][number];

function makePlayers(): Player[] {
  return [
    { id: 'h1', nickname: 'Hosty', isReady: false },
    { id: 'a1', nickname: 'Alice', isReady: true },
    { id: 'b1', nickname: 'Bob', isReady: false },
  ];
}

function setup(overrides?: Partial<React.ComponentProps<typeof LobbyView>>) {
  const players = overrides?.players ?? makePlayers();
  const onStart = vi.fn();
  const onToggleReady = vi.fn();
  const onQuit = vi.fn();
  const onRoundDurationChange = vi.fn();
  const onCategoryChange = vi.fn();

  const result = render(
    <LobbyView
      players={players}
      roomCode={overrides?.roomCode ?? 'ABCD'}
      isHost={overrides?.isHost ?? true}
      roundDuration={overrides?.roundDuration ?? 60}
      category={overrides?.category ?? null}
      onRoundDurationChange={overrides?.onRoundDurationChange ?? onRoundDurationChange}
      onCategoryChange={overrides?.onCategoryChange ?? onCategoryChange}
      onStart={overrides?.onStart ?? onStart}
      onToggleReady={overrides?.onToggleReady ?? onToggleReady}
      onQuit={overrides?.onQuit ?? onQuit}
      myId={overrides?.myId ?? 'h1'}
      hostId={overrides?.hostId ?? 'h1'}
    />
  );
  return { ...result, onStart, onToggleReady, onQuit, onRoundDurationChange, onCategoryChange };
}

describe('LobbyView', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders lobby heading and room code UI', () => {
    setup();
    expect(screen.getByRole('heading', { name: /lobby/i })).toBeInTheDocument();
    // Chip and button
    expect(screen.getByRole('button', { name: /room code abcd/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^copy$/i })).toBeInTheDocument();
  });

  it('lists players with host first, then ready users, then alphabetical, and shows badges', () => {
    const { container } = setup({
      players: [
        { id: 'b1', nickname: 'Bob', isReady: false },
        { id: 'h1', nickname: 'Hosty', isReady: false }, // host out of order on purpose
        { id: 'c1', nickname: 'Charlie', isReady: true },
        { id: 'a1', nickname: 'Alice', isReady: true },
      ],
      myId: 'h1',
      hostId: 'h1',
      isHost: true,
    });

    const playersList = container.querySelector('.players') as HTMLElement;
    const rows = Array.from(playersList.querySelectorAll('.player-row')) as HTMLElement[];
    const order = rows.map((r) => r.textContent || '');
    // Expect host first, then ready (Alice, Charlie sorted), then Bob
    expect(order[0]).toMatch(/Hosty/);
    expect(order[1]).toMatch(/Alice/);
    expect(order[2]).toMatch(/Charlie/);
    expect(order[3]).toMatch(/Bob/);

    // Badges (exact text to avoid matching nickname "Hosty")
    expect(within(rows[0]).getByText(/^host$/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/ready/i)).toBeInTheDocument();
    expect(within(rows[3]).getByText(/not ready/i)).toBeInTheDocument();
  });

  it('marks the current user with (you)', () => {
    const players = [
      { id: 'h1', nickname: 'Hosty', isReady: false },
      { id: 'me1', nickname: 'MeSelf', isReady: false },
    ];
    setup({ players, myId: 'me1', hostId: 'h1', isHost: false });
    expect(screen.getByText(/MeSelf \(you\)/)).toBeInTheDocument();
  });

  it('computes initials for avatars', () => {
    const players = [
      { id: 'h1', nickname: 'Mary Jane', isReady: false }, // → MJ
      { id: 'a1', nickname: 'bob', isReady: false }, // → B
    ];
    const { container } = setup({ players, myId: 'h1', hostId: 'h1', isHost: true });
    const rows = Array.from((container.querySelector('.players') as HTMLElement).querySelectorAll('.player-row')) as HTMLElement[];
    // Avatar div is the small circle with text, aria-hidden; grab first child text
    const firstAvatar = rows[0].querySelector('.w-7') as HTMLElement;
    const secondAvatar = rows[1].querySelector('.w-7') as HTMLElement;
    expect(firstAvatar.textContent).toBe('MJ');
    expect(secondAvatar.textContent).toBe('B');
  });

  it('shows ready count including host and disables/enables Start Game appropriately (desktop actions)', async () => {
    const user = userEvent.setup();
    const players = [
      { id: 'h1', nickname: 'Hosty', isReady: false },
      { id: 'a1', nickname: 'Alice', isReady: true },
      { id: 'b1', nickname: 'Bob', isReady: false },
    ];
    const { rerender, onStart } = setup({ players, isHost: true, myId: 'h1', hostId: 'h1' });

    // 2/3 ready (host counts even if not marked ready)
    expect(screen.getAllByText(/2\/3 ready/i).length).toBeGreaterThan(0);
    const startBtn = screen.getAllByRole('button', { name: /start game/i })[0];
    expect(startBtn).toBeDisabled();

    // Make all non-hosts ready → button enabled
    players[2].isReady = true;
    rerender(
      <LobbyView
        players={[...players]}
        roomCode={'ABCD'}
        isHost={true}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={onStart}
        onToggleReady={vi.fn()}
        onQuit={vi.fn()}
        myId={'h1'}
        hostId={'h1'}
      />
    );
    const enabledStart = screen.getAllByRole('button', { name: /start game/i })[0];
    expect(enabledStart).toBeEnabled();
    await user.click(enabledStart);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('non-host ready toggle fires and label reflects readiness after rerender', async () => {
    const user = userEvent.setup();
    const players = [
      { id: 'h1', nickname: 'Hosty', isReady: false },
      { id: 'me1', nickname: 'Me', isReady: false },
    ];
    const { rerender, onToggleReady } = setup({ players, isHost: false, myId: 'me1', hostId: 'h1' });
    const toggleBtn = screen.getAllByRole('button', { name: /i'm ready/i })[0];
    await user.click(toggleBtn);
    expect(onToggleReady).toHaveBeenCalledTimes(1);

    // After store updates and component re-renders with ready=true, label flips
    players[1].isReady = true;
    rerender(
      <LobbyView
        players={[...players]}
        roomCode={'ABCD'}
        isHost={false}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={vi.fn()}
        onToggleReady={onToggleReady}
        onQuit={vi.fn()}
        myId={'me1'}
        hostId={'h1'}
      />
    );
    expect(screen.getAllByRole('button', { name: /not ready/i })[0]).toBeInTheDocument();
  });

  it('host quit opens disband dialog; confirm calls onQuit; cancel closes', async () => {
    const user = userEvent.setup();
    const { onQuit } = setup({ isHost: true, myId: 'h1', hostId: 'h1' });
    // Desktop action (first group)
    const [desktopActions] = screen.getAllByRole('group', { name: /lobby actions/i });
    await user.click(within(desktopActions).getByRole('button', { name: /quit/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /disband lobby\?/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Open again and confirm
    await user.click(within(desktopActions).getByRole('button', { name: /quit/i }));
    await user.click(screen.getByRole('button', { name: /disband & quit/i }));
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('non-host quit: alone leaves immediately; with others shows confirm', async () => {
    const user = userEvent.setup();
    // Alone → immediate onQuit
    let players = [{ id: 'me1', nickname: 'Me', isReady: false }];
    let onQuit = vi.fn();
    const { rerender } = setup({ isHost: false, myId: 'me1', hostId: 'h1', players, onQuit });
    const [desktopActions] = screen.getAllByRole('group', { name: /lobby actions/i });
    await user.click(within(desktopActions).getByRole('button', { name: /quit/i }));
    expect(onQuit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // With others → confirm dialog
    players = [
      { id: 'h1', nickname: 'Hosty', isReady: false },
      { id: 'me1', nickname: 'Me', isReady: false },
    ];
    onQuit = vi.fn();
    rerender(
      <LobbyView
        players={players}
        roomCode={'ABCD'}
        isHost={false}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={vi.fn()}
        onToggleReady={vi.fn()}
        onQuit={onQuit}
        myId={'me1'}
        hostId={'h1'}
      />
    );
    await user.click(within(screen.getAllByRole('group', { name: /lobby actions/i })[0]).getByRole('button', { name: /quit/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /leave lobby\?/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it('provides two action groups (desktop and mobile), and mobile actions behave similarly', async () => {
    const user = userEvent.setup();
    // Initial render: host with not all non-hosts ready
    const onStart = vi.fn();
    const onToggleReady = vi.fn();
    const { rerender } = render(
      <LobbyView
        players={[{ id: 'h1', nickname: 'Hosty', isReady: false }, { id: 'a1', nickname: 'Alice', isReady: true }, { id: 'b1', nickname: 'Bob', isReady: false }]}
        roomCode={'ABCD'}
        isHost={true}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={onStart}
        onToggleReady={onToggleReady}
        onQuit={vi.fn()}
        myId={'h1'}
        hostId={'h1'}
      />
    );
    const groups = screen.getAllByRole('group', { name: /lobby actions/i });
    expect(groups.length).toBe(2);
    const mobile = groups[1];
    expect(within(mobile).getByRole('button', { name: /start game/i })).toBeDisabled();

    // Rerender: all non-hosts ready → Start enabled in mobile section
    rerender(
      <LobbyView
        players={[{ id: 'h1', nickname: 'Hosty', isReady: false }, { id: 'a1', nickname: 'Alice', isReady: true }, { id: 'b1', nickname: 'Bob', isReady: true }]}
        roomCode={'ABCD'}
        isHost={true}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={onStart}
        onToggleReady={onToggleReady}
        onQuit={vi.fn()}
        myId={'h1'}
        hostId={'h1'}
      />
    );
    const mobile2 = screen.getAllByRole('group', { name: /lobby actions/i })[1];
    const startBtn2 = within(mobile2).getByRole('button', { name: /start game/i });
    expect(startBtn2).toBeEnabled();
    await user.click(startBtn2);
    expect(onStart).toHaveBeenCalledTimes(1);

    // Non-host mobile ready toggle
    rerender(
      <LobbyView
        players={[{ id: 'h1', nickname: 'Hosty', isReady: false }, { id: 'me1', nickname: 'Me', isReady: false }]}
        roomCode={'ABCD'}
        isHost={false}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={vi.fn()}
        onToggleReady={onToggleReady}
        onQuit={vi.fn()}
        myId={'me1'}
        hostId={'h1'}
      />
    );
    const mobile3 = screen.getAllByRole('group', { name: /lobby actions/i })[1];
    const readyBtn = within(mobile3).getByRole('button', { name: /i'm ready/i });
    await user.click(readyBtn);
    expect(onToggleReady).toHaveBeenCalledTimes(1);
  });

  it('host settings: presets enabled', () => {
    setup({ isHost: true });
    const preset60 = screen.getByRole('button', { name: /60 s/i });
    expect(preset60).toBeEnabled();
  });

  it('non-host settings: presets and radios disabled with Host controls indicator', () => {
    render(
      <LobbyView
        players={makePlayers()}
        roomCode={'ABCD'}
        isHost={false}
        roundDuration={60}
        onRoundDurationChange={vi.fn()}
        onStart={vi.fn()}
        onToggleReady={vi.fn()}
        onQuit={vi.fn()}
        myId={'a1'}
        hostId={'h1'}
      />
    );
    const indicator = screen.getByText(/host controls/i);
    expect(indicator).toBeInTheDocument();
    // Single component rendered; first 60 s is the only one
    const preset60Disabled = screen.getByRole('button', { name: /60 s/i });
    expect(preset60Disabled).toBeDisabled();
    // Category radios are role="radio"; ensure aria-disabled/disabled present
    const radios = screen.getAllByRole('radio');
    for (const r of radios) {
      expect(r).toHaveAttribute('aria-disabled', 'true');
      expect(r).toBeDisabled();
    }
  });

  it('copies room code via copy button and shows Copied! state', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    setup({ roomCode: 'WXYZ' });
    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    await user.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith('WXYZ');
    expect(copyBtn).toHaveTextContent(/copied!/i);
  });

  it('copies room code from the room chip via Enter and Space keys', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup({ roomCode: 'EF12' });
    const chip = screen.getByRole('button', { name: /room code ef12/i });
    chip.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' '); // Space key
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith('EF12');
  });

  it('falls back to document.execCommand("copy") when clipboard write fails', async () => {
    const user = userEvent.setup();
    // Make clipboard.writeText reject to trigger fallback
    const failingClipboard = { writeText: vi.fn().mockRejectedValue(new Error('nope')) } as Pick<Clipboard, 'writeText'> as Clipboard;
    Object.defineProperty(navigator, 'clipboard', { value: failingClipboard, configurable: true });
    type DocWithExec = Document & { execCommand: (commandId: string) => boolean };
    const docWithExec = document as DocWithExec;
    if (typeof (docWithExec as unknown as { execCommand?: unknown }).execCommand !== 'function') {
      docWithExec.execCommand = (() => true) as (commandId: string) => boolean;
    }
    const execMock = vi.fn<(commandId: string) => boolean>(() => true) as (commandId: string) => boolean;
    docWithExec.execCommand = execMock;

    setup({ roomCode: 'CODE1' });
    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    await user.click(copyBtn);
    expect(execMock).toHaveBeenCalledWith('copy');
  });
});
