
import React from 'react';
import { CarAction, CarStatus } from '../types';

interface BluelinkPanelProps {
  status: CarStatus;
  onAction: (action: CarAction) => void;
}

const BluelinkPanel: React.FC<BluelinkPanelProps> = ({ status, onAction }) => {
  const actions: { id: CarAction; icon: string; label: string; active?: boolean }[] = [
    { id: 'LOCK', icon: 'fa-lock', label: 'Travar portas', active: status.isLocked },
    { id: 'START', icon: 'fa-power-off', label: 'Ligar motor', active: status.isEngineRunning },
    { id: 'UNLOCK', icon: 'fa-lock-open', label: 'Destravar portas', active: !status.isLocked },
    { id: 'STOP', icon: 'fa-microphone-slash', label: 'Desligar o motor', active: !status.isEngineRunning },
    { id: 'WINDOWS_DOWN', icon: 'fa-window-maximize', label: 'Abrir janela', active: status.areWindowsOpen },
    { id: 'WINDOWS_UP', icon: 'fa-window-minimize', label: 'Fechar janela', active: !status.areWindowsOpen },
    { id: 'HAZARD_LIGHTS', icon: 'fa-triangle-exclamation', label: 'Luzes emergência', active: status.hazardActive },
    { id: 'HORN_LIGHTS', icon: 'fa-bullhorn', label: 'Luz / Buzina' },
  ];

  return (
    <div className="bg-white rounded-[40px] p-8 flex flex-col gap-8 shadow-2xl overflow-hidden text-slate-800">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold tracking-tight text-slate-900">Controle do veículo</h3>
      </div>
      
      <div className="grid grid-cols-3 gap-y-10 gap-x-2">
        {actions.map(a => (
          <button 
            key={a.id}
            onClick={() => onAction(a.id)}
            disabled={status.isUpdating}
            className="flex flex-col items-center gap-3 group outline-none"
          >
            <div className={`w-20 h-20 rounded-full border border-slate-200 flex items-center justify-center text-3xl transition-all duration-300 shadow-sm active:bg-blue-50 active:border-blue-400 group-hover:border-slate-300 ${status.isUpdating ? 'opacity-30' : 'text-slate-700 bg-white'}`}>
              <i className={`fas ${a.icon} ${a.active && a.id !== 'HORN_LIGHTS' ? 'text-blue-500' : ''}`}></i>
            </div>
            <span className="text-[11px] font-medium text-slate-600 uppercase text-center leading-tight tracking-tight px-1 h-8 flex items-center">
               {a.label}
            </span>
          </button>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-100 mt-2">
         <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-800">Ajustes de climatização</h4>
            <div className="text-slate-300">
               <i className="fas fa-car-fan text-2xl"></i>
            </div>
         </div>
      </div>
    </div>
  );
};

export default BluelinkPanel;
