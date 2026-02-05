
import React from 'react';
import { PandoraNotification } from '../types';

interface NotificationOverlayProps {
  notifications: PandoraNotification[];
  isPrivacyMode: boolean;
  onClear: (id: string) => void;
}

const NotificationOverlay: React.FC<NotificationOverlayProps> = ({ notifications, isPrivacyMode, onClear }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-36 right-12 z-[200] flex flex-col gap-4 w-[400px]">
      {notifications.map((notif) => (
        <div 
          key={notif.id}
          className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-[35px] p-6 shadow-2xl flex items-center gap-6 animate-slide-in-right relative overflow-hidden group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
          
          <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-2xl">
            <i className={`fab ${notif.app === 'WHATSAPP' ? 'fa-whatsapp text-emerald-500' : 'fa-envelope text-blue-500'}`}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
               <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">{notif.sender}</span>
               <span className="text-[8px] text-white/20 font-bold uppercase">{notif.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className={`text-sm font-bold text-white/60 italic uppercase truncate transition-all duration-500 ${isPrivacyMode ? 'blur-md select-none opacity-40' : ''}`}>
               {isPrivacyMode ? 'Conteúdo Confidencial' : notif.content}
            </p>
          </div>

          <button 
            onClick={() => onClear(notif.id)}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right { animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};

export default NotificationOverlay;
