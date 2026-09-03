import type { User } from "firebase/auth";
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import type { UserProfile } from '../types/game';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (customName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync profile from Firestore or create initial doc
  const syncProfile = async (uid: string, name: string, email: string, photoURL: string) => {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      setUserProfile(snap.data() as UserProfile);
    } else {
      const initialProfile: UserProfile = {
        uid,
        displayName: name || 'Ludo Master',
        email: email || '',
        photoURL: photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${uid}`,
        rating: 1200,
        wins: 0,
        losses: 0,
        matchesPlayed: 0,
        level: 6,
        lastActive: Date.now(),
      };
      await setDoc(userRef, initialProfile);
      setUserProfile(initialProfile);
    }

    // Subscribe to live profile changes
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    });
  };

  useEffect(() => {
    // Check local demo / guest user
    const guestData = localStorage.getItem('ludo_guest_profile');
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        unsubscribeFirestore = await syncProfile(
          user.uid,
          user.displayName || 'Champion',
          user.email || '',
          user.photoURL || ''
        );
        localStorage.removeItem('ludo_guest_profile');
      } else if (guestData) {
        try {
          const parsed = JSON.parse(guestData) as UserProfile;
          setUserProfile(parsed);
        } catch {}
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.warn('Popup failed or blocked, falling back to redirect:', err);
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        console.error('Google Sign-In failed:', redirectErr);
        throw redirectErr;
      }
    }
  };

  const signInAsGuest = async (customName?: string) => {
    const guestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const guestProfile: UserProfile = {
      uid: guestId,
      displayName: customName || `Player_${guestId.substring(6, 10)}`,
      email: `${guestId}@guest.local`,
      photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${guestId}`,
      rating: 1200,
      wins: 0,
      losses: 0,
      matchesPlayed: 0,
      level: 6,
      lastActive: Date.now(),
    };
    localStorage.setItem('ludo_guest_profile', JSON.stringify(guestProfile));
    setUserProfile(guestProfile);
  };

  const signOut = async () => {
    localStorage.removeItem('ludo_guest_profile');
    setUserProfile(null);
    setCurrentUser(null);
    await fbSignOut(auth).catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        signInAsGuest,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
