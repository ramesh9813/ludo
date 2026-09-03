export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface TokenState {
  id: number; // 0, 1, 2, 3
  step: number; // -1: base, 0..50: board track, 51..55: home path, 56: Home!
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: PlayerColor;
  isAi: boolean;
  aiDifficulty?: AIDifficulty;
  isHost: boolean;
  tokens: TokenState[];
  rating: number;
  isMuted?: boolean;
  isSpeaking?: boolean;
  hasFinished?: boolean;
  finishRank?: number;
  disconnected?: boolean;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  text: string;
  color?: PlayerColor;
}

export interface GameState {
  status: 'waiting' | 'in_progress' | 'completed';
  activePlayerIndex: number;
  diceValue: number | null;
  diceRolling: boolean;
  consecutiveSixes: number;
  mustMoveToken: boolean;
  validTokenMoves: number[]; // indices of tokens that can move
  winnerIds: string[];
  lastActionTimestamp: number;
  logs: GameLogEntry[];
}

export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: 2 | 3 | 4;
  targetHumans: number;
  autoFillAi: boolean;
  aiDifficulty: AIDifficulty;
  isPrivate: boolean;
  playerUids: string[];
  players: Player[];
  game: GameState;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  rating: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  level: number;
  lastActive: number;
}

export interface WebRTCSignal {
  id?: string;
  senderId: string;
  receiverId: string;
  type: 'offer' | 'answer' | 'candidate';
  payload: string; // JSON stringified RTCSessionDescriptionInit or RTCIceCandidateInit
  timestamp: number;
}
