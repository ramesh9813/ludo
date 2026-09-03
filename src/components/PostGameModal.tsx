import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import type { Player, UserProfile } from '../types/game';
import { sounds } from '../audio/soundEffects';
import { Trophy, Award, ArrowRight, RotateCcw } from 'lucide-react';

interface PostGameModalProps {
  players: Player[];
  currentUserProfile: UserProfile | null;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
}

export const PostGameModal: React.FC<PostGameModalProps> = ({
  players,
  currentUserProfile,
  onPlayAgain,
  onReturnToLobby,
}) => {
  // Sort players by finishRank (1st, 2nd, etc.)
  const sortedPlayers = [...players].sort((a, b) => {
    if (a.finishRank && b.finishRank) return a.finishRank - b.finishRank;
    if (a.finishRank) return -1;
    if (b.finishRank) return 1;
    const aHome = a.tokens.filter((t) => t.step === 56).length;
    const bHome = b.tokens.filter((t) => t.step === 56).length;
    return bHome - aHome;
  });

  const winner = sortedPlayers[0];
  const isWinnerMe = currentUserProfile && winner && winner.id === currentUserProfile.uid;

  useEffect(() => {
    sounds.playVictory();

    // Launch celebratory fireworks
    const duration = 3.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl relative overflow-hidden text-center">
        {/* Luminous background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/10 blur-3xl rounded-full" />

        {/* Trophy icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-[0_0_25px_rgba(245,158,11,0.5)] flex items-center justify-center mb-4 animate-bounce-gentle">
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-amber-400">
            <Trophy size={32} />
          </div>
        </div>

        <h2 className="text-2xl font-black text-white tracking-tight">
          {isWinnerMe ? '🎉 VICTORY! YOU WON! 🎉' : `${winner?.name || 'Player'} Won!`}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Match concluded • Ratings and statistics updated
        </p>

        {/* Podium Leaderboard */}
        <div className="mt-5 space-y-2.5">
          {sortedPlayers.map((player, idx) => {
            const rank = idx + 1;
            const isMe = currentUserProfile && player.id === currentUserProfile.uid;
            let ratingChange = '+25';
            if (rank === 2) ratingChange = '+10';
            else if (rank === 3) ratingChange = '-10';
            else if (rank === 4) ratingChange = '-20';

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                  rank === 1
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-xs">
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '4'}
                  </div>

                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="w-8 h-8 rounded-full border border-white/20 object-cover"
                  />

                  <div className="text-left">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] px-1 rounded bg-white/20 text-white font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {player.color} Player
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-bold ${
                      ratingChange.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {ratingChange} ELO
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Play Again</span>
          </button>

          <button
            onClick={onReturnToLobby}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Lobby</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
