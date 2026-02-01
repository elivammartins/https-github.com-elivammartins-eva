
import React from 'react';
import { MediaApp, TrackMetadata } from '../types';

interface EntertainmentHubProps {
  speed: number;
  currentApp: MediaApp;
  track: TrackMetadata;
  isPip?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onControl: (action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREVIOUS') => void;
}

const EntertainmentHub: React.FC<EntertainmentHubProps> = ({ speed, currentApp, track, isPip, onMinimize, onMaximize, onClose, onControl }) => {
  const isVideoApp = currentApp.category === 'VIDEO';

  return (
    <div className={`flex flex-col h-full bg-black relative italic uppercase overflow-hidden transition-all duration-500 ${isPip ? 'rounded-[40px] border-2 border-blue-500/50 shadow-[0_0_50px_rgba(59,130,246,0.3)]' : ''}`}>
       
       {/* DRIVE CARE HUD (Sempre visível em movimento) */}
       {speed > 5 && isVideoApp && (
         <div className="absolute top-0 left-0 right-0 z-[100] h-12 bg-red-600/90 backdrop-blur-xl flex items-center justify-center animate-pulse border-b border-white/20">
            <div className="flex items-center gap-4">
               <i className="fas fa-eye text-white animate-bounce"></i>
               <span className="text-[11px] font-black text-white tracking-[0.5em]">ATENÇÃO: DIRIJA COM CUIDADO</span>
            </div>
         </div>
       )}

       {/* JANELA DE CONTROLES */}
       <div className={`absolute ${isPip ? 'top-3 right-3 scale-75' : 'top-12 right-12'} z-[110] flex gap-4 pointer-events-auto`}>
          {!isPip && onMinimize && (
            <button onClick={onMinimize} title="Minimizar PIP" className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 hover:bg-white/20 active:scale-90 transition-all shadow-xl">
               <i className="fas fa-compress"></i>
            </button>
          )}
          {isPip && onMaximize && (
            <button onClick={onMaximize} title="Maximizar" className="w-14 h-14 rounded-full bg-blue-600/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 hover:bg-blue-500 active:scale-90 transition-all shadow-xl">
               <i className="fas fa-expand"></i>
            </button>
          )}
          {onClose && (
            <button onClick={onClose} title="Fechar Player" className="w-14 h-14 rounded-full bg-red-600/80 backdrop-blur-md flex items-center justify-center text-white border border-white/20 hover:bg-red-500 active:scale-90 transition-all shadow-xl">
               <i className="fas fa-times"></i>
            </button>
          )}
       </div>

       {/* PLAYER CORE */}
       <div className="flex-1 relative flex items-center justify-center">
          {isVideoApp ? (
             <div className="w-full h-full relative group bg-zinc-900">
                <img 
                   src={currentApp.id === 'youtube' 
                     ? "https://images.unsplash.com/photo-1514525253361-b83f8b9627c5?q=80&w=1200" 
                     : "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1200"} 
                   className="w-full h-full object-cover transition-all duration-700"
                   alt="Video Stream"
                />
                
                {/* Overlay de Controle Flutuante */}
                <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-12 ${isPip ? 'hidden' : ''}`}>
                   <button onClick={() => onControl('PREVIOUS')} className="w-20 h-20 rounded-full bg-white/10 text-white text-3xl hover:bg-white/20 active:scale-75 transition-all"><i className="fas fa-step-backward"></i></button>
                   <button onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')} className="w-28 h-28 rounded-full bg-blue-600 text-white text-5xl hover:bg-blue-500 active:scale-75 transition-all flex items-center justify-center">
                      <i className={`fas ${track.isPlaying ? 'fa-pause' : 'fa-play ml-2'}`}></i>
                   </button>
                   <button onClick={() => onControl('NEXT')} className="w-20 h-20 rounded-full bg-white/10 text-white text-3xl hover:bg-white/20 active:scale-75 transition-all"><i className="fas fa-step-forward"></i></button>
                </div>

                {/* Info de Séries/Episódios */}
                {(track.seriesName || track.season) && !isPip && (
                  <div className="absolute bottom-32 left-10 z-50 animate-fade-in">
                     <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-6 rounded-[30px] flex flex-col gap-1 shadow-2xl">
                        <span className="text-blue-500 text-[10px] font-black tracking-widest uppercase">Reproduzindo Série</span>
                        <h3 className="text-2xl font-black text-white leading-none">{track.seriesName || 'Conteúdo Pandora'}</h3>
                        <p className="text-white/40 text-[11px] font-bold">TEMPORADA {track.season || 1} • EPISÓDIO {track.episode || 1}</p>
                     </div>
                  </div>
                )}
             </div>
          ) : (
             <div className="w-full h-full bg-gradient-to-br from-[#0c0c0e] to-black flex items-center justify-center p-6">
                <div className={`${isPip ? 'w-24 h-24' : 'w-56 h-56'} rounded-[60px] bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_120px_rgba(59,130,246,0.1)] relative animate-pulse-slow`}>
                   <i className={`fas ${currentApp.icon} ${isPip ? 'text-4xl' : 'text-8xl'} ${currentApp.color}`}></i>
                </div>
             </div>
          )}
       </div>

       {/* BARRA DE PROGRESSO & INFO */}
       {!isPip && (
         <div className="h-32 bg-[#080808] border-t border-white/5 flex items-center px-12 gap-8 shrink-0 relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
               <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,1)] transition-all duration-1000" style={{width: `${track.progress}%`}}></div>
            </div>
            
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-4xl ${currentApp.color} shadow-inner`}>
               <i className={currentApp.icon}></i>
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
               <h4 className="text-2xl font-black text-white truncate leading-none mb-2">{track.title}</h4>
               <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] truncate">{track.artist} • ENGINE V155</p>
            </div>
            <div className="flex items-center gap-6">
               <button onClick={() => onControl('PREVIOUS')} className="text-white/40 hover:text-white text-2xl transition-all"><i className="fas fa-backward-step"></i></button>
               <button onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')} className="w-16 h-16 rounded-full bg-white text-black text-2xl flex items-center justify-center shadow-white/20 shadow-xl active:scale-90 transition-all">
                  <i className={`fas ${track.isPlaying ? 'fa-pause' : 'fa-play ml-1'}`}></i>
               </button>
               <button onClick={() => onControl('NEXT')} className="text-white/40 hover:text-white text-2xl transition-all"><i className="fas fa-forward-step"></i></button>
            </div>
         </div>
       )}
       <style>{`
          @keyframes pulse-slow { 0%, 100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.02); } }
          .animate-pulse-slow { animation: pulse-slow 5s ease-in-out infinite; }
       `}</style>
    </div>
  );
};

export default EntertainmentHub;
