
import React from 'react';
import { MediaApp, TrackMetadata } from '../types';

interface MiniPlayerProps {
  app: MediaApp;
  metadata: TrackMetadata;
  onControl: (action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREVIOUS') => void;
  onExpand: () => void;
  transparent?: boolean;
}

const MiniPlayer: React.FC<MiniPlayerProps> = ({ app, metadata, onControl, transparent }) => {
  return (
    <div className={`flex items-center gap-6 w-full h-full ${transparent ? 'bg-transparent' : 'bg-white/5'}`}>
       
       <div className={`w-16 h-16 shrink-0 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center text-3xl ${app.color} shadow-xl`}>
          <i className={app.icon}></i>
       </div>
       
       <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-[15px] font-black text-white truncate italic uppercase tracking-tighter">
             {metadata.title}
          </h4>
          <span className="text-[10px] font-bold text-white/40 tracking-widest uppercase mt-0.5 truncate">
             {metadata.artist} • EVA SYNC
          </span>
       </div>

       <div className="flex items-center gap-4 shrink-0 px-2">
          <button 
            onClick={() => onControl('PREVIOUS')} 
            className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/50 hover:text-white active:scale-90 transition-all"
          >
             <i className="fas fa-step-backward"></i>
          </button>
          
          <button 
            onClick={() => onControl(metadata.isPlaying ? 'PAUSE' : 'PLAY')}
            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center text-xl shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-90 transition-all"
          >
             <i className={`fas ${metadata.isPlaying ? 'fa-pause' : 'fa-play ml-1'}`}></i>
          </button>
          
          <button 
            onClick={() => onControl('NEXT')} 
            className="w-12 h-12 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/50 hover:text-white active:scale-90 transition-all"
          >
             <i className="fas fa-step-forward"></i>
          </button>
       </div>
    </div>
  );
};

export default MiniPlayer;
