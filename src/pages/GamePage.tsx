import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Room, Player, GameLogEntry } from '../types/game';
import { subscribeToRoom } from '../services/roomService';
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
          const roomRef = doc(db, 'rooms', roomId);
          updateDoc(roomRef, {
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
      }, 800);
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
      }, 1000);
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
    const roomRef = doc(db, 'rooms', roomId);

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

      await updateDoc(roomRef, {
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

    // Set rolling animation in firestore
    await updateDoc(roomRef, {
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

        await updateDoc(roomRef, {
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
        await updateDoc(roomRef, {
          'game.diceRolling': false,
          'game.diceValue': rolledValue,
          'game.consecutiveSixes': consecutiveSixes,
          'game.mustMoveToken': true,
          'game.validTokenMoves': validMoves,
          'game.logs': [...room.game.logs, rollLog],
          'game.lastActionTimestamp': Date.now(),
        });
      }
    }, 900);
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

    const roomRef = doc(db, 'rooms', roomId);

    await updateDoc(roomRef, {
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
    const roomRef = doc(db, 'rooms', roomId);

    await updateDoc(roomRef, {
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

  return (
    <div className="game-arena max-w-6xl mx-auto px-3 sm:px-4 py-4 min-h-[calc(100vh-64px)] flex flex-col justify-between">
      {/* Top Bar: Back, Voice Chat Bar, Log Toggle */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
        <button
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
        >
          <ArrowLeft size={16} />
          <span>Exit Table</span>
        </button>

        {/* Live Voice Chat Bar */}
        <div className="w-full sm:w-auto flex-1 max-w-md mx-auto">
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

        {/* Game Log Drawer Button */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all self-end sm:self-auto ${
            showLogs
              ? 'bg-rose-600/20 border-rose-500/60 text-rose-300'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare size={14} />
          <span>Log</span>
        </button>
      </div>

      {/* Main Board & Players Layout */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 my-auto">
        {/* Left / Top Players (e.g. Green and Red) */}
        <div className="w-full lg:w-48 flex lg:flex-col gap-3 justify-between">
          {room.players.slice(0, Math.ceil(room.players.length / 2)).map((p, idx) => (
            <div key={p.id} className="flex-1 lg:flex-initial">
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

        {/* Center: Ludo Board + Rolling Action Area */}
        <div className="flex flex-col items-center gap-4">
          <LudoBoard
            players={room.players}
            activePlayerIndex={room.game.activePlayerIndex}
            validTokenMoves={room.game.validTokenMoves}
            canMove={isMyTurn && room.game.mustMoveToken}
            onSelectToken={handleMoveToken}
          />

          {/* Interactive 3D Dice & Turn Banner */}
          <div className="flex items-center justify-center gap-8 py-2 px-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
            <div className="text-center sm:text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Current Turn
              </span>
              <span className="text-sm font-black text-white flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{
                    backgroundColor:
                      activePlayer.color === 'red'
                        ? '#ef4444'
                        : activePlayer.color === 'green'
                        ? '#22c55e'
                        : activePlayer.color === 'yellow'
                        ? '#eab308'
                        : '#3b82f6',
                  }}
                />
                {isMyTurn ? 'YOUR TURN' : activePlayer.name}
              </span>
            </div>

            {/* 3D Dice */}
            <Dice3D
              value={room.game.diceValue}
              isRolling={room.game.diceRolling}
              canRoll={isMyTurn && !room.game.mustMoveToken && !room.game.diceRolling}
              playerColor={activePlayer.color}
              onRoll={() => executeDiceRoll(false)}
              size={64}
            />
          </div>
        </div>

        {/* Right / Bottom Players (e.g. Yellow and Blue) */}
        <div className="w-full lg:w-48 flex lg:flex-col gap-3 justify-between">
          {room.players.slice(Math.ceil(room.players.length / 2)).map((p, idx) => {
            const actualIdx = Math.ceil(room.players.length / 2) + idx;
            return (
              <div key={p.id} className="flex-1 lg:flex-initial">
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
