import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sounds } from '../audio/soundEffects';
import { Volume2, VolumeX, LogOut, Shield, Trophy } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { userProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [soundEnabled, setSoundEnabled] = React.useState(sounds.enabled);

  const toggleSound = () => {
    sounds.enabled = !soundEnabled;
    setSoundEnabled(sounds.enabled);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-amber-500 to-emerald-500 p-0.5 shadow-[0_0_15px_rgba(244,63,94,0.4)] group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center font-black text-white text-base">
              🎲
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-white flex items-center gap-1">
              game <span className="text-rose-500 text-xs px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 font-bold uppercase tracking-wider">Ludo</span>
            </span>
            <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline">Online Multiplayer & Voice</span>
          </div>
        </Link>

        {/* Right Action Icons & User Card */}
        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="text-rose-400" />}
          </button>

          {userProfile && (
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
              {/* ELO Rating Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Trophy size={13} />
                <span>{userProfile.rating} ELO</span>
              </div>

              {/* User Avatar & Name */}
              <div className="flex items-center gap-2">
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
                />
                <span className="text-xs font-semibold text-slate-200 hidden md:inline truncate max-w-[120px]">
                  {userProfile.displayName}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
