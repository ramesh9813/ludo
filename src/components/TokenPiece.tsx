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

const SOLID: Record<PlayerColor, string> = {
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#EAB308',
  blue: '#2563EB',
};

export const TokenPiece: React.FC<TokenPieceProps> = ({
  color,
  id,
  isSelectable,
  isMoving = false,
  onClick,
  size = 28,
}) => {
  const solid = SOLID[color];

  return (
    <div
      onClick={isSelectable ? onClick : undefined}
      className={`relative flex items-center justify-center transition-transform duration-200 ${
        isSelectable ? 'animate-token-pulse z-30 cursor-pointer' : 'z-20'
      } ${isMoving ? 'token-hopping scale-110 z-40' : ''}`}
      style={{
        width: `clamp(20px, 5vmin, ${size + 6}px)`,
        height: `clamp(20px, 5vmin, ${size + 6}px)`,
      }}
    >
      {isSelectable && (
        <div
          className="absolute -inset-1 rounded-full animate-ping opacity-70"
          style={{ border: `2px solid ${solid}` }}
        />
      )}

      {/* flat single-color body, white ring, dark outline */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center"
        style={{
          backgroundColor: solid,
          border: '2px solid #0f172a',
          boxShadow: isSelectable
            ? `0 0 0 2px #ffffff, 0 0 12px ${solid}, 0 3px 5px rgba(0,0,0,0.5)`
            : '0 0 0 2px #ffffff, 0 2px 4px rgba(0,0,0,0.45)',
        }}
      >
        <div
          className="rounded-full bg-white flex items-center justify-center"
          style={{
            width: '58%',
            height: '58%',
            border: '1.5px solid #0f172a',
          }}
        >
          <span
            className="font-black leading-none"
            style={{ color: solid, fontSize: 'clamp(9px, 2.2vmin, 13px)' }}
          >
            {id + 1}
          </span>
        </div>
      </div>
    </div>
  );
};
