import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Room, Player, GameLogEntry } from '../types/game';
import { subscribeToRoom, updateRoomState } from '../services/roomService';
import {
  canTokenMove,
  getValidMoves,
  executeMove,
  getNextPlayerIndex,
  selectAIMove,
} from '../services/gameLogic';
import { updateUserStats } from '../services/matchmaking';
import { WebRTCVoiceManager } from '../services/webrtcVoice';
import { sounds } from '../audio/soundEffects';

import { LudoBoard } from '../components/LudoBoard';
import { Dice3D } from '../components/Dice3D';
import { PlayerCard } from '../components/PlayerCard';
import { VoiceChatBar } from '../components/VoiceChatBar';
import { PostGameModal } from '../components/PostGameModal';

import { ArrowLeft, MessageSquare, Volume2, Info } from 'lucide-react';

export const GamePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<Room | null>(null);
  const [turnTimer, setTurnTimer] = useState<number>(20);
  const [showLogs, setShowLogs] = useState(false);

  // WebRTC Voice Chat State
  const voiceManagerRef = useRef<WebRTCVoiceManager | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Sound chime tracking for active turn change
  const prevActivePlayerRef = useRef<number>(-1);

  // Connect to room snapshot
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        setRoom(updatedRoom);
      },
      (err) => console.error('Subscription error:', err)
    );

    return () => unsubscribe();
  }, [roomId]);

  // Voice Chat initialization & signaling
  const enableMic = useCallback(async () => {
    if (!roomId || !userProfile) return;

    if (!voiceManagerRef.current) {
      voiceManagerRef.current = new WebRTCVoiceManager({
        onSpeakingChange: (speaking) => {
          setIsSpeaking(speaking);
          // Broadcast speaking indicator to room
          updateRoomState(roomId, {
            players: (room?.players || []).map((p) =>
              p.id === userProfile.uid ? { ...p, isSpeaking: speaking } : p
            ),
          }).catch(() => {});
        },
        onError: (err) => console.warn('Voice error:', err),
      });
    }

    const ok = await voiceManagerRef.current.initMic();
    if (ok) {
      setIsMicActive(true);
      const allHumanUids = (room?.players || []).filter((p) => !p.isAi).map((p) => p.id);
      voiceManagerRef.current.startSignaling(roomId, userProfile.uid, allHumanUids);
    }
  }, [roomId, userProfile, room?.players]);

  const toggleMute = () => {
    if (voiceManagerRef.current) {
      const muted = voiceManagerRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.leave();
        voiceManagerRef.current = null;
      }
    };
  }, []);

  // Turn Chime sound when active player changes to current client
  useEffect(() => {
    if (!room || !userProfile) return;
    const activePlayer = room.players[room.game.activePlayerIndex];
    if (activePlayer && activePlayer.id === userProfile.uid && prevActivePlayerRef.current !== room.game.activePlayerIndex) {
      sounds.playTurnChime();
    }
    prevActivePlayerRef.current = room.game.activePlayerIndex;
  }, [room?.game.activePlayerIndex, userProfile, room?.players]);

  // Turn timer countdown (20s turn limit)
  useEffect(() => {
    if (!room || room.game.status !== 'in_progress') return;

    const timer = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          // Time expired! Auto-skip or trigger AI auto-move
          handleTurnTimeout();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [room?.game.activePlayerIndex, room?.game.diceValue, room?.game.mustMoveToken]);

  // Reset timer on turn change
  useEffect(() => {
    setTurnTimer(20);
  }, [room?.game.activePlayerIndex]);

  // If active player is an AI, automate their turn
  useEffect(() => {
    if (!room || !roomId || room.game.status !== 'in_progress') return;

    const activePlayer = room.players[room.game.activePlayerIndex];
    if (!activePlayer || !activePlayer.isAi) return;

    // Only host drives AI state updates to avoid multi-client collisions
    const isHostOrFirstClient =
      userProfile &&
      (room.hostId === userProfile.uid ||
        room.players.find((p) => !p.isAi)?.id === userProfile.uid);

    if (!isHostOrFirstClient) return;

    // Phase 1: AI needs to roll
    if (!room.game.diceRolling && room.game.diceValue === null) {
      const rollTimeout = setTimeout(async () => {
        await executeDiceRoll(true);
      }, 600);
      return () => clearTimeout(rollTimeout);
    }

    // Phase 2: AI rolled, needs to pick a token
    if (room.game.mustMoveToken && room.game.diceValue !== null) {
      const moveTimeout = setTimeout(async () => {
        const validMoves = room.game.validTokenMoves;
        if (validMoves.length > 0) {
          const chosenTokenId = selectAIMove(
            room.players,
            room.game.activePlayerIndex,
            validMoves,
            room.game.diceValue!,
            activePlayer.aiDifficulty
          );
          await handleMoveToken(chosenTokenId);
        } else {
          // No moves available, pass turn
          await passTurnToNext(room.players, room.game.activePlayerIndex, 'No valid moves available.');
        }
      }, 800);
      return () => clearTimeout(moveTimeout);
    }
  }, [
    room?.game.activePlayerIndex,
    room?.game.diceRolling,
    room?.game.diceValue,
    room?.game.mustMoveToken,
    roomId,
    userProfile,
  ]);

  // Execute Dice Roll
  const executeDiceRoll = async (isAiCall: boolean = false) => {
    if (!room || !roomId) return;
    const activePlayer = room.players[room.game.activePlayerIndex];
    const isMyTurn = userProfile && activePlayer.id === userProfile.uid;

    if (!isMyTurn && !isAiCall) return;
    if (room.game.diceRolling || room.game.mustMoveToken) return;

    // Generate roll (1 to 6)
    const rolledValue = Math.floor(Math.random() * 6) + 1;

    // Check triple six penalty
    const consecutiveSixes = rolledValue === 6 ? room.game.consecutiveSixes + 1 : 0;
    if (consecutiveSixes >= 3) {
      // Forfeit turn!
      const nextIdx = getNextPlayerIndex(room.players, room.game.activePlayerIndex);
      const forfeitLog: GameLogEntry = {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `⚠️ ${activePlayer.name} rolled THREE 6s in a row! Turn forfeited.`,
        color: activePlayer.color,
      };

      await updateRoomState(roomId, {
        'game.diceValue': 6,
        'game.diceRolling': false,
        'game.consecutiveSixes': 0,
        'game.mustMoveToken': false,
        'game.validTokenMoves': [],
        'game.activePlayerIndex': nextIdx,
        'game.logs': [...room.game.logs, forfeitLog],
        'game.lastActionTimestamp': Date.now(),
      });
      return;
    }

    // Set rolling animation in room
    await updateRoomState(roomId, {
      'game.diceRolling': true,
      'game.diceValue': rolledValue,
    });

    // Settle roll after animation delay
    setTimeout(async () => {
      const validMoves = getValidMoves(activePlayer.tokens, rolledValue);

      const rollLog: GameLogEntry = {
        id: Math.random().toString(36),
        timestamp: Date.now(),
        text: `🎲 ${activePlayer.name} rolled a ${rolledValue}!`,
        color: activePlayer.color,
      };

      if (validMoves.length === 0) {
        // No moves possible for this roll
        const passLog: GameLogEntry = {
          id: Math.random().toString(36),
          timestamp: Date.now(),
          text: `⏩ No valid moves for ${activePlayer.name}. Passing turn.`,
          color: activePlayer.color,
        };

        const nextIdx = getNextPlayerIndex(room.players, room.game.activePlayerIndex);

        await updateRoomState(roomId, {
          'game.diceRolling': false,
          'game.diceValue': rolledValue,
          'game.consecutiveSixes': consecutiveSixes,
          'game.mustMoveToken': false,
          'game.validTokenMoves': [],
          'game.activePlayerIndex': nextIdx,
          'game.logs': [...room.game.logs, rollLog, passLog],
          'game.lastActionTimestamp': Date.now(),
        });
      } else {
        // Tokens can move! Wait for player selection
        await updateRoomState(roomId, {
          'game.diceRolling': false,
          'game.diceValue': rolledValue,
          'game.consecutiveSixes': consecutiveSixes,
          'game.mustMoveToken': true,
          'game.validTokenMoves': validMoves,
          'game.logs': [...room.game.logs, rollLog],
          'game.lastActionTimestamp': Date.now(),
        });
      }
    }, 350);
  };

  // Move Token
  const handleMoveToken = async (tokenId: number) => {
    if (!room || !roomId || !room.game.diceValue) return;
    const activePlayer = room.players[room.game.activePlayerIndex];

    const result = executeMove(
      room.players,
      room.game.activePlayerIndex,
      tokenId,
      room.game.diceValue
    );

    // Audio effects based on move outcome
    if (result.capturedOpponent) {
      sounds.playCapture();
    } else if (result.reachedHome) {
      sounds.playHomeFinish();
    } else {
      sounds.playTokenHop();
    }

    const moveLog: GameLogEntry = {
      id: Math.random().toString(36),
      timestamp: Date.now(),
      text: result.logText,
      color: activePlayer.color,
    };

    // Check if game has concluded (either someone won or all finished)
    const winner = result.updatedPlayers.find((p) => p.hasFinished && p.finishRank === 1);
    const isGameFinished = !!winner;

    let nextPlayerIdx = room.game.activePlayerIndex;
    let nextConsecutiveSixes = room.game.consecutiveSixes;

    if (!result.bonusTurn) {
      // Normal turn over, advance to next player
      nextPlayerIdx = getNextPlayerIndex(result.updatedPlayers, room.game.activePlayerIndex);
      nextConsecutiveSixes = 0;
    }

    await updateRoomState(roomId, {
      players: result.updatedPlayers,
      'game.status': isGameFinished ? 'completed' : 'in_progress',
      'game.activePlayerIndex': isGameFinished ? room.game.activePlayerIndex : nextPlayerIdx,
      'game.diceValue': null,
      'game.diceRolling': false,
      'game.consecutiveSixes': nextConsecutiveSixes,
      'game.mustMoveToken': false,
      'game.validTokenMoves': [],
      'game.winnerIds': isGameFinished ? [winner.id] : [],
      'game.logs': [...room.game.logs, moveLog],
      'game.lastActionTimestamp': Date.now(),
      updatedAt: Date.now(),
    });

    // If game ended, record stats
    if (isGameFinished && userProfile) {
      const myRank = result.updatedPlayers.find((p) => p.id === userProfile.uid)?.finishRank || 2;
      updateUserStats(userProfile.uid, myRank === 1 ? 'win' : 'rank', myRank).catch(() => {});
    }
  };

  // Pass Turn on timeout or no moves
  const passTurnToNext = async (players: Player[], currentIdx: number, reason: string) => {
    if (!roomId || !room) return;
    const nextIdx = getNextPlayerIndex(players, currentIdx);

    await updateRoomState(roomId, {
      'game.activePlayerIndex': nextIdx,
      'game.diceValue': null,
      'game.diceRolling': false,
      'game.consecutiveSixes': 0,
      'game.mustMoveToken': false,
      'game.validTokenMoves': [],
      'game.logs': [
        ...room.game.logs,
        {
          id: Math.random().toString(36),
          timestamp: Date.now(),
          text: `⏱️ ${players[currentIdx].name} turn ended (${reason}).`,
        },
      ],
      'game.lastActionTimestamp': Date.now(),
    });
  };

  // Turn Timeout Handler
  const handleTurnTimeout = async () => {
    if (!room || !roomId) return;
    const activePlayer = room.players[room.game.activePlayerIndex];

    // If it was supposed to roll: auto-roll or pass
    if (!room.game.mustMoveToken) {
      await passTurnToNext(room.players, room.game.activePlayerIndex, 'Time expired');
    } else if (room.game.validTokenMoves.length > 0) {
      // Auto move the first valid token
      await handleMoveToken(room.game.validTokenMoves[0]);
    }
  };

  if (!room) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Loading Game Board...</p>
        </div>
      </div>
    );
  }

  const activePlayer = room.players[room.game.activePlayerIndex];
  const isMyTurn = userProfile && activePlayer && activePlayer.id === userProfile.uid;
  const humanCount = room.players.filter((p) => !p.isAi).length;
  const topPlayers = room.players.slice(0, Math.ceil(room.players.length / 2));
  const bottomPlayers = room.players.slice(Math.ceil(room.players.length / 2));
  const activeDot =
    activePlayer.color === 'red'
      ? '#DC2626'
      : activePlayer.color === 'green'
        ? '#16A34A'
        : activePlayer.color === 'yellow'
          ? '#EAB308'
          : '#2563EB';

  return (
    <div className="w-full h-[calc(100dvh-64px)] flex flex-col overflow-hidden bg-slate-950">
      {/* Slim full-width top strip — no margins */}
      <div className="shrink-0 h-11 flex items-center gap-2 px-2 border-b border-slate-800 bg-slate-900">
        <button
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Exit</span>
        </button>

        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-black/40"
            style={{ backgroundColor: activeDot }}
          />
          <span className="text-xs font-black text-white truncate">
            {isMyTurn ? 'YOUR TURN' : activePlayer.name}
          </span>
          <span className="text-[11px] font-mono font-bold text-amber-300 bg-slate-800 px-1.5 py-0.5 rounded-md shrink-0">
            {turnTimer}s
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold">
            {humanCount} online
          </span>
          {isMicActive ? (
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-lg border text-xs font-bold ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                  : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <Volume2 size={14} />
            </button>
          ) : (
            <button
              onClick={enableMic}
              className="px-2 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Join Voice
            </button>
          )}
          <button
            onClick={() => setShowLogs(!showLogs)}
            className={`p-1.5 rounded-lg border transition-all ${
              showLogs
                ? 'bg-rose-600/20 border-rose-500/60 text-rose-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Match log"
          >
            <MessageSquare size={14} />
          </button>
        </div>
      </div>

      {/* Middle: players + square board, fills all remaining space */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Desktop left players */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col gap-2 p-3 overflow-y-auto border-r border-slate-800 bg-slate-900/40">
          {topPlayers.map((p, idx) => (
            <PlayerCard
              key={p.id}
              player={p}
              isActive={room.game.activePlayerIndex === idx}
              isCurrentClient={userProfile?.uid === p.id}
              onToggleMute={toggleMute}
              timerSeconds={room.game.activePlayerIndex === idx ? turnTimer : undefined}
            />
          ))}
          <div className="mt-auto hidden xl:block w-full">
            <VoiceChatBar
              voiceManager={voiceManagerRef.current}
              isMicActive={isMicActive}
              isMuted={isMuted}
              isSpeaking={isSpeaking}
              onEnableMic={enableMic}
              onToggleMute={toggleMute}
              humanCount={humanCount}
            />
          </div>
        </div>

        {/* Mobile top players */}
        <div className="lg:hidden shrink-0 flex gap-2 px-2 pt-2 overflow-x-auto">
          {topPlayers.map((p, idx) => (
            <div key={p.id} className="flex-1 min-w-[168px]">
              <PlayerCard
                player={p}
                isActive={room.game.activePlayerIndex === idx}
                isCurrentClient={userProfile?.uid === p.id}
                onToggleMute={toggleMute}
                timerSeconds={room.game.activePlayerIndex === idx ? turnTimer : undefined}
              />
            </div>
          ))}
        </div>

        {/* Center: square board, zero margin/padding, always square */}
        <div className="flex-1 min-h-0 min-w-0 flex items-center justify-center bg-[#070d1a] p-0">
          <div className="aspect-square w-[min(100vw,calc(100dvh-268px))] lg:w-[min(calc(100vw-512px),calc(100dvh-158px))] max-w-full max-h-full leading-none">
            <LudoBoard
              players={room.players}
              activePlayerIndex={room.game.activePlayerIndex}
              validTokenMoves={room.game.validTokenMoves}
              canMove={Boolean(isMyTurn) && room.game.mustMoveToken}
              onSelectToken={handleMoveToken}
            />
          </div>
        </div>

        {/* Mobile bottom players */}
        <div className="lg:hidden shrink-0 flex gap-2 px-2 pb-2 overflow-x-auto">
          {bottomPlayers.map((p, idx) => {
            const actualIdx = topPlayers.length + idx;
            return (
              <div key={p.id} className="flex-1 min-w-[168px]">
                <PlayerCard
                  player={p}
                  isActive={room.game.activePlayerIndex === actualIdx}
                  isCurrentClient={userProfile?.uid === p.id}
                  onToggleMute={toggleMute}
                  timerSeconds={room.game.activePlayerIndex === actualIdx ? turnTimer : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* Desktop right players */}
        <div className="hidden lg:flex w-64 shrink-0 flex-col gap-2 p-3 overflow-y-auto border-l border-slate-800 bg-slate-900/40">
          {bottomPlayers.map((p, idx) => {
            const actualIdx = topPlayers.length + idx;
            return (
              <PlayerCard
                key={p.id}
                player={p}
                isActive={room.game.activePlayerIndex === actualIdx}
                isCurrentClient={userProfile?.uid === p.id}
                onToggleMute={toggleMute}
                timerSeconds={room.game.activePlayerIndex === actualIdx ? turnTimer : undefined}
              />
            );
          })}
          <div className="mt-auto text-[11px] text-slate-500 font-mono px-1 flex items-center gap-1.5">
            <Info size={12} />
            <span>Exact roll needed for home</span>
          </div>
        </div>
      </div>

      {/* Bottom dice bar — full width, compact */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-3 py-1.5 flex items-center justify-center gap-5">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold">
          <Info size={13} />
          <span>{room.game.mustMoveToken ? 'Tap a glowing token' : isMyTurn ? 'Roll the dice' : `Waiting on ${activePlayer.name}…`}</span>
        </div>
        <Dice3D
          value={room.game.diceValue}
          isRolling={room.game.diceRolling}
          canRoll={Boolean(isMyTurn) && !room.game.mustMoveToken && !room.game.diceRolling}
          playerColor={activePlayer.color}
          onRoll={() => executeDiceRoll(false)}
          size={56}
        />
      </div>

      {/* Slide-out Event / Game Log Modal */}
      {showLogs && (
        <div className="fixed bottom-4 right-4 z-40 w-80 max-h-72 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl p-3 flex flex-col backdrop-blur-xl animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <MessageSquare size={13} />
              <span>Match Log</span>
            </span>
            <button
              onClick={() => setShowLogs(false)}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1 font-mono text-[11px]">
            {room.game.logs.slice(-15).reverse().map((entry) => (
              <div key={entry.id} className="text-slate-300">
                <span className="text-slate-500 mr-1">
                  [{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                </span>
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-Game Victory Modal */}
      {room.game.status === 'completed' && (
        <PostGameModal
          players={room.players}
          currentUserProfile={userProfile}
          onPlayAgain={() => navigate('/lobby')}
          onReturnToLobby={() => navigate('/lobby')}
        />
      )}
    </div>
  );
};
