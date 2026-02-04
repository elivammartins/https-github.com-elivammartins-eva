
import React from 'react';
import { PandoraMood } from '../types';

interface Props {
  mood: PandoraMood;
  size: 'SM' | 'LG';
}

const SentinelOrb: React.FC<Props> = ({ mood, size }) => {
  const isLarge = size === 'LG';
  
  const moodColors = {
    IDLE: 'from-blue-600 via-purple-600 to-blue-900 shadow-blue-500/30',
    LISTENING: 'from-cyan-400 via-blue-500 to-indigo-600 shadow-cyan-400/50',
    THINKING: 'from-purple-500 via-indigo-600 to-blue-800 shadow-purple-500/50 animate-pulse',
    WARNING: 'from-orange-500 via-red-600 to-red-900 shadow-red-500/50',
    SUGGESTING: 'from-fuchsia-500 via-purple-600 to-indigo-700 shadow-fuchsia-500/40'
  };

  return (
    <div className={`relative ${isLarge ? 'w-44 h-44' : 'w-20 h-20'} flex items-center justify-center`}>
       {/* EXTERNAL GLOW */}
       <div className={`absolute inset-0 rounded-full bg-gradient-to-br opacity-40 blur-3xl transition-all duration-1000 ${moodColors[mood]}`}></div>
       
       {/* ORBITAL RINGS */}
       <div className={`absolute inset-0 rounded-full border border-white/10 animate-[spin_15s_linear_infinite]`}>
          <div className="absolute top-4 left-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full"></div>
       </div>
       <div className={`absolute inset-4 rounded-full border border-white/5 animate-[spin_8s_linear_reverse_infinite]`}>
          <div className="absolute bottom-4 left-1/2 w-1 h-1 bg-purple-400 rounded-full"></div>
       </div>

       {/* CORE ORB */}
       <div className={`relative w-full h-full rounded-full bg-gradient-to-br border-2 border-white/20 overflow-hidden shadow-2xl transition-all duration-1000 ${moodColors[mood]}`}>
          {/* SURFACE REFLECTIONS */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.5),transparent_60%)]"></div>
          
          {/* EAGLE EYE PUPIL */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-0.5 bg-white/20 blur-[1px] rotate-45"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-0.5 bg-white/20 blur-[1px] -rotate-45"></div>
          
          {/* INTERNAL MOTION */}
          {mood === 'LISTENING' && (
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-full h-full border-[8px] border-white/10 rounded-full animate-ping"></div>
            </div>
          )}
       </div>
    </div>
  );
};

export default SentinelOrb;
