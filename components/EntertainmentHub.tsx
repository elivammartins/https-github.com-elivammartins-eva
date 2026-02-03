
import React from 'react';
import { MediaApp, TrackMetadata } from '../types';

interface EntertainmentHubProps {
  speed: number;
  status: 'IDLE' | 'LOADING' | 'READY' | 'ERROR';
  error: string | null;
  currentApp: MediaApp;
  track: TrackMetadata;
  isPip?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onControl: (action: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREVIOUS') => void;
}

const EntertainmentHub: React.FC<EntertainmentHubProps> = ({ speed, status, error, currentApp, track, isPip, onMinimize, onMaximize, onClose, onControl }) => {
  const isVideoApp = currentApp.category === 'VIDEO' || currentApp.category === 'TV';

  return (
    <div className={`flex flex-col h-full bg-black relative italic uppercase overflow-hidden transition-all duration-500 ${isPip ? 'rounded-[40px] border-2 border-blue-500/50' : ''}`}>
       
       {/* DRIVE CARE ALERT */}
       {speed > 5 && isVideoApp && (
         <div className="absolute top-0 left-0 right-0 z-[100] h-10 bg-red-600/90 backdrop-blur-md flex items-center justify-center border-b border-white/20">
            <span className="text-[9px] font-black text-white tracking-[0.4em]">DRIVE CARE: CONTROLE POR VOZ ATIVO</span>
         </div>
       )}

       {/* WINDOW CONTROLS */}
       <div className="absolute top-6 right-6 z-[110] flex gap-3">
          {!isPip && status === 'READY' && (
            <button onClick={onMinimize} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/20 active:scale-90 transition-all">
               <i className="fas fa-compress"></i>
            </button>
          )}
          {isPip && status === 'READY' && (
            <button onClick={onMaximize} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/20 active:scale-90 transition-all">
               <i className="fas fa-expand"></i>
            </button>
          )}
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-red-600/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-500 active:scale-90 transition-all">
             <i className="fas fa-times"></i>
          </button>
       </div>

       {/* REPRODUCTION AREA */}
       <div className="flex-1 relative bg-[#050505] flex flex-col items-center justify-center overflow-hidden">
          
          {/* ERRO DE COFRE / CREDENCIAIS */}
          {status === 'ERROR' && (
             <div className="flex flex-col items-center text-center p-8 animate-fade-in z-50">
                <div className="w-20 h-20 rounded-full bg-red-600/20 flex items-center justify-center mb-6 border border-red-500/30 shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                  <i className="fas fa-key text-red-500 text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-white mb-2 tracking-tighter uppercase italic">Cofre de Senhas Vazio</h3>
                <p className="text-red-400 text-[10px] font-bold tracking-widest max-w-xs mb-8">{error || 'CREDENCIAIS NÃO IDENTIFICADAS'}</p>
                <div className="flex gap-4">
                  <button onClick={onClose} className="px-8 h-12 bg-white/5 border border-white/10 rounded-xl font-black text-[9px] hover:bg-white/10 transition-all uppercase active:scale-95">Fechar Painel</button>
                </div>
             </div>
          )}

          {/* LOADING STATE */}
          {status === 'LOADING' && (
             <div className="flex flex-col items-center gap-6 z-50">
                <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <div className="text-center">
                   <p className="text-cyan-400 font-black text-[12px] tracking-[0.5em] animate-pulse">ACESSANDO COFRE...</p>
                   <p className="text-white/20 text-[8px] mt-2 tracking-widest uppercase italic">{currentApp.name} SECURITY SYNC</p>
                </div>
             </div>
          )}

          {/* ACTIVE PLAYER */}
          {status === 'READY' && (
             <div className="absolute inset-0 flex flex-col animate-fade-in">
                <div className="flex-1 relative overflow-hidden bg-black">
                   <img 
                      src={`https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1200&auto=format&fit=crop`} 
                      className="w-full h-full object-cover opacity-70 brightness-75 animate-ken-burns scale-110" 
                      alt="Content Visual" 
                   />
                   
                   <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay pointer-events-none"></div>
                   <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>
                   
                   <div className={`absolute bottom-8 left-8 right-8 z-20 transition-all ${isPip ? 'scale-75 origin-bottom-left' : ''}`}>
                      <div className="flex items-center gap-3 mb-2">
                         <i className={`${currentApp.icon} text-2xl ${currentApp.color}`}></i>
                         <span className="text-[9px] font-black tracking-[0.4em] text-white/40">{currentApp.name} STREAMING</span>
                      </div>
                      <h2 className="text-4xl font-black text-white leading-tight mb-1 tracking-tighter uppercase italic">{track.title}</h2>
                      <div className="flex items-center gap-4">
                         <span className="bg-blue-600/20 border border-blue-500/30 px-3 py-1 rounded-lg text-[10px] font-black text-blue-400">
                            REPRODUÇÃO ATIVA
                         </span>
                         <span className="text-white/50 text-[10px] font-bold tracking-widest uppercase">{track.artist}</span>
                      </div>
                   </div>
                   
                   <div className="absolute top-8 left-8 opacity-20">
                      <span className="text-[8px] font-black tracking-[0.6em] text-white">EVA PANDORA V168 LIVE</span>
                   </div>
                </div>

                {!isPip && (
                   <div className="h-28 bg-black/95 backdrop-blur-3xl border-t border-white/5 flex items-center justify-between px-12 shrink-0">
                      <div className="flex items-center gap-6">
                         <button onClick={() => onControl('PREVIOUS')} className="text-2xl text-white/30 hover:text-white transition-all active:scale-90"><i className="fas fa-step-backward"></i></button>
                         <button onClick={() => onControl('PLAY')} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black text-2xl shadow-xl active:scale-90 transition-all"><i className="fas fa-pause"></i></button>
                         <button onClick={() => onControl('NEXT')} className="text-2xl text-white/30 hover:text-white transition-all active:scale-90"><i className="fas fa-step-forward"></i></button>
                      </div>
                      <div className="flex-1 max-w-lg mx-12">
                         <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-[45%] animate-pulse"></div>
                         </div>
                         <div className="flex justify-between mt-2 text-[8px] font-black text-white/20 tracking-widest uppercase">
                            <span>12:45</span>
                            <span>48:00</span>
                         </div>
                      </div>
                      <button onClick={onMinimize} className="w-14 h-14 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-lg active:scale-90 transition-all"><i className="fas fa-compress-alt"></i></button>
                   </div>
                )}
             </div>
          )}
       </div>

       <style>{`
          @keyframes kenburns { 0% { transform: scale(1.1); } 100% { transform: scale(1.3) translate(1%, 1%); } }
          .animate-ken-burns { animation: kenburns 50s infinite alternate ease-in-out; }
          .animate-fade-in { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
       `}</style>
    </div>
  );
};

export default EntertainmentHub;
