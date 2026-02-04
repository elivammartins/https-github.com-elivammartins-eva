
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
    <header className="absolute top-0 left-0 right-0 h-28 z-50 flex items-center justify-between px-16 bg-gradient-to-b from-black/90 to-transparent">
       {/* WEATHER WIDGET */}
       <div className="flex items-center gap-5">
          <i className={`fas ${sentinel.floodRisk ? 'fa-cloud-showers-heavy text-blue-400' : 'fa-sun text-yellow-500'} text-3xl`}></i>
          <div className="flex flex-col">
             <span className="text-3xl font-black italic tracking-tighter leading-none">{sentinel.temperature}°C</span>
             <span className="text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase">{sentinel.weather}</span>
          </div>
       </div>

       {/* RISK PILL (CENTER) */}
       <div className={`px-12 py-3 rounded-2xl border-2 transition-all duration-1000 ${riskStyles[sentinel.riskLevel]}`}>
          <div className="flex items-center gap-4">
             <div className={`w-2.5 h-2.5 rounded-full ${sentinel.riskLevel === 'SAFE' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
             <span className="text-sm font-black tracking-[0.5em] uppercase italic">RISCO: {sentinel.riskLevel}</span>
          </div>
       </div>

       {/* SPEED CLUSTER */}
       <div className="flex items-center gap-8">
          <div className="flex flex-col items-end">
             <div className="flex items-baseline gap-2">
                <span className={`text-8xl font-black italic tracking-tighter ${isOverSpeed ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                   {speed}
                </span>
                <span className="text-sm font-bold text-white/20 tracking-widest">KM/H</span>
             </div>
          </div>
          <div className="w-16 h-16 rounded-full border-[6px] border-red-600 bg-white flex items-center justify-center text-black font-black text-2xl shadow-2xl">
             {sentinel.speedLimit}
          </div>
       </div>
    </header>
  );
};

export default TopBar;
