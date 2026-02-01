
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
  const [vaultFilter, setVaultFilter] = useState<'ALL' | 'AUDIO' | 'VIDEO'>('ALL');

  if (!isOpen) return null;

  const updateCredential = (appId: string, field: keyof StreamingCredential, value: string) => {
    const exists = settings.credentials.find(c => c.appId === appId);
    let newCreds = [...settings.credentials];
    if (exists) {
      newCreds = newCreds.map(c => c.appId === appId ? { ...c, [field]: value } : c);
    } else {
      const newCred: StreamingCredential = { appId, user: '', pass: '', profileName: '' };
      // @ts-ignore
      newCred[field] = value;
      newCreds.push(newCred);
    }
    onUpdate({ ...settings, credentials: newCreds });
  };

  const filteredApps = mediaApps.filter(app => {
    if (app.id === 'whatsapp') return false;
    if (vaultFilter === 'ALL') return true;
    return app.category === vaultFilter;
  });

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-2xl cursor-pointer" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-[#0c0c0e] rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up h-[90dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex flex-col gap-6 bg-[#1c1c1e] shrink-0">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-black text-white italic tracking-tighter">Protocolo de Configuração PANDORA</h2>
             <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
               <i className="fas fa-times"></i>
             </button>
          </div>
          
          <div className="flex gap-4">
             <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest transition-all ${activeTab === 'GENERAL' ? 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'bg-white/5 opacity-50'}`}>CONFIGURAÇÕES GERAIS</button>
             <button onClick={() => setActiveTab('VAULT')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] tracking-widest transition-all ${activeTab === 'VAULT' ? 'bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-white/5 opacity-50'}`}>COFRE DE CREDENCIAIS (EVA SYNC)</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar pb-32">
          {activeTab === 'GENERAL' ? (
            <div className="space-y-10">
              <section className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 tracking-widest">Identificação do Comandante</label>
                <input 
                  type="text" value={settings.userName}
                  onChange={(e) => onUpdate({...settings, userName: e.target.value.toUpperCase()})}
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic uppercase"
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
              
              <section className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-cyan-400 tracking-widest">Áudio Preferencial</label>
                  <select 
                    value={settings.preferredMusicApp}
                    onChange={(e) => onUpdate({...settings, preferredMusicApp: e.target.value})}
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic appearance-none"
                  >
                    {mediaApps.filter(a => a.category === 'AUDIO').map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-purple-400 tracking-widest">Vídeo Preferencial</label>
                  <select 
                    value={settings.preferredVideoApp}
                    onChange={(e) => onUpdate({...settings, preferredVideoApp: e.target.value})}
                    className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic appearance-none"
                  >
                    {mediaApps.filter(a => a.category === 'VIDEO').map(a => <option key={a.id} value={a.id} className="bg-zinc-900">{a.name.toUpperCase()}</option>)}
                  </select>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-8">
               <div className="flex gap-2 sticky top-0 z-10 bg-[#0c0c0e] py-4 border-b border-white/5">
                  <button onClick={() => setVaultFilter('ALL')} className={`px-6 h-10 rounded-full text-[9px] font-black tracking-widest ${vaultFilter === 'ALL' ? 'bg-white text-black' : 'bg-white/5'}`}>TODOS</button>
                  <button onClick={() => setVaultFilter('VIDEO')} className={`px-6 h-10 rounded-full text-[9px] font-black tracking-widest ${vaultFilter === 'VIDEO' ? 'bg-purple-600 text-white' : 'bg-white/5'}`}>VÍDEO & TV</button>
                  <button onClick={() => setVaultFilter('AUDIO')} className={`px-6 h-10 rounded-full text-[9px] font-black tracking-widest ${vaultFilter === 'AUDIO' ? 'bg-cyan-600 text-white' : 'bg-white/5'}`}>MÚSICA</button>
               </div>

               <p className="text-[9px] text-emerald-400 font-bold tracking-widest text-center mb-4">DADOS PROTEGIDOS PELO PROTOCOLO PANDORA V160</p>
               
               <div className="grid grid-cols-1 gap-6">
                 {filteredApps.map(app => {
                   const cred = settings.credentials.find(c => c.appId === app.id);
                   return (
                     <div key={app.id} className="p-8 bg-white/5 border border-white/5 rounded-[40px] space-y-6 hover:border-white/20 transition-all">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className={`w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center text-3xl ${app.color}`}>
                                 <i className={app.icon}></i>
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-lg font-black tracking-tighter">{app.name}</span>
                                 <span className="text-[8px] opacity-40 font-bold tracking-[0.3em]">{app.category} PROTOCOL</span>
                              </div>
                           </div>
                           {cred?.user && <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[8px] font-black opacity-30 px-2 tracking-widest">USUÁRIO / E-MAIL</label>
                              <input 
                                type="text" placeholder="EX: ELIVAM@PANDORA.COM" value={cred?.user || ''}
                                onChange={(e) => updateCredential(app.id, 'user', e.target.value)}
                                className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase italic"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[8px] font-black opacity-30 px-2 tracking-widest">SENHA DE ACESSO</label>
                              <input 
                                type="password" placeholder="••••••••" value={cred?.pass || ''}
                                onChange={(e) => updateCredential(app.id, 'pass', e.target.value)}
                                className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white"
                              />
                           </div>
                           <div className="space-y-2 col-span-2">
                              <label className="text-[8px] font-black opacity-30 px-2 tracking-widest">NOME DO PERFIL PREFERENCIAL</label>
                              <input 
                                type="text" placeholder="NOME NO APP (EX: ELIVAM MARTINS)" value={cred?.profileName || ''}
                                onChange={(e) => updateCredential(app.id, 'profileName', e.target.value)}
                                className="w-full h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase italic"
                              />
                           </div>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 border-t border-white/5 bg-black/95 backdrop-blur-xl z-20">
           <button onClick={onClose} className="w-full h-20 bg-blue-600 rounded-[30px] text-white font-black text-lg shadow-[0_0_50px_rgba(37,99,235,0.3)] active:scale-95 transition-all uppercase italic tracking-tighter">SINCRONIZAR PROTOCOLO COM A EVA</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
