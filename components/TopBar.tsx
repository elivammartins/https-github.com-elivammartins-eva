
import React from 'react';
import { SentinelStatus } from '../types';

interface Props {
  sentinel: SentinelStatus;
  speed: number;
}

const TopBar: React.FC<Props> = ({ sentinel, speed }) => {
  const isOverSpeed = speed > sentinel.speedLimit;
  const riskStyles = {
    SAFE: 'border-emerald-500 text-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    CAUTION: 'border-orange-500 text-orange-400 bg-orange-500/10',
    DANGER: 'border-red-600 text-red-500 bg-red-600/20 animate-pulse',
    CRITICAL: 'border-red-600 text-white bg-red-600 animate-ping'
  };

  return (
    <header className="absolute top-0 left-0 right-0 h-32 z-50 flex items-center justify-between px-16 bg-gradient-to-b from-black via-black/80 to-transparent">
       {/* WEATHER WIDGET */}
       <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
            <i className={`fas ${sentinel.floodRisk ? 'fa-cloud-showers-heavy text-blue-400' : 'fa-sun text-yellow-500'}`}></i>
          </div>
          <div className="flex flex-col">
             <span className="text-4xl font-black italic tracking-tighter leading-none">{sentinel.temperature}°C</span>
             <span className="text-[10px] font-bold text-white/30 tracking-[0.4em] uppercase">{sentinel.weather}</span>
          </div>
       </div>

       {/* RISK PILL (CENTER) */}
       <div className={`px-14 py-4 rounded-[30px] border-2 transition-all duration-1000 flex flex-col items-center justify-center ${riskStyles[sentinel.riskLevel]}`}>
          <span className="text-[8px] font-black tracking-[0.6em] mb-1 opacity-60">PROTOCOLO ÁGUIA ATIVO</span>
          <span className="text-sm font-black tracking-[0.3em] uppercase italic leading-none">RISCO: {sentinel.riskLevel}</span>
       </div>

       {/* SPEED CLUSTER */}
       <div className="flex items-center gap-10">
          <div className="flex flex-col items-end">
             <div className="flex items-baseline gap-3">
                <span className={`text-[110px] font-black italic tracking-tighter leading-none transition-colors duration-300 ${isOverSpeed ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                   {speed}
                </span>
                <span className="text-xl font-black text-white/20 tracking-widest italic uppercase">KM/H</span>
             </div>
          </div>
          <div className="w-24 h-24 rounded-full border-[10px] border-red-600 bg-white flex items-center justify-center text-black font-black text-4xl shadow-[0_0_50px_rgba(220,38,38,0.5)]">
             {sentinel.speedLimit}
          </div>
       </div>
    </header>
  );
};

export default TopBar;
