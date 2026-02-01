
import React from 'react';
import { TravelInfo, StopInfo, WarningType, RouteStep } from '../types';

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
        default: return { icon: 'fa-circle-exclamation', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
     }
  };

  return (
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/95'} rounded-[40px] border border-white/10 flex flex-col italic uppercase overflow-hidden transition-all duration-500`}>
      <div className="p-6">
        <header className="flex justify-between items-center mb-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-blue-500 tracking-[0.3em]">NAV CORE V160</span>
              <h4 className="text-lg font-black text-white truncate w-48">{travel.destination}</h4>
           </div>
           <div className="flex gap-2">
              <div className="bg-white/5 px-3 py-1.5 rounded-xl flex flex-col items-center">
                 <span className="text-[8px] opacity-40">KM TOTAL</span>
                 <span className="text-xs font-black">{travel.totalDistanceKm}</span>
              </div>
              <div className="bg-blue-600/20 px-3 py-1.5 rounded-xl border border-blue-500/20 flex flex-col items-center">
                 <span className="text-[8px] text-blue-400">TEMPO TOTAL</span>
                 <span className="text-xs font-black text-blue-400">{travel.drivingTimeMinutes}M</span>
              </div>
           </div>
        </header>

        <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar mb-6">
           {/* TIMELINE DE TRAJETOS SEGMENTADOS */}
           {travel.destination !== 'SEM DESTINO' ? (
             <div className="relative pl-6 space-y-8">
                {/* Linha da timeline */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-white/10"></div>
                
                {/* Pos Atual */}
                <div className="relative">
                   <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-black"></div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-white/40">VOCÊ ESTÁ AQUI</span>
                      {travel.segments.length > 0 && (
                        <span className="text-[10px] font-black text-emerald-500">{travel.segments[0].durationMin} MIN • {travel.segments[0].distanceKm} KM</span>
                      )}
                   </div>
                </div>

                {/* Paradas */}
                {travel.stops.map((stop, i) => (
                  <div key={stop.id} className="relative">
                     <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-white border-2 border-black"></div>
                     <div className="flex flex-col bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-xs font-black text-white">{stop.name}</span>
                           <button onClick={() => onRemoveStop(stop.id)} className="text-red-500 text-[10px]"><i className="fas fa-times"></i></button>
                        </div>
                        {travel.segments[i+1] && (
                           <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                             + {travel.segments[i+1].durationMin} MIN • {travel.segments[i+1].distanceKm} KM PARA PRÓXIMA
                           </span>
                        )}
                     </div>
                  </div>
                ))}

                {/* Destino Final */}
                <div className="relative">
                   <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black"></div>
                   <div className="flex flex-col">
                      <span className="text-xs font-black text-emerald-500">{travel.destination}</span>
                      <span className="text-[9px] font-bold text-white/20 uppercase">PONTO FINAL DO VETOR</span>
                   </div>
                </div>
             </div>
           ) : (
             <div className="py-14 text-center opacity-20 italic">
                <i className="fas fa-location-arrow text-5xl mb-6 animate-pulse"></i>
                <p className="text-xs font-black tracking-widest">AGUARDANDO COORDENADAS DE ELIVAM</p>
             </div>
           )}

           {/* AVISOS DE RADAR / TRÂNSITO */}
           {travel.warnings.map(w => {
              const ui = getWarningUI(w.type);
              return (
                 <div key={w.id} className={`p-5 rounded-3xl border border-white/5 flex items-center gap-5 ${ui.bg} animate-slide-in shadow-xl`}>
                    <div className={`w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center text-xl ${ui.color}`}>
                       <i className={`fas ${ui.icon}`}></i>
                    </div>
                    <div>
                       <h5 className="text-xs font-black text-white">{w.description}</h5>
                       <span className="text-[9px] font-bold text-white/40">{w.distance}M • AJUSTE DE VETOR AUTOMÁTICO</span>
                    </div>
                 </div>
              );
           })}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button onClick={onAddStop} className="h-16 rounded-2xl bg-white text-black font-black text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all">
             <i className="fas fa-plus-circle text-lg"></i> ADICIONAR PARADA
           </button>
           <button onClick={() => window.open(`waze://?ll=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}&navigate=yes`)} className="h-16 rounded-2xl bg-[#33CCFF] text-white font-black text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-[#33CCFF]/20">
             <i className="fab fa-waze text-lg"></i> FORÇAR WAZE
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
