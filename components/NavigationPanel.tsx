
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
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/95'} rounded-[40px] border border-white/10 flex flex-col italic uppercase overflow-hidden`}>
      <div className="p-6">
        <header className="flex justify-between items-center mb-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-blue-500 tracking-[0.3em]">NAV CORE V160</span>
              <h4 className="text-lg font-black text-white truncate w-48">{travel.destination}</h4>
           </div>
           <button onClick={onSetDestination} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40"><i className="fas fa-search"></i></button>
        </header>

        <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar mb-6">
           {/* INSTRUÇÕES CURVA-A-CURVA */}
           {travel.destination !== 'SEM DESTINO' ? (
             <div className="space-y-3">
                <div className="p-4 bg-emerald-600/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4">
                   <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-xl text-white">
                      <i className="fas fa-arrow-up"></i>
                   </div>
                   <div>
                      <span className="text-[10px] font-black opacity-40 block">Próxima Manobra</span>
                      <span className="text-xs font-black">Siga em frente por 1.2km</span>
                   </div>
                </div>
                
                {travel.stops.map(stop => (
                  <div key={stop.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <i className="fas fa-map-pin text-blue-500"></i>
                        <span className="text-xs font-black">{stop.name}</span>
                     </div>
                     <button onClick={() => onRemoveStop(stop.id)} className="text-red-500"><i className="fas fa-times"></i></button>
                  </div>
                ))}
             </div>
           ) : (
             <div className="py-10 text-center opacity-20 italic">
                <i className="fas fa-location-arrow text-4xl mb-4"></i>
                <p className="text-xs font-black">AGUARDANDO DESTINO PARA CALCULAR VETORES</p>
             </div>
           )}

           {/* AVISOS PROATIVOS (RADARES) */}
           {travel.warnings.map(w => {
              const ui = getWarningUI(w.type);
              return (
                 <div key={w.id} className={`p-4 rounded-2xl border border-white/5 flex items-center gap-4 ${ui.bg} animate-slide-in`}>
                    <div className={`w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-lg ${ui.color}`}>
                       <i className={`fas ${ui.icon}`}></i>
                    </div>
                    <div>
                       <h5 className="text-[10px] font-black text-white">{w.description}</h5>
                       <span className="text-[9px] font-bold text-white/40">{w.distance}M PARA O ALVO</span>
                    </div>
                 </div>
              );
           })}
        </div>

        <div className="grid grid-cols-2 gap-3">
           <button onClick={onAddStop} className="h-14 rounded-2xl bg-white text-black font-black text-[10px] flex items-center justify-center gap-2">
             <i className="fas fa-plus"></i> PARADA
           </button>
           <button onClick={() => window.open(`waze://?q=${travel.destination}`)} className="h-14 rounded-2xl bg-[#33CCFF] text-white font-black text-[10px] flex items-center justify-center gap-2">
             <i className="fab fa-waze"></i> FORÇAR WAZE
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
