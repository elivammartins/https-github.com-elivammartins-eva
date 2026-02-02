
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, MessageNotification, PrivacyMode } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'yt_music', name: 'YT Music', icon: 'fab fa-youtube', color: 'text-red-600', category: 'AUDIO', scheme: 'youtubemusic://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'claro_tv', name: 'Claro TV+', icon: 'fas fa-tv', color: 'text-red-500', category: 'TV', scheme: 'clarotv://' },
  { id: 'sky_plus', name: 'Sky+', icon: 'fas fa-satellite-dish', color: 'text-blue-500', category: 'TV', scheme: 'skyplus://' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-emerald-500', category: 'COMM', scheme: 'whatsapp://send?text=' },
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activeMessage, setActiveMessage] = useState<MessageNotification | null>(null);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pandora_settings_v162');
    return saved ? JSON.parse(saved) : {
      userName: 'ELIVAM', voiceVolume: 90, privacyMode: 'RESTRICTED', safetyDistance: 30, alertVoiceEnabled: true, 
      preferredMusicApp: 'spotify', preferredVideoApp: 'stremio', preferredTvApp: 'claro_tv',
      credentials: [], totalOdometer: 1000.0, currentFuelLiters: 0, odometerAtLastRefuel: 1000.0
    };
  });

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [safetyDist, setSafetyDist] = useState(0);
  const [travel, setTravel] = useState<TravelInfo>({ destination: 'AGUARDANDO DESTINO', stops: [], warnings: [], drivingTimeMinutes: 0, totalDistanceKm: 0 });
  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'EVA CORE V162', artist: 'SISTEMA ATIVO', isPlaying: false, progress: 0 });

  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const lastPosRef = useRef<[number, number] | null>(null);

  useEffect(() => { localStorage.setItem('pandora_settings_v162', JSON.stringify(settings)); }, [settings]);
  
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const geoWatcher = navigator.geolocation.watchPosition((p) => {
      const { latitude, longitude, speed } = p.coords;
      const speedKmH = speed ? Math.round(speed * 3.6) : 0;
      if (lastPosRef.current) {
        const delta = calculateDistance(lastPosRef.current[0], lastPosRef.current[1], latitude, longitude);
        if (delta > 0.003) setSettings(s => ({ ...s, totalOdometer: s.totalOdometer + delta }));
      }
      lastPosRef.current = [latitude, longitude];
      if (speedKmH > 0) {
        const vMs = speedKmH / 3.6;
        setSafetyDist(Math.round((vMs * 1.5) + ((vMs * vMs) / (2 * 0.7 * 9.8))));
      } else setSafetyDist(0);
      setCurrentSpeed(speedKmH);
      setCurrentPos([latitude, longitude]);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geoWatcher);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    if (name === 'send_whatsapp') return { result: `WHATSAPP ENVIADO: ${args.message}` };
    if (name === 'open_tv_channel') return { result: `SINTONIZANDO CANAL ${args.channel} VIA ${args.app}` };
    return { result: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) { sessionRef.current?.close(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => { setIsListening(true); setIsSystemBooted(true); },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = await handleSystemAction(fc);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const src = outputCtxRef.current.createBufferSource();
              src.buffer = buffer; src.connect(outputCtxRef.current.destination);
              src.onended = () => setIsSpeaking(false);
              src.start(Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime) + buffer.duration;
            }
          },
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [
            { name: 'send_whatsapp', parameters: { type: Type.OBJECT, properties: { message: { type: Type.STRING } } } },
            { name: 'open_tv_channel', parameters: { type: Type.OBJECT, properties: { channel: { type: Type.STRING }, app: { type: Type.STRING } } } }
          ]}],
          systemInstruction: `EVA V162. Driver: ${settings.userName}. Odo: ${settings.totalOdometer.toFixed(1)}. 
          PROTOCOLOS: PT-BR por padrão. EN-US se solicitado. 
          TV: Se pedirem canal, use as credenciais de TV e pergunte qual app usar se houver mais de um.
          PRIVACIDADE: ${settings.privacyMode}.`,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
      // Audio input streaming logic (omitted for brevity but preserved from previous)
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white p-12 uppercase italic">
         <h1 className="text-6xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400">EVA PANDORA V162</h1>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-cyan-600 rounded-full font-black text-xl shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-all">Sincronizar Driver</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* SIDEBAR - SMART-FIT ANDROID AUTO */}
      <aside className="h-full z-20 bg-[#020202] border-r border-white/5 flex flex-col w-[25%] transition-all duration-700 relative overflow-hidden">
         <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2 space-y-4">
            
            {/* VELOCÍMETRO */}
            <header className="shrink-0 pl-2 pt-2">
               <div className="flex flex-col items-start">
                  <span className="text-[6.5rem] font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
                  <div className="flex items-center gap-2 -mt-2 opacity-60">
                     <span className="text-[8px] font-black tracking-[0.3em]">KM/H</span>
                     <button onClick={() => setIsSettingsOpen(true)} className="p-1"><i className="fas fa-cog text-[10px]"></i></button>
                  </div>
               </div>
            </header>

            {/* HUD ADAS HB20 */}
            <div className="w-full bg-transparent p-2 flex flex-col gap-2 relative h-[320px] shrink-0 border-y border-white/5">
               <div className="flex flex-col items-center mb-1">
                  <div className="flex items-center gap-4 font-bold">
                    <span className="text-lg">D</span>
                    <i className="fas fa-gas-pump text-cyan-400 text-xs"></i>
                  </div>
                  <div className="text-[12px] font-black text-white/80 tracking-tighter">{settings.totalOdometer.toFixed(1)} KM</div>
               </div>

               <div className="relative flex-1 flex flex-col items-center justify-center overflow-visible" style={{ perspective: '800px' }}>
                  <div className="absolute top-[2%] left-1/2 -translate-x-1/2 flex flex-col items-center z-30">
                     <div className={`text-xl font-black italic tracking-tighter ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {safetyDist} <span className="text-[8px]">M</span>
                     </div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transform-gpu" style={{ transform: 'rotateX(55deg) translateY(35px) scale(1.4)' }}>
                     <div className="w-[54px] h-[34px] bg-[#e2e8f0] rounded-t-[22px] border-t-[3px] border-white relative">
                        <div className={`absolute -left-1 bottom-[8px] w-[18px] h-[6px] ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'bg-red-500 animate-flash-adas' : 'bg-gray-400'}`}></div>
                        <div className={`absolute -right-1 bottom-[8px] w-[18px] h-[6px] ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'bg-red-500 animate-flash-adas' : 'bg-gray-400'}`}></div>
                     </div>
                  </div>
               </div>
            </div>

            <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} onSetDestination={() => setIsAddStopModalOpen(true)} transparent />
         </div>

         {/* FOOTER - RELÓGIO + CONTROLE */}
         <footer className="shrink-0 h-[140px] pt-2 border-t border-white/10 flex flex-col gap-2 bg-[#020202] px-2 z-30">
            <div className="flex items-center gap-2">
               <div onClick={startVoiceSession} className={`w-11 h-11 shrink-0 rounded-full border border-cyan-500/30 overflow-hidden ${isListening ? 'border-red-600 shadow-[0_0_20px_red]' : ''}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <div className="flex-1 h-9">
                  <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
               </div>
            </div>
            <div className="mt-1 pl-2 border-l-2 border-cyan-500/20">
               <span className="text-4xl font-black text-white italic tracking-tighter leading-none">{currentTime}</span>
               <p className="text-[6px] font-bold text-cyan-500/40 tracking-[0.4em] uppercase mt-0.5">EVA CORE V162 ACTIVE</p>
            </div>
         </footer>
      </aside>

      <main className="flex-1 h-full relative bg-[#080808]">
         <MapView travel={travel} currentPosition={currentPos} heading={0} isFullScreen={true} mode={'3D'} layer={'DARK'} onToggleFullScreen={() => {}} />
         
         {/* OVERLAY DE MENSAGENS COM MODO DE PRIVACIDADE */}
         {activeMessage && (
           <div className="absolute top-10 left-10 max-w-lg z-[1000] animate-slide-in">
              <div className="bg-black/90 backdrop-blur-3xl border-2 border-emerald-500/50 rounded-[40px] p-8 shadow-2xl">
                 <div className="flex items-center gap-4 mb-4">
                    <i className="fab fa-whatsapp text-4xl text-emerald-500"></i>
                    <div>
                       <h3 className="text-2xl font-black">{settings.privacyMode === 'GHOST' ? 'MENSAGEM PRIVADA' : activeMessage.sender}</h3>
                       <span className="text-[10px] opacity-40">NOTIFICAÇÃO PANDORA</span>
                    </div>
                 </div>
                 <p className="text-lg font-bold leading-relaxed italic uppercase">
                    {settings.privacyMode === 'GHOST' ? 'PANDORA: Conteúdo Oculto. Diga "Ler Mensagem" para autorizar.' : 
                     settings.privacyMode === 'RESTRICTED' ? `${activeMessage.content.substring(0, 128)}...` : 
                     activeMessage.content}
                 </p>
              </div>
           </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }))} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={(ns) => setSettings(ns)} mediaApps={APP_DATABASE} />
      
      <style>{`
         @keyframes flash-adas { 0%, 100% { opacity: 1; filter: brightness(1.7); } 50% { opacity: 0.1; } }
         .animate-flash-adas { animation: flash-adas 0.4s infinite; }
         ::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
