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



