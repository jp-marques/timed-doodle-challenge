export type Player = {
  id: string;
  nickname: string;
  isReady?: boolean;
};

export type ChatMessage = {
  id: string; // player id or 'system'
  nickname: string;
  text: string;
  time: number;
  isSystem?: boolean;
};

// Lobby update payload types for backwards compatibility
export type LobbyUpdateV1 = Player[];
export type LobbyUpdateV2 = {
  players: Player[];
  hostId: string;
};
export type LobbyUpdate = LobbyUpdateV1 | LobbyUpdateV2;

export type SettingsUpdate = {
  roundDuration?: number;
  category?: string | null;
};



