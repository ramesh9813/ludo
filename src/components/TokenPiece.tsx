import React from 'react';
import type { PlayerColor } from '../types/game';

interface TokenPieceProps {
  color: PlayerColor;
  id: number;
  isSelectable: boolean;
  isMoving?: boolean;
  onClick?: () => void;
  size?: number;
}

const COLOR_GRADIENTS: Record<PlayerColor, { bg: string; border: string; glow: string }> = {
  red: {
    bg: 'radial-gradient(circle at 35% 35%, #ff8a80 0%, #ef4444 45%, #991b1b 100%)',
    border: '#fca5a5',
    glow: 'rgba(239, 68, 68, 0.7)',
  },
  green: {
    bg: 'radial-gradient(circle at 35% 35%, #bbf7d0 0%, #22c55e 45%, #14532d 100%)',
    border: '#86efac',
    glow: 'rgba(34, 197, 94, 0.7)',
  },
  yellow: {
    bg: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #eab308 45%, #713f12 100%)',
    border: '#fde047',
    glow: 'rgba(234, 179, 8, 0.7)',
  },
  blue: {
    bg: 'radial-gradient(circle at 35% 35%, #93c5fd 0%, #3b82f6 45%, #1e3a8a 100%)',
    border: '#bfdbfe',
    glow: 'rgba(59, 130, 246, 0.7)',
  },
};

export const TokenPiece: React.FC<TokenPieceProps> = ({
  color,
  id,
  isSelectable,
  isMoving = false,
  onClick,
  size = 28,
}) => {
  const styles = COLOR_GRADIENTS[color];

  return (
    <div
      onClick={isSelectable ? onClick : undefined}
      className={`token-piece relative flex items-center justify-center cursor-pointer transition-all duration-300 ${
        isSelectable ? 'selectable-token animate-token-pulse z-30' : 'z-20'
      } ${isMoving ? 'token-hopping scale-110 z-40' : ''}`}
      style={{
        width: size,
        height: size,
      }}
    >
      {/* Outer selection ring */}
      {isSelectable && (
        <div
          className="absolute -inset-1 rounded-full animate-ping opacity-75"
          style={{
            border: `2px solid ${styles.border}`,
            boxShadow: `0 0 10px ${styles.glow}`,
          }}
        />
      )}

      {/* 3D Glossy Token Body */}
      <div
        className="w-full h-full rounded-full shadow-lg flex items-center justify-center relative overflow-hidden transition-transform duration-200"
        style={{
          background: styles.bg,
          border: `2px solid ${styles.border}`,
          boxShadow: isSelectable
            ? `0 0 14px ${styles.glow}, 0 4px 6px rgba(0,0,0,0.5)`
            : '0 3px 6px rgba(0,0,0,0.4)',
        }}
      >
        {/* Specular gloss highlight */}
        <div className="absolute top-1 left-1.5 w-2 h-1 bg-white/70 rounded-full blur-[0.5px] -rotate-45" />

        {/* Inner crown/ring */}
        <div className="w-2.5 h-2.5 rounded-full border border-white/40 flex items-center justify-center bg-white/20">
          <span className="text-[9px] font-black text-white/90 drop-shadow">
            {id + 1}
          </span>
        </div>
      </div>
    </div>
  );
};
