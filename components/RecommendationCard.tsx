
import React from 'react';
import { StopRecommendation } from '../types';

interface RecommendationCardProps {
  stops: StopRecommendation[];
  onSelect: (stop: StopRecommendation) => void;
  onClose: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ stops, onSelect, onClose }) => {
  return (
    <div className="bg-black/98 backdrop-blur-3xl border-2 border-white/10 rounded-[50px] shadow-[0_0_100px_rgba(0,0,0,1)] p-10 flex flex-col gap-8 animate-scale-up">
       <div className="flex justify-between items-center mb-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-blue-500 tracking-[0.5em]">OPÇÕES DE VETOR</span>
            <h3 className="text-3xl font-black italic text-white uppercase tracking-tighter">Escolha o Destino</h3>
          </div>
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/40 border border-white/10"><i className="fas fa-times"></i></button>
       </div>
       
       <div className="flex flex-col gap-4">
          {stops.map((stop, idx) => (
            <button 
              key={idx}
              onClick={() => onSelect(stop)}
              className="w-full p-8 bg-white/5 border border-white/5 rounded-[35px] flex items-center justify-between hover:bg-blue-600 hover:border-blue-400 transition-all group active:scale-95"
            >
              <div className="flex items-center gap-8">
                <div className="w-16 h-16 rounded-3xl bg-black border border-white/10 flex items-center justify-center text-3xl text-white group-hover:scale-110 transition-transform">
                   <i className={`fas ${stop.type === 'GAS' ? 'fa-gas-pump' : (stop.type === 'COFFEE' ? 'fa-coffee' : 'fa-utensils')}`}></i>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-black italic text-white leading-none mb-2">{stop.name}</p>
                  <p className="text-[11px] font-bold text-white/40 tracking-[0.2em] group-hover:text-white/80 uppercase">{stop.distance} • {stop.rating} <i className="fas fa-star text-yellow-500"></i></p>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:border-white group-hover:text-white">
                <i className="fas fa-chevron-right"></i>
              </div>
            </button>
          ))}
       </div>
       
       <p className="text-[10px] font-black text-blue-500/50 text-center tracking-[0.4em] uppercase mt-4">DIGA O NOME OU TOQUE NO HUD</p>
    </div>
  );
};

export default RecommendationCard;
