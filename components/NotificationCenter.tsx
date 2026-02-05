
import React from 'react';
import { PandoraNotification } from '../types';

interface Props {
  notifications: PandoraNotification[];
  privacyMode: boolean;
}

const NotificationCenter: React.FC<Props> = ({ notifications, privacyMode }) => {
  if (notifications.length === 0) {
    return (
      <div className="bg-black/30 backdrop-blur-3xl border border-white/5 rounded-[40px] p-8 h-full flex flex-col items-center justify-center gap-4 opacity-20">
         <i className="fas fa-bell-slash text-3xl"></i>
         <span className="text-[10px] font-black tracking-[0.4em] uppercase">Sem Mensagens</span>
      </div>
    );
  }

  return (
    <div className="bg-black/30 backdrop-blur-3xl border border-white/10 rounded-[40px] p-6 h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
         <span className="text-[10px] font-black text-blue-500 tracking-[0.4em] uppercase">Fluxo de Dados</span>
         <span className="bg-blue-600/20 px-3 py-1 rounded-full text-[9px] font-black text-blue-400 border border-blue-500/20 uppercase">Real-Time</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pr-1">
        {notifications.map((notif) => (
          <div 
            key={notif.id}
            className="p-4 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-4 animate-fade-in relative group hover:bg-white/10 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-black border border-white/10 flex items-center justify-center relative shrink-0 overflow-hidden">
               {notif.image ? (
                 <img src={notif.image} className="w-full h-full object-cover" />
               ) : (
                 <i className={`fab ${notif.app === 'WHATSAPP' ? 'fa-whatsapp text-emerald-500' : 'fa-microsoft text-indigo-500'} text-xl`}></i>
               )}
            </div>

            <div className="flex-1 min-w-0">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-black text-white/60 truncate uppercase">{notif.sender}</span>
                  <span className="text-[8px] text-white/20 font-bold uppercase">{notif.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
               <p className={`text-[11px] font-bold italic uppercase leading-tight truncate transition-all duration-500 ${privacyMode ? 'blur-md opacity-20' : 'text-white/40'}`}>
                 {privacyMode ? 'Mensagem Protegida' : notif.text}
               </p>
            </div>
            
            {notif.app === 'WHATSAPP' && (
              <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_rgba(16,185,129,1)]"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationCenter;
