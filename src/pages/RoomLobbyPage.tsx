import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Room, Player } from '../types/game';
import { subscribeToRoom, fillEmptySeatsWithAI, startGame } from '../services/roomService';
import {
  Copy,
  Check,
  Crown,
  Bot,
  Users,
  Play,
  Share2,
  ArrowLeft,
  Shield,
  Radio,
} from 'lucide-react';

export const RoomLobbyPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        setRoom(updatedRoom);
        // If the game has already started, jump into the game arena
        if (updatedRoom.game.status === 'in_progress') {
          navigate(`/game/${roomId}`);
        }
      },
      (err) => {
        console.error('Room subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [roomId, navigate]);

  const isHost = userProfile && room && room.hostId === userProfile.uid;

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleFillAI = async () => {
    if (!roomId) return;
    await fillEmptySeatsWithAI(roomId);
  };

  const handleStartGame = async () => {
    if (!roomId) return;
    setStarting(true);
    try {
      // If seats are not yet full, fill remaining with AI automatically before starting
      if (room && room.players.length < room.maxPlayers) {
        await fillEmptySeatsWithAI(roomId);
      }
      await startGame(roomId);
      navigate(`/game/${roomId}`);
    } catch (e) {
      console.error(e);
      setStarting(false);
    }
  };

  if (!room) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Loading Game Arena...</p>
        </div>
      </div>
    );
  }

  const emptySeats = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <div className="room-lobby max-w-4xl mx-auto px-4 py-6">
      {/* Top Navigation */}
      <button
        onClick={() => navigate('/lobby')}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        <span>Back to Lobby</span>
      </button>

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xl mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Radio size={14} className="animate-pulse" />
              <span>Waiting Room</span>
            </div>
            <h1 className="text-2xl font-black text-white">{room.name}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {room.maxPlayers} Players • {room.aiDifficulty.toUpperCase()} AI Difficulty
            </p>
          </div>

          {/* Shareable Room Code & Link */}
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-amber-400 font-mono font-black text-sm hover:border-amber-500/50 transition-all shadow"
            >
              <span>{room.code}</span>
              {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>

            <button
              onClick={copyLink}
              className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
              title="Copy shareable link"
            >
              {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Seats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Filled player slots */}
        {room.players.map((player, idx) => {
          const isMe = userProfile && player.id === userProfile.uid;

          return (
            <div
              key={player.id}
              className="p-4 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md text-center flex flex-col items-center justify-between shadow-lg relative overflow-hidden"
            >
              {player.isHost && (
                <div className="absolute top-3 left-3 bg-amber-500/20 text-amber-400 p-1 rounded-full border border-amber-500/40">
                  <Crown size={12} />
                </div>
              )}

              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/20 my-2 bg-slate-800 relative">
                <img
                  src={player.avatar}
                  alt={player.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full">
                <div className="flex items-center justify-center gap-1">
                  <span className="text-sm font-bold text-white truncate max-w-[130px]">
                    {player.name}
                  </span>
                  {isMe && (
                    <span className="text-[9px] px-1 rounded bg-rose-500 text-white font-bold">
                      YOU
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
                  {player.isAi ? (
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Bot size={12} /> AI Bot
                    </span>
                  ) : (
                    <span>⭐ {player.rating} ELO</span>
                  )}
                </div>
              </div>

              <div className="mt-3 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                READY
              </div>
            </div>
          );
        })}

        {/* Empty Seats */}
        {Array.from({ length: emptySeats }).map((_, i) => (
          <div
            key={`empty_${i}`}
            className="p-6 rounded-3xl bg-slate-950/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center min-h-[190px]"
          >
            <div className="w-12 h-12 rounded-full border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-600 mb-3">
              <Users size={20} />
            </div>
            <span className="text-xs font-bold text-slate-500">Seat {room.players.length + i + 1}</span>
            <span className="text-[10px] text-slate-600 mt-0.5">Waiting for player...</span>
          </div>
        ))}
      </div>

      {/* Host Controls & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-900/60 border border-slate-800">
        <div className="text-xs text-slate-400 text-center sm:text-left">
          {emptySeats > 0 ? (
            <span>
              Waiting for {emptySeats} more player{emptySeats > 1 ? 's' : ''}. Host can fill with AI bots anytime.
            </span>
          ) : (
            <span className="text-emerald-400 font-bold">
              ✓ All seats filled. Ready to roll!
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isHost && emptySeats > 0 && (
            <button
              onClick={handleFillAI}
              className="flex-1 sm:flex-initial py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Bot size={15} className="text-cyan-400" />
              <span>Fill with AI</span>
            </button>
          )}

          {isHost ? (
            <button
              onClick={handleStartGame}
              disabled={starting}
              className="flex-1 sm:flex-initial py-3 px-6 rounded-2xl font-bold text-sm bg-gradient-to-r from-rose-600 to-emerald-600 hover:from-rose-500 hover:to-emerald-500 text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              <Play size={16} />
              <span>{starting ? 'Starting...' : 'Start Match'}</span>
            </button>
          ) : (
            <span className="text-xs text-amber-400 font-bold animate-pulse">
              Waiting for host to start match...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
