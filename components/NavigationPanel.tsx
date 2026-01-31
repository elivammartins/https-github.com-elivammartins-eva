
import React from 'react';
import { TravelInfo } from '../types';

interface NavigationPanelProps {
  travel: TravelInfo;
  onAddStop: () => void;
  onSetDestination: () => void;
  onRemoveStop: (index: number) => void;
  transparent?: boolean;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ travel, onAddStop, onSetDestination, transparent }) => {
  return (
    <div className={`${transparent ? 'bg-transparent border-transparent' : 'bg-black/60 border-white/10 backdrop-blur-md'} rounded-[20px] lg:rounded-[40px] border overflow-hidden flex flex-col h-full italic uppercase transition-all duration-700`}>
      <div className="p-3 lg:p-8 flex flex-col h-full relative overflow-hidden">
        
        {/* Banner Turn-by-Turn HUD High Impact */}
        {travel.nextInstruction && (
          <div className="mb-3 lg:mb-6 bg-blue-600 rounded-[20px] lg:rounded-[30px] p-3 lg:p-8 flex items-center gap-4 lg:gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-blue-400/40 shrink-0">
             <div className="w-12 h-12 lg:w-20 lg:h-20 rounded-2xl lg:rounded-3xl bg-white/20 flex items-center justify-center text-xl lg:text-5xl drop-shadow-xl shrink-0">
                <i className={`fas ${travel.nextInstruction.icon}`}></i>
             </div>
             <div className="flex-1 flex flex-col min-w-0">
                <span className="text-2xl lg:text-6xl font-black text-white leading-tight italic drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] tracking-tighter">{travel.nextInstruction.distance}</span>
                <span className="text-[10px] lg:text-[14px] font-black text-blue-100 uppercase mt-1 truncate drop-shadow-md">{travel.nextInstruction.instruction}</span>
             </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 lg:space-y-4 pb-2 lg:pb-4">
          <div className="bg-black/10 p-3 lg:p-5 rounded-[20px] lg:rounded-[30px] border border-white/10 shadow-lg backdrop-blur-[1px]">
             <span className="text-[8px] lg:text-[9px] font-black text-blue-400 tracking-widest uppercase mb-0.5 lg:mb-1 block drop-shadow-sm">Vetor de Destino</span>
             <h4 className="font-black text-white text-[14px] lg:text-[18px] truncate italic leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">{travel.destination}</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-2 lg:gap-4">
             <div className="bg-black/10 p-3 lg:p-5 rounded-2xl lg:rounded-3xl border border-white/10 shadow-md">
                <span className="text-[8px] lg:text-[9px] font-black text-white/50 uppercase italic">Km Restante</span>
                <span className="text-xl lg:text-3xl font-black italic text-white block mt-0.5 lg:mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">{travel.distanceRemaining}</span>
             </div>
             <div className="bg-black/10 p-3 lg:p-5 rounded-2xl lg:rounded-3xl border border-white/10 shadow-md">
                <span className="text-[8px] lg:text-[9px] font-black text-white/50 uppercase italic">ETA Alpha</span>
                <span className="text-xl lg:text-3xl font-black italic text-blue-400 block mt-0.5 lg:mt-1 drop-shadow-[0_2px_6px_rgba(0,0,0,1)]">{travel.drivingTimeMinutes}m</span>
             </div>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2 lg:gap-4 pt-4 lg:pt-6 border-t border-white/10 pointer-events-auto">
           <div className="flex gap-2">
              <button 
                onClick={() => window.location.href = `waze://?ll=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}&navigate=yes`}
                className="flex-1 h-12 lg:h-16 rounded-[15px] lg:rounded-[25px] bg-[#33CCFF] text-white font-black text-[10px] lg:text-[12px] flex items-center justify-center gap-2 lg:gap-3 shadow-lg active:scale-95 transition-all"
              >
                <i className="fab fa-waze text-xl lg:text-2xl"></i> WAZE
              </button>
              <button 
                onClick={() => window.location.href = `https://www.google.com/maps/dir/?api=1&destination=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}`}
                className="flex-1 h-12 lg:h-16 rounded-[15px] lg:rounded-[25px] bg-[#34A853] text-white font-black text-[10px] lg:text-[12px] flex items-center justify-center gap-2 lg:gap-3 shadow-lg active:scale-95 transition-all"
              >
                <i className="fas fa-map-marked-alt text-xl lg:text-2xl"></i> MAPS
              </button>
           </div>
           <button 
             onClick={onSetDestination} 
             className="h-12 lg:h-16 w-full rounded-[20px] lg:rounded-[30px] bg-blue-600 text-white text-[10px] lg:text-[12px] font-black tracking-[0.1em] lg:tracking-[0.2em] shadow-xl border border-blue-400/40 active:scale-95 transition-all"
           >
             MUDAR VETOR ALPHA
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
