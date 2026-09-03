import React from 'react';
import type { Player, PlayerColor } from '../types/game';
import { Mic, MicOff, Bot, Crown, Trophy } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  isActive: boolean;
  isCurrentClient: boolean;
  onToggleMute?: () => void;
  timerSeconds?: number;
}

const COLOR_THEMES: Record<PlayerColor, { text: string; bg: string; border: string; glow: string }> = {
  red: {
    text: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/50',
    glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
  },
  green: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
  },
  yellow: {
    text: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
  },
  blue: {
    text: 'text-blue-400',
    bg: 'bg-blue-950/40',
    border: 'border-blue-500/50',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
  },
};

export const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  isActive,
  isCurrentClient,
  onToggleMute,
  timerSeconds,
}) => {
  const theme = COLOR_THEMES[player.color];
  const finishedTokens = player.tokens.filter((t) => t.step === 56).length;

  return (
    <div
      className={`player-card relative p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 backdrop-blur-md ${
        theme.bg
      } ${
        isActive
          ? `${theme.border} ${theme.glow} ring-2 ring-white/40 scale-[1.02]`
          : 'border-white/10 opacity-90'
      }`}
    >
      {/* Active turn countdown indicator banner */}
      {isActive && timerSeconds !== undefined && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-slate-900 border border-white/20 text-[10px] font-bold text-amber-400 flex items-center gap-1 shadow-md animate-bounce-gentle">
          <span>⏱️</span>
          <span>{timerSeconds}s</span>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        {/* Avatar with speaking glow ring */}
        <div className="relative">
          {/* Pulsing Speaking Glow Indicator */}
          {player.isSpeaking && (
            <div className="absolute -inset-1.5 rounded-full bg-emerald-500/40 animate-ping" />
          )}

          <div
            className={`w-11 h-11 rounded-full overflow-hidden border-2 relative bg-slate-800 ${
              player.isSpeaking
                ? 'border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] ring-2 ring-emerald-300/60'
                : theme.border
            }`}
          >
            <img
              src={player.avatar}
              alt={player.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Bot or Host badge */}
          {player.isAi ? (
            <span className="absolute -bottom-1 -right-1 bg-slate-800 text-cyan-400 p-0.5 rounded-full border border-cyan-500/40 text-[10px]">
              <Bot size={11} />
            </span>
          ) : player.isHost ? (
            <span className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full text-[10px]">
              <Crown size={11} />
            </span>
          ) : null}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate max-w-[100px]">
              {player.name}
            </span>
            {isCurrentClient && (
              <span className="text-[9px] px-1 rounded bg-white/20 text-white font-medium">
                YOU
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            <span className={`font-semibold uppercase tracking-wider ${theme.text}`}>
              {player.color}
            </span>
            <span>•</span>
            <span>⭐ {player.rating}</span>
          </div>

          {/* Tokens Home Progress */}
          <div className="flex items-center gap-1 mt-1.5">
            {[0, 1, 2, 3].map((idx) => {
              const isHome = idx < finishedTokens;
              return (
                <div
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    isHome
                      ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
                      : 'bg-slate-700/60 border border-slate-600'
                  }`}
                />
              );
            })}
            <span className="text-[9px] text-slate-400 ml-1 font-mono">
              {finishedTokens}/4
            </span>
          </div>
        </div>

        {/* Mic Status & Toggle */}
        {!player.isAi && (
          <div className="ml-auto">
            {isCurrentClient && onToggleMute ? (
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded-full border transition-all ${
                  player.isMuted
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
                }`}
                title={player.isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {player.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            ) : (
              <div
                className={`p-1.5 rounded-full text-[10px] ${
                  player.isMuted ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {player.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
              </div>
            )}
          </div>
        )}

        {/* Finished Trophy Badge */}
        {player.hasFinished && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[10px] px-1.5 py-0.5 rounded-full">
            <Trophy size={11} />
            <span>#{player.finishRank}</span>
          </div>
        )}
      </div>
    </div>
  );
};
