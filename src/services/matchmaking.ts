import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfile, Room, AIDifficulty } from '../types/game';
import { createRoom } from './roomService';

export interface QueueTicket {
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  maxPlayers: 2 | 3 | 4;
  roomId?: string;
  matchedWith?: string[];
  createdAt: number;
}

// Join the matchmaking queue
export async function enterMatchmakingQueue(
  user: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4
): Promise<() => void> {
  const ticketRef = doc(db, 'matchmakingQueue', user.uid);
  const ticketData: QueueTicket = {
    userId: user.uid,
    userName: user.displayName || 'Player',
    userAvatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
    rating: user.rating || 1200,
    maxPlayers,
    createdAt: Date.now(),
  };

  await setDoc(ticketRef, ticketData);

  return () => {
    deleteDoc(ticketRef).catch(() => {});
  };
}

// Cancel queue ticket
export async function leaveMatchmakingQueue(userId: string) {
  try {
    const ticketRef = doc(db, 'matchmakingQueue', userId);
    await deleteDoc(ticketRef);
  } catch (e) {
    console.warn('Could not leave queue:', e);
  }
}

// Poll or listen for a match
export function listenForMatch(
  userId: string,
  onMatched: (roomId: string) => void
): () => void {
  const ticketRef = doc(db, 'matchmakingQueue', userId);
  return onSnapshot(ticketRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as QueueTicket;
      if (data.roomId) {
        onMatched(data.roomId);
        deleteDoc(ticketRef).catch(() => {});
      }
    }
  });
}

// Find existing players in queue within ELO range and group them
export async function tryFindMatch(
  user: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4
): Promise<string | null> {
  const queueRef = collection(db, 'matchmakingQueue');
  const q = query(
    queueRef,
    where('maxPlayers', '==', maxPlayers),
    limit(maxPlayers)
  );

  const snap = await getDocs(q);
  const candidates: QueueTicket[] = [];

  snap.forEach((d) => {
    const ticket = d.data() as QueueTicket;
    if (ticket.userId !== user.uid && !ticket.roomId) {
      // Skill check: within 250 ELO points
      const diff = Math.abs(ticket.rating - (user.rating || 1200));
      if (diff <= 300) {
        candidates.push(ticket);
      }
    }
  });

  if (candidates.length >= maxPlayers - 1) {
    // We have a full group!
    const group = [
      { uid: user.uid, name: user.displayName, rating: user.rating, photoURL: user.photoURL },
      ...candidates.map((c) => ({
        uid: c.userId,
        name: c.userName,
        rating: c.rating,
        photoURL: c.userAvatar,
      })),
    ];

    // Create room with group
    const roomId = await createRoom(user, maxPlayers, maxPlayers, 'medium', false);

    // Notify other players by writing roomId to their tickets
    for (const c of candidates) {
      const ticketDoc = doc(db, 'matchmakingQueue', c.userId);
      await updateDoc(ticketDoc, { roomId });
    }

    // Clean up my ticket
    await leaveMatchmakingQueue(user.uid);
    return roomId;
  }

  return null;
}

// Auto-fill with AI fallback when matchmaking wait threshold is reached
export async function createInstantMatchWithAI(
  user: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4,
  difficulty: AIDifficulty = 'medium'
): Promise<string> {
  await leaveMatchmakingQueue(user.uid);
  const roomId = await createRoom(user, maxPlayers, 1, difficulty, false);
  return roomId;
}

// Update user profile and rating
export async function updateUserStats(
  userId: string,
  result: 'win' | 'loss' | 'rank',
  rank: number = 1
) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const user = snap.data() as UserProfile;
  let ratingDelta = 0;
  if (rank === 1) ratingDelta = +25;
  else if (rank === 2) ratingDelta = +10;
  else if (rank === 3) ratingDelta = -10;
  else ratingDelta = -20;

  const newRating = Math.max(600, (user.rating || 1200) + ratingDelta);
  const newWins = (user.wins || 0) + (rank === 1 ? 1 : 0);
  const newLosses = (user.losses || 0) + (rank > 1 ? 1 : 0);
  const newMatches = (user.matchesPlayed || 0) + 1;
  const newLevel = Math.floor(newRating / 200);

  await updateDoc(userRef, {
    rating: newRating,
    wins: newWins,
    losses: newLosses,
    matchesPlayed: newMatches,
    level: newLevel,
    lastActive: Date.now(),
  });
}
