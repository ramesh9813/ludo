import React, { useMemo } from 'react';
import type { Player, PlayerColor } from '../types/game';
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

// Single flat color per player — used for yard, start tile, home line, center triangle.
export const PLAYER_SOLID: Record<PlayerColor, string> = {
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#EAB308',
  blue: '#2563EB',
};

const GRID_LINE = 'rgba(15, 23, 42, 0.55)';

function Yard({
  color,
  position,
}: {
  color: PlayerColor;
  position: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const solid = PLAYER_SOLID[color];
  const posClass =
    position === 'tl'
      ? 'top-0 left-0 border-r border-b'
      : position === 'tr'
        ? 'top-0 right-0 border-l border-b'
        : position === 'bl'
          ? 'bottom-0 left-0 border-r border-t'
          : 'bottom-0 right-0 border-l border-t';

  return (
    <div
      className={`absolute ${posClass} w-[40%] h-[40%] flex items-center justify-center`}
      style={{ backgroundColor: solid, borderColor: '#0f172a', borderWidth: 0 }}
    >
      {/* white inner house */}
      <div
        className="w-[68%] h-[68%] bg-white flex items-center justify-center"
        style={{ border: '2px solid #0f172a', borderRadius: 6 }}
      >
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 place-items-center p-[12%] gap-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[78%] aspect-square rounded-full"
              style={{
                backgroundColor: solid,
                border: '2px solid #0f172a',
                boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const LudoBoard: React.FC<LudoBoardProps> = ({
  players,
  activePlayerIndex,
  validTokenMoves,
  canMove,
  onSelectToken,
}) => {
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
          coords = BASE_POCKETS[player.color][token.id];
        } else if (token.step >= 0 && token.step <= 50) {
          const globalIdx = (START_OFFSETS[player.color] + token.step) % TOTAL_TRACK_TILES;
          coords = TRACK_COORDINATES[globalIdx];
        } else {
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
        const angle = (indexInGroup / totalInGroup) * Math.PI * 2;
        offsetX = Math.cos(angle) * 7;
        offsetY = Math.sin(angle) * 7;
      }

      return { ...t, offsetX, offsetY };
    });
  }, [placedTokens]);

  const cellSize = `${(1 / 15) * 100}%`;

  return (
    <div
      className="ludo-board-classic relative w-full aspect-square select-none bg-white overflow-hidden"
      style={{
        border: '3px solid #0f172a',
        borderRadius: 0,
        lineHeight: 1,
      }}
    >
      {/* Four solid corner yards */}
      <Yard color="green" position="tl" />
      <Yard color="yellow" position="tr" />
      <Yard color="red" position="bl" />
      <Yard color="blue" position="br" />

      {/* Center home — 4 flat triangles */}
      <div
        className="absolute bg-white overflow-hidden"
        style={{
          top: '40%',
          left: '40%',
          width: '20%',
          height: '20%',
          border: '2px solid #0f172a',
        }}
      >
        <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 50%)', backgroundColor: PLAYER_SOLID.green }} />
        <div className="absolute inset-0" style={{ clipPath: 'polygon(100% 0, 100% 100%, 50% 50%)', backgroundColor: PLAYER_SOLID.yellow }} />
        <div className="absolute inset-0" style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 50%)', backgroundColor: PLAYER_SOLID.blue }} />
        <div className="absolute inset-0" style={{ clipPath: 'polygon(0 0, 0 100%, 50% 50%)', backgroundColor: PLAYER_SOLID.red }} />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white flex items-center justify-center"
          style={{ width: '34%', aspectRatio: '1/1', borderRadius: 9999, border: '2px solid #0f172a' }}
        >
          <span style={{ fontSize: 'clamp(10px, 2.4vmin, 18px)' }}>👑</span>
        </div>
      </div>

      {/* 52 perimeter track cells */}
      {TRACK_COORDINATES.map((pos, idx) => {
        const isSafe = SAFE_TILES.has(idx);
        const startColor: PlayerColor | null =
          idx === 0 ? 'red' : idx === 13 ? 'green' : idx === 26 ? 'yellow' : idx === 39 ? 'blue' : null;

        const bg = startColor ? PLAYER_SOLID[startColor] : '#FFFFFF';

        return (
          <div
            key={`track_${idx}`}
            className="absolute flex items-center justify-center"
            style={{
              width: cellSize,
              height: cellSize,
              left: `${(pos.col / 15) * 100}%`,
              top: `${(pos.row / 15) * 100}%`,
              backgroundColor: bg,
              border: `1px solid ${GRID_LINE}`,
              color: startColor ? '#fff' : '#475569',
              fontSize: 'clamp(7px, 1.8vmin, 13px)',
              fontWeight: 800,
            }}
          >
            {startColor ? (
              <span style={{ color: '#fff' }}>★</span>
            ) : (
              isSafe && <span>★</span>
            )}
          </div>
        );
      })}

      {/* Home lines — one single solid color per player */}
      {[1, 2, 3, 4, 5].map((c) => (
        <div
          key={`red_runway_${c}`}
          className="absolute flex items-center justify-center"
          style={{
            width: cellSize,
            height: cellSize,
            left: `${(c / 15) * 100}%`,
            top: `${(7 / 15) * 100}%`,
            backgroundColor: PLAYER_SOLID.red,
            border: `1px solid ${GRID_LINE}`,
            color: '#fff',
            fontSize: 'clamp(6px, 1.6vmin, 11px)',
          }}
        >
          ▶
        </div>
      ))}
      {[1, 2, 3, 4, 5].map((r) => (
        <div
          key={`green_runway_${r}`}
          className="absolute flex items-center justify-center"
          style={{
            width: cellSize,
            height: cellSize,
            left: `${(7 / 15) * 100}%`,
            top: `${(r / 15) * 100}%`,
            backgroundColor: PLAYER_SOLID.green,
            border: `1px solid ${GRID_LINE}`,
            color: '#fff',
            fontSize: 'clamp(6px, 1.6vmin, 11px)',
          }}
        >
          ▼
        </div>
      ))}
      {[9, 10, 11, 12, 13].map((c) => (
        <div
          key={`yellow_runway_${c}`}
          className="absolute flex items-center justify-center"
          style={{
            width: cellSize,
            height: cellSize,
            left: `${(c / 15) * 100}%`,
            top: `${(7 / 15) * 100}%`,
            backgroundColor: PLAYER_SOLID.yellow,
            border: `1px solid ${GRID_LINE}`,
            color: '#fff',
            fontSize: 'clamp(6px, 1.6vmin, 11px)',
          }}
        >
          ◀
        </div>
      ))}
      {[9, 10, 11, 12, 13].map((r) => (
        <div
          key={`blue_runway_${r}`}
          className="absolute flex items-center justify-center"
          style={{
            width: cellSize,
            height: cellSize,
            left: `${(7 / 15) * 100}%`,
            top: `${(r / 15) * 100}%`,
            backgroundColor: PLAYER_SOLID.blue,
            border: `1px solid ${GRID_LINE}`,
            color: '#fff',
            fontSize: 'clamp(6px, 1.6vmin, 11px)',
          }}
        >
          ▲
        </div>
      ))}

      {/* Tokens */}
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
              zIndex: t.isSelectable ? 30 : 20,
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
  );
};
