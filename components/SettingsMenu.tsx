
import React from 'react';
import { AppSettings, MediaApp } from '../types';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  mediaApps: MediaApp[];
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, settings, onUpdate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl cursor-pointer" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#0c0c0e] rounded-[40px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[90dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-red-900/10 to-transparent shrink-0">
          <h2 className="text-2xl font-black tracking-tighter text-white">Segurança & Privacidade</h2>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar pb-12">
          
          {/* SEGURANÇA PROATIVA */}
          <section className="space-y-6">
             <label className="text-[11px] font-black text-red-500 tracking-[0.3em] uppercase block">Radar de Colisão Ativa</label>
             <div className="bg-white/5 p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                   <span className="text-sm font-bold">Distância Crítica</span>
                   <span className="text-xl font-black text-white">{settings.safetyDistance} METROS</span>
                </div>
                <input 
                  type="range" min="5" max="50" step="5"
                  value={settings.safetyDistance}
                  onChange={(e) => onUpdate({...settings, safetyDistance: parseInt(e.target.value)})}
                  className="w-full accent-red-600 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <div className="flex items-center gap-3">
                   <input 
                     type="checkbox" 
                     checked={settings.alertVoiceEnabled}
                     onChange={(e) => onUpdate({...settings, alertVoiceEnabled: e.target.checked})}
                     className="w-6 h-6 rounded bg-black border-white/10"
                   />
                   <span className="text-[10px] font-black opacity-60">Alertas de voz em tempo real</span>
                </div>
             </div>
          </section>

          {/* PRIVACIDADE GHOST */}
          <section className="space-y-6">
             <label className="text-[11px] font-black text-blue-500 tracking-[0.3em] uppercase block">Modo Ghost (Privacidade)</label>
             <div className="bg-white/5 p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                   <span className="text-sm font-bold">Ocultar Remetente & Conteúdo</span>
                   <button 
                      onClick={() => onUpdate({...settings, privacyMode: !settings.privacyMode})}
                      className={`w-14 h-8 rounded-full relative transition-all ${settings.privacyMode ? 'bg-blue-600' : 'bg-white/10'}`}
                   >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.privacyMode ? 'left-7' : 'left-1'}`}></div>
                   </button>
                </div>
                <p className="text-[9px] text-white/30 lowercase italic">A EVA não ditará ou mostrará mensagens recebidas sem comando de voz específico.</p>
             </div>
          </section>

          {/* LEITURA DE WHATSAPP */}
          <section className="space-y-6">
             <label className="text-[11px] font-black text-emerald-500 tracking-[0.3em] uppercase block">Leitura de WhatsApp</label>
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => onUpdate({...settings, messageLimit: 128})}
                  className={`h-16 rounded-2xl border font-black text-[11px] transition-all ${settings.messageLimit === 128 ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5 border-white/5 text-white/40'}`}
                >MODO RESUMO (128C)</button>
                <button 
                  onClick={() => onUpdate({...settings, messageLimit: 'full'})}
                  className={`h-16 rounded-2xl border font-black text-[11px] transition-all ${settings.messageLimit === 'full' ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5 border-white/5 text-white/40'}`}
                >TEXTO COMPLETO</button>
             </div>
          </section>
        </div>

        <div className="p-8 border-t border-white/5 bg-black/40">
           <button onClick={onClose} className="w-full h-20 bg-blue-600 rounded-3xl text-white font-black text-lg shadow-xl active:scale-95 transition-all uppercase italic">Salvar Protocolos</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
