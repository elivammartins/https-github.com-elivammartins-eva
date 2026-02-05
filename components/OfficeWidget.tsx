
import React from 'react';
import { MeetingInfo } from '../types';

interface OfficeWidgetProps {
  schedule: MeetingInfo[];
  onJoin: (meeting: MeetingInfo) => void;
}

const OfficeWidget: React.FC<OfficeWidgetProps> = ({ schedule, onJoin }) => {
  const nextMeeting = schedule[0];

  return (
    <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-6 flex flex-col gap-4 shadow-2xl animate-scale-up h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#464775] flex items-center justify-center text-white">
            <i className="fab fa-microsoft"></i>
          </div>
          <span className="text-[10px] font-black text-white/30 tracking-[0.4em] uppercase">Office Hub</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[9px] font-black text-emerald-500 uppercase">Sincronizado</span>
        </div>
      </div>

      {nextMeeting ? (
        <div className="flex flex-col gap-4 flex-1 justify-center">
          <div className="space-y-1">
            <h4 className="text-xl font-black italic text-white uppercase tracking-tighter truncate">
              {nextMeeting.title}
            </h4>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">
              Hoje • {nextMeeting.startTime} • Org: {nextMeeting.organizer}
            </p>
          </div>

          <button 
            onClick={() => onJoin(nextMeeting)}
            className="w-full h-14 bg-[#464775] hover:bg-[#5a5b94] rounded-2xl flex items-center justify-center gap-3 text-white font-black text-[11px] tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
          >
            <i className="fas fa-video"></i> ENTRAR AGORA
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-20">
          <p className="text-[10px] font-black tracking-widest">SEM REUNIÕES AGENDADAS</p>
        </div>
      )}
    </div>
  );
};

export default OfficeWidget;
