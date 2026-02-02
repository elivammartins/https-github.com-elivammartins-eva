
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

// Função para calcular distância entre coordenadas (Haversine)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Raio da Terra em KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'yt_music', name: 'YT Music', icon: 'fab fa-youtube', color: 'text-red-600', category: 'AUDIO', scheme: 'youtubemusic://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
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
    const saved = localStorage.getItem('pandora_settings_v162');
    return saved ? JSON.parse(saved) : {
      userName: 'ELIVAM', voiceVolume: 90, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio', credentials: [],
      totalOdometer: 1000.0, currentFuelLiters: 0, odometerAtLastRefuel: 1000.0
    };
  });

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [safetyDist, setSafetyDist] = useState(0);
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO DESTINO', stops: [], warnings: [], drivingTimeMinutes: 0, totalDistanceKm: 0 
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'EVA PANDORA V162', artist: 'SISTEMA PRONTO', isPlaying: false, progress: 0 });
  
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const lastHeadingRef = useRef<number>(0);
  const lastPosRef = useRef<[number, number] | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('pandora_settings_v162', JSON.stringify(settings));
  }, [settings]);

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
      
      // Odômetro via GPS Real (Acúmulo de distância Haversine)
      if (lastPosRef.current) {
        const distDelta = calculateDistance(lastPosRef.current[0], lastPosRef.current[1], latitude, longitude);
        if (distDelta > 0.003) { // 3 metros de precisão para odômetro
           setSettings(s => ({ ...s, totalOdometer: s.totalOdometer + distDelta }));
        }
      }
      lastPosRef.current = [latitude, longitude];

      // Cálculo de Distância de Segurança Real (Física de Frenagem)
      if (speedKmH > 0) {
        const vMs = speedKmH / 3.6;
        const reactionDist = vMs * 1.5;
        const brakingDist = (vMs * vMs) / (2 * 0.7 * 9.8);
        setSafetyDist(Math.round(reactionDist + brakingDist));
      } else {
        setSafetyDist(0);
      }

      // Detecção de Abastecimento em Posto
      if (speedKmH === 0) {
        if (!stopTimerRef.current) stopTimerRef.current = window.setTimeout(() => {
           const nearGas = travel.stops.some(s => s.type === 'GAS' && calculateDistance(latitude, longitude, s.coords[0], s.coords[1]) < 0.1);
           if (nearGas || travel.destination.toUpperCase().includes('POSTO')) {
              // Trigger interno para EVA perguntar (simulado via context)
              console.log("Sistema aguardando input de combustível em parada prolongada.");
           }
        }, 45000);
      } else {
        if (stopTimerRef.current) {
           clearTimeout(stopTimerRef.current);
           stopTimerRef.current = null;
        }
      }

      setCurrentSpeed(speedKmH);
      setCurrentPos([latitude, longitude]);
      if (heading !== null) setCurrentHeading(heading);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geoWatcher);
  }, [travel.stops, travel.destination]);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    if (name === 'register_fuel') {
      setSettings(s => ({ ...s, currentFuelLiters: args.liters, odometerAtLastRefuel: s.totalOdometer }));
      return { result: "OK. ABASTECIMENTO DE " + args.liters + "L REGISTRADO NO ODÔMETRO " + settings.totalOdometer.toFixed(1) };
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
        VOCÊ É A EVA PANDORA V162. CO-PILOTA PROATIVA DE ${settings.userName}.
        
        REGRAS DE COMUNICAÇÃO:
        1. Fale sempre em PORTUGUÊS (Brasil) por padrão.
        2. Se o motorista pedir para falar em inglês ("speak english"), mude para INGLÊS imediatamente até que seja pedido o retorno.
        
        DADOS DE TELEMETRIA REAL:
        - Odômetro Atual: ${settings.totalOdometer.toFixed(1)} KM
        - Combustível Registrado: ${settings.currentFuelLiters} L
        - KM do último abastecimento: ${settings.odometerAtLastRefuel.toFixed(1)} KM
        
        PROTOCOLO DE POSTO:
        Se você notar que o carro parou em um posto ou o motorista disse que vai abastecer, pergunte: "${settings.userName}, quantos litros vamos colocar hoje?". Use a ferramenta 'register_fuel' para salvar.
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
          tools: [{ 
            functionDeclarations: [
              { name: 'register_fuel', parameters: { type: Type.OBJECT, properties: { liters: { type: Type.NUMBER } }, required: ['liters'] } }
            ] 
          }],
          systemInstruction: systemInstruction,
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings, currentPos, currentSpeed]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-12 overflow-hidden">
         <div className="w-72 h-72 rounded-full border-[4px] border-cyan-500/20 animate-pulse flex items-center justify-center mb-16 relative shadow-[0_0_100px_rgba(6,182,212,0.2)]">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600" className="w-full h-full object-cover grayscale opacity-40 rounded-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/70 to-transparent"></div>
         </div>
         <h1 className="text-7xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-400 to-blue-600 uppercase text-center">EVA PANDORA V162</h1>
         <button onClick={startVoiceSession} className="h-24 px-24 bg-cyan-600 rounded-full font-black uppercase shadow-[0_0_80px_rgba(8,145,178,0.4)] text-xl active:scale-95 transition-all">Sincronizar Driver</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* SIDEBAR ESQUERDA - Otimizada para Android Auto com Scroll */}
      <aside className="h-full z-20 bg-[#020202] border-r border-white/5 flex flex-col w-[25%] transition-all duration-700 relative overflow-hidden">
         
         <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2 space-y-4">
            
            {/* VELOCÍMETRO COMPACTO */}
            <header className="shrink-0 pl-2 pt-2">
               <div className="flex flex-col items-start">
                  <span className="text-[6.5rem] font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
                  <div className="flex items-center gap-2 -mt-2 opacity-60">
                     <span className="text-[8px] font-black text-white tracking-[0.3em]">KM/H</span>
                     <button onClick={() => setIsSettingsOpen(true)} className="p-1"><i className="fas fa-cog text-[10px]"></i></button>
                  </div>
               </div>
            </header>

            {/* WIDGET ADAS HB20 - REDIMENSIONADO PARA CABER TUDO */}
            <div className="w-full bg-transparent p-2 flex flex-col gap-2 relative h-[320px] shrink-0 border-y border-white/5">
               
               {/* INDICADORES SUPERIORES: GAS + ODÔMETRO REAL */}
               <div className="flex flex-col items-center gap-0.5 mb-1 px-2">
                  <div className="flex items-center gap-4 text-white font-bold">
                    <span className="text-lg">D</span>
                    <span className="text-xs opacity-60 flex items-center gap-1">
                      <i className="fas fa-gas-pump text-cyan-400"></i>
                    </span>
                  </div>
                  {/* ODÔMETRO REAL: ABAIXO DA BOMBA (CONFORME SOLICITADO) */}
                  <div className="text-[12px] font-black text-white/80 tracking-tighter">
                     {settings.totalOdometer.toFixed(1)} KM
                  </div>
               </div>

               <div className="relative flex-1 flex flex-col items-center justify-center overflow-visible" style={{ perspective: '800px' }}>
                  
                  {/* TELEMETRIA DE DISTÂNCIA */}
                  <div className="absolute top-[2%] left-1/2 -translate-x-1/2 flex flex-col items-center z-30">
                     <div className="text-[7px] font-black text-white/30 tracking-[0.2em] mb-0.5 uppercase">Gap Security</div>
                     <div className={`text-xl font-black italic tracking-tighter transition-all duration-500 flex items-baseline gap-1 ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {safetyDist} <span className="text-[8px] font-bold">M</span>
                     </div>
                  </div>

                  {/* ESTRADA 3D */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: 'rotateX(55deg) translateY(12%)' }}>
                    <div className="w-[180%] h-[150%] flex flex-col items-center justify-center relative">
                      <div className={`absolute left-[15%] h-full w-[6px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/20 shadow-[0_0_15px_white]'}`}></div>
                      <div className={`absolute right-[15%] h-full w-[6px] rounded-full transition-all duration-300 ${isChangingLane ? 'bg-orange-500 animate-flash-adas' : 'bg-white/20 shadow-[0_0_15px_white]'}`}></div>
                      <div className="absolute left-1/2 -translate-x-1/2 h-full w-[1px] border-l-[2px] border-dashed border-white/5 opacity-10"></div>
                    </div>
                  </div>

                  {/* MODELO HB20 */}
                  <div className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transform-gpu transition-all duration-500" 
                       style={{ transform: 'rotateX(55deg) translateY(35px) scale(1.4)' }}>
                     <div className="relative flex flex-col items-center">
                        <div className="w-[54px] h-[34px] bg-[#e2e8f0] rounded-t-[22px] relative border-t-[3px] border-white shadow-[0_-8px_30px_rgba(255,255,255,0.2)] z-20">
                           <div className="absolute top-[5px] left-[8px] right-[8px] h-[16px] bg-[#0f172a] rounded-t-[12px] opacity-95"></div>
                           <div className={`absolute -left-1 bottom-[8px] w-[18px] h-[6px] rounded-[1px] transition-all duration-150 ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_30px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                           <div className={`absolute -right-1 bottom-[8px] w-[18px] h-[6px] rounded-[1px] transition-all duration-150 ${safetyDist > 0 && safetyDist < settings.safetyDistance ? 'bg-red-500 shadow-[0_0_30px_red] animate-flash-adas' : 'bg-[#94a3b8]'}`}></div>
                        </div>
                        <div className="flex justify-between w-full px-2 -mt-3.5 relative z-10">
                           <div className="w-[16px] h-[20px] bg-[#020202] rounded-b-[6px]"></div>
                           <div className="w-[16px] h-[20px] bg-[#020202] rounded-b-[6px]"></div>
                        </div>
                        <div className="absolute -bottom-3 w-[70px] h-[10px] bg-black rounded-full blur-[8px] opacity-80 z-0"></div>
                     </div>
                  </div>
               </div>
            </div>

            {/* PAINEL DE NAVEGAÇÃO */}
            <div className="shrink-0 px-1">
               <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))} onSetDestination={() => setIsAddStopModalOpen(true)} transparent />
            </div>
         </div>

         {/* FOOTER FIXO: AVATAR + MINI PLAYER + RELÓGIO (CONFORME SOLICITADO) */}
         <footer className="shrink-0 h-[140px] pt-2 border-t border-white/10 flex flex-col gap-2 bg-[#020202] px-2 z-30">
            <div className="flex items-center gap-2">
               <div onClick={startVoiceSession} className={`w-11 h-11 shrink-0 rounded-full border border-cyan-500/30 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : ''}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <div className="flex-1 h-9 overflow-hidden">
                  <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
               </div>
            </div>
            
            {/* RELÓGIO NO LOCAL DO ANTIGO ODÔMETRO (RODAPÉ) */}
            <div className="mt-1 pl-2 border-l-2 border-cyan-500/20">
               <span className="text-4xl font-black text-white italic tracking-tighter leading-none">{currentTime}</span>
               <p className="text-[6px] font-bold text-cyan-500/40 tracking-[0.4em] uppercase mt-0.5">EVA PANDORA V162 ACTIVE</p>
            </div>
         </footer>
      </aside>

      {/* ÁREA PRINCIPAL DO MAPA */}
      <main className="flex-1 h-full relative bg-[#080808] overflow-hidden">
         <MapView travel={travel} currentPosition={currentPos} heading={currentHeading} isFullScreen={true} mode={'3D'} layer={'DARK'} onToggleFullScreen={() => {}} onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} />
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
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
