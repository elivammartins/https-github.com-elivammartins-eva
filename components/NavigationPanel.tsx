
import React from 'react';
import { TravelInfo } from '../types';

interface NavigationPanelProps {
  travel: TravelInfo;
  onAddStop: () => void;
  onSetDestination: () => void;
  onRemoveStop: (index: number) => void;
  transparent?: boolean;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ travel, onSetDestination, transparent }) => {
  return (
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/90'} rounded-[60px] border border-white/10 overflow-hidden flex flex-col h-full italic uppercase shadow-[0_30px_60px_rgba(0,0,0,0.8)]`}>
      <div className="p-10 flex flex-col h-full">
        
        <div className="flex justify-between items-end mb-10 border-b border-white/10 pb-8">
           <div>
              <p className="text-[12px] font-black text-blue-400 tracking-widest uppercase">Destino Final</p>
              <h2 className="text-4xl font-black text-white tracking-tighter truncate w-64 leading-none mt-1">{travel.destination}</h2>
              <p className="text-[11px] font-bold text-white/40 mt-2">{travel.totalDistanceKm || 0} KM restantes</p>
           </div>
           <div className="text-right">
              <p className="text-4xl font-black text-emerald-400 leading-none">{travel.drivingTimeMinutes || 0}m</p>
              <p className="text-[11px] font-bold text-white/30 uppercase mt-1 tracking-widest">Tempo Estimado</p>
           </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto no-scrollbar mb-8 pr-2">
           {travel.allSteps && travel.allSteps.length > 0 ? travel.allSteps.map((step, i) => (
             <div key={i} className={`p-6 rounded-[40px] border flex items-center gap-6 transition-all duration-500 ${i === 0 ? 'bg-blue-600/30 border-blue-400/50 scale-105' : 'bg-white/5 border-white/5 opacity-40'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${i === 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/10 text-white/40'}`}>
                   <i className={`fas fa-arrow-turn-up ${step.maneuver?.includes('right') ? 'rotate-90' : step.maneuver?.includes('left') ? '-rotate-90' : ''}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-1">
                      <span className={`text-[11px] font-black ${i === 0 ? 'text-blue-300' : 'text-white/30'}`}>{step.distance} METROS</span>
                   </div>
                   <p className="text-lg font-black text-white truncate leading-tight uppercase">{step.instruction}</p>
                   <p className="text-[11px] font-bold text-white/20 truncate uppercase tracking-widest">{step.street}</p>
                </div>
             </div>
           )) : (
             <div className="h-full flex flex-col items-center justify-center opacity-20">
                <i className="fas fa-route text-4xl mb-4"></i>
                <p className="font-black text-sm tracking-widest">TRAÇANDO VETOR DE ROTA...</p>
             </div>
           )}
        </div>

        <div className="grid grid-cols-2 gap-5">
           <button onClick={() => window.open(`waze://?q=${travel.destination}&navigate=yes`)} className="h-20 rounded-[30px] bg-[#33CCFF] text-white font-black text-sm flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all">
             <i className="fab fa-waze text-3xl"></i> WAZE FORCE
           </button>
           <button onClick={onSetDestination} className="h-20 rounded-[30px] bg-white/10 border border-white/10 text-white font-black text-sm hover:bg-white/20 transition-all uppercase tracking-widest">
             <i className="fas fa-map-pin mr-3"></i> NOVA ROTA
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
