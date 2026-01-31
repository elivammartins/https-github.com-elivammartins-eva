
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
    <div className={`${transparent ? 'bg-black/30 backdrop-blur-3xl' : 'bg-black/80'} rounded-[50px] border border-white/10 overflow-hidden flex flex-col h-full italic uppercase shadow-2xl`}>
      <div className="p-8 flex flex-col h-full">
        
        {/* Sumário da Viagem */}
        <div className="flex justify-between items-end mb-8 border-b border-white/5 pb-6">
           <div>
              <p className="text-[11px] font-black text-white/30 tracking-widest">DESTINO FINAL</p>
              <h2 className="text-3xl font-black text-white tracking-tighter truncate w-64 leading-tight">{travel.destination}</h2>
           </div>
           <div className="text-right">
              <p className="text-2xl font-black text-emerald-400">{travel.drivingTimeMinutes || 0}m</p>
              <p className="text-[10px] font-bold text-white/20 uppercase">Tempo Estimado</p>
           </div>
        </div>

        {/* Lista de Passos Curva-a-Curva */}
        <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar mb-6">
           {travel.allSteps ? travel.allSteps.map((step, i) => (
             <div key={i} className={`p-5 rounded-[35px] border flex items-center gap-5 transition-all ${i === 0 ? 'bg-blue-600/20 border-blue-500/40' : 'bg-white/5 border-white/5 opacity-40'}`}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${i === 0 ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'}`}>
                   <i className="fas fa-arrow-turn-up"></i>
                </div>
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-blue-400">{step.distance} Metros</span>
                   </div>
                   <p className="text-sm font-black text-white truncate">{step.instruction}</p>
                   <p className="text-[10px] font-bold text-white/30 truncate">{step.street}</p>
                </div>
             </div>
           )) : (
             <div className="h-full flex flex-col items-center justify-center opacity-20">
                <i className="fas fa-route text-6xl mb-4"></i>
                <p className="font-black">Aguardando definição de rota</p>
             </div>
           )}
        </div>

        {/* Botões de Ação */}
        <div className="grid grid-cols-2 gap-4">
           <button 
             onClick={() => window.open(`waze://?q=${travel.destination}&navigate=yes`)}
             className="h-16 rounded-3xl bg-[#33CCFF] text-white font-black text-[12px] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
           >
             <i className="fab fa-waze text-2xl"></i> WAZE FORCE
           </button>
           <button 
             onClick={onSetDestination}
             className="h-16 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-[12px] hover:bg-white/10 transition-all uppercase"
           >
             <i className="fas fa-plus mr-2"></i> NOVA ROTA
           </button>
        </div>
      </div>
    </div>
  );
};

export default NavigationPanel;
