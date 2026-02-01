
import React from 'react';
import { TravelInfo } from '../types';

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
    <div className={`${transparent ? 'bg-black/40 backdrop-blur-3xl' : 'bg-black/95'} rounded-[40px] border border-white/10 flex flex-col italic uppercase overflow-hidden`}>
      <div className="p-6">
        <header className="flex justify-between items-center mb-6">
           <div className="flex flex-col">
              <span className="text-[9px] font-black text-emerald-500 tracking-[0.3em]">ROTA PANDORA V160</span>
              <h4 className="text-lg font-black text-white truncate w-40">{travel.destination}</h4>
           </div>
           <div className="flex gap-2">
              <div className="bg-white/5 px-4 py-2 rounded-2xl border border-white/5 flex flex-col items-center">
                 <span className="text-[8px] opacity-40">KM</span>
                 <span className="text-xs font-black">{travel.totalDistanceKm}</span>
              </div>
              <div className="bg-emerald-600/20 px-4 py-2 rounded-2xl border border-emerald-500/20 flex flex-col items-center">
                 <span className="text-[8px] text-emerald-400">TEMPO</span>
                 <span className="text-xs font-black text-emerald-400">{formatTime(travel.drivingTimeMinutes)}</span>
              </div>
           </div>
        </header>

        {travel.destination !== 'SEM DESTINO' && (
          <div className="mb-6 p-6 bg-blue-600/10 border border-blue-500/30 rounded-[30px] flex items-center gap-6">
             <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl shadow-xl">
                <i className="fas fa-location-arrow -rotate-45"></i>
             </div>
             <div className="flex-1">
                <span className="text-[10px] font-black text-blue-400 block tracking-widest">PRÓXIMA MANOBRA</span>
                <span className="text-lg font-black leading-none uppercase">SIGA EM FRENTE</span>
                <p className="text-[10px] font-bold opacity-30 mt-1 uppercase">RECALCULANDO EM TEMPO REAL</p>
             </div>
          </div>
        )}

        <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar mb-6">
           {travel.stops.map((stop) => (
             <div key={stop.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-black">{stop.name}</span>
                <button onClick={() => onRemoveStop(stop.id)} className="text-red-500"><i className="fas fa-times"></i></button>
             </div>
           ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
           <button onClick={onAddStop} className="h-16 rounded-2xl bg-white text-black font-black text-[10px] flex items-center justify-center gap-3">
             <i className="fas fa-plus"></i> PARADA
           </button>
           <button onClick={onSetDestination} className="h-16 rounded-2xl bg-blue-600 text-white font-black text-[10px] flex items-center justify-center gap-3">
             <i className="fas fa-flag-checkered"></i> DESTINO
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
