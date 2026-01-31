
import React from 'react';
import { MediaApp, TrackMetadata } from '../types';

interface MiniPlayerProps {
  app: MediaApp;
  metadata: TrackMetadata;
  onControl: (action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREV') => void;
  onExpand: () => void;
  transparent?: boolean;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ app, metadata, onControl, onExpand, transparent }) => {
  return (
    <div 
      onClick={onExpand}
      className={`flex flex-col w-full h-16 ${transparent ? 'bg-transparent' : 'bg-white/5'} transition-all cursor-pointer pointer-events-auto`}
    >
       <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className={`w-12 h-12 shrink-0 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl ${app.color} shadow-lg active:scale-95 transition-all`}>
             <i className={app.icon}></i>
          </div>
          
          <div className="flex-1 min-w-0 flex flex-col justify-center">
             <h4 className="text-[12px] font-black text-white truncate italic uppercase leading-tight tracking-tighter">
                {metadata.title || 'PANDORA SYNC'}
             </h4>
             <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase mt-0.5 italic truncate">
                {metadata.artist || 'ABRA O SPOTIFY'}
             </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
             <button 
               onClick={(e) => { e.stopPropagation(); onControl(metadata.isPlaying ? 'PAUSE' : 'PLAY'); }}
               className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white text-sm active:scale-90"
             >
                <i className={`fas ${metadata.isPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`}></i>
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); onControl('NEXT'); }}
               className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white text-sm active:scale-90"
             >
                <i className="fas fa-forward"></i>
             </button>
          </div>
       </div>

       {/* Barra de Progresso Realista */}
       <div className="w-full h-[2px] bg-white/10 rounded-full mt-2 overflow-hidden relative">
          <div 
            className={`h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000 ${metadata.isPlaying ? 'animate-progress-fill' : ''}`}
            style={{ width: '25%' }}
          ></div>
       </div>

       <style>{`
          @keyframes progress-fill {
            0% { width: 25%; }
            100% { width: 35%; }
          }
          .animate-progress-fill { animation: progress-fill 60s linear infinite; }
       `}</style>
    </div>
  );
};

export default MiniPlayer;
