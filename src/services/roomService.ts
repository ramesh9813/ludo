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
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Room, Player, PlayerColor, AIDifficulty, GameState, UserProfile } from '../types/game';
import { generateRoomCode, createInitialTokens } from './gameLogic';

const COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

const AI_NAMES = ['Aero Bot', 'Cyber Pawn', 'Nova AI', 'Pulse Bot', 'Echo Unit'];
const AI_AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=Aero',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Cyber',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Nova',
  'https://api.dicebear.com/7.x/bottts/svg?seed=Pulse',
];

// Helper to set nested object properties from dot-notation keys (e.g. 'game.diceValue')
function applyNestedUpdates(target: any, updates: Record<string, any>) {
  for (const [key, value] of Object.entries(updates)) {
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = target;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    } else {
      target[key] = value;
    }
  }
}

// Create a 100% Local / Offline Room (Instant 1 Human vs AI Bots)
export function createLocalRoom(
  hostUser: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4,
  aiDifficulty: AIDifficulty = 'medium'
): string {
  const roomId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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

  // Fill remaining slots with AI Bots
  const aiCount = maxPlayers - 1;
  for (let i = 0; i < aiCount; i++) {
    let color: PlayerColor = 'green';
    if (maxPlayers === 2) {
      color = 'yellow';
    } else if (maxPlayers === 3) {
      color = (['red', 'green', 'yellow'] as PlayerColor[])[i + 1];
    } else {
      color = COLORS[i + 1];
    }

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
    status: 'in_progress', // Local 1 vs AI starts directly!
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
        text: `🎲 Local Match started! ${hostPlayer.name} rolls first!`,
        color: 'red',
      },
    ],
  };

  const roomData: Room = {
    id: roomId,
    code: roomCode,
    name: `Local Match (1 vs ${aiCount} Bots)`,
    hostId: hostUser.uid,
    maxPlayers,
    targetHumans: 1,
    autoFillAi: true,
    aiDifficulty,
    isPrivate: true,
    playerUids: [hostUser.uid],
    players,
    game: initialGame,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(roomData));
  } catch (e) {
    console.warn('localStorage error:', e);
  }

  return roomId;
}

// Create Room (Online or Local)
export async function createRoom(
  hostUser: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4,
  targetHumans: number = 4,
  aiDifficulty: AIDifficulty = 'medium',
  isPrivate: boolean = false
): Promise<string> {
  // If targetHumans is 1, create an instant local room for best performance
  if (targetHumans === 1) {
    return createLocalRoom(hostUser, maxPlayers, aiDifficulty);
  }

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

  try {
    await setDoc(roomRef, roomData);
    return roomId;
  } catch (err) {
    console.warn('Firestore createRoom failed, falling back to local room:', err);
    return createLocalRoom(hostUser, maxPlayers, aiDifficulty);
  }
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

// Universal Room State Updater (handles both Firestore and Local rooms)
export async function updateRoomState(roomId: string, updates: Record<string, any>) {
  if (roomId.startsWith('local_')) {
    const raw = localStorage.getItem(`ludo_room_${roomId}`);
    if (raw) {
      try {
        const room = JSON.parse(raw) as Room;
        applyNestedUpdates(room, updates);
        room.updatedAt = Date.now();
        localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(room));
        window.dispatchEvent(new CustomEvent(`ludo_room_update_${roomId}`, { detail: room }));
      } catch (e) {
        console.warn('Local update error:', e);
      }
    }
    return;
  }

  // Online Firestore room
  const roomRef = doc(db, 'rooms', roomId);
  try {
    await updateDoc(roomRef, updates);
  } catch (err) {
    console.warn('Firestore update failed, updating local copy:', err);
    const raw = localStorage.getItem(`ludo_room_${roomId}`);
    if (raw) {
      const room = JSON.parse(raw) as Room;
      applyNestedUpdates(room, updates);
      localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(room));
      window.dispatchEvent(new CustomEvent(`ludo_room_update_${roomId}`, { detail: room }));
    }
  }
}

// Universal Room Subscription (handles both Firestore and Local rooms)
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: Room) => void,
  onError?: (err: Error) => void
): () => void {
  if (roomId.startsWith('local_')) {
    // Initial fetch from localStorage
    const raw = localStorage.getItem(`ludo_room_${roomId}`);
    if (raw) {
      try {
        onUpdate(JSON.parse(raw) as Room);
      } catch (e) {
        if (onError) onError(e as Error);
      }
    }

    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<Room>;
      if (customEvent.detail) {
        onUpdate(customEvent.detail);
      }
    };

    const eventName = `ludo_room_update_${roomId}`;
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }

  // Online Firestore subscription
  const roomRef = doc(db, 'rooms', roomId);
  return onSnapshot(
    roomRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Room;
        localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(data));
        onUpdate(data);
      }
    },
    (err) => {
      console.warn('Firestore subscription warning, checking local storage:', err);
      const raw = localStorage.getItem(`ludo_room_${roomId}`);
      if (raw) {
        try {
          onUpdate(JSON.parse(raw) as Room);
        } catch {}
      }
      if (onError) onError(err);
    }
  );
}

// Fill empty slots with AI bots
export async function fillEmptySeatsWithAI(roomId: string) {
  if (roomId.startsWith('local_')) {
    const raw = localStorage.getItem(`ludo_room_${roomId}`);
    if (!raw) return;
    const room = JSON.parse(raw) as Room;
    const needed = room.maxPlayers - room.players.length;
    if (needed <= 0) return;

    for (let i = 0; i < needed; i++) {
      const color = COLORS[room.players.length % COLORS.length];
      const botIdx = room.players.length;
      room.players.push({
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

    room.updatedAt = Date.now();
    localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(room));
    window.dispatchEvent(new CustomEvent(`ludo_room_update_${roomId}`, { detail: room }));
    return;
  }

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
  if (roomId.startsWith('local_')) {
    const raw = localStorage.getItem(`ludo_room_${roomId}`);
    if (!raw) return;
    const room = JSON.parse(raw) as Room;

    const updatedPlayers = room.players.map((p, idx) => {
      let color: PlayerColor = 'red';
      if (room.maxPlayers === 2) {
        color = idx === 0 ? 'red' : 'yellow';
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

    room.players = updatedPlayers;
    room.game.status = 'in_progress';
    room.game.activePlayerIndex = 0;
    room.game.diceValue = null;
    room.game.diceRolling = false;
    room.game.consecutiveSixes = 0;
    room.game.mustMoveToken = false;
    room.game.validTokenMoves = [];
    room.game.lastActionTimestamp = Date.now();
    room.game.logs.push({
      id: Math.random().toString(36),
      timestamp: Date.now(),
      text: `🎲 Game started! ${updatedPlayers[0].name} rolls first!`,
      color: updatedPlayers[0].color,
    });
    room.updatedAt = Date.now();

    localStorage.setItem(`ludo_room_${roomId}`, JSON.stringify(room));
    window.dispatchEvent(new CustomEvent(`ludo_room_update_${roomId}`, { detail: room }));
    return;
  }

  const roomRef = doc(db, 'rooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as Room;

  const updatedPlayers = room.players.map((p, idx) => {
    let color: PlayerColor = 'red';
    if (room.maxPlayers === 2) {
      color = idx === 0 ? 'red' : 'yellow';
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
