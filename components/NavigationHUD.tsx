
import React from 'react';
import { PandoraTravel } from '../types';

interface Props {
  travel: PandoraTravel;
  privacyMode: boolean;
}

const NavigationHUD: React.FC<Props> = ({ travel, privacyMode }) => {
  if (!travel.nextStep) return null;

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
       {/* MANEUVER CARD (GLASS) */}
       <div className="bg-black/30 backdrop-blur-3xl border-l-[12px] border-blue-600 rounded-[50px] p-10 shadow-2xl border border-white/10">
          <div className="flex items-center gap-10">
             <div className="w-28 h-28 bg-blue-600 rounded-[35px] flex items-center justify-center text-6xl shadow-2xl shadow-blue-500/40">
                <i className={`fas ${travel.nextStep.maneuver === 'right' ? 'fa-turn-up rotate-90' : 'fa-turn-up -rotate-90'}`}></i>
             </div>
             <div className="flex-1 min-w-0">
                <h2 className="text-5xl font-black text-white italic tracking-tighter leading-[0.9] uppercase mb-2">
                   {travel.nextStep.instruction}
                </h2>
                <span className="text-3xl font-black text-blue-400/80 italic">em {travel.nextStep.distance}</span>
             </div>
          </div>

          <div className="h-px w-full bg-white/5 my-8"></div>

          <div className="flex flex-col">
             <span className="text-[10px] font-bold text-white/30 tracking-[0.5em] mb-1">ALVO DA MISSÃO</span>
             <h3 className="text-2xl font-black text-white truncate italic">
                {privacyMode ? 'DESTINO CONFIDENCIAL' : travel.destination}
             </h3>
          </div>
       </div>

       {/* ETA SUB-CARD */}
       <div className="bg-blue-700/80 backdrop-blur-2xl rounded-[45px] p-10 flex items-center justify-between shadow-2xl border border-white/20">
          <div className="flex flex-col">
             <span className="text-[10px] font-black text-white/50 tracking-widest uppercase mb-1">Chegada</span>
             <span className="text-6xl font-black italic tracking-tighter text-white leading-none">{travel.eta}</span>
          </div>
          <div className="h-16 w-px bg-white/20"></div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-white/50 tracking-widest uppercase mb-1">Distância</span>
             <span className="text-4xl font-black italic tracking-tighter text-white/90 leading-none">{travel.distanceTotal}</span>
          </div>
       </div>
    </div>
  );
};

export default NavigationHUD;
