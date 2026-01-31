
import React from 'react';
import { MediaApp } from '../types';

interface EntertainmentHubProps {
  speed: number;
  currentApp: MediaApp;
}

const EntertainmentHub: React.FC<EntertainmentHubProps> = ({ speed, currentApp }) => {
  const isVideoApp = currentApp.category === 'VIDEO';

  return (
    <div className="flex flex-col h-full bg-black relative italic uppercase overflow-hidden">
       
       {/* PLAYER CORE */}
       <div className="flex-1 relative">
          {isVideoApp ? (
             <div className="w-full h-full relative group">
                <img 
                   src={currentApp.id === 'youtube' 
                     ? "https://images.unsplash.com/photo-1514525253361-b83f8b9627c5?q=80&w=1200" 
                     : "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1200"} 
                   className={`w-full h-full object-cover transition-all duration-1000 ${speed > 5 ? 'blur-2xl brightness-50' : 'brightness-100'}`}
                   alt="Visual Alpha"
                />
                
                {/* Interface do Player sobre o vídeo */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-8">
                   <div className="flex justify-between items-center">
                      <span className="bg-red-600 px-3 py-1 rounded-md text-[10px] font-black">LIVE CORE</span>
                      <i className="fas fa-cog text-xl"></i>
                   </div>
                   <div className="flex flex-col gap-4">
                      <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                         <div className="h-full bg-red-600 w-1/3"></div>
                      </div>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-6">
                            <i className="fas fa-backward text-2xl"></i>
                            <i className="fas fa-play text-4xl text-white"></i>
                            <i className="fas fa-forward text-2xl"></i>
                         </div>
                         <i className="fas fa-expand text-2xl"></i>
                      </div>
                   </div>
                </div>

                {speed > 5 && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md p-10 text-center">
                      <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center mb-4 animate-pulse">
                         <i className="fas fa-eye-slash text-3xl text-red-500"></i>
                      </div>
                      <h3 className="text-2xl font-black text-white mb-2">SEGURANÇA ALPHA ATIVA</h3>
                      <p className="text-[10px] text-white/60 tracking-widest font-bold">VÍDEO BLOQUEADO EM MOVIMENTO. USE O COMANDO DE VOZ PARA ÁUDIO.</p>
                   </div>
                )}
             </div>
          ) : (
             <div className="w-full h-full bg-gradient-to-br from-[#0c0c0e] to-black flex items-center justify-center p-6 relative">
                <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-[50px] bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_80px_rgba(37,99,235,0.2)] relative animate-vibe">
                   <i className={`fas ${currentApp.icon} text-6xl lg:text-8xl ${currentApp.color} opacity-90`}></i>
                   <div className="absolute inset-0 bg-blue-500/5 rounded-[inherit] blur-[100px]"></div>
                </div>
                
                {/* Visualizer animado */}
                <div className="absolute bottom-10 left-0 right-0 h-20 flex items-end justify-center gap-1 opacity-40">
                   {[...Array(20)].map((_, i) => (
                      <div key={i} className="w-1 bg-blue-500 rounded-full animate-bounce" style={{ height: `${Math.random()*100}%`, animationDelay: `${i*0.1}s` }}></div>
                   ))}
                </div>
             </div>
          )}
       </div>

       {/* INFORMAÇÕES DO TRACK */}
       <div className="h-20 bg-[#080808] border-t border-white/10 flex items-center px-8 gap-6 shrink-0">
          <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl ${currentApp.color} shadow-lg`}>
             <i className={currentApp.icon}></i>
          </div>
          <div className="flex-1 flex flex-col justify-center min-w-0">
             <h4 className="text-[14px] font-black text-white truncate italic leading-none mb-1 tracking-tight">
                Alpha Core Dynamic Stream
             </h4>
             <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] truncate italic">
                {currentApp.name} Premium • Sincronizado com Eva
             </p>
          </div>
          <div className="flex gap-6 text-white/40 text-xl">
             <i className="fas fa-heart hover:text-red-600 transition-colors cursor-pointer"></i>
             <i className="fas fa-share-alt hover:text-blue-400 transition-colors cursor-pointer"></i>
          </div>
       </div>
       <style>{`
          @keyframes vibe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
          .animate-vibe { animation: vibe 4s ease-in-out infinite; }
       `}</style>
    </div>
  );
};

export default EntertainmentHub;
