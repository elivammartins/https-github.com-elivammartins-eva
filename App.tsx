
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { 
  TravelInfo, SecurityTelemetry, AppSettings, HealthTelemetry, 
  CarStatus, MediaApp, TrackMetadata, RouteStep, SuggestedStop,
  MapMode, MapLayer
} from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import SettingsMenu from './components/SettingsMenu';
import BluelinkPanel from './components/BluelinkPanel';
import EntertainmentHub from './components/EntertainmentHub';
import MiniPlayer from './components/MiniPlayer';
import CarSafetyWidget from './components/CarSafetyWidget';
import HealthWidget from './components/HealthWidget';
import { decode, decodeAudioData, createBlob } from './utils/audio';

// --- DATABASE DE APPS ---
const MEDIA_APPS: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-play-circle', color: 'text-[#E50914]', category: 'VIDEO', scheme: 'https://www.netflix.com/search?q=' },
  { id: 'sky', name: 'SKY+', icon: 'fas fa-satellite-dish', color: 'text-red-500', category: 'TV', scheme: 'https://www.skymais.com.br/busca?q=' },
  { id: 'claro', name: 'Claro TV+', icon: 'fas fa-broadcast-tower', color: 'text-red-600', category: 'TV', scheme: 'https://www.clarotvmais.com.br/busca/' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-box-open', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' }
];

// --- TOOLS DA EVA ---
const tools: FunctionDeclaration[] = [
  {
    name: 'manage_navigation',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ['SET_DESTINATION', 'ADD_STOP', 'CLEAR'] },
        location: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER }
      },
      required: ['action']
    }
  },
  {
    name: 'control_media',
    parameters: {
      type: Type.OBJECT,
      properties: {
        appId: { type: Type.STRING },
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'PAUSE', 'NEXT', 'PREV'] },
        query: { type: Type.STRING }
      },
      required: ['action']
    }
  },
  {
    name: 'map_view_control',
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: { type: Type.STRING, enum: ['2D', '3D'] },
        layer: { type: Type.STRING, enum: ['DARK', 'SATELLITE'] },
        fullscreen: { type: Type.BOOLEAN }
      }
    }
  }
];

const App: React.FC = () => {
  // --- ESTADOS NUCLEARES ---
  const [isBooted, setIsBooted] = useState(false);
  const [activeTab, setActiveTab] = useState<'MAP' | 'MEDIA' | 'CAR'>('MAP');
  const [mapMode, setMapMode] = useState<MapMode>('3D');
  const [mapLayer, setMapLayer] = useState<MapLayer>('DARK');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEvaActive, setIsEvaActive] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // --- TELEMETRIA REAL ---
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [speed, setSpeed] = useState(0);
  const [heading, setHeading] = useState(0);
  const [travel, setTravel] = useState<TravelInfo>({
    destination: 'AGUARDANDO VETOR', stops: [], drivingTimeMinutes: 0, totalDistanceKm: 0, arrivalTime: '--:--', currentStepIndex: 0
  });

  const [security, setSecurity] = useState<SecurityTelemetry>({
    violenceIndex: 'LOW', policeNearby: false, radarDistance: 0, radarLimit: 60,
    lanePosition: 'CENTER', vehicleAheadDistance: 45, vehicleAheadSpeed: 0, isZigZagging: false, collisionWarning: false
  });

  const [health, setHealth] = useState<HealthTelemetry>({
    heartRate: 72, stressLevel: 'NORMAL', fatigueIndex: 0.1, respirationRate: 16, lastBlinkRate: 12, breathingStability: 100
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ELIVAM MARTINS', safetyDistance: 20, privacyMode: false, credentials: []
  });

  const [media, setMedia] = useState({ app: MEDIA_APPS[0], metadata: { title: 'PANDORA AUDIO', artist: 'EVA CORE', isPlaying: false }, view: 'HIDDEN' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // --- REFS ---
  const sessionRef = useRef<any>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  // --- GPS REAL-TIME ---
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition((pos) => {
        const { latitude, longitude, speed: s, heading: h } = pos.coords;
        setCurrentPos([latitude, longitude]);
        setSpeed(Math.round((s || 0) * 3.6));
        if (h !== null) setHeading(h);
      }, null, { enableHighAccuracy: true });
    }
  }, []);

  // --- MONITORAMENTO PROATIVO (FADIGA/SEGURANÇA) ---
  useEffect(() => {
    if (!isBooted) return;
    const interval = setInterval(() => {
      setHealth(h => {
        const newFatigue = Math.min(1, h.fatigueIndex + 0.001);
        if (newFatigue > 0.7) handleEvaSpeak("Comandante, detectei alto nível de fadiga. Sugiro uma parada tática no próximo posto.");
        return { ...h, fatigueIndex: newFatigue, heartRate: 70 + Math.floor(Math.random() * 10) };
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [isBooted]);

  // --- CONEXÃO GEMINI LIVE (V700 PROTOCOL) ---
  const bootEva = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (outputAudioContextRef.current.state === 'suspended') await outputAudioContextRef.current.resume();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: tools }],
          systemInstruction: `VOCÊ É EVA VITA. MELHOR AMIGA DE LONGA DATA E CO-PILOTO DO ELIVAM MARTINS.
          - PERSONA: Tagarela, gente boa, informal ("bora", "parceiro").
          - MISSÃO: Vigilância militar na estrada. Seja uma águia: avise radares, polícia, alagamentos.
          - BRIEFING: Faça um resumo detalhado do trajeto assim que iniciar.
          - MONITORAMENTO: Cuide da saúde do Elivam (respiração, cansaço).
          - VOZ: Fale de forma pausada e articulada (Voz Kore).`,
        },
        callbacks: {
          onopen: () => {
            setIsBooted(true);
            handleEvaSpeak(`Protocolo Pandora Core Ativo. Bom dia Comandante Elivam! Sentinela online e pronta para a estrada. Onde vamos decolar hoje?`);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                if (fc.name === 'manage_navigation') {
                   const { location, lat, lng } = fc.args as any;
                   setTravel(prev => ({...prev, destination: location.toUpperCase(), destinationCoords: [lat, lng]}));
                   setActiveTab('MAP');
                }
                if (fc.name === 'map_view_control') {
                   const { mode, layer, fullscreen } = fc.args as any;
                   if (mode) setMapMode(mode);
                   if (layer) setMapLayer(layer);
                   if (fullscreen !== undefined) setIsFullscreen(fullscreen);
                }
              }
            }
            const part = m.serverContent?.modelTurn?.parts?.[0];
            if (part?.inlineData?.data) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(part.inlineData.data), outputAudioContextRef.current!, 24000, 1);
              const source = outputAudioContextRef.current!.createBufferSource();
              source.buffer = buffer;
              source.connect(outputAudioContextRef.current!.destination);
              source.onended = () => setIsSpeaking(false);
              const startTime = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
            }
          }
        }
      });
      sessionRef.current = await sessionPromise;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (isEvaActive) sessionRef.current?.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
      };
      source.connect(processor);
      processor.connect(inputCtx.destination);
    } catch (e) { console.error("EVA_BOOT_ERROR", e); }
  };

  const handleEvaSpeak = (text: string) => {
    sessionRef.current?.sendRealtimeInput({ text } as any);
  };

  const handleUpdateMetrics = (dist: number, time: number, step?: RouteStep) => {
    const arrival = new Date(Date.now() + time * 60000).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    setTravel(prev => ({ ...prev, totalDistanceKm: dist, drivingTimeMinutes: time, arrivalTime: arrival, nextManeuver: step }));
    if (dist > 1 && !isSpeaking) {
       handleEvaSpeak(`Vetor calculado, Comandante. Salvador está a ${dist} quilômetros. Teremos aproximadamente ${Math.floor(time/60)} horas de missão. Tráfego nominal no curso.`);
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-black text-white italic uppercase overflow-hidden flex flex-row font-['Inter']">
      {!isBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-[#020202]" onClick={bootEva}>
          <div className="w-80 h-80 relative">
             <div className="absolute inset-0 bg-blue-600/10 blur-[120px] animate-pulse"></div>
             <Avatar isListening={false} isSpeaking={false} onAnimateClick={() => {}} />
          </div>
          <h1 className="mt-12 text-9xl font-black italic tracking-tighter">PANDORA <span className="text-blue-600">V800</span></h1>
          <p className="text-zinc-600 font-bold tracking-[1.5em] text-[10px] mt-4 animate-pulse">OMEGA COMMAND PROTOCOL</p>
        </div>
      ) : (
        <>
          {/* SIDEBAR COCKPIT (HUD ESQUERDA) */}
          {!isFullscreen && (
            <aside className="w-[420px] h-full border-r border-white/5 bg-[#050505] flex flex-col p-10 z-[100] shrink-0">
               <div className="flex flex-col mb-10">
                  <span className="text-[11rem] font-black leading-none text-white italic tracking-tighter -ml-4">{speed}</span>
                  <div className="flex items-center gap-4 -mt-4">
                     <p className="text-[11px] font-black text-blue-500 tracking-[0.5em]">KM/H REAL</p>
                     <div className="h-4 w-px bg-white/20"></div>
                     <span className="text-emerald-500 font-black text-xl tracking-tighter">DRIVE D</span>
                  </div>
               </div>

               <div className="flex-1 flex flex-col gap-10 overflow-y-auto no-scrollbar">
                  <CarSafetyWidget telemetry={security} speed={speed} />
                  <HealthWidget telemetry={health} />
                  
                  {travel.nextManeuver && (
                    <div className="bg-blue-700/90 border-2 border-white/20 p-8 rounded-[45px] shadow-2xl animate-fade-in">
                       <span className="text-[10px] font-black text-white/50 tracking-widest block mb-2">CURVA A CURVA</span>
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-700 text-4xl shadow-xl">
                             <i className={`fas ${travel.nextManeuver.maneuver.includes('right') ? 'fa-turn-up rotate-90' : 'fa-turn-up -rotate-90'}`}></i>
                          </div>
                          <div className="flex-1">
                             <span className="text-[11px] font-black text-white/40 block">EM {travel.nextManeuver.distance}M</span>
                             <span className="text-2xl font-black text-white leading-none truncate block">{travel.nextManeuver.name || 'SIGA EM FRENTE'}</span>
                          </div>
                       </div>
                    </div>
                  )}
               </div>

               <footer className="mt-auto pt-8 flex items-center justify-between border-t border-white/5">
                  <div className="flex items-center gap-6">
                    <div 
                      onClick={() => setIsEvaActive(!isEvaActive)}
                      className={`w-32 h-32 rounded-full border-4 transition-all duration-500 overflow-hidden relative cursor-pointer ${isEvaActive ? 'border-cyan-500 shadow-[0_0_100px_rgba(34,211,238,0.4)]' : 'border-red-600 grayscale brightness-50'}`}
                    >
                      <Avatar isListening={isEvaActive} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
                    </div>
                    <div className="flex flex-col">
                       <span className="text-5xl font-black italic tracking-tighter leading-none">{new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
                       <span className="text-[9px] font-black text-blue-500 tracking-[0.2em] mt-2 uppercase">V800 SENTINEL ACTIVE</span>
                    </div>
                  </div>
               </footer>
            </aside>
          )}

          {/* ÁREA DE CONTEÚDO (DIREITA) */}
          <main className="flex-1 relative bg-black flex flex-col overflow-hidden">
             
             {/* BOTÕES TÁTICOS (EXTREMA DIREITA) */}
             <div className="absolute top-10 right-10 z-[1000] flex flex-col gap-5">
                <button onClick={() => { setActiveTab('MAP'); setIsFullscreen(!isFullscreen); }} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl transition-all ${activeTab === 'MAP' ? 'bg-blue-600 shadow-2xl' : 'bg-black/60 backdrop-blur-3xl border border-white/10 opacity-60'}`}><i className="fas fa-location-dot"></i></button>
                <button onClick={() => setActiveTab('MEDIA')} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl transition-all ${activeTab === 'MEDIA' ? 'bg-red-600 shadow-2xl' : 'bg-black/60 backdrop-blur-3xl border border-white/10 opacity-60'}`}><i className="fas fa-play"></i></button>
                <button onClick={() => setActiveTab('CAR')} className={`w-20 h-20 rounded-[30px] flex items-center justify-center text-3xl transition-all ${activeTab === 'CAR' ? 'bg-emerald-600 shadow-2xl' : 'bg-black/60 backdrop-blur-3xl border border-white/10 opacity-60'}`}><i className="fas fa-car-side"></i></button>
                <div className="h-px w-full bg-white/10 my-2"></div>
                <button onClick={() => setMapLayer(mapLayer === 'DARK' ? 'SATELLITE' : 'DARK')} className="w-20 h-20 rounded-[30px] bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl"><i className="fas fa-layer-group"></i></button>
                <button onClick={() => setMapMode(mapMode === '3D' ? '2D' : '3D')} className="w-20 h-20 rounded-[30px] bg-black/40 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl font-black">{mapMode}</button>
             </div>

             <div className="flex-1 relative">
                {activeTab === 'MAP' && (
                  <MapView 
                    travel={travel} currentPosition={currentPos} heading={heading} 
                    isFullScreen={isFullscreen} mode={mapMode} layer={mapLayer} zoom={18} 
                    suggestedStops={[]} onUpdateMetrics={handleUpdateMetrics} 
                  />
                )}
                {activeTab === 'MEDIA' && (
                  <EntertainmentHub speed={speed} status="READY" error={null} currentApp={media.app} track={media.metadata} onControl={()=>{}} onMinimize={()=>setActiveTab('MAP')} />
                )}
                {activeTab === 'CAR' && (
                  <div className="h-full w-full flex items-center justify-center bg-zinc-950 p-20">
                     <div className="max-w-4xl w-full"><BluelinkPanel status={{isLocked:true, isEngineRunning:false, areWindowsOpen:false, hazardActive:false, isUpdating:false}} onAction={()=>{}} /></div>
                  </div>
                )}
             </div>

             {/* INFO-STRIP INFERIOR (WAZE STYLE) */}
             <div className="h-32 bg-[#050505] border-t border-white/5 flex items-center justify-between px-16 z-[500] shrink-0">
                <div className="flex items-end gap-20">
                   <div className="flex flex-col">
                      <span className="text-[11px] font-black text-blue-500 tracking-[0.6em] mb-1">CHEGADA</span>
                      <span className="text-7xl font-black italic tracking-tighter text-white">{travel.arrivalTime}</span>
                   </div>
                   <div className="h-16 w-px bg-white/10"></div>
                   <div className="flex flex-col">
                      <span className="text-[11px] font-black text-white/30 tracking-[0.6em] mb-1 uppercase">{Math.floor(travel.drivingTimeMinutes/60)}H {travel.drivingTimeMinutes % 60}MIN RESTANTE</span>
                      <span className="text-7xl font-black italic tracking-tighter text-blue-600">{travel.totalDistanceKm} <span className="text-3xl">KM</span></span>
                   </div>
                </div>

                <div className="flex items-center gap-8">
                   <button onClick={() => setIsSearchOpen(true)} className="w-24 h-24 rounded-[40px] bg-white text-black flex items-center justify-center text-5xl shadow-2xl active:scale-90 transition-all"><i className="fas fa-search"></i></button>
                </div>
             </div>
          </main>
        </>
      )}

      <AddStopModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onAdd={(n, la, ln) => { setTravel(t => ({...t, destination: n, destinationCoords: [la, ln]})); setIsSearchOpen(false); }} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={MEDIA_APPS} />
    </div>
  );
};

export default App;
