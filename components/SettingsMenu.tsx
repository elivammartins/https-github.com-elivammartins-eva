
import React from 'react';
import { AppSettings, MediaApp } from '../types';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  mediaApps: MediaApp[];
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, settings, onUpdate, mediaApps }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      {/* Backdrop de fechamento - Z-INDEX ALTO */}
      <div 
        className="fixed inset-0 bg-black/95 backdrop-blur-xl cursor-pointer" 
        onClick={onClose} 
      />
      
      {/* Container Principal */}
      <div 
        className="relative w-full max-w-2xl bg-[#0c0c0e] rounded-[40px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()} // Impede o clique interno de fechar o modal
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-900/10 to-transparent shrink-0">
          <h2 className="text-2xl font-black tracking-tighter text-white">Configurações Pandora</h2>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white border border-white/5">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          <div className="flex flex-col gap-4">
             <label className="text-[10px] font-black text-blue-400 tracking-widest uppercase">ID do Condutor</label>
             <input 
               type="text"
               value={settings.userName}
               onChange={(e) => onUpdate({...settings, userName: e.target.value})}
               className="w-full h-14 bg-black/60 border border-white/10 rounded-2xl px-6 text-lg font-black outline-none focus:border-blue-500 text-white uppercase italic"
             />
          </div>

          <div className="flex flex-col gap-6">
             <label className="text-[10px] font-black text-blue-400 tracking-widest uppercase">Volume do Sistema</label>
             <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col gap-3">
                <input 
                  type="range" min="0" max="100" 
                  value={settings.voiceVolume}
                  onChange={(e) => onUpdate({...settings, voiceVolume: parseInt(e.target.value)})}
                  className="w-full accent-blue-600 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
             </div>
          </div>
          
          <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-center">
             <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase">Pandora Core V44 Alpha</p>
          </div>
        </div>

        <div className="p-8 border-t border-white/5 bg-black/40">
           <button onClick={onClose} className="w-full h-16 bg-blue-600 rounded-2xl text-white font-black text-lg shadow-xl active:scale-95 transition-all uppercase italic">Confirmar Mudanças</button>
        </div>
      </div>

      <style>{`
        @keyframes scale-up { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-scale-up { animation: scale-up 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default SettingsMenu;
