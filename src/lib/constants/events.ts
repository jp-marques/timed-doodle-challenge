export const Events = {
  HostRoom: 'host-room',
  JoinRoom: 'join-room',
  LeaveRoom: 'leave-room',
  RejoinRoom: 'rejoin-room',
  ToggleReady: 'toggle-ready',
  StartRound: 'start-round',
  SubmitDrawing: 'submit-drawing',
  UpdateSettings: 'update-settings',

  // Server -> Client
  LobbyUpdate: 'lobby-update',
  SettingsUpdate: 'settings-update',
  RoundStart: 'round-start',
  RoundEnd: 'round-end',
  ChatMessage: 'chat-message',
} as const;

export type EventKey = keyof typeof Events;
export type EventName = (typeof Events)[EventKey];

