
import React from 'react';
import { MeetingInfo } from '../types';

interface MeetingViewProps {
  isActive: boolean;
  isFullScreen: boolean;
  onToggle: () => void;
  onToggleFullScreen: () => void;
  nextMeeting?: MeetingInfo;
}

const MeetingView: React.FC<MeetingViewProps> = ({ isActive, isFullScreen, onToggle, onToggleFullScreen, nextMeeting }) => {
  if (isFullScreen && isActive) {
    return (
      <div className="absolute inset-0 z-[2000] bg-[#0b0b0e] flex flex-col animate-fade-in">
        {/* Header Fullscreen */}
        <div className="p-8 flex justify-between items-center bg-black/40 border-b border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#464775] flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <i className="fab fa-microsoft text-white text-2xl"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter">Microsoft Teams</h2>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Conexão Segura em HD • Protocolo Pandora</p>
            </div>
          </div>
          <button 
            onClick={onToggleFullScreen}
            className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl hover:bg-white/10 transition-all"
          >
            <i className="fas fa-compress"></i>
          </button>
        </div>

        {/* Main Video Content */}
        <div className="flex-1 relative overflow-hidden bg-[#11100f]">
          <img 
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=1200&auto=format&fit=crop" 
            className="w-full h-full object-cover"
            alt="Meeting Video"
          />
          
          <div className="absolute top-10 left-10 flex flex-col gap-2">
             <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-black uppercase italic">REC 00:12:45</span>
             </div>
          </div>

          {/* Overlay de Participantes */}
          <div className="absolute bottom-10 right-10 flex gap-4">
            <div className="w-32 h-20 rounded-2xl border-2 border-indigo-500 overflow-hidden shadow-2xl relative">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/40 text-[8px] font-bold rounded">Jake Sully</div>
            </div>
            <div className="w-32 h-20 rounded-2xl border border-white/20 overflow-hidden shadow-2xl brightness-50">
               <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white font-bold italic text-xs uppercase">Você</div>
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="p-10 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-10">
          <button className="w-20 h-20 rounded-full bg-white/5 text-3xl hover:bg-white/10 transition-all"><i className="fas fa-microphone"></i></button>
          <button className="w-20 h-20 rounded-full bg-white/5 text-3xl hover:bg-white/10 transition-all"><i className="fas fa-video"></i></button>
          <button className="w-20 h-20 rounded-full bg-white/5 text-3xl hover:bg-white/10 transition-all"><i className="fas fa-ellipsis-h"></i></button>
          <button 
            onClick={onToggle}
            className="w-24 h-24 rounded-full bg-red-600 text-4xl shadow-[0_0_40px_rgba(220,38,38,0.4)] hover:bg-red-500 active:scale-95 transition-all"
          >
            <i className="fas fa-phone-slash"></i>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`group relative flex flex-col w-full h-full rounded-[40px] border transition-all duration-700 overflow-hidden ${
        isActive 
          ? 'bg-[#464775]/20 border-indigo-500 shadow-[0_0_40px_rgba(70,71,117,0.3)]' 
          : 'bg-[#121214] border-white/5 hover:border-white/20'
      }`}
      onClick={() => isActive && onToggleFullScreen()}
    >
      <div className="p-6 flex flex-col h-full relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#464775] flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <i className="fab fa-microsoft text-white text-xl"></i>
          </div>
          {isActive ? (
            <div className="px-4 py-1.5 bg-indigo-500 border border-white/20 rounded-full flex items-center gap-2 shadow-lg animate-pulse">
              <span className="text-[10px] font-black text-white uppercase italic">EM CHAMADA</span>
            </div>
          ) : (
             <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/30">
                <i className="fas fa-calendar-alt text-xs"></i>
             </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h4 className="text-white text-xl font-black italic uppercase leading-none tracking-tighter mb-2">
            {isActive ? 'Daily Sync: Projeto Pandora' : (nextMeeting?.title || 'Agenda de Hoje')}
          </h4>
          <div className="flex items-center gap-3">
             <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                   <div key={i} className="w-5 h-5 rounded-full border border-black bg-gray-700 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} className="w-full h-full object-cover" />
                   </div>
                ))}
             </div>
             <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.1em]">
               {isActive ? '+14 Participantes' : `${nextMeeting?.startTime || '16:00'} • Jake Sully`}
             </p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
           <button 
             onClick={(e) => { e.stopPropagation(); onToggle(); }}
             className={`flex-1 h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-2xl ${
               isActive 
                 ? 'bg-red-600 text-white hover:bg-red-500' 
                 : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'
             }`}
           >
             {isActive ? (
               <><i className="fas fa-phone-slash"></i> Sair</>
             ) : (
               <><i className="fas fa-video"></i> Entrar Agora</>
             )}
           </button>
           {!isActive && (
              <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">
                 <i className="fas fa-ellipsis-v"></i>
              </button>
           )}
        </div>
      </div>
      
      {/* Background Subtle Elements */}
      <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isActive ? 'opacity-20' : 'opacity-5'}`}>
         <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 blur-[60px]"></div>
         <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500 blur-[60px]"></div>
      </div>
    </div>
  );
};

export default MeetingView;
