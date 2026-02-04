
import React from 'react';
import SentinelOrb from './SentinelOrb';
import { PandoraMood } from '../types';

interface Props {
  mood: PandoraMood;
  privacyMode: boolean;
  onOrbClick: () => void;
  onTogglePrivacy: () => void;
}

const SystemDock: React.FC<Props> = ({ mood, privacyMode, onOrbClick, onTogglePrivacy }) => {
  return (
    <footer className="absolute bottom-0 left-0 right-0 h-32 z-[100] flex items-center justify-center px-12 pointer-events-none">
       <div className="w-full max-w-6xl h-28 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-between px-16 shadow-[0_-25px_60px_rgba(0,0,0,0.9)] pointer-events-auto">
          {/* LEFT GROUP */}
          <div className="flex items-center gap-16">
             <button className="w-20 h-20 rounded-full flex items-center justify-center text-4xl text-white hover:bg-white/5 active:scale-90 transition-all">
                <i className="fas fa-th-large"></i>
             </button>
             <button className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl text-emerald-500 hover:bg-white/5 active:scale-90 transition-all">
                <i className="fas fa-phone"></i>
                <div className="absolute top-4 right-4 w-4 h-4 bg-red-600 rounded-full border-[3px] border-black"></div>
             </button>
          </div>

          {/* CENTRAL ORB (GATILHO) */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-16 cursor-pointer transform hover:scale-105 transition-transform" onClick={onOrbClick}>
             <SentinelOrb mood={mood} size="LG" />
          </div>

          {/* RIGHT GROUP */}
          <div className="flex items-center gap-16">
             <button className="w-20 h-20 rounded-full flex items-center justify-center text-4xl text-white hover:bg-white/5 active:scale-90 transition-all">
                <i className="fas fa-music"></i>
             </button>
             <button 
                onClick={onTogglePrivacy}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl transition-all active:scale-90 ${privacyMode ? 'text-yellow-500' : 'text-white/40 hover:text-white'}`}
             >
                <i className={`fas ${privacyMode ? 'fa-shield-halved' : 'fa-shield'}`}></i>
             </button>
          </div>
       </div>
    </footer>
  );
};

export default SystemDock;
