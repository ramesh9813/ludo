import React, { useState, useEffect } from 'react';
import { sounds } from '../audio/soundEffects';
import type { PlayerColor } from '../types/game';

interface Dice3DProps {
  value: number | null;
  isRolling: boolean;
  canRoll: boolean;
  playerColor?: PlayerColor;
  onRoll: () => void;
  size?: number;
}

// 3D rotation angles for each face to face the camera
const FACE_ROTATIONS: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 0, y: 0, z: 0 },
  2: { x: 0, y: 180, z: 0 },
  3: { x: 0, y: -90, z: 0 },
  4: { x: 0, y: 90, z: 0 },
  5: { x: -90, y: 0, z: 0 },
  6: { x: 90, y: 0, z: 0 },
};

const COLOR_GLOW: Record<PlayerColor, string> = {
  red: 'rgba(239, 68, 68, 0.5)',
  green: 'rgba(34, 197, 94, 0.5)',
  yellow: 'rgba(234, 179, 8, 0.5)',
  blue: 'rgba(59, 130, 246, 0.5)',
};

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  isRolling,
  canRoll,
  playerColor = 'red',
  onRoll,
  size = 72,
}) => {
  const [internalRoll, setInternalRoll] = useState(false);
  const [displayValue, setDisplayValue] = useState(value || 1);
  const halfSize = size / 2;

  useEffect(() => {
    if (isRolling) {
      setInternalRoll(true);
      sounds.playDiceRoll();
      const timer = setTimeout(() => {
        setInternalRoll(false);
        if (value) {
          setDisplayValue(value);
          sounds.playDiceResult(value);
        }
      }, 900);
      return () => clearTimeout(timer);
    } else if (value) {
      setDisplayValue(value);
    }
  }, [isRolling, value]);

  const rotation = FACE_ROTATIONS[displayValue] || FACE_ROTATIONS[1];

  const handleClick = () => {
    if (canRoll && !isRolling && !internalRoll) {
      onRoll();
    }
  };

  return (
    <div className="dice-container flex flex-col items-center select-none">
      <div
        onClick={handleClick}
        className={`dice-wrapper relative cursor-pointer transition-transform duration-300 ${
          canRoll && !isRolling ? 'hover:scale-105 active:scale-95 animate-pulse-subtle' : 'opacity-90'
        }`}
        style={{
          width: size,
          height: size,
          perspective: 800,
        }}
      >
        {/* Dynamic ambient shadow underneath die */}
        <div
          className={`dice-shadow absolute left-1/2 -translate-x-1/2 bottom-[-16px] rounded-full transition-all duration-500 ${
            internalRoll ? 'scale-75 opacity-40 blur-md' : 'scale-100 opacity-70 blur-sm'
          }`}
          style={{
            width: size * 0.9,
            height: 14,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 70%)',
          }}
        />

        {/* 3D Cube */}
        <div
          className={`dice-cube w-full h-full relative transition-transform ${
            internalRoll ? 'dice-tumbling' : 'dice-settling'
          }`}
          style={{
            transformStyle: 'preserve-3d',
            transform: internalRoll
              ? undefined
              : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
            transitionDuration: internalRoll ? '0s' : '0.6s',
          }}
        >
          {/* Face 1 (Front) */}
          <div
            className="dice-face face-1 absolute inset-0 flex items-center justify-center rounded-2xl border border-white/20 shadow-inner"
            style={{
              transform: `translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <span className="dice-pip w-3.5 h-3.5 rounded-full bg-red-600 shadow-sm" />
          </div>

          {/* Face 2 (Back) */}
          <div
            className="dice-face face-2 absolute inset-0 flex flex-col justify-between p-3 rounded-2xl border border-white/20 shadow-inner"
            style={{
              transform: `rotateY(180deg) translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <span className="dice-pip self-start w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip self-end w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
          </div>

          {/* Face 3 (Right) */}
          <div
            className="dice-face face-3 absolute inset-0 flex flex-col justify-between p-3 rounded-2xl border border-white/20 shadow-inner"
            style={{
              transform: `rotateY(90deg) translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <span className="dice-pip self-start w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip self-center w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip self-end w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
          </div>

          {/* Face 4 (Left) */}
          <div
            className="dice-face face-4 absolute inset-0 grid grid-cols-2 gap-3 p-3 rounded-2xl border border-white/20 shadow-inner"
            style={{
              transform: `rotateY(-90deg) translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <span className="dice-pip place-self-start w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip place-self-end w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip place-self-start w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            <span className="dice-pip place-self-end w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
          </div>

          {/* Face 5 (Top) */}
          <div
            className="dice-face face-5 absolute inset-0 p-2.5 rounded-2xl border border-white/20 shadow-inner flex flex-col justify-between"
            style={{
              transform: `rotateX(90deg) translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <div className="flex justify-between">
              <span className="dice-pip w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
              <span className="dice-pip w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            </div>
            <div className="flex justify-center">
              <span className="dice-pip w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            </div>
            <div className="flex justify-between">
              <span className="dice-pip w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
              <span className="dice-pip w-3 h-3 rounded-full bg-slate-800 shadow-sm" />
            </div>
          </div>

          {/* Face 6 (Bottom) */}
          <div
            className="dice-face face-6 absolute inset-0 grid grid-cols-2 grid-rows-3 gap-1.5 p-2.5 rounded-2xl border border-white/20 shadow-inner"
            style={{
              transform: `rotateX(-90deg) translateZ(${halfSize}px)`,
              background: 'linear-gradient(145deg, #ffffff, #e2e8f0)',
            }}
          >
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
            <span className="dice-pip justify-self-center self-center w-3 h-3 rounded-full bg-red-600 shadow-sm" />
          </div>
        </div>
      </div>

      {/* Action Button & Prompt */}
      {canRoll && !isRolling && !internalRoll && (
        <button
          onClick={handleClick}
          className="mt-4 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 animate-bounce-gentle"
          style={{
            background: `linear-gradient(135deg, ${COLOR_GLOW[playerColor]}, #000)`,
            border: `1px solid ${COLOR_GLOW[playerColor]}`,
            boxShadow: `0 0 15px ${COLOR_GLOW[playerColor]}`,
          }}
        >
          🎲 Roll Dice
        </button>
      )}

      {/* Result indicator badge */}
      {value && !internalRoll && !isRolling && (
        <div className="mt-2 text-center">
          <span className="text-xl font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]">
            {value === 6 ? '🔥 SIX! 🔥' : `Rolled ${value}`}
          </span>
        </div>
      )}
    </div>
  );
};
