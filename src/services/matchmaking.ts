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
import { createRoom, joinRoomByCode } from './roomService';

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

// Join the matchmaking queue (works for both Google and Guest players)
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

  await setDoc(ticketRef, ticketData).catch((e) => console.warn('Queue write:', e));

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

// Find existing players in queue (including guest players) or open public rooms
export async function tryFindMatch(
  user: UserProfile,
  maxPlayers: 2 | 3 | 4 = 4
): Promise<string | null> {
  try {
    // 1. First check if an open public room already exists with available seats
    const roomsRef = collection(db, 'rooms');
    const openRoomsQuery = query(
      roomsRef,
      where('maxPlayers', '==', maxPlayers),
      where('isPrivate', '==', false),
      limit(10)
    );

    const openRoomsSnap = await getDocs(openRoomsQuery).catch(() => null);
    if (openRoomsSnap && !openRoomsSnap.empty) {
      for (const roomDoc of openRoomsSnap.docs) {
        const room = roomDoc.data() as Room;
        if (
          room.game.status === 'waiting' &&
          room.players.length < room.maxPlayers &&
          !room.playerUids.includes(user.uid)
        ) {
          const joinedId = await joinRoomByCode(room.code, user);
          if (joinedId) {
            await leaveMatchmakingQueue(user.uid);
            return joinedId;
          }
        }
      }
    }

    // 2. Check matchmaking queue for other players (including guests!)
    const queueRef = collection(db, 'matchmakingQueue');
    const q = query(
      queueRef,
      where('maxPlayers', '==', maxPlayers),
      limit(10)
    );

    const snap = await getDocs(q).catch(() => null);
    if (!snap || snap.empty) return null;

    const candidates: QueueTicket[] = [];

    snap.forEach((d) => {
      const ticket = d.data() as QueueTicket;
      if (ticket.userId !== user.uid && !ticket.roomId) {
        // Skill check: within 350 ELO points
        const diff = Math.abs(ticket.rating - (user.rating || 1200));
        if (diff <= 350) {
          candidates.push(ticket);
        }
      }
    });

    // If we have at least 1 other human player/guest
    if (candidates.length >= 1) {
      const selectedCandidates = candidates.slice(0, maxPlayers - 1);
      const totalHumans = 1 + selectedCandidates.length;

      // Create room with all matched humans (and fill any remaining seats with AI bots)
      const roomId = await createRoom(user, maxPlayers, totalHumans, 'medium', false);

      // Notify other players/guests by updating their queue ticket with roomId
      for (const c of selectedCandidates) {
        const ticketDoc = doc(db, 'matchmakingQueue', c.userId);
        await updateDoc(ticketDoc, { roomId }).catch(() => {});
      }

      await leaveMatchmakingQueue(user.uid);
      return roomId;
    }
  } catch (err) {
    console.warn('tryFindMatch error:', err);
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
  try {
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
  } catch (e) {
    console.warn('Failed to update stats online:', e);
  }
}
