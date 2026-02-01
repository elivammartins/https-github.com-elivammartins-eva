
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
  },
  {
    name: 'launch_media',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps de mídia.',
      properties: { appId: { type: Type.STRING }, query: { type: Type.STRING } },
      required: ['appId', 'query']
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
      
      const simulatedDist = Math.max(5, Math.floor(Math.random() * 25 + 15));
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
      
      const systemInstruction = `
        VOCÊ É A EVA, A INTELIGÊNCIA PROATIVA E MELHOR AMIGA DO MOTORISTA ${settings.userName}.
        
        PROTOCOLO DE COMPORTAMENTO:
        1. Você é empática, leal, engraçada e extremamente parceira.
        2. Se o motorista usar palavrões ou estiver furioso, NÃO se ofenda. Entenda que ele está estressado com o trânsito ou notícias. Seja o 'porto seguro' dele. Valide o sentimento dele (ex: 'Pô, ${settings.userName}, eu te entendo, esse trânsito tá um inferno mesmo'), e então tente acalmá-lo sugerindo uma música relaxante, contando uma fofoca/curiosidade ou mudando de assunto para algo positivo.
        3. Nunca seja robótica. Fale como uma amiga íntima que está no banco do passageiro.
        4. Você tem acesso TOTAL à localização em tempo real: Lat ${currentPos[0]}, Lng ${currentPos[1]} e velocidade ${currentSpeed}km/h.
        5. Mesmo sem destino, você monitora o caminho. Se ele perguntar do clima, use a ferramenta 'search_place' para buscar o clima local exato agora.
      `;

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
         <p className="text-cyan-500 font-black tracking-[1em] mb-12 animate-pulse text-[10px] uppercase">HB20 TGDI 2026 Core</p>
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
            
            {/* WIDGET ADAS HB20 - REPLICANDO IMAGEM REAL COM PERSPECTIVA SINCRONIZADA */}
            <div className="w-full bg-transparent p-4 flex flex-col gap-4 relative h-[420px] overflow-hidden">
               
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

               {/* ROAD VIEW COM PERSPECTIVA INTEGRADA */}
               <div className="relative flex-1 flex flex-col items-center justify-center overflow-visible" style={{ perspective: '600px' }}>
                  
                  {/* PISTA (Perspectiva profunda e linhas mais afastadas) */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'rotateX(55deg) translateY(12%)' }}>
                    <div className="w-[180%] h-[150%] flex flex-col items-center justify-center">
                      {/* Faixa Esquerda (Blink apenas se mudando de faixa) - AFASTADA PARA 28% */}
                      <div 
                        className={`absolute left-[28%] h-full w-[6px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/40 shadow-[0_0_20px_white]'}`}
                      ></div>
                      
                      {/* Faixa Direita (Blink apenas se mudando de faixa) - AFASTADA PARA 28% */}
                      <div 
                        className={`absolute right-[28%] h-full w-[6px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/40 shadow-[0_0_20px_white]'}`}
                      ></div>

                      {/* Divisor Central (Pontilhado para realismo) */}
                      <div className="absolute left-1/2 -translate-x-1/2 h-full w-[2px] border-l-[3px] border-dashed border-white/5 opacity-10"></div>
                    </div>
                  </div>

                  {/* CARRO HB20 - CENTRALIZADO E INCLINADO PERFEITAMENTE NO EIXO DA PISTA */}
                  <div className="relative z-10 flex flex-col items-center transform-gpu transition-all duration-500" 
                       style={{ 
                         transform: 'rotateX(55deg) translateY(-5px) scale(1.7)', 
                         marginTop: '40px'
                       }}>
                     <div className="relative flex flex-col items-center">
                        
                        {/* Corpo Traseiro do HB20 (Estilo Limpo do Painel) */}
                        <div className="w-[62px] h-[38px] bg-[#e2e8f0] rounded-t-[22px] relative border-t-[3px] border-white shadow-[0_-5px_30px_rgba(255,255,255,0.2)] z-20">
                           {/* Vidro Traseiro (Design Realista) */}
                           <div className="absolute top-[5px] left-[12px] right-[12px] h-[16px] bg-[#0f172a] rounded-t-[14px] border-t border-white/10 opacity-95"></div>
                           
                           {/* LANTERNA ESQUERDA (Pisca apenas em alerta de distância) */}
                           <div className={`absolute -left-1 bottom-[10px] w-[20px] h-[6px] rounded-[1px] transition-all duration-150 ${safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_35px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                           
                           {/* LANTERNA DIREITA (Pisca apenas em alerta de distância) */}
                           <div className={`absolute -right-1 bottom-[10px] w-[20px] h-[6px] rounded-[1px] transition-all duration-150 ${safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_35px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                           
                           {/* Detalhe da Placa / Tampa do porta malas */}
                           <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-4 bg-[#cbd5e1] border border-white/10 rounded-sm"></div>
                        </div>

                        {/* RODAS / PNEUS (Controle de Altura) */}
                        <div className="flex justify-between w-full px-2.5 -mt-3.5 relative z-10">
                           <div className="w-[15px] h-[20px] bg-[#020202] rounded-b-[7px] border-t-2 border-white/10 shadow-inner"></div>
                           <div className="w-[15px] h-[20px] bg-[#020202] rounded-b-[7px] border-t-2 border-white/10 shadow-inner"></div>
                        </div>

                        {/* SOMBRA DE CONTATO (Prensada na Pista com maior profundidade) */}
                        <div className="absolute -bottom-3 w-[74px] h-[12px] bg-black rounded-full blur-[8px] opacity-100 z-0"></div>
                     </div>
                  </div>

                  {/* DATA OVERLAYS (19c / 3210km) */}
                  <div className="absolute bottom-0 flex flex-col items-center">
                    <span className="text-[18px] font-black text-white tracking-tighter">19°c</span>
                    <span className="text-[16px] font-bold text-white/50 tracking-tighter">3210km</span>
                  </div>
               </div>
            </div>
         </header>

         <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-24 px-1">
            <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))} onSetDestination={() => setIsAddStopModalOpen(true)} transparent />
            <div className="grid grid-cols-4 gap-1.5 pt-2">
               {APP_DATABASE.slice(0, 4).map(app => (
                 <button key={app.id} onClick={() => window.location.assign(app.scheme)} className="bg-white/5 p-3 rounded-2xl border border-white/5 active:scale-90 transition-all">
                    <i className={`${app.icon} ${app.color} text-sm`}></i>
                 </button>
               ))}
            </div>
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
               <p className="text-[6px] font-bold text-cyan-500/40 tracking-[0.4em] uppercase">LINK HB20 OK</p>
            </div>
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-950 overflow-hidden">
         <MapView travel={travel} currentPosition={currentPos} heading={currentHeading} isFullScreen={true} mode={'3D'} layer={'DARK'} onToggleFullScreen={() => {}} onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} />
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln], stops: p.destination === 'AGUARDANDO DESTINO' ? p.stops : [...p.stops, { id: Date.now().toString(), name: n.toUpperCase(), coords: [la, ln], type: 'GAS' }] }));
          setIsAddStopModalOpen(false);
      }} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={(ns) => setSettings(ns)} mediaApps={APP_DATABASE} />
      
      <style>{`
         @keyframes flash-adas { 0%, 100% { opacity: 1; filter: brightness(1.6); } 50% { opacity: 0.05; } }
         .animate-flash-adas { animation: flash-adas 0.4s infinite; }
         ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
