
import React from 'react';
import { SecurityTelemetry } from '../types';

interface CarSafetyWidgetProps {
  telemetry: SecurityTelemetry;
  speed: number;
}

const CarSafetyWidget: React.FC<CarSafetyWidgetProps> = ({ telemetry, speed }) => {
  // Cálculo de perigo para mudar a cor do arco
  const isDanger = telemetry.vehicleAheadDistance < 15;

  return (
    <div className="relative w-full h-32 flex items-center justify-center overflow-hidden">
      {/* Container do Arco Principal */}
      <div className="relative w-64 h-32 flex flex-col items-center justify-end">
        
        {/* Linhas de Faixa Prospectivas */}
        <div className="absolute inset-0 flex justify-center pointer-events-none">
           <div className="w-[2px] h-full bg-gradient-to-t from-white/20 to-transparent rotate-[-25deg] origin-bottom -translate-x-20"></div>
           <div className="w-[2px] h-full bg-gradient-to-t from-white/20 to-transparent rotate-[25deg] origin-bottom translate-x-20"></div>
        </div>

        {/* O Arco de Brilho (HUD Style) */}
        <div className={`absolute bottom-0 w-48 h-20 border-t-[4px] rounded-[100%] transition-all duration-500 ${
           isDanger ? 'border-red-500 shadow-[0_-20px_40px_rgba(239,68,68,0.4)]' : 'border-cyan-500/60 shadow-[0_-15px_30px_rgba(6,182,212,0.2)]'
        }`}></div>

        {/* Representação do Veículo (Pílula Minimalista) */}
        <div className={`relative mb-4 transition-all duration-700 ease-out ${
           telemetry.lanePosition === 'LEFT' ? '-translate-x-12' : 
           telemetry.lanePosition === 'RIGHT' ? 'translate-x-12' : ''
        }`}>
           <div className={`w-12 h-4 rounded-full shadow-2xl transition-colors duration-500 ${
              isDanger ? 'bg-red-500 animate-pulse' : 'bg-cyan-500'
           }`}></div>
           <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-[8px] font-black tracking-widest opacity-40">
              PANDORA
           </div>
        </div>

        {/* Indicador de Obstáculo à Frente */}
        <div className="absolute top-2 w-full flex justify-center">
           <div className={`w-16 h-1 rounded-full transition-all duration-500 ${
              isDanger ? 'bg-red-600 scale-125' : 'bg-white/10'
           }`}></div>
        </div>

        {/* Texto de Distância */}
        <div className="absolute bottom-10 text-[9px] font-black tracking-[0.4em] text-white/30">
           GAP MONITOR: {Math.floor(telemetry.vehicleAheadDistance)}M
        </div>
      </div>
    </div>
  );
};

export default CarSafetyWidget;
