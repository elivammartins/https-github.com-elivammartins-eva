
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
  
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} MIN`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}H ${m > 0 ? `${m}MIN` : ''}`;
  };

  return (
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/95'} rounded-[40px] border border-white/10 flex flex-col italic uppercase overflow-hidden transition-all duration-500 shadow-2xl`}>
      <div className="p-6">
        <header className="flex justify-between items-center mb-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-emerald-500 tracking-[0.3em]">ROTA PANDORA V160</span>
              <h4 className="text-lg font-black text-white truncate w-40">{travel.destination}</h4>
           </div>
           <div className="flex gap-2 text-center">
              <div className="bg-white/5 px-4 py-2 rounded-2xl flex flex-col border border-white/5">
                 <span className="text-[8px] opacity-40 uppercase">DISTÂNCIA</span>
                 <span className="text-xs font-black">{travel.totalDistanceKm} KM</span>
              </div>
              <div className="bg-emerald-600/20 px-4 py-2 rounded-2xl border border-emerald-500/20 flex flex-col">
                 <span className="text-[8px] text-emerald-400 uppercase">RESTANTE</span>
                 <span className="text-xs font-black text-emerald-400">{formatTime(travel.drivingTimeMinutes)}</span>
              </div>
           </div>
        </header>

        {/* HUD TURN-BY-TURN (A PRÓXIMA CURVA) */}
        {travel.destination !== 'SEM DESTINO' && (
          <div className="mb-6 p-5 bg-blue-600/10 border border-blue-500/30 rounded-[30px] flex items-center gap-6 shadow-xl animate-slide-in">
             <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl text-white shadow-2xl">
                <i className="fas fa-location-arrow -rotate-45"></i>
             </div>
             <div className="flex-1">
                <span className="text-[10px] font-black text-blue-400 block tracking-[0.2em] mb-1">MANOBRA À FRENTE</span>
                <span className="text-lg font-black leading-tight">ENTRE À DIREITA NA RODOVIA</span>
                <p className="text-[11px] font-bold opacity-40 mt-1">EM 450 METROS</p>
             </div>
          </div>
        )}

        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar mb-6">
           {travel.destination !== 'SEM DESTINO' ? (
             <div className="relative pl-6 space-y-8">
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-white/10"></div>
                
                <div className="relative">
                   <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-black"></div>
                   <span className="text-[10px] font-black text-white/40 tracking-[0.2em]">VOCÊ ESTÁ AQUI</span>
                </div>

                {travel.stops.map((stop, i) => (
                  <div key={stop.id} className="relative">
                     <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-white border-2 border-black"></div>
                     <div className="flex flex-col bg-white/5 p-4 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-black text-white">{stop.name}</span>
                           <button onClick={() => onRemoveStop(stop.id)} className="text-red-500 active:scale-75 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                        </div>
                        {travel.segments[i+1] && (
                           <span className="text-[9px] font-bold text-white/30 mt-2 tracking-widest">
                             + {formatTime(travel.segments[i+1].durationMin)} • {travel.segments[i+1].distanceKm} KM ATÉ O PRÓXIMO VETOR
                           </span>
                        )}
                     </div>
                  </div>
                ))}

                <div className="relative">
                   <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black shadow-[0_0_20px_rgba(16,185,129,0.4)]"></div>
                   <div className="flex flex-col">
                      <span className="text-xs font-black text-emerald-500">{travel.destination}</span>
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">PONTO DE CHEGADA</span>
                   </div>
                </div>
             </div>
           ) : (
             <div className="py-14 text-center opacity-10">
                <i className="fas fa-location-arrow text-6xl mb-4 animate-pulse text-blue-500"></i>
                <p className="text-xs font-black tracking-[0.4em]">DEFINA O DESTINO COM A EVA</p>
             </div>
           )}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button onClick={onAddStop} className="h-16 rounded-2xl bg-white text-black font-black text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg">
             <i className="fas fa-plus-circle text-lg"></i> NOVA PARADA
           </button>
           <button onClick={() => window.open(`waze://?ll=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}&navigate=yes`)} className="h-16 rounded-2xl bg-[#33CCFF] text-white font-black text-[11px] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
             <i className="fab fa-waze text-lg"></i> FORÇAR WAZE
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
