
import React from 'react';
import { PandoraMedia } from '../types';

interface Props {
  media: PandoraMedia;
}

const MediaWidget: React.FC<Props> = ({ media }) => {
  return (
    <div className="bg-black/50 backdrop-blur-3xl border border-white/10 rounded-[50px] p-8 flex flex-col gap-8 shadow-2xl w-[440px] animate-scale-up group">
       <div className="flex items-center gap-8">
          <div className="w-28 h-28 rounded-[35px] overflow-hidden bg-zinc-900 shadow-2xl relative shrink-0">
             <img 
               src={media.cover || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop'} 
               className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" 
               alt="Cover"
             />
             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i className={`fab fa-${media.service.toLowerCase()} text-4xl text-white`}></i>
             </div>
          </div>

          <div className="flex-1 min-w-0">
             <span className="text-[10px] font-black text-blue-500 tracking-[0.5em] mb-2 block">SENTINEL HUB</span>
             <h4 className="text-3xl font-black text-white truncate italic tracking-tighter uppercase leading-none mb-1">{media.title}</h4>
             <p className="text-sm font-bold text-white/30 truncate uppercase tracking-widest">{media.artist}</p>
          </div>
       </div>

       <div className="space-y-6">
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.8)]" style={{ width: `${media.progress}%` }}></div>
          </div>

          <div className="flex items-center justify-between px-4">
             <button className="text-3xl text-white/20 hover:text-white transition-all active:scale-90">
                <i className="fas fa-step-backward"></i>
             </button>
             <button className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black text-4xl shadow-2xl hover:scale-105 active:scale-90 transition-all">
                <i className={`fas ${media.isPlaying ? 'fa-pause' : 'fa-play ml-1'}`}></i>
             </button>
             <button className="text-3xl text-white/20 hover:text-white transition-all active:scale-90">
                <i className="fas fa-step-forward"></i>
             </button>
          </div>
       </div>
    </div>
  );
};

export default MediaWidget;
