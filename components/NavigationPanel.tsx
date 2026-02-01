
import React from 'react';
import { TravelInfo, StopInfo, WarningType } from '../types';

interface NavigationPanelProps {
  travel: TravelInfo;
  onAddStop: () => void;
  onRemoveStop: (id: string) => void;
  onSetDestination: () => void;
  transparent?: boolean;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ travel, onAddStop, onRemoveStop, onSetDestination, transparent }) => {
  
  const getWarningUI = (type: WarningType) => {
     switch(type) {
        case 'RADAR': return { icon: 'fa-camera', color: 'text-blue-500', bg: 'bg-blue-500/10' };
        case 'POLICE': return { icon: 'fa-user-shield', color: 'text-orange-500', bg: 'bg-orange-500/10' };
        case 'FLOOD': return { icon: 'fa-water', color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
        case 'ACCIDENT': return { icon: 'fa-car-burst', color: 'text-red-500', bg: 'bg-red-500/10' };
        default: return { icon: 'fa-circle-exclamation', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
     }
  };

  return (
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/95'} rounded-[60px] border border-white/10 flex flex-col h-full italic uppercase shadow-2xl overflow-hidden`}>
      <div className="p-8 flex flex-col h-full">
        
        {/* HEADER: RESUMO TOTAL & CLIMA */}
        <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-8">
           <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                 <span className="text-[10px] font-black text-blue-500 tracking-[0.3em]">Destino: {travel.destination}</span>
                 {travel.floodRisk === 'HIGH' && (
                   <span className="px-2 py-0.5 bg-red-600 text-[8px] font-black rounded-md animate-pulse">Risco Alagamento</span>
                 )}
              </div>
              <div className="flex items-end gap-3">
                 <span className="text-4xl font-black text-white">{travel.drivingTimeMinutes || 0}m</span>
                 <span className="text-white/40 text-lg font-bold mb-1">/ {travel.totalDistanceKm || 0}km</span>
              </div>
           </div>
           <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 text-white/60">
                 <i className="fas fa-cloud-sun-rain"></i>
                 <span className="text-[10px] font-black">{travel.weatherStatus || 'ESTÁVEL'}</span>
              </div>
              <button onClick={onSetDestination} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white"><i className="fas fa-search"></i></button>
           </div>
        </div>

        {/* TRAJETÓRIA SEGMENTADA */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 mb-6">
           
           {/* SEGMENTOS DE PARADA */}
           <div className="space-y-4">
              <label className="text-[9px] font-black text-white/30 tracking-widest block uppercase">Segmentos do Percurso</label>
              {travel.stops.map((stop, i) => (
                 <div key={stop.id} className="relative pl-8">
                    {/* Linha de Conexão */}
                    <div className="absolute left-[11px] top-6 bottom-[-20px] w-0.5 bg-white/10"></div>
                    <div className="absolute left-0 top-1 w-6 h-6 rounded-full border-2 border-blue-600 bg-black flex items-center justify-center z-10">
                       <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    </div>
                    
                    <div className="p-5 rounded-[30px] bg-white/5 border border-white/5 flex items-center justify-between group">
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-white truncate max-w-[150px]">{stop.name}</span>
                          <span className="text-[9px] font-bold text-blue-400">+{stop.timeFromPrev || '0m'} ({stop.distanceFromPrev || '0km'})</span>
                       </div>
                       <button onClick={() => onRemoveStop(stop.id)} className="w-8 h-8 rounded-full bg-red-600/10 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times text-xs"></i></button>
                    </div>
                 </div>
              ))}
              {/* Ponto Final */}
              <div className="relative pl-8">
                 <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                    <i className="fas fa-flag-checkered text-[10px] text-white"></i>
                 </div>
                 <div className="p-5 rounded-[30px] bg-blue-600/10 border border-blue-500/20">
                    <span className="text-xs font-black text-white">{travel.destination} (Final)</span>
                 </div>
              </div>
           </div>

           {/* ALERTAS DETALHADOS */}
           <div className="space-y-3 pt-4">
              <label className="text-[9px] font-black text-red-500 tracking-widest block uppercase">Alertas de Via</label>
              {travel.warnings.map(w => {
                 const ui = getWarningUI(w.type);
                 return (
                    <div key={w.id} className={`p-5 rounded-[30px] border border-white/5 flex items-center gap-5 ${ui.bg}`}>
                       <div className={`w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center text-xl ${ui.color}`}>
                          <i className={`fas ${ui.icon}`}></i>
                       </div>
                       <div className="flex-1">
                          <h5 className="text-[11px] font-black text-white">{w.description}</h5>
                          <div className="flex gap-3">
                             <span className="text-[9px] font-bold text-white/40">{w.distance}m</span>
                             {w.speedLimit && <span className="text-[9px] font-black text-red-500">LIMITE: {w.speedLimit}KM/H</span>}
                          </div>
                       </div>
                    </div>
                 );
              })}
           </div>
        </div>

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-4 shrink-0">
           <button onClick={onAddStop} className="h-16 rounded-[30px] bg-white text-black font-black text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all">
             <i className="fas fa-plus-circle text-lg"></i> PARADA
           </button>
           <button onClick={() => window.open(`waze://?q=${travel.destination}&navigate=yes`)} className="h-16 rounded-[30px] bg-[#33CCFF] text-white font-black text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all">
             <i className="fab fa-waze text-xl"></i> WAZE FORCE
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
