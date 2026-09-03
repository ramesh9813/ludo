import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  enterMatchmakingQueue,
  leaveMatchmakingQueue,
  listenForMatch,
  tryFindMatch,
  createInstantMatchWithAI,
} from '../services/matchmaking';
import { createRoom, createLocalRoom, joinRoomByCode } from '../services/roomService';
import type { AIDifficulty } from '../types/game';
import {
  Users,
  Trophy,
  Zap,
  PlusCircle,
  Key,
  Bot,
  Play,
  X,
  Clock,
  Sparkles,
  Gamepad2,
  Cpu,
} from 'lucide-react';

export const LobbyPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Matchmaking queue state
  const [inQueue, setInQueue] = useState(false);
  const [queueTime, setQueueTime] = useState(0);
  const [matchPlayerCount, setMatchPlayerCount] = useState<2 | 3 | 4>(4);

  // Custom Room Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customPlayers, setCustomPlayers] = useState<2 | 3 | 4>(4);
  const [targetHumans, setTargetHumans] = useState<number>(1); // Default to 1 human + 3 bots
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join by code state
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Redirect to landing if not logged in
  useEffect(() => {
    if (!userProfile) {
      navigate('/');
    }
  }, [userProfile, navigate]);

  // Matchmaking timer & auto-match logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let unsubscribeQueue: (() => void) | null = null;

    if (inQueue && userProfile) {
      // 1. Check if match already exists
      tryFindMatch(userProfile, matchPlayerCount).then((matchedRoomId) => {
        if (matchedRoomId) {
          setInQueue(false);
          navigate(`/room/${matchedRoomId}`);
        }
      });

      // 2. Listen for assignment from other matchmakers
      unsubscribeQueue = listenForMatch(userProfile.uid, (matchedRoomId) => {
        setInQueue(false);
        navigate(`/room/${matchedRoomId}`);
      });

      // 3. Increment timer every second
      interval = setInterval(() => {
        setQueueTime((prev) => {
          const nextTime = prev + 1;
          // Every 4 seconds, re-attempt matching
          if (nextTime % 4 === 0 && userProfile) {
            tryFindMatch(userProfile, matchPlayerCount).then((rId) => {
              if (rId) {
                setInQueue(false);
                navigate(`/room/${rId}`);
              }
            });
          }
          return nextTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (unsubscribeQueue) unsubscribeQueue();
    };
  }, [inQueue, userProfile, matchPlayerCount, navigate]);

  const handleStartMatchmaking = async () => {
    if (!userProfile) return;
    setQueueTime(0);
    setInQueue(true);
    await enterMatchmakingQueue(userProfile, matchPlayerCount);
  };

  const handleCancelMatchmaking = async () => {
    if (!userProfile) return;
    setInQueue(false);
    await leaveMatchmakingQueue(userProfile.uid);
  };

  const handleFillWithAIImmediately = async () => {
    if (!userProfile) return;
    setInQueue(false);
    const roomId = await createInstantMatchWithAI(userProfile, matchPlayerCount, 'medium');
    navigate(`/room/${roomId}`);
  };

  // Instant 1 Human vs 3 Computer Bots
  const handlePlayLocal1v3 = () => {
    if (!userProfile) return;
    const roomId = createLocalRoom(userProfile, 4, 'medium');
    navigate(`/game/${roomId}`);
  };

  const handleCreateCustomRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    try {
      setCreatingRoom(true);
      setCreateError(null);
      const roomId = await createRoom(
        userProfile,
        customPlayers,
        targetHumans,
        aiDifficulty,
        isPrivate
      );
      // If 1 human (local/offline bots), jump straight into game!
      if (targetHumans === 1) {
        navigate(`/game/${roomId}`);
      } else {
        navigate(`/room/${roomId}`);
      }
    } catch (err: unknown) {
      console.error(err);
      setCreateError((err as Error).message || 'Failed to create room. Please try again.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !joinCode.trim()) return;
    try {
      setJoining(true);
      setJoinError(null);
      const roomId = await joinRoomByCode(joinCode.trim(), userProfile);
      if (roomId) {
        navigate(`/room/${roomId}`);
      } else {
        setJoinError('Invalid room code. Please check and try again.');
      }
    } catch (err: unknown) {
      setJoinError((err as Error).message || 'Could not join room.');
    } finally {
      setJoining(false);
    }
  };

  if (!userProfile) return null;

  const winRate =
    userProfile.matchesPlayed > 0
      ? Math.round((userProfile.wins / userProfile.matchesPlayed) * 100)
      : 0;

  return (
    <div className="lobby-page max-w-5xl mx-auto px-4 py-6">
      {/* Player Stats Profile Bar */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={userProfile.photoURL}
              alt={userProfile.displayName}
              className="w-16 h-16 rounded-2xl border-2 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)] object-cover bg-slate-800"
            />
            <div className="text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h2 className="text-xl font-black text-white">{userProfile.displayName}</h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                  Tier {userProfile.level}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{userProfile.email}</p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Rating</span>
              <span className="text-base font-black text-amber-400 flex items-center justify-center gap-1">
                <Trophy size={14} />
                {userProfile.rating}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Victories</span>
              <span className="text-base font-black text-emerald-400">{userProfile.wins}</span>
            </div>

            <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Win Rate</span>
              <span className="text-base font-black text-blue-400">{winRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Quick Action: 1 Player vs 3 Computer Bots */}
      <div className="mb-6 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-teal-950/60 border border-emerald-500/40 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Gamepad2 size={28} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
              <Cpu size={12} />
              <span>Instant Local Match</span>
            </div>
            <h3 className="text-xl font-black text-white">Play Local: 1 Player vs 3 Computer Bots</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Jump straight into the board game against 3 adaptive AI opponents. Instant start with zero wait!
            </p>
          </div>
        </div>

        <button
          onClick={handlePlayLocal1v3}
          className="w-full sm:w-auto py-3.5 px-7 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Play size={17} className="fill-slate-950" />
          <span>Start 1 vs 3 Bots</span>
        </button>
      </div>

      {/* Main Game Mode Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Quick Matchmaking */}
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Zap size={15} />
              <span>Online Ranked</span>
            </div>
            <h3 className="text-2xl font-black text-white">Quick Match</h3>
            <p className="text-xs text-slate-400 mt-1">
              Find human players around your skill level (±250 ELO) with live voice audio.
            </p>

            {/* Select player count */}
            <div className="mt-5">
              <span className="text-xs font-bold text-slate-300 block mb-2">
                Select Total Players:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {([2, 3, 4] as const).map((num) => (
                  <button
                    key={num}
                    disabled={inQueue}
                    onClick={() => setMatchPlayerCount(num)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      matchPlayerCount === num
                        ? 'bg-rose-600 border-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {num} Players
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Queue Status / Action Button */}
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            {inQueue ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-rose-500/40 animate-pulse">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                    <Clock size={16} className="animate-spin" />
                    <span>Searching for opponents...</span>
                  </div>
                  <span className="font-mono text-xs font-black text-white">{queueTime}s</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleFillWithAIImmediately}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-emerald-600 text-white font-bold text-xs shadow hover:opacity-90 flex items-center justify-center gap-1.5"
                  >
                    <Bot size={14} />
                    <span>Fill with AI Now</span>
                  </button>
                  <button
                    onClick={handleCancelMatchmaking}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartMatchmaking}
                className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
              >
                <Play size={16} />
                <span>Find Match ({matchPlayerCount} Players)</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Custom Room & Join By Code */}
        <div className="space-y-5">
          {/* Create Custom Room */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <PlusCircle size={15} />
              <span>Custom Table</span>
            </div>
            <h3 className="text-xl font-black text-white">Create Custom Match</h3>
            <p className="text-xs text-slate-400 mt-1">
              Configure human vs computer players (e.g. 1 human + 3 bots), AI difficulty, or invite friends with a code.
            </p>

            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 w-full py-3 rounded-2xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition-all flex items-center justify-center gap-2"
            >
              <PlusCircle size={16} />
              <span>Configure & Host Room</span>
            </button>
          </div>

          {/* Join with Code */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
              <Key size={15} />
              <span>Private Room</span>
            </div>
            <h3 className="text-xl font-black text-white">Join by Room Code</h3>

            <form onSubmit={handleJoinByCode} className="mt-4 flex gap-2">
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 uppercase font-mono tracking-widest px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={joining || !joinCode.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow transition-all active:scale-95"
              >
                {joining ? 'Joining...' : 'Join'}
              </button>
            </form>

            {joinError && (
              <p className="text-xs text-rose-400 mt-2">{joinError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Custom Room Configuration Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800"
            >
              <X size={16} />
            </button>

            <h3 className="text-xl font-black text-white">Configure Custom Room</h3>
            <p className="text-xs text-slate-400 mt-1">Setup player count and AI behavior</p>

            {createError && (
              <p className="mt-3 p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs">
                {createError}
              </p>
            )}

            <form onSubmit={handleCreateCustomRoom} className="mt-5 space-y-4">
              {/* Total Players */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Total Players:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 4] as const).map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setCustomPlayers(count);
                        if (targetHumans > count) setTargetHumans(count);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        customPlayers === count
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {count} Players
                    </button>
                  ))}
                </div>
              </div>

              {/* Humans vs AI */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Real Human Players:
                  </label>
                  <span className="text-[11px] text-amber-400 font-semibold">
                    {customPlayers - targetHumans} Computer (AI) Bots
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: customPlayers }, (_, i) => i + 1).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setTargetHumans(h)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        targetHumans === h
                          ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {h === 1 ? '1 (You)' : `${h} Humans`}
                    </button>
                  ))}
                </div>
                {targetHumans === 1 && (
                  <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                    <Sparkles size={12} />
                    <span>Single Player: You vs {customPlayers - 1} Bots (Starts immediately!)</span>
                  </p>
                )}
              </div>

              {/* AI Difficulty */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  Computer (AI) Difficulty:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setAiDifficulty(diff)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                        aiDifficulty === diff
                          ? 'bg-amber-600 border-amber-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Private Room Toggle (only if more than 1 human) */}
              {targetHumans > 1 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Private Match (Invite Code Only)</span>
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={creatingRoom}
                className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-emerald-600 hover:from-rose-500 hover:to-emerald-500 text-white shadow-lg transition-all active:scale-95"
              >
                {creatingRoom
                  ? 'Creating Room...'
                  : targetHumans === 1
                  ? 'Start Match vs 3 Bots'
                  : 'Create Room & Enter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
