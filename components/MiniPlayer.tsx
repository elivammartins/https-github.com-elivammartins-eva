
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
    <div className={`flex items-center gap-4 w-full h-full ${transparent ? 'bg-transparent' : 'bg-white/5'}`}>
       
       <div className={`w-14 h-14 shrink-0 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl ${app.color} shadow-lg`}>
          <i className={app.icon}></i>
       </div>
       
       <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-[13px] font-black text-white truncate italic uppercase tracking-tighter">
             {metadata.title}
          </h4>
          <span className="text-[9px] font-bold text-white/30 tracking-widest uppercase mt-0.5 truncate">
             {metadata.artist}
          </span>
       </div>

       <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => onControl('PREVIOUS')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all">
             <i className="fas fa-backward text-xs"></i>
          </button>
          
          <button 
            onClick={() => onControl(metadata.isPlaying ? 'PAUSE' : 'PLAY')}
            className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
          >
             <i className={`fas ${metadata.isPlaying ? 'fa-pause' : 'fa-play ml-1'} text-sm`}></i>
          </button>
          
          <button onClick={() => onControl('NEXT')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-all">
             <i className="fas fa-forward text-xs"></i>
          </button>
       </div>
    </div>
  );
};

export default MiniPlayer;
