
import React from 'react';
import { TravelInfo, LocationData } from '../types';

interface DashboardProps {
  travel: TravelInfo;
  location: LocationData;
}

const Dashboard: React.FC<DashboardProps> = ({ travel, location }) => {
  return (
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 text-xs">
          <i className="fas fa-route"></i>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[7px] font-black text-white/30 uppercase tracking-[0.2em]">Destino</p>
          <h4 className="text-white font-black truncate text-[11px] uppercase">{travel.destination}</h4>
        </div>
      </div>
      
      <div className="flex flex-col gap-1 mt-4">
         <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-white/30 uppercase">Tempo Restante</span>
            <span className="text-emerald-400">{travel.drivingTimeMinutes} MIN</span>
         </div>
         <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-[65%]"></div>
         </div>
      </div>

      <div className="flex items-center gap-2 mt-4 opacity-40">
         <i className="fas fa-satellite text-[10px]"></i>
         <span className="text-[8px] font-black uppercase tracking-widest">Link Satélite OK</span>
      </div>
    </div>
  );
};

export default Dashboard;
