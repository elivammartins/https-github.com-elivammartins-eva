
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
    <div className={`${transparent ? 'bg-black/60 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)]' : 'bg-black/80 backdrop-blur-md'} rounded-[40px] border border-white/10 overflow-hidden flex flex-col h-full italic uppercase transition-all duration-700`}>
      <div className="p-8 flex flex-col h-full relative">
        
        {/* Próxima Manobra High Visibility */}
        {travel.nextInstruction && (
          <div className="mb-6 bg-blue-600 rounded-[30px] p-6 flex items-center gap-6 shadow-2xl border border-blue-400/50">
             <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl shadow-inner">
                <i className={`fas ${travel.nextInstruction.icon}`}></i>
             </div>
             <div className="flex-1">
                <span className="text-4xl font-black text-white leading-tight block">{travel.nextInstruction.distance}</span>
                <span className="text-[11px] font-bold text-blue-100 uppercase mt-0.5 truncate block">{travel.nextInstruction.instruction}</span>
             </div>
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div className="bg-black/40 p-5 rounded-[30px] border border-white/5">
             <span className="text-[9px] font-black text-blue-400 tracking-widest block mb-1">DESTINO FINAL</span>
             <h4 className="font-black text-white text-[16px] truncate leading-none">{travel.destination}</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-black/40 p-5 rounded-[30px] border border-white/5">
                <span className="text-[9px] font-black text-white/40 uppercase">RESTANTE</span>
                <span className="text-2xl font-black text-white block mt-1 tracking-tighter">12.4 KM</span>
             </div>
             <div className="bg-black/40 p-5 rounded-[30px] border border-white/5">
                <span className="text-[9px] font-black text-white/40 uppercase">CHEGADA</span>
                <span className="text-2xl font-black text-emerald-400 block mt-1 tracking-tighter">18 MIN</span>
             </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 pointer-events-auto">
           <div className="flex gap-2">
              <button 
                onClick={() => window.open(`https://waze.com/ul?ll=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}&navigate=yes`)}
                className="flex-1 h-14 rounded-2xl bg-[#33CCFF] text-white font-black text-[10px] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <i className="fab fa-waze text-xl"></i> WAZE
              </button>
              <button 
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${travel.destinationCoords?.[0]},${travel.destinationCoords?.[1]}`)}
                className="flex-1 h-14 rounded-2xl bg-[#34A853] text-white font-black text-[10px] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <i className="fas fa-map-marked-alt text-xl"></i> MAPS
              </button>
           </div>
           <button 
             onClick={onSetDestination} 
             className="h-14 w-full rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[10px] font-black tracking-widest hover:bg-white/10 transition-all"
           >
             REDEFINIR VETOR
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
