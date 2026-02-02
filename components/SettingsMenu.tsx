
import React, { useState } from 'react';
import { AppSettings, MediaApp, StreamingCredential, PrivacyMode } from '../types';

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
    const creds = [...settings.credentials];
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

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-[#0c0c0e] rounded-[50px] border border-white/10 flex flex-col shadow-2xl h-[90dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex flex-col gap-6 bg-[#1c1c1e] shrink-0">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-black text-white italic tracking-tighter">EVA SYNC PROTOCOL</h2>
             <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white"><i className="fas fa-times"></i></button>
          </div>
          <div className="flex gap-4">
             <button onClick={() => setActiveTab('GENERAL')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] ${activeTab === 'GENERAL' ? 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.3)]' : 'bg-white/5 opacity-50'}`}>CONFIGURAÇÕES GERAIS</button>
             <button onClick={() => setActiveTab('VAULT')} className={`flex-1 h-14 rounded-2xl font-black text-[10px] ${activeTab === 'VAULT' ? 'bg-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-white/5 opacity-50'}`}>COFRE DE CREDENCIAIS</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-10 no-scrollbar pb-32">
          {activeTab === 'GENERAL' ? (
            <div className="space-y-10">
              <section className="space-y-4">
                <label className="text-[10px] font-black text-blue-500 tracking-widest">Motorista (Driver ID)</label>
                <input type="text" value={settings.userName} onChange={(e) => onUpdate({...settings, userName: e.target.value.toUpperCase()})} className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic uppercase" />
              </section>

              <section className="space-y-4">
                <label className="text-[10px] font-black text-emerald-500 tracking-widest">Modo de Privacidade PANDORA</label>
                <div className="grid grid-cols-3 gap-4">
                   {(['GHOST', 'RESTRICTED', 'TOTAL'] as PrivacyMode[]).map(mode => (
                     <button key={mode} onClick={() => onUpdate({...settings, privacyMode: mode})} className={`h-16 rounded-2xl font-black text-[10px] border transition-all ${settings.privacyMode === mode ? 'bg-emerald-600 border-emerald-400' : 'bg-white/5 border-white/10 opacity-40'}`}>
                        {mode === 'GHOST' ? 'FANTASMA' : mode === 'RESTRICTED' ? 'RESTRITO' : 'TOTAL'}
                     </button>
                   ))}
                </div>
              </section>

              <section className="grid grid-cols-3 gap-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-cyan-400">Streaming Áudio</label>
                  <select value={settings.preferredMusicApp} onChange={(e) => onUpdate({...settings, preferredMusicApp: e.target.value})} className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic uppercase appearance-none">
                    {mediaApps.filter(a => a.category === 'AUDIO').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-purple-400">Streaming Vídeo</label>
                  <select value={settings.preferredVideoApp} onChange={(e) => onUpdate({...settings, preferredVideoApp: e.target.value})} className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic uppercase appearance-none">
                    {mediaApps.filter(a => a.category === 'VIDEO').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-red-400">Provedor TV</label>
                  <select value={settings.preferredTvApp} onChange={(e) => onUpdate({...settings, preferredTvApp: e.target.value})} className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-6 text-white font-black italic uppercase appearance-none">
                    {mediaApps.filter(a => a.category === 'TV').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-8">
               <p className="text-[9px] text-emerald-400 font-bold tracking-[0.4em] text-center mb-8">PROTEÇÃO EVA SYNC ACTIVE • DADOS CRIPTOGRAFADOS</p>
               {mediaApps.filter(a => ['AUDIO', 'VIDEO', 'TV'].includes(a.category)).map(app => {
                 const cred = settings.credentials.find(c => c.appId === app.id);
                 return (
                   <div key={app.id} className="p-8 bg-white/5 border border-white/10 rounded-[40px] space-y-6">
                      <div className="flex items-center gap-4">
                         <i className={`${app.icon} text-3xl ${app.color}`}></i>
                         <span className="text-xl font-black">{app.name}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <input type="text" placeholder="USUÁRIO / E-MAIL" value={cred?.user || ''} onChange={(e) => updateCredential(app.id, 'user', e.target.value)} className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase" />
                         <input type="password" placeholder="SENHA" value={cred?.pass || ''} onChange={(e) => updateCredential(app.id, 'pass', e.target.value)} className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white" />
                         <input type="text" placeholder="PERFIL PREFERENCIAL" value={cred?.profileName || ''} onChange={(e) => updateCredential(app.id, 'profileName', e.target.value)} className="h-14 bg-black/40 border border-white/10 rounded-xl px-4 text-[10px] font-bold text-white uppercase col-span-2" />
                      </div>
                   </div>
                 );
               })}
            </div>
          )}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/95 shrink-0">
           <button onClick={onClose} className="w-full h-20 bg-blue-600 rounded-[30px] text-white font-black text-xl shadow-[0_0_50px_rgba(37,99,235,0.3)] active:scale-95 transition-all">SALVAR E SINCRONIZAR COFRE</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsMenu;
