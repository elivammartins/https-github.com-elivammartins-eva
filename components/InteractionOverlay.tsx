
import React from 'react';
import SentinelOrb from './SentinelOrb';
import { PandoraMood } from '../types';

interface Props {
  mood: PandoraMood;
  transcript: string;
}

const InteractionOverlay: React.FC<Props> = ({ mood, transcript }) => {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
       <div className="transform scale-150 mb-20">
          <SentinelOrb mood={mood} size="LG" />
       </div>
       
       <div className="max-w-2xl text-center px-10">
          <p className="text-4xl font-black italic uppercase tracking-tighter text-white leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
             {transcript}
          </p>
          <div className="mt-8 flex justify-center gap-2">
             {[1, 2, 3].map(i => (
                <div key={i} className={`w-2 h-2 rounded-full bg-cyan-500 animate-bounce`} style={{ animationDelay: `${i * 0.1}s` }}></div>
             ))}
          </div>
       </div>
    </div>
  );
};

export default InteractionOverlay;
