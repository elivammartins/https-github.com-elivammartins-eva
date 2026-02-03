
import React from 'react';
import { HealthTelemetry } from '../types';

interface HealthWidgetProps {
  telemetry: HealthTelemetry;
}

const HealthWidget: React.FC<HealthWidgetProps> = ({ telemetry }) => {
  const isCritical = telemetry.fatigueIndex > 0.7;

  return (
    <div className={`bg-white/5 border border-white/5 p-8 rounded-[45px] flex flex-col gap-6 transition-all duration-500 ${isCritical ? 'border-red-600 bg-red-600/10 animate-pulse' : ''}`}>
       <div className="flex items-center gap-5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${isCritical ? 'bg-red-600' : 'bg-blue-600/20 text-blue-500'}`}>
             <i className="fas fa-heartbeat"></i>
          </div>
          <div>
             <span className="text-[10px] font-black text-white/40 tracking-widest uppercase block">Freq. Cardíaca</span>
             <span className="text-4xl font-black italic text-white leading-none">{telemetry.heartRate} <span className="text-lg">BPM</span></span>
          </div>
       </div>

       <div className="space-y-4">
          <div>
             <div className="flex justify-between mb-2 px-1">
                <span className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase">Status de Fadiga</span>
                <span className={`text-[9px] font-black ${isCritical ? 'text-red-500' : 'text-blue-500'}`}>{Math.round(telemetry.fatigueIndex * 100)}%</span>
             </div>
             <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-600' : 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)]'}`} style={{ width: `${telemetry.fatigueIndex * 100}%` }}></div>
             </div>
          </div>
          
          <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
             <span className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase">Piscadas / MIN</span>
             <span className="text-2xl font-black italic text-white">{telemetry.lastBlinkRate}</span>
          </div>
       </div>

       {isCritical && (
         <div className="bg-red-600 text-white p-3 rounded-2xl text-center font-black text-[9px] tracking-[0.3em] uppercase">
            Alerta: Faça uma pausa
         </div>
       )}
    </div>
  );
};

export default HealthWidget;
