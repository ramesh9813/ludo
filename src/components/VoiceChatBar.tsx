import React, { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Radio, Users } from 'lucide-react';
import { WebRTCVoiceManager } from '../services/webrtcVoice';

interface VoiceChatBarProps {
  voiceManager: WebRTCVoiceManager | null;
  isMicActive: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onEnableMic: () => void;
  onToggleMute: () => void;
  humanCount: number;
}

export const VoiceChatBar: React.FC<VoiceChatBarProps> = ({
  isMicActive,
  isMuted,
  isSpeaking,
  onEnableMic,
  onToggleMute,
  humanCount,
}) => {
  return (
    <div className="voice-chat-bar flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-md shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <span
            className={`w-2.5 h-2.5 rounded-full block ${
              isMicActive
                ? isMuted
                  ? 'bg-amber-400'
                  : isSpeaking
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-ping'
                  : 'bg-emerald-500'
                : 'bg-slate-600'
            }`}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Radio size={13} className={isMicActive && !isMuted ? 'text-emerald-400 animate-pulse' : 'text-slate-500'} />
            <span>Voice Chat</span>
            {isSpeaking && !isMuted && (
              <span className="text-[10px] text-emerald-400 font-semibold px-1.5 rounded-full bg-emerald-950 border border-emerald-500/40">
                Speaking...
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            {isMicActive
              ? isMuted
                ? 'Mic is muted'
                : 'Live audio mesh active'
              : 'Mic is disconnected'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Connected humans count */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
          <Users size={12} />
          <span>{humanCount} human{humanCount === 1 ? '' : 's'}</span>
        </div>

        {isMicActive ? (
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow ${
              isMuted
                ? 'bg-rose-600/20 border border-rose-500/60 text-rose-300 hover:bg-rose-600/30'
                : 'bg-emerald-600/20 border border-emerald-500/60 text-emerald-300 hover:bg-emerald-600/30'
            }`}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        ) : (
          <button
            onClick={onEnableMic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all active:scale-95"
          >
            <Mic size={14} />
            <span>Join Voice</span>
          </button>
        )}
      </div>
    </div>
  );
};
