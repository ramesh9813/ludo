import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Room, Player, PlayerColor, AIDifficulty, GameState, UserProfile } from '../types/game';
import { generateRoomCode, createInitialTokens, getValidMoves, selectAIMove, executeMove, getNextPlayerIndex } from './gameLogic';

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

const AI_NAMES = ['Aero Bot', 'Cyber Pawn', 'Nova AI', 'Pulse Bot', 'Echo Unit'];
const AI_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aero',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Pulse',
];

export async function createRoom(
  hostUser: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4,
  targetHumans: number = 4,
  aiDifficulty: AIDifficulty = 'medium',
  isPrivate: boolean = false
): Promise<string> {
  const roomRef = doc(collection(db, 'rooms'));
  const roomId = roomRef.id;
  const roomCode = generateRoomCode();

  const hostPlayer: Player = {
    id: hostUser.uid,
    name: hostUser.displayName || 'Player 1',
    avatar: hostUser.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${hostUser.uid}`,
    color: 'red',
    isAi: false,
    isHost: true,
    tokens: createInitialTokens(),
    rating: hostUser.rating || 1200,
  };

  const players: Player[] = [hostPlayer];

  // If host chose AI players from the beginning
  const aiCount = maxPlayers - targetHumans;
  for (let i = 0; i < aiCount; i++) {
    const color = COLORS[players.length];
    players.push({
      id: `ai_${Math.random().toString(36).substring(2, 9)}`,
      name: `${AI_NAMES[i % AI_NAMES.length]} (${aiDifficulty.toUpperCase()})`,
      avatar: AI_AVATARS[i % AI_AVATARS.length],
      color,
      isAi: true,
      aiDifficulty,
      isHost: false,
      tokens: createInitialTokens(),
      rating: hostUser.rating ? Math.round(hostUser.rating + (Math.random() * 60 - 30)) : 1200,
    });
  }

  const initialGame: GameState = {
    status: 'waiting',
    activePlayerIndex: 0,
    diceValue: null,
    diceRolling: false,
    consecutiveSixes: 0,
    mustMoveToken: false,
    validTokenMoves: [],
    winnerIds: [],
    lastActionTimestamp: Date.now(),
    logs: [
      {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `Room created by ${hostPlayer.name}. Waiting for players...`,
      },
    ],
  };

  const roomData: Room = {
    id: roomId,
    code: roomCode,
    name: `${hostPlayer.name}'s Arena`,
    hostId: hostUser.uid,
    maxPlayers,
    targetHumans,
    autoFillAi: true,
    aiDifficulty,
    isPrivate,
    playerUids: [hostUser.uid],
    players,
    game: initialGame,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(roomRef, roomData);
  return roomId;
}

export async function joinRoomByCode(code: string, user: UserProfile): Promise<string | null> {
  const q = query(collection(db, 'rooms'), where('code', '==', code.toUpperCase().trim()));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const roomDoc = snapshot.docs[0];
  const room = roomDoc.data() as Room;

  if (room.players.length >= room.maxPlayers && !room.playerUids.includes(user.uid)) {
    throw new Error('Room is already full');
  }

  // Already joined
  if (room.playerUids.includes(user.uid)) {
    return room.id;
  }

  const color = COLORS[room.players.length % COLORS.length];
  const newPlayer: Player = {
    id: user.uid,
    name: user.displayName || `Player ${room.players.length + 1}`,
    avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
    color,
    isAi: false,
    isHost: false,
    tokens: createInitialTokens(),
    rating: user.rating || 1200,
  };

  const updatedPlayers = [...room.players, newPlayer];
  const updatedUids = [...room.playerUids, user.uid];

  await updateDoc(roomDoc.ref, {
    players: updatedPlayers,
    playerUids: updatedUids,
    updatedAt: Date.now(),
    'game.logs': [
      ...room.game.logs,
      {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `${newPlayer.name} joined the room.`,
        color,
      },
    ],
  });

  return room.id;
}

export function subscribeToRoom(roomId: string, onUpdate: (room: Room) => void, onError?: (err: Error) => void) {
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(
    roomRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data() as Room);
      }
    },
    onError
  );
}

// Host actions: fill empty slots with AI bots
export async function fillEmptySeatsWithAI(roomId: string) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as Room;

  const needed = room.maxPlayers - room.players.length;
  if (needed <= 0) return;

  const newPlayers = [...room.players];
  for (let i = 0; i < needed; i++) {
    const color = COLORS[newPlayers.length % COLORS.length];
    const botIdx = newPlayers.length;
    newPlayers.push({
      id: `ai_${Math.random().toString(36).substring(2, 9)}`,
      name: `${AI_NAMES[botIdx % AI_NAMES.length]} (${room.aiDifficulty.toUpperCase()})`,
      avatar: AI_AVATARS[botIdx % AI_AVATARS.length],
      color,
      isAi: true,
      aiDifficulty: room.aiDifficulty,
      isHost: false,
      tokens: createInitialTokens(),
      rating: 1200 + Math.floor(Math.random() * 50 - 25),
    });
  }

  await updateDoc(roomRef, {
    players: newPlayers,
    updatedAt: Date.now(),
    'game.logs': [
      ...room.game.logs,
      {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `Empty seats filled with AI bots. Ready to roll!`,
      },
    ],
  });
}

// Start game
export async function startGame(roomId: string) {
  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as Room;

  // Assign colors cleanly according to player count
  const updatedPlayers = room.players.map((p, idx) => {
    let color: PlayerColor = 'red';
    if (room.maxPlayers === 2) {
      color = idx === 0 ? 'red' : 'yellow'; // Opposite corners for 2-player
    } else if (room.maxPlayers === 3) {
      color = (['red', 'green', 'yellow'] as PlayerColor[])[idx];
    } else {
      color = COLORS[idx];
    }
    return {
      ...p,
      color,
      tokens: createInitialTokens(),
    };
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    'game.status': 'in_progress',
    'game.activePlayerIndex': 0,
    'game.diceValue': null,
    'game.diceRolling': false,
    'game.consecutiveSixes': 0,
    'game.mustMoveToken': false,
    'game.validTokenMoves': [],
    'game.lastActionTimestamp': Date.now(),
    'game.logs': [
      ...room.game.logs,
      {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `🎲 Game started! ${updatedPlayers[0].name} rolls first!`,
        color: updatedPlayers[0].color,
      },
    ],
    updatedAt: Date.now(),
  });
}
