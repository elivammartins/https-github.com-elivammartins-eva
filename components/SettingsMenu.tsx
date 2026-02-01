
import React, { useState } from 'react';
import { AppSettings, MediaApp, StreamingCredential } from '../types';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  mediaApps: MediaApp[];
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, settings, onUpdate, mediaApps }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VAULT'>('GENERAL');

  if (!isOpen) return null;

  const updateCredential = (appId: string, field: keyof StreamingCredential, value: string) => {
    const exists = settings.credentials.find(c => c.appId === appId);
    let newCreds = [...settings.credentials];
    if (exists) {
      newCreds = newCreds.map(c => c.appId === appId ? { ...c, [field]: value } : c);
    } else {
      newCreds.push({ appId, user: '', pass: '', profileName: '', [field]: value } as StreamingCredential);
    }
    onUpdate({ ...settings, credentials: newCreds });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-2xl cursor-pointer" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-[#0c0c0e] rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[90dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex flex-col gap-6 bg-[#1c1c1e]">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-black text-white italic tracking-tighter">Protocolo de Configuração PANDORA</h2>
             <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
               <i className="fas fa-times"></i>
             </button>
          </div>
          
          <div className="flex gap-4">
             <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest transition-all ${activeTab === 'GENERAL' ? 'bg-blue-600' : 'bg-white/5 opacity-50'}`}>GERAL</button>
             <button onClick={() => setActiveTab('VAULT')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest transition-all ${activeTab === 'VAULT' ? 'bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-white/5 opacity-50'}`}>COFRE DE STREAMING</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar">
          {activeTab === 'GENERAL' ? (
            <>
              <section className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 tracking-widest">Identificação do Comandante</label>
                <input 
                  type="text" value={settings.userName}
                  onChange={(e) => onUpdate({...settings, userName: e.target.value})}
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black"
                />
              </section>

              <section className="space-y-4">
                <label className="text-[10px] font-black text-red-500 tracking-widest">Radarbot: Telemetria de Segurança</label>
                <div className="bg-white/5 p-6 rounded-3xl flex justify-between items-center border border-white/5">
                   <div className="flex flex-col">
                      <span className="text-lg font-black">{settings.safetyDistance} Metros</span>
                      <span className="text-[8px] opacity-40">DISTÂNCIA DE COLISÃO ESTIMADA</span>
                   </div>
                   <input 
                     type="range" min="10" max="100" value={settings.safetyDistance}
                     onChange={(e) => onUpdate({...settings, safetyDistance: parseInt(e.target.value)})}
                     className="w-1/2 accent-red-500"
                   />
                </div>
              </section>
            </>
          ) : (
            <div className="space-y-6">
               <p className="text-[9px] text-emerald-400 font-bold tracking-widest text-center mb-8">A EVA USARÁ ESTES DADOS PARA COMANDOS DE VOZ PROFUNDOS</p>
               {mediaApps.filter(a => a.category === 'VIDEO' || a.category === 'AUDIO').map(app => {
                 const cred = settings.credentials.find(c => c.appId === app.id);
                 return (
                   <div key={app.id} className="p-6 bg-white/5 border border-white/5 rounded-[30px] space-y-4">
                      <div className="flex items-center gap-4">
                         <i className={`${app.icon} ${app.color} text-2xl`}></i>
                         <span className="text-sm font-black">{app.name}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <input 
                           type="text" placeholder="USUÁRIO / EMAIL" value={cred?.user || ''}
                           onChange={(e) => updateCredential(app.id, 'user', e.target.value)}
                           className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase"
                         />
                         <input 
                           type="password" placeholder="SENHA" value={cred?.pass || ''}
                           onChange={(e) => updateCredential(app.id, 'pass', e.target.value)}
                           className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white"
                         />
                         <input 
                           type="text" placeholder="NOME DO PERFIL (EX: ELIVAM)" value={cred?.profileName || ''}
                           onChange={(e) => updateCredential(app.id, 'profileName', e.target.value)}
                           className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase col-span-2"
                         />
                      </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/60">
           <button onClick={onClose} className="w-full h-20 bg-blue-600 rounded-3xl text-white font-black text-lg shadow-xl active:scale-95 transition-all">SALVAR ALTERAÇÕES PROTOCOLO</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
