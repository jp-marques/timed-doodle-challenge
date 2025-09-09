import { create } from 'zustand';

import type { Player, ChatMessage, LobbyUpdate, SettingsUpdate } from '../types';

type GameState = {
  // Session/room
  roomCode: string;
  inputCode: string;
  nickname: string;
  myId: string | null;
  hostId: string | null;

  // Phase data
  players: Player[];
  prompt: string;
  roundDuration: number;
  category: string | null; // lobby preference; null means random
  roundCategory: string | null; // active round category
  drawings: Record<string, string>;
  endsAtMs: number | null;

  // UI/connection
  isConnected: boolean;
  toastMessage: string | null;

  // Chat
  chatMessages: ChatMessage[];

  // Actions
  setConnection: (v: boolean) => void;
  setNickname: (v: string) => void;
  setInputCode: (v: string) => void;
  setRoomCode: (v: string) => void;
  setMyId: (id: string | null) => void;
  setHostId: (id: string | null) => void;
  setToast: (msg: string | null) => void;

  lobbyUpdate: (update: LobbyUpdate) => void;
  applySettingsUpdate: (payload: SettingsUpdate) => void;
  roundStart: (payload: { prompt: string; duration: number; category?: string; endsAt?: number }) => void;
  roundEnd: (payload: { drawings: Record<string, string> }) => void;
  addChatMessage: (msg: ChatMessage) => void;

  // Clears ephemeral per-room state but not the roomCode
  clearPerRoomState: () => void;
  // Legacy: full clear used when leaving; kept for compatibility
  clearOnLeave: () => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  // Defaults
  roomCode: '',
  inputCode: '',
  nickname: '',
  myId: null,
  hostId: null,

  players: [],
  prompt: '',
  roundDuration: 60,
  category: null,
  roundCategory: null,
  drawings: {},
  endsAtMs: null,

  isConnected: false,
  toastMessage: null,

  chatMessages: [],

  // Actions
  setConnection: (v) => set({ isConnected: v }),
  setNickname: (v) => set({ nickname: v }),
  setInputCode: (v) => set({ inputCode: v }),
  setRoomCode: (v) => set({ roomCode: v }),
  setMyId: (id) => set({ myId: id }),
  setHostId: (id) => set({ hostId: id }),
  setToast: (msg) => set({ toastMessage: msg }),

  lobbyUpdate: (update) => {
    const prevHost = get().hostId;
    if (Array.isArray(update)) {
      // Backwards compatibility mode: array means players list; host is first
      const players = update as unknown as Player[];
      const hostId = players[0]?.id ?? null;
      set({ players, hostId });
    } else {
      set({ players: update.players, hostId: update.hostId });
    }

    // Host change toast
    const { hostId, players } = get();
    if (prevHost && hostId && prevHost !== hostId) {
      const newHost = players.find((p) => p.id === hostId);
      const name = newHost?.nickname || 'Unknown';
      set({ toastMessage: `New host: ${name}` });
      window.setTimeout(() => set({ toastMessage: null }), 3000);
    }

    // If myId is still unknown (older ACKs), derive it from nickname
    const state = get();
    if (!state.myId && state.nickname && state.players.length > 0) {
      const targetName = state.nickname.trim().toLowerCase();
      const self = state.players.find((p) => p.nickname.trim().toLowerCase() === targetName);
      if (self?.id) set({ myId: self.id });
    }
  },

  applySettingsUpdate: (payload) => {
    const patch: Partial<GameState> = {};
    if (typeof payload.roundDuration === 'number') patch.roundDuration = payload.roundDuration;
    if (typeof payload.category !== 'undefined') patch.category = payload.category ?? null;
    set(patch);
  },

  roundStart: ({ prompt, duration, category, endsAt }) => {
    const serverEnds = typeof endsAt === 'number' ? endsAt : (Date.now() + duration * 1000);
    const remainingNow = Math.max(0, Math.ceil((serverEnds - Date.now()) / 1000));
    // Timer value is derived in component; store endsAtMs and other fields
    set({
      prompt,
      roundCategory: category || null,
      endsAtMs: serverEnds,
    });
    // Also add a system chat message summarizing the round
    const msg: ChatMessage = {
      id: 'system',
      nickname: 'System',
      text: `New round started! Draw: ${prompt} (${remainingNow}s)`,
      time: Date.now(),
      isSystem: true,
    };
    const prev = get().chatMessages;
    set({ chatMessages: [...prev.slice(-49), msg] });
  },

  roundEnd: ({ drawings }) => {
    set({ drawings, endsAtMs: null });
  },

  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages.slice(-49), msg] })),

  clearPerRoomState: () => set({
    players: [],
    prompt: '',
    drawings: {},
    roundCategory: null,
    endsAtMs: null,
    hostId: null,
    chatMessages: [],
  }),

  clearOnLeave: () => set({
    roomCode: '',
    inputCode: '',
    players: [],
    prompt: '',
    drawings: {},
    roundCategory: null,
    endsAtMs: null,
    hostId: null,
    chatMessages: [],
  }),
}));
