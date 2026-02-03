
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { TravelInfo, MediaApp, SecurityTelemetry, CarTelemetry, AppSettings } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import SettingsMenu from './components/SettingsMenu';
import CarSafetyWidget from './components/CarSafetyWidget';
import BluelinkPanel from './components/BluelinkPanel';
import EntertainmentHub from './components/EntertainmentHub';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fab fa-youtube', color: 'text-red-500', category: 'AUDIO', scheme: 'youtube:search:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-compact-disc', color: 'text-white', category: 'AUDIO', scheme: 'deezer:' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-600', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'disney', name: 'Disney+', icon: 'fas fa-circle-play', color: 'text-blue-400', category: 'VIDEO', scheme: 'disneyplus:' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'prime', name: 'Prime Video', icon: 'fab fa-amazon', color: 'text-blue-300', category: 'VIDEO', scheme: 'primevideo:' },
  { id: 'iptv', name: 'IPTV Pandora', icon: 'fas fa-tv', color: 'text-emerald-500', category: 'TV', scheme: 'iptv:' },
  { id: 'pluto', name: 'Pluto TV', icon: 'fas fa-satellite-dish', color: 'text-yellow-400', category: 'TV', scheme: 'plutotv:' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-white', category: 'TV', scheme: 'globoplay:' },
];

const App: React.FC = () => {
  const [activePanel, setActivePanel] = useState<'MAP' | 'MEDIA' | 'VEHICLE'>('MAP');
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [time, setTime] = useState('00:00');
  
  const [security, setSecurity] = useState<SecurityTelemetry>({ 
    violenceIndex: 'LOW', policeNearby: false, radarDistance: 800, radarLimit: 60,
    lanePosition: 'CENTER', vehicleAheadDistance: 120 
  });
  
  const [car, setCar] = useState<CarTelemetry>({ 
    fuelLevel: 82, autonomyKm: 940, odometer: 12450, isFuelLow: false, model: 'PANDORA V160' 
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM TRAJETO ATIVO', stops: [], drivingTimeMinutes: 45, totalDistanceKm: 12,
    nextStep: { instruction: 'SIGA PELA VIA PRINCIPAL', distance: 1200, type: 'straight' }
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ELIVAM', voiceVolume: 90, safetyDistance: 30, videoPlaybackMode: 'PIP', privacyMode: 'RESTRICTED', credentials: []
  });

  const outputCtxRef = useRef<AudioContext | null>(null);

  // Solicitação de permissões e saudação inicial
  const bootSystem = async () => {
    try {
      // Solicita Localização e Microfone
      await navigator.mediaDevices.getUserMedia({ audio: true });
      navigator.geolocation.getCurrentPosition(() => {});
      
      setIsSystemBooted(true);
      
      // Simulação de inicialização da EVA com saudação descontraída
      setTimeout(() => {
        setIsSpeaking(true);
        // O sistema de áudio real seria iniciado aqui. 
        // A EVA fala baseada no horário atual.
        const hour = new Date().getHours();
        const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
        console.log(`EVA: ${greeting}, Elivam! Que bom te ver de novo, parceiro. Já estou de olho em tudo por aqui. Para onde vamos hoje?`);
        
        setTimeout(() => setIsSpeaking(false), 5000);
      }, 1000);
    } catch (err) {
      console.error("Permissões negadas. O sistema Pandora requer acesso para operar.");
      alert("A EVA precisa de microfone e localização para ser sua co-piloto!");
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
      setSecurity(prev => ({
        ...prev,
        radarDistance: prev.radarDistance > 10 ? prev.radarDistance - 10 : 1000
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleEVA = useCallback(() => {
    if (isListening) { setIsListening(false); return; }
    setIsListening(true);
  }, [isListening]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white cursor-pointer" onClick={bootSystem}>
         <div className="w-64 h-64 rounded-full border-2 border-cyan-500/20 flex items-center justify-center relative">
            <div className="absolute inset-0 animate-ping rounded-full border border-cyan-500/10"></div>
            <div className="w-56 h-56 rounded-full overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.15)]">
               <Avatar isListening={false} isSpeaking={false} onAnimateClick={() => {}} />
            </div>
         </div>
         <h1 className="mt-12 text-6xl font-black italic tracking-tighter uppercase text-zinc-100">PANDORA <span className="text-cyan-500">EVA</span></h1>
         <p className="mt-6 text-zinc-600 font-bold tracking-[1.2em] text-[10px] animate-pulse">INICIAR PROTOCOLO DE CONFIANÇA</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#020202] text-white flex overflow-hidden font-sans italic uppercase select-none">
      
      {/* HUD SIDEBAR */}
      <aside className="w-[32%] min-w-[360px] h-full bg-black border-r border-white/5 flex flex-col p-8 z-30 shadow-[25px_0_80px_rgba(0,0,0,1)] relative">
        
        {/* VELOCÍMETRO */}
        <section className="mb-2 flex items-start gap-4">
           <span className="text-[11rem] font-black leading-none tracking-tighter italic text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.12)]">{currentSpeed}</span>
           <div className="flex flex-col mt-8">
              <span className="text-[10px] font-black text-cyan-500/50 tracking-widest uppercase">KM/H</span>
              <button onClick={() => setIsSettingsOpen(true)} className="mt-6 text-white/10 hover:text-white transition-all"><i className="fas fa-cog text-xl"></i></button>
           </div>
        </section>

        {/* INFO VEÍCULO */}
        <section className="mb-8 flex items-center justify-between px-2">
           <div className="flex items-center gap-4">
              <span className="text-4xl font-black text-white italic">D</span>
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 text-cyan-500">
                    <i className="fas fa-gas-pump text-xs"></i>
                    <span className="text-lg font-black tracking-tighter uppercase">{car.autonomyKm} KM</span>
                 </div>
                 <span className="text-[9px] opacity-20 font-bold tracking-widest uppercase">AUTONOMIA</span>
              </div>
           </div>
           <div className="flex flex-col items-end">
              <span className="text-xl font-black text-white">{car.fuelLevel}%</span>
              <div className="w-20 h-1.5 bg-white/5 rounded-full mt-1 overflow-hidden">
                 <div className="h-full bg-cyan-500" style={{ width: `${car.fuelLevel}%` }}></div>
              </div>
           </div>
        </section>

        {/* ARCO DE SEGURANÇA */}
        <section className="mb-10 scale-110 origin-center py-4">
           <CarSafetyWidget telemetry={security} speed={currentSpeed} />
        </section>

        {/* ROTA */}
        <section className="flex-1 overflow-y-auto custom-scroll mb-6 space-y-8 pr-2">
           <div>
              <p className="text-[10px] font-black text-blue-500 tracking-[0.5em] mb-3 uppercase">Rota Ativa</p>
              <div className="flex justify-between items-end border-b border-white/10 pb-4">
                 <h4 className="text-2xl font-black truncate max-w-[220px] tracking-tighter uppercase">{travel.destination}</h4>
                 <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-white uppercase">{travel.totalDistanceKm} KM</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">{travel.drivingTimeMinutes} MIN</span>
                 </div>
              </div>
           </div>
           {/* Manobra e Paradas */}
           <div className="space-y-4">
              <div className="bg-[#1a2b4d]/40 border border-blue-500/20 rounded-[35px] p-5 flex items-center gap-5">
                 <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-2xl shadow-xl">
                    <i className="fas fa-location-arrow -rotate-45"></i>
                 </div>
                 <div className="flex-1">
                    <p className="text-[9px] font-black text-blue-400 tracking-widest mb-1 uppercase">MANOBRA</p>
                    <h3 className="text-lg font-black leading-tight uppercase">{travel.nextStep?.instruction}</h3>
                 </div>
              </div>
           </div>
        </section>

        {/* FOOTER: RELÓGIO + EVA LADO A LADO */}
        <footer className="pt-6 border-t border-white/5 bg-black">
           <div className="flex items-center justify-between gap-6">
              <div className="flex flex-col flex-1">
                 <span className="text-7xl font-black tracking-tighter leading-none text-white/95">{time}</span>
                 <div className="mt-2 flex items-center gap-3 opacity-30">
                    <span className="text-[9px] font-black tracking-[0.4em] uppercase">SYNC OK</span>
                    <div className="flex gap-1">
                       {[1,2,3,4,5].map(i => <div key={i} className="w-1 h-2.5 bg-white/60"></div>)}
                    </div>
                 </div>
              </div>

              {/* EVA AO LADO DA HORA */}
              <div 
                onClick={toggleEVA} 
                className={`w-28 h-28 rounded-full border-2 cursor-pointer transition-all duration-500 overflow-hidden relative shrink-0 ${
                  isListening ? 'border-red-500 scale-105 shadow-[0_0_50px_rgba(239,68,68,0.5)]' : 
                  isSpeaking ? 'border-cyan-400 shadow-[0_0_40px_rgba(34,211,238,0.4)]' :
                  'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.2)]'
                }`}
              >
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
           </div>
        </footer>
      </aside>

      {/* ÁREA DE CONTEÚDO 70% */}
      <main className="flex-1 relative bg-black">
         <div className={`absolute inset-0 transition-all duration-700 ${activePanel === 'MAP' ? 'opacity-100' : 'opacity-10 pointer-events-none'}`}>
            <MapView travel={travel} currentPosition={currentPos} heading={0} isFullScreen={false} mode="3D" layer="DARK" onToggleFullScreen={() => {}} />
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-40">
               <button onClick={() => setIsAddStopModalOpen(true)} className="h-20 px-12 bg-blue-600 rounded-full text-white font-black text-lg shadow-2xl border-2 border-white/20 hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-4 uppercase">
                  <i className="fas fa-plus-circle text-2xl"></i> CADASTRAR DESTINO
               </button>
            </div>
         </div>

         {/* ... Outros painéis omitidos para brevidade ... */}

         {/* SWITCHER TÁTICO */}
         <div className="absolute top-12 right-12 flex flex-col gap-8 z-50">
            <button onClick={() => setActivePanel('MAP')} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl border-2 ${activePanel === 'MAP' ? 'bg-blue-600 text-white' : 'bg-black/60 text-white/20 border-white/5'}`}><i className="fas fa-location-arrow"></i></button>
            <button onClick={() => setActivePanel('MEDIA')} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl border-2 ${activePanel === 'MEDIA' ? 'bg-purple-600 text-white' : 'bg-black/60 text-white/20 border-white/5'}`}><i className="fas fa-play"></i></button>
            <button onClick={() => setActivePanel('VEHICLE')} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl border-2 ${activePanel === 'VEHICLE' ? 'bg-emerald-600 text-white' : 'bg-black/60 text-white/20 border-white/5'}`}><i className="fas fa-car-side"></i></button>
         </div>
      </main>

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n) => { setTravel(p => ({...p, destination: n.toUpperCase()})); setIsAddStopModalOpen(false); }} />
    </div>
  );
};

export default App;
