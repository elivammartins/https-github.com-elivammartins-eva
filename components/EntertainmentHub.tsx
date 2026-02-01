
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
    <div className={`flex flex-col h-full bg-black relative italic uppercase overflow-hidden transition-all duration-500 ${isPip ? 'rounded-[40px] border-2 border-blue-500/50' : ''}`}>
       
       {/* DRIVE CARE HUD */}
       {speed > 5 && isVideoApp && (
         <div className="absolute top-0 left-0 right-0 z-[100] h-12 bg-red-600/90 backdrop-blur-xl flex items-center justify-center border-b border-white/20 shadow-2xl">
            <span className="text-[10px] font-black text-white tracking-[0.4em]">MODO CONDUÇÃO: CONTROLE VIA VOZ HABILITADO</span>
         </div>
       )}

       {/* CONTROLES DE JANELA */}
       <div className="absolute top-12 right-12 z-[110] flex gap-4">
          <button onClick={onMinimize} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
             <i className="fas fa-compress"></i>
          </button>
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-red-600/80 backdrop-blur-md flex items-center justify-center text-white">
             <i className="fas fa-times"></i>
          </button>
       </div>

       {/* HUB CENTRAL (REMOTE CONTROL MODE) */}
       <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <div className="mb-10 w-48 h-48 rounded-[60px] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl animate-pulse-slow">
             <i className={`fas ${currentApp.icon} text-8xl ${currentApp.color}`}></i>
          </div>
          
          <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[50px] border border-white/10 max-w-2xl w-full">
             <span className="text-blue-500 text-[9px] font-black tracking-[0.5em] block mb-2">MODO CONTROLE REMOTO</span>
             <h2 className="text-4xl font-black text-white mb-2 leading-none truncate">{track.title}</h2>
             <p className="text-white/30 text-[11px] font-bold tracking-widest">{currentApp.name} STREAMING • SINCRONIZADO</p>
             
             <div className="mt-12 flex items-center justify-center gap-10">
                <button onClick={() => onControl('PREVIOUS')} className="w-20 h-20 rounded-full bg-white/5 text-white text-3xl hover:bg-white/10 active:scale-90 transition-all"><i className="fas fa-step-backward"></i></button>
                <button 
                   onClick={() => onControl(track.isPlaying ? 'PAUSE' : 'PLAY')} 
                   className="w-32 h-32 rounded-full bg-white text-black text-5xl flex items-center justify-center shadow-2xl active:scale-95 transition-all"
                >
                   <i className={`fas ${track.isPlaying ? 'fa-pause' : 'fa-play ml-2'}`}></i>
                </button>
                <button onClick={() => onControl('NEXT')} className="w-20 h-20 rounded-full bg-white/5 text-white text-3xl hover:bg-white/10 active:scale-90 transition-all"><i className="fas fa-step-forward"></i></button>
             </div>
          </div>
       </div>

       {/* STATUS BAR */}
       <div className="h-24 bg-white/5 border-t border-white/5 flex items-center justify-center px-12 italic">
          <p className="text-[10px] font-black text-white/20 tracking-[0.6em]">PANDORA CORE V160 • MEDIA BRIDGE ACTIVE</p>
       </div>
       <style>{`
          @keyframes pulse-slow { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.05); opacity: 1; } }
          .animate-pulse-slow { animation: pulse-slow 5s infinite ease-in-out; }
       `}</style>
    </div>
  );
};

export default EntertainmentHub;
