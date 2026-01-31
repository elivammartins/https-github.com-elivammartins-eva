
import React from 'react';
import { MediaApp } from '../types';

interface EntertainmentHubProps {
  speed: number;
  currentApp: MediaApp;
  isPip?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

const EntertainmentHub: React.FC<EntertainmentHubProps> = ({ speed, currentApp, isPip, onMinimize, onMaximize, onClose }) => {
  const isVideoApp = currentApp.category === 'VIDEO';

  return (
    <div className={`flex flex-col h-full bg-black relative italic uppercase overflow-hidden ${isPip ? 'rounded-[inherit] border border-blue-500/30' : ''}`}>
       
       {/* CONTROLES DE JANELA */}
       <div className={`absolute ${isPip ? 'top-2 right-2' : 'top-6 right-6'} z-[60] flex gap-3 pointer-events-auto`}>
          {!isPip && onMinimize && (
            <button onClick={onMinimize} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all"><i className="fas fa-compress"></i></button>
          )}
          {isPip && onMaximize && (
            <button onClick={onMaximize} className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-white/20 transition-all"><i className="fas fa-expand"></i></button>
          )}
          {onClose && (
            <button onClick={onClose} className="w-12 h-12 rounded-full bg-red-600/80 backdrop-blur-md flex items-center justify-center text-white border border-white/10 hover:bg-red-500 transition-all"><i className="fas fa-times"></i></button>
          )}
       </div>

       {/* PLAYER CORE */}
       <div className="flex-1 relative">
          {isVideoApp ? (
             <div className="w-full h-full relative group">
                <img 
                   src={currentApp.id === 'youtube' 
                     ? "https://images.unsplash.com/photo-1514525253361-b83f8b9627c5?q=80&w=1200" 
                     : "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1200"} 
                   className={`w-full h-full object-cover transition-all duration-1000 ${speed > 5 && !isPip ? 'blur-3xl brightness-50' : 'brightness-100'}`}
                   alt="Media Preview"
                />
                
                <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 transition-opacity flex flex-col justify-end p-8 ${isPip ? 'opacity-0' : 'group-hover:opacity-100'}`}>
                   <div className="flex flex-col gap-4">
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-600 w-1/3"></div>
                      </div>
                      <div className="flex justify-between items-center text-white">
                         <div className="flex items-center gap-6">
                            <i className="fas fa-backward text-2xl"></i>
                            <i className="fas fa-play text-4xl"></i>
                            <i className="fas fa-forward text-2xl"></i>
                         </div>
                         <i className="fas fa-expand text-2xl"></i>
                      </div>
                   </div>
                </div>

                {speed > 5 && !isPip && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl p-10 text-center animate-fade-in">
                      <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center mb-4 animate-pulse">
                         <i className="fas fa-eye-slash text-3xl text-red-500"></i>
                      </div>
                      <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Segurança Ativa</h3>
                      <p className="text-[10px] text-white/60 tracking-widest font-bold">VÍDEO BLOQUEADO EM MOVIMENTO. USE O MODO PIP OU FOQUE NA ESTRADA.</p>
                   </div>
                )}
             </div>
          ) : (
             <div className="w-full h-full bg-gradient-to-br from-[#0c0c0e] to-black flex items-center justify-center p-6">
                <div className={`${isPip ? 'w-24 h-24' : 'w-48 h-48 lg:w-64 lg:h-64'} rounded-[50px] bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_100px_rgba(37,99,235,0.15)] relative animate-vibe`}>
                   <i className={`fas ${currentApp.icon} ${isPip ? 'text-3xl' : 'text-6xl lg:text-8xl'} ${currentApp.color} opacity-90`}></i>
                </div>
             </div>
          )}
       </div>

       {/* TRACK INFO BAR */}
       {!isPip && (
         <div className="h-28 bg-[#080808] border-t border-white/5 flex items-center px-10 gap-6 shrink-0 shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-4xl ${currentApp.color} shadow-inner`}>
               <i className={currentApp.icon}></i>
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
               <h4 className="text-xl font-black text-white truncate leading-none mb-1">Alpha System V100</h4>
               <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] truncate">{currentApp.name} Sincronizado • Co-Piloto Eva</p>
            </div>
         </div>
       )}
       <style>{`
          @keyframes vibe { 0%, 100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.05); filter: brightness(1.3); } }
          .animate-vibe { animation: vibe 4s ease-in-out infinite; }
       `}</style>
    </div>
  );
};

export default EntertainmentHub;
