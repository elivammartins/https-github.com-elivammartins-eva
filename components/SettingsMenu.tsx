
import React, { useState } from 'react';
import { AppSettings, MediaApp, StreamingCredential, PrivacyMode, VideoPlaybackMode } from '../types';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdate: (settings: AppSettings) => void;
  mediaApps: MediaApp[];
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ isOpen, onClose, settings, onUpdate, mediaApps }) => {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'VAULT'>('GENERAL');
  const [activeCategory, setActiveCategory] = useState<'AUDIO' | 'VIDEO' | 'TV'>('AUDIO');

  if (!isOpen) return null;

  const updateCredential = (appId: string, field: keyof StreamingCredential, value: string) => {
    const creds = [...(settings.credentials || [])];
    const idx = creds.findIndex(c => c.appId === appId);
    if (idx >= 0) {
      creds[idx] = { ...creds[idx], [field]: value };
    } else {
      const newCred = { appId, user: '', pass: '', profileName: '' };
      // @ts-ignore
      newCred[field] = value;
      creds.push(newCred);
    }
    onUpdate({ ...settings, credentials: creds });
  };

  const filteredApps = mediaApps.filter(a => a.category === activeCategory);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-[#0c0c0e] rounded-[50px] border border-white/10 flex flex-col shadow-2xl h-[92dvh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex flex-col gap-6 bg-[#121214] shrink-0">
          <div className="flex justify-between items-center">
             <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">EVA SYNC PROTOCOL V160</h2>
             <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10">
                <i className="fas fa-times"></i>
             </button>
          </div>
          <div className="flex gap-4">
             <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 h-16 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all ${activeTab === 'GENERAL' ? 'bg-blue-600' : 'bg-white/5 opacity-40'}`}>CONFIGURAÇÕES HUD</button>
             <button onClick={() => setActiveTab('VAULT')} className={`flex-1 h-16 rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all ${activeTab === 'VAULT' ? 'bg-emerald-600' : 'bg-white/5 opacity-40'}`}>COFRE DE CREDENCIAIS</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scroll pb-32">
          {activeTab === 'GENERAL' ? (
            <div className="max-w-3xl mx-auto space-y-12">
               {/* Configurações básicas já existentes */}
               <section className="space-y-4">
                 <label className="text-[11px] font-black text-blue-500 tracking-[0.4em] uppercase">Motorista Ativo</label>
                 <input type="text" value={settings.userName} onChange={(e) => onUpdate({...settings, userName: e.target.value.toUpperCase()})} className="w-full h-20 bg-white/5 border-2 border-white/10 rounded-3xl px-8 text-2xl font-black italic text-white outline-none focus:border-blue-500" />
               </section>
            </div>
          ) : (
            <div className="space-y-10">
               <div className="flex justify-center gap-6 mb-12">
                  {(['AUDIO', 'VIDEO', 'TV'] as const).map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-10 h-14 rounded-full font-black text-[11px] tracking-widest uppercase transition-all border ${activeCategory === cat ? 'bg-white text-black' : 'bg-transparent border-white/10 text-white/40'}`}>
                       {cat}
                    </button>
                  ))}
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {filteredApps.map(app => {
                    const cred = (settings.credentials || []).find(c => c.appId === app.id);
                    return (
                      <div key={app.id} className="p-8 bg-zinc-900/40 border-2 border-white/5 rounded-[45px] space-y-8 hover:border-white/20 transition-all group">
                         <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-black border border-white/10 flex items-center justify-center text-3xl shadow-xl group-hover:scale-110 transition-transform">
                               <i className={`${app.icon} ${app.color}`}></i>
                            </div>
                            <div className="flex flex-col">
                               <span className="text-xl font-black text-white uppercase italic">{app.name}</span>
                               <span className="text-[9px] font-bold text-white/20 tracking-[0.3em] uppercase">{app.category} AUTH</span>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 gap-4">
                            <input type="text" placeholder="USUÁRIO / EMAIL" value={cred?.user || ''} onChange={(e) => updateCredential(app.id, 'user', e.target.value)} className="w-full h-14 bg-black/60 border border-white/10 rounded-2xl px-6 text-[10px] font-black text-white uppercase focus:border-emerald-500 outline-none" />
                            <input type="password" placeholder="SENHA" value={cred?.pass || ''} onChange={(e) => updateCredential(app.id, 'pass', e.target.value)} className="w-full h-14 bg-black/60 border border-white/10 rounded-2xl px-6 text-[10px] font-black text-white focus:border-emerald-500 outline-none" />
                            
                            <div className="relative">
                               <input 
                                 type="text" 
                                 placeholder="NOME DO PERFIL (OPCIONAL)" 
                                 value={cred?.profileName || ''} 
                                 onChange={(e) => updateCredential(app.id, 'profileName', e.target.value)} 
                                 className="w-full h-14 bg-black/60 border border-white/10 rounded-2xl px-6 text-[10px] font-black text-white uppercase focus:border-emerald-500 outline-none" 
                               />
                               <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[7px] font-black opacity-20">AUTO-IGNORE IF BLANK</span>
                            </div>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/95 shrink-0">
           <button onClick={onClose} className="w-full h-22 bg-blue-600 rounded-[35px] text-white font-black text-2xl uppercase italic tracking-tighter hover:bg-blue-500 shadow-2xl transition-all">
             SALVAR PROTOCOLO EVA
           </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
