import React, { useMemo } from 'react';
import type { Player, PlayerColor, TokenState } from '../types/game';
import { TokenPiece } from './TokenPiece';
import { SAFE_TILES, START_OFFSETS, TOTAL_TRACK_TILES } from '../services/gameLogic';

interface LudoBoardProps {
  players: Player[];
  activePlayerIndex: number;
  validTokenMoves: number[];
  canMove: boolean;
  onSelectToken: (tokenId: number) => void;
}

// 52 common perimeter track coordinates on a 15x15 grid (0-indexed col, row)
const TRACK_COORDINATES: Array<{ col: number; row: number }> = [
  { col: 1, row: 6 }, // 0: Red Start (SAFE)
  { col: 2, row: 6 }, // 1
  { col: 3, row: 6 }, // 2
  { col: 4, row: 6 }, // 3
  { col: 5, row: 6 }, // 4
  { col: 6, row: 5 }, // 5
  { col: 6, row: 4 }, // 6
  { col: 6, row: 3 }, // 7
  { col: 6, row: 2 }, // 8: SAFE
  { col: 6, row: 1 }, // 9
  { col: 6, row: 0 }, // 10
  { col: 7, row: 0 }, // 11
  { col: 8, row: 0 }, // 12
  { col: 8, row: 1 }, // 13: Green Start (SAFE)
  { col: 8, row: 2 }, // 14
  { col: 8, row: 3 }, // 15
  { col: 8, row: 4 }, // 16
  { col: 8, row: 5 }, // 17
  { col: 9, row: 6 }, // 18
  { col: 10, row: 6 }, // 19
  { col: 11, row: 6 }, // 20
  { col: 12, row: 6 }, // 21: SAFE
  { col: 13, row: 6 }, // 22
  { col: 14, row: 6 }, // 23
  { col: 14, row: 7 }, // 24
  { col: 14, row: 8 }, // 25
  { col: 13, row: 8 }, // 26: Yellow Start (SAFE)
  { col: 12, row: 8 }, // 27
  { col: 11, row: 8 }, // 28
  { col: 10, row: 8 }, // 29
  { col: 9, row: 8 }, // 30
  { col: 8, row: 9 }, // 31
  { col: 8, row: 10 }, // 32
  { col: 8, row: 11 }, // 33
  { col: 8, row: 12 }, // 34: SAFE
  { col: 8, row: 13 }, // 35
  { col: 8, row: 14 }, // 36
  { col: 7, row: 14 }, // 37
  { col: 6, row: 14 }, // 38
  { col: 6, row: 13 }, // 39: Blue Start (SAFE)
  { col: 6, row: 12 }, // 40
  { col: 6, row: 11 }, // 41
  { col: 6, row: 10 }, // 42
  { col: 6, row: 9 }, // 43
  { col: 5, row: 8 }, // 44
  { col: 4, row: 8 }, // 45
  { col: 3, row: 8 }, // 46
  { col: 2, row: 8 }, // 47: SAFE
  { col: 1, row: 8 }, // 48
  { col: 0, row: 8 }, // 49
  { col: 0, row: 7 }, // 50
  { col: 0, row: 6 }, // 51
];

// Home runway coordinates (steps 51..55) + Home (step 56)
const HOME_RUNWAYS: Record<PlayerColor, Array<{ col: number; row: number }>> = {
  red: [
    { col: 1, row: 7 },
    { col: 2, row: 7 },
    { col: 3, row: 7 },
    { col: 4, row: 7 },
    { col: 5, row: 7 },
    { col: 6.3, row: 7 }, // Home
  ],
  green: [
    { col: 7, row: 1 },
    { col: 7, row: 2 },
    { col: 7, row: 3 },
    { col: 7, row: 4 },
    { col: 7, row: 5 },
    { col: 7, row: 6.3 }, // Home
  ],
  yellow: [
    { col: 13, row: 7 },
    { col: 12, row: 7 },
    { col: 11, row: 7 },
    { col: 10, row: 7 },
    { col: 9, row: 7 },
    { col: 7.7, row: 7 }, // Home
  ],
  blue: [
    { col: 7, row: 13 },
    { col: 7, row: 12 },
    { col: 7, row: 11 },
    { col: 7, row: 10 },
    { col: 7, row: 9 },
    { col: 7, row: 7.7 }, // Home
  ],
};

// Base token pocket positions (col, row)
const BASE_POCKETS: Record<PlayerColor, Array<{ col: number; row: number }>> = {
  red: [
    { col: 1.5, row: 10.5 },
    { col: 3.5, row: 10.5 },
    { col: 1.5, row: 12.5 },
    { col: 3.5, row: 12.5 },
  ],
  green: [
    { col: 1.5, row: 1.5 },
    { col: 3.5, row: 1.5 },
    { col: 1.5, row: 3.5 },
    { col: 3.5, row: 3.5 },
  ],
  yellow: [
    { col: 10.5, row: 1.5 },
    { col: 12.5, row: 1.5 },
    { col: 10.5, row: 3.5 },
    { col: 12.5, row: 3.5 },
  ],
  blue: [
    { col: 10.5, row: 10.5 },
    { col: 12.5, row: 10.5 },
    { col: 10.5, row: 12.5 },
    { col: 12.5, row: 12.5 },
  ],
};

export const LudoBoard: React.FC<LudoBoardProps> = ({
  players,
  activePlayerIndex,
  validTokenMoves,
  canMove,
  onSelectToken,
}) => {
  const activePlayer = players[activePlayerIndex];

  // Map every token on the board to its (col, row) coordinates
  const placedTokens = useMemo(() => {
    const list: Array<{
      playerColor: PlayerColor;
      playerIndex: number;
      tokenId: number;
      col: number;
      row: number;
      isSelectable: boolean;
      cellKey: string;
    }> = [];

    players.forEach((player, pIdx) => {
      const isPlayerActive = pIdx === activePlayerIndex;

      player.tokens.forEach((token) => {
        let coords: { col: number; row: number };

        if (token.step === -1) {
          // Inside yard base
          coords = BASE_POCKETS[player.color][token.id];
        } else if (token.step >= 0 && token.step <= 50) {
          // On common perimeter track
          const globalIdx = (START_OFFSETS[player.color] + token.step) % TOTAL_TRACK_TILES;
          coords = TRACK_COORDINATES[globalIdx];
        } else {
          // Inside home stretch (step 51..56)
          const stretchIdx = Math.min(5, token.step - 51);
          coords = HOME_RUNWAYS[player.color][stretchIdx];
        }

        const isSelectable = isPlayerActive && canMove && validTokenMoves.includes(token.id);

        list.push({
          playerColor: player.color,
          playerIndex: pIdx,
          tokenId: token.id,
          col: coords.col,
          row: coords.row,
          isSelectable,
          cellKey: `${coords.col.toFixed(1)}_${coords.row.toFixed(1)}`,
        });
      });
    });

    return list;
  }, [players, activePlayerIndex, validTokenMoves, canMove]);

  // Group tokens by tile to offset multiple tokens on the same cell
  const tokensWithOffset = useMemo(() => {
    const cellGroups: Record<string, typeof placedTokens> = {};
    placedTokens.forEach((t) => {
      if (!cellGroups[t.cellKey]) cellGroups[t.cellKey] = [];
      cellGroups[t.cellKey].push(t);
    });

    return placedTokens.map((t) => {
      const group = cellGroups[t.cellKey];
      const indexInGroup = group.indexOf(t);
      const totalInGroup = group.length;

      let offsetX = 0;
      let offsetY = 0;

      if (totalInGroup > 1) {
        // Distribute slightly so all are visible
        const angle = (indexInGroup / totalInGroup) * Math.PI * 2;
        offsetX = Math.cos(angle) * 7;
        offsetY = Math.sin(angle) * 7;
      }

      return {
        ...t,
        offsetX,
        offsetY,
      };
    });
  }, [placedTokens]);

  return (
    <div className="ludo-board-wrapper relative w-full max-w-[580px] aspect-square rounded-3xl p-3 sm:p-4 bg-slate-900/90 border border-slate-700/60 shadow-2xl backdrop-blur-xl select-none">
      {/* 15x15 SVG / Grid Board Surface */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
        {/* Four Corner Yards (6x6 each) */}
        {/* Green Yard (Top-Left) */}
        <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-gradient-to-br from-emerald-500/20 to-emerald-950/60 border-r border-b border-emerald-500/30 p-3 flex items-center justify-center">
          <div className="w-[75%] h-[75%] rounded-2xl bg-emerald-950/70 border-2 border-emerald-500/40 p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-full bg-emerald-900/50 border border-emerald-400/40 shadow-inner flex items-center justify-center" />
            ))}
          </div>
        </div>

        {/* Yellow Yard (Top-Right) */}
        <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-gradient-to-bl from-amber-500/20 to-amber-950/60 border-l border-b border-amber-500/30 p-3 flex items-center justify-center">
          <div className="w-[75%] h-[75%] rounded-2xl bg-amber-950/70 border-2 border-amber-500/40 p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-full bg-amber-900/50 border border-amber-400/40 shadow-inner flex items-center justify-center" />
            ))}
          </div>
        </div>

        {/* Red Yard (Bottom-Left) */}
        <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-gradient-to-tr from-rose-500/20 to-rose-950/60 border-r border-t border-rose-500/30 p-3 flex items-center justify-center">
          <div className="w-[75%] h-[75%] rounded-2xl bg-rose-950/70 border-2 border-rose-500/40 p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-full bg-rose-900/50 border border-rose-400/40 shadow-inner flex items-center justify-center" />
            ))}
          </div>
        </div>

        {/* Blue Yard (Bottom-Right) */}
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-gradient-to-tl from-blue-500/20 to-blue-950/60 border-l border-t border-blue-500/30 p-3 flex items-center justify-center">
          <div className="w-[75%] h-[75%] rounded-2xl bg-blue-950/70 border-2 border-blue-500/40 p-2 grid grid-cols-2 grid-rows-2 gap-2 shadow-inner">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-full bg-blue-900/50 border border-blue-400/40 shadow-inner flex items-center justify-center" />
            ))}
          </div>
        </div>

        {/* Center Home Triangle (3x3 grid area) */}
        <div className="absolute top-[40%] left-[40%] w-[20%] h-[20%] bg-slate-900 border border-slate-700/80 shadow-2xl flex items-center justify-center overflow-hidden">
          {/* 4 Colored Triangles */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 50% 50%)',
              background: 'linear-gradient(to bottom, #10b981, #064e3b)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)',
              background: 'linear-gradient(to left, #f59e0b, #78350f)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)',
              background: 'linear-gradient(to top, #3b82f6, #1e3a8a)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              clipPath: 'polygon(0 0, 0 100%, 50% 50%)',
              background: 'linear-gradient(to right, #ef4444, #881337)',
            }}
          />
          {/* Central Crown / Trophy Emblem */}
          <div className="relative z-10 w-7 h-7 rounded-full bg-slate-950/90 border border-amber-400/60 shadow-lg flex items-center justify-center">
            <span className="text-xs">👑</span>
          </div>
        </div>

        {/* 52 Perimeter Tiles + 20 Home Runway Tiles */}
        {TRACK_COORDINATES.map((pos, idx) => {
          const isSafe = SAFE_TILES.has(idx);
          const isRedStart = idx === 0;
          const isGreenStart = idx === 13;
          const isYellowStart = idx === 26;
          const isBlueStart = idx === 39;

          let cellBg = 'bg-slate-900/60 border-slate-800/80';
          if (isRedStart) cellBg = 'bg-rose-950/80 border-rose-500/50';
          else if (isGreenStart) cellBg = 'bg-emerald-950/80 border-emerald-500/50';
          else if (isYellowStart) cellBg = 'bg-amber-950/80 border-amber-500/50';
          else if (isBlueStart) cellBg = 'bg-blue-950/80 border-blue-500/50';

          return (
            <div
              key={`track_${idx}`}
              className={`absolute border text-[9px] font-bold flex items-center justify-center transition-colors ${cellBg}`}
              style={{
                width: `${(1 / 15) * 100}%`,
                height: `${(1 / 15) * 100}%`,
                left: `${(pos.col / 15) * 100}%`,
                top: `${(pos.row / 15) * 100}%`,
              }}
            >
              {isSafe && (
                <span className="text-amber-400/90 text-[10px] drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]">
                  ★
                </span>
              )}
            </div>
          );
        })}

        {/* Colored Home Runways */}
        {/* Red Home Runway (row 7, cols 1..5) */}
        {[1, 2, 3, 4, 5].map((c) => (
          <div
            key={`red_runway_${c}`}
            className="absolute border border-rose-600/40 bg-gradient-to-r from-rose-950/90 to-rose-700/80 flex items-center justify-center shadow-inner"
            style={{
              width: `${(1 / 15) * 100}%`,
              height: `${(1 / 15) * 100}%`,
              left: `${(c / 15) * 100}%`,
              top: `${(7 / 15) * 100}%`,
            }}
          >
            <span className="text-rose-400 text-[8px] opacity-60">▶</span>
          </div>
        ))}

        {/* Green Home Runway (col 7, rows 1..5) */}
        {[1, 2, 3, 4, 5].map((r) => (
          <div
            key={`green_runway_${r}`}
            className="absolute border border-emerald-600/40 bg-gradient-to-b from-emerald-950/90 to-emerald-700/80 flex items-center justify-center shadow-inner"
            style={{
              width: `${(1 / 15) * 100}%`,
              height: `${(1 / 15) * 100}%`,
              left: `${(7 / 15) * 100}%`,
              top: `${(r / 15) * 100}%`,
            }}
          >
            <span className="text-emerald-400 text-[8px] opacity-60">▼</span>
          </div>
        ))}

        {/* Yellow Home Runway (row 7, cols 9..13) */}
        {[9, 10, 11, 12, 13].map((c) => (
          <div
            key={`yellow_runway_${c}`}
            className="absolute border border-amber-600/40 bg-gradient-to-l from-amber-950/90 to-amber-700/80 flex items-center justify-center shadow-inner"
            style={{
              width: `${(1 / 15) * 100}%`,
              height: `${(1 / 15) * 100}%`,
              left: `${(c / 15) * 100}%`,
              top: `${(7 / 15) * 100}%`,
            }}
          >
            <span className="text-amber-400 text-[8px] opacity-60">◀</span>
          </div>
        ))}

        {/* Blue Home Runway (col 7, rows 9..13) */}
        {[9, 10, 11, 12, 13].map((r) => (
          <div
            key={`blue_runway_${r}`}
            className="absolute border border-blue-600/40 bg-gradient-to-t from-blue-950/90 to-blue-700/80 flex items-center justify-center shadow-inner"
            style={{
              width: `${(1 / 15) * 100}%`,
              height: `${(1 / 15) * 100}%`,
              left: `${(7 / 15) * 100}%`,
              top: `${(r / 15) * 100}%`,
            }}
          >
            <span className="text-blue-400 text-[8px] opacity-60">▲</span>
          </div>
        ))}

        {/* Dynamic Tokens Layer with Smooth Hopping Interpolation */}
        {tokensWithOffset.map((t) => {
          const leftPercent = ((t.col + 0.5) / 15) * 100;
          const topPercent = ((t.row + 0.5) / 15) * 100;

          return (
            <div
              key={`${t.playerColor}_token_${t.tokenId}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ease-out"
              style={{
                left: `calc(${leftPercent}% + ${t.offsetX}px)`,
                top: `calc(${topPercent}% + ${t.offsetY}px)`,
              }}
            >
              <TokenPiece
                color={t.playerColor}
                id={t.tokenId}
                isSelectable={t.isSelectable}
                onClick={() => onSelectToken(t.tokenId)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
