import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Dice3D } from '../components/Dice3D';
import { Trophy, Mic, Bot, Sparkles, Shield, ArrowRight, Play, CheckCircle } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { currentUser, userProfile, signInWithGoogle, signInAsGuest } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Demo dice roll in hero section
  const [demoRoll, setDemoRoll] = useState<number>(6);
  const [isDemoRolling, setIsDemoRolling] = useState<boolean>(false);

  const handleDemoDiceRoll = () => {
    if (isDemoRolling) return;
    setIsDemoRolling(true);
    setTimeout(() => {
      const next = Math.floor(Math.random() * 6) + 1;
      setDemoRoll(next);
      setIsDemoRolling(false);
    }, 900);
  };

  const handleGoogleLogin = async () => {
    try {
      setSigningIn(true);
      setErrorMsg(null);
      await signInWithGoogle();
      navigate('/lobby');
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Google Sign-in encountered an issue. You can also play as Guest below!');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setSigningIn(true);
      await signInAsGuest();
      navigate('/lobby');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="landing-page min-h-[calc(100vh-64px)] flex flex-col justify-between py-8 px-4 relative overflow-hidden">
      {/* Background ambient lighting glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/70 text-xs font-semibold text-slate-300 mb-6 shadow-lg backdrop-blur-md">
          <Sparkles size={14} className="text-amber-400" />
          <span>Real-time Multiplayer • WebRTC Voice Chat • 3D Physics Dice</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-3xl leading-[1.1]">
          The Ultimate <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400">
            Online Ludo
          </span>{' '}
          Arena
        </h1>

        <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-xl">
          Roll the dice, strategize token moves, talk in real-time with integrated voice chat, and compete against friends or adaptive AI bots.
        </p>

        {/* Hero 3D Dice Showcase */}
        <div className="my-8 py-4 px-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-md flex flex-col items-center">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Try the 3D Physics Dice
          </span>
          <Dice3D
            value={demoRoll}
            isRolling={isDemoRolling}
            canRoll={!isDemoRolling}
            playerColor="red"
            onRoll={handleDemoDiceRoll}
            size={76}
          />
        </div>

        {/* Call to Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full max-w-sm">
          {userProfile ? (
            <button
              onClick={() => navigate('/lobby')}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-base bg-gradient-to-r from-rose-600 via-amber-600 to-emerald-600 hover:from-rose-500 hover:to-emerald-500 text-white shadow-[0_0_25px_rgba(244,63,94,0.4)] transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
            >
              <Play size={18} />
              <span>Enter Lobby ({userProfile.displayName})</span>
            </button>
          ) : (
            <>
              {/* Google Sign In */}
              <button
                disabled={signingIn}
                onClick={handleGoogleLogin}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-white hover:bg-slate-100 text-slate-900 shadow-xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign In with Google</span>
              </button>

              {/* Instant Guest / Demo Play */}
              <button
                disabled={signingIn}
                onClick={handleGuestLogin}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Instant Guest Play</span>
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 rounded-lg max-w-sm">
            {errorMsg}
          </p>
        )}

        {/* Feature Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-left backdrop-blur-sm">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-3">
              <Mic size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Live Voice Chat</h3>
            <p className="text-xs text-slate-400 mt-1">
              Low-latency WebRTC mesh audio with speaking indicators and mute controls.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-left backdrop-blur-sm">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-3">
              <Trophy size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Skill Matchmaking</h3>
            <p className="text-xs text-slate-400 mt-1">
              Pairs you against opponents of matching ELO tiers and tracks career stats.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-left backdrop-blur-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
              <Bot size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Adaptive AI Bots</h3>
            <p className="text-xs text-slate-400 mt-1">
              Fill empty seats instantly with smart bots across Easy, Medium, and Hard difficulty.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-left backdrop-blur-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
              <Shield size={18} />
            </div>
            <h3 className="text-sm font-bold text-white">Standard Rules</h3>
            <p className="text-xs text-slate-400 mt-1">
              Roll 6 to exit yard, capture opponents, safe zones, and triple-six penalty.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
