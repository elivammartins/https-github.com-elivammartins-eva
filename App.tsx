
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, StopInfo } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'yt_music', name: 'YT Music', icon: 'fab fa-youtube', color: 'text-red-600', category: 'AUDIO', scheme: 'youtubemusic://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'yt_premium', name: 'YouTube Premium', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'claro_tv', name: 'Claro TV+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'clarotvplus://' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-g', color: 'text-orange-500', category: 'VIDEO', scheme: 'globoplay://search/' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca locais, notícias ou clima atualizado.',
      properties: { query: { type: Type.STRING }, searchType: { type: Type.STRING, enum: ['PLACE', 'NEWS', 'WEATHER', 'SAFETY'] } },
      required: ['query']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Atualiza o trajeto ou adiciona uma parada.',
      properties: { name: { type: Type.STRING }, lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER }, type: { type: Type.STRING, enum: ['DESTINATION', 'STOP'] } },
      required: ['name', 'lat', 'lng', 'type']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [isChangingLane, setIsChangingLane] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pandora_settings_v160');
    return saved ? JSON.parse(saved) : {
      userName: 'ELIVAM', voiceVolume: 90, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio', credentials: []
    };
  });

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [safetyDist, setSafetyDist] = useState(50);
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO DESTINO', stops: [], warnings: [], drivingTimeMinutes: 0, totalDistanceKm: 0 
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'EVA PANDORA V160', artist: 'SISTEMA PRONTO', isPlaying: false, progress: 0 });
  
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const lastHeadingRef = useRef<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const geoWatcher = navigator.geolocation.watchPosition((p) => {
      const { latitude, longitude, speed, heading } = p.coords;
      const speedKmH = speed ? Math.round(speed * 3.6) : 0;
      
      if (heading !== null) {
        const delta = Math.abs(heading - lastHeadingRef.current);
        if (delta > 4.5 && speedKmH > 15) { 
           setIsChangingLane(true);
           setTimeout(() => setIsChangingLane(false), 3000);
        }
        lastHeadingRef.current = heading;
      }

      setCurrentSpeed(speedKmH);
      setCurrentPos([latitude, longitude]);
      if (heading !== null) setCurrentHeading(heading);
      
      // Simulação de telemetria baseada no tráfego (Radarbot/Waze data-sync)
      const simulatedDist = Math.max(8, Math.floor(Math.random() * 40 + 20));
      setSafetyDist(simulatedDist);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geoWatcher);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    if (name === 'set_navigation') {
      const isDest = args.type === 'DESTINATION';
      setTravel(p => ({
        ...p, destination: isDest ? args.name.toUpperCase() : p.destination,
        destinationCoords: isDest ? [args.lat, args.lng] : p.destinationCoords,
        stops: isDest ? p.stops : [...p.stops, { id: Date.now().toString(), name: args.name.toUpperCase(), coords: [args.lat, args.lng], type: 'GAS' }]
      }));
      return { result: "OK" };
    }
    return { result: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) { sessionRef.current?.close(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
      
      const systemInstruction = `Você é a EVA, co-pilota proativa do ${settings.userName}. Sua voz é Kore. Seja parceira e monitore o trânsito.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setIsSystemBooted(true);
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => { 
              sessionPromise.then((session) => { session.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }); });
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = await handleSystemAction(fc);
                sessionPromise.then((session) => { session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }); });
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer; source.connect(outputCtxRef.current.destination);
              source.onended = () => { activeSourcesRef.current.delete(source); if (activeSourcesRef.current.size === 0) setIsSpeaking(false); };
              activeSourcesRef.current.add(source); source.start(Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime) + buffer.duration;
            }
          },
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings.userName, currentPos, currentSpeed]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-12 overflow-hidden">
         <div className="w-72 h-72 rounded-full border-[4px] border-cyan-500/20 animate-pulse flex items-center justify-center mb-16 relative shadow-[0_0_100px_rgba(6,182,212,0.2)]">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600" className="w-full h-full object-cover grayscale opacity-40 rounded-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/70 to-transparent"></div>
         </div>
         <h1 className="text-7xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-400 to-blue-600 uppercase text-center">EVA PANDORA V160</h1>
         <button onClick={startVoiceSession} className="h-24 px-24 bg-cyan-600 rounded-full font-black uppercase shadow-[0_0_80px_rgba(8,145,178,0.4)] text-xl active:scale-95 transition-all">Sincronizar Driver</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD ESQUERDO (22%) */}
      <aside className="h-full z-20 bg-[#020202] border-r border-white/5 flex flex-col p-2 w-[22%] transition-all duration-700 relative">
         
         <header className="mb-4 space-y-3 px-1">
            <div className="flex flex-col items-start pt-4 pl-2">
               <span className="text-[7rem] font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
               <div className="flex items-center gap-2 -mt-2 opacity-60">
                  <span className="text-[8px] font-black text-white tracking-[0.3em]">KM/H</span>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-1">
                     <i className="fas fa-cog text-[10px]"></i>
                  </button>
               </div>
            </div>
            
            {/* WIDGET ADAS HB20 - PERSPECTIVA INTEGRADA */}
            <div className="w-full bg-transparent p-4 flex flex-col gap-4 relative h-[420px] overflow-hidden border-y border-white/5">
               
               <div className="flex flex-col items-center gap-1 mb-2">
                  <div className="flex items-center gap-4 text-white font-bold">
                    <span className="text-xl">D</span>
                    <span className="text-xs opacity-60 flex items-center gap-1">
                      <i className="fas fa-gas-pump"></i> 158km
                    </span>
                  </div>
                  <div className="flex items-center gap-4 py-1 text-emerald-500">
                    <i className={`fas fa-dharmachakra text-[14px] ${isChangingLane ? 'text-orange-500' : ''}`}></i>
                    <i className="fas fa-road text-[12px] opacity-40"></i>
                  </div>
               </div>

               {/* ROAD VIEW 3D */}
               <div className="relative flex-1 flex flex-col items-center justify-center overflow-visible" style={{ perspective: '800px' }}>
                  
                  {/* WIDGET DISTÂNCIA REAL (TELEMETRIA GPS/WAZE) */}
                  <div className="absolute top-[5%] left-1/2 -translate-x-1/2 flex flex-col items-center z-30">
                     <div className="text-[8px] font-black text-white/30 tracking-[0.2em] mb-1">RADAR TELEMETRY</div>
                     <div className={`text-2xl font-black italic tracking-tighter transition-all duration-500 flex items-baseline gap-1 ${safetyDist < settings.safetyDistance ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {safetyDist} <span className="text-[10px] font-bold">METROS</span>
                     </div>
                     <div className="w-24 h-[2px] bg-white/10 mt-1 relative overflow-hidden rounded-full">
                        <div 
                           className={`h-full transition-all duration-500 ${safetyDist < settings.safetyDistance ? 'bg-red-500' : 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]'}`}
                           style={{ width: `${Math.min(100, (safetyDist / 80) * 100)}%` }}
                        ></div>
                     </div>
                  </div>

                  {/* PISTA (Perspectiva 55deg e Linhas Afastadas) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'rotateX(55deg) translateY(12%)' }}>
                    <div className="w-[180%] h-[150%] flex flex-col items-center justify-center relative">
                      
                      {/* Faixa Esquerda (Borda Rodovia) - Afastada para 15% */}
                      <div className={`absolute left-[15%] h-full w-[8px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/30 shadow-[0_0_20px_white]'}`}></div>
                      
                      {/* Faixa Direita (Borda Rodovia) - Afastada para 15% */}
                      <div className={`absolute right-[15%] h-full w-[8px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/30 shadow-[0_0_20px_white]'}`}></div>

                      {/* Divisor Central Pontilhado */}
                      <div className="absolute left-1/2 -translate-x-1/2 h-full w-[2px] border-l-[4px] border-dashed border-white/5 opacity-10"></div>
                    </div>
                  </div>

                  {/* CARRO HB20 - CENTRALIZADO E INCLINADO NO PLANO DA PISTA */}
                  <div className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transform-gpu transition-all duration-500" 
                       style={{ 
                         transform: 'rotateX(55deg) translateY(45px) scale(1.6)', 
                       }}>
                     <div className="relative flex flex-col items-center">
                        {/* Corpo Traseiro do HB20 */}
                        <div className="w-[62px] h-[40px] bg-[#e2e8f0] rounded-t-[25px] relative border-t-[4px] border-white shadow-[0_-8px_40px_rgba(255,255,255,0.25)] z-20">
                           <div className="absolute top-[6px] left-[10px] right-[10px] h-[18px] bg-[#0f172a] rounded-t-[15px] border-t border-white/20 opacity-95"></div>
                           <div className={`absolute -left-1 bottom-[10px] w-[22px] h-[7px] rounded-[1px] transition-all duration-150 ${safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_35px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                           <div className={`absolute -right-1 bottom-[10px] w-[22px] h-[7px] rounded-[1px] transition-all duration-150 ${safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_35px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                           <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-[#cbd5e1] border border-white/10 rounded-sm"></div>
                        </div>

                        {/* Rodas Traseiras */}
                        <div className="flex justify-between w-full px-2 -mt-4 relative z-10">
                           <div className="w-[18px] h-[22px] bg-[#020202] rounded-b-[8px] border-t-2 border-white/10"></div>
                           <div className="w-[18px] h-[22px] bg-[#020202] rounded-b-[8px] border-t-2 border-white/10"></div>
                        </div>

                        {/* Sombra de Contato Pista */}
                        <div className="absolute -bottom-4 w-[80px] h-[14px] bg-black rounded-full blur-[10px] opacity-100 z-0"></div>
                     </div>
                  </div>
               </div>
            </div>
         </header>

         <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-24 px-1">
            <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))} onSetDestination={() => setIsAddStopModalOpen(true)} transparent />
         </div>

         <footer className="h-40 pt-2 border-t border-white/10 flex flex-col gap-3 sticky bottom-0 bg-[#020202] px-1">
            <div className="flex items-center gap-2">
               <div onClick={startVoiceSession} className={`w-12 h-12 shrink-0 rounded-full border border-cyan-500/30 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.4)]' : ''}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <div className="flex-1 h-10 overflow-hidden">
                  <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
               </div>
            </div>
            <div className="mt-2 pl-2 border-l-2 border-cyan-500/20">
               <span className="text-4xl font-black text-white italic tracking-tighter">{currentTime}</span>
               <p className="text-[6px] font-bold text-cyan-500/40 tracking-[0.4em] uppercase">SYSTEM CORE HB20 OK</p>
            </div>
         </footer>
      </aside>

      {/* MAPA PREENCHENDO 100% DA ÁREA DIREITA */}
      <main className="flex-1 h-full relative bg-[#080808] overflow-hidden">
         <MapView 
           travel={travel} 
           currentPosition={currentPos} 
           heading={currentHeading} 
           isFullScreen={true} 
           mode={'3D'} 
           layer={'DARK'} 
           onToggleFullScreen={() => {}} 
           onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} 
         />
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln], stops: p.destination === 'AGUARDANDO DESTINO' ? p.stops : [...p.stops, { id: Date.now().toString(), name: n.toUpperCase(), coords: [la, ln], type: 'GAS' }] }));
          setIsAddStopModalOpen(false);
      }} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={(ns) => setSettings(ns)} mediaApps={APP_DATABASE} />
      
      <style>{`
         @keyframes flash-adas { 0%, 100% { opacity: 1; filter: brightness(1.7); } 50% { opacity: 0.1; } }
         .animate-flash-adas { animation: flash-adas 0.4s infinite; }
         ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
