
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, MediaViewState, AppSettings, CarStatus, StopInfo, RouteWarning, RouteSegment, RouteStep } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import EntertainmentHub from './components/EntertainmentHub';
import SettingsMenu from './components/SettingsMenu';
import BluelinkPanel from './components/BluelinkPanel';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://wa.me/' },
  { id: 'phone', name: 'Telefone', icon: 'fas fa-phone-alt', color: 'text-blue-500', category: 'COMM', scheme: 'tel:' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca coordenadas reais de um local para navegação.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'navigation_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla a rota do GPS.',
      properties: {
        type: { type: Type.STRING, enum: ['SET_DESTINATION', 'ADD_STOP', 'CLEAR_ROUTE'] },
        name: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER }
      },
      required: ['type']
    }
  },
  {
    name: 'media_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre e controla apps de música e vídeo.',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'ytmusic', 'youtube', 'netflix'] },
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'SEARCH'] },
        query: { type: Type.STRING }
      },
      required: ['appId', 'action']
    }
  },
  {
    name: 'car_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Comandos remotos Bluelink.',
      properties: { command: { type: Type.STRING, enum: ['LOCK', 'UNLOCK', 'START', 'STOP', 'WINDOWS_UP', 'WINDOWS_DOWN', 'HAZARD_LIGHTS'] } },
      required: ['command']
    }
  }
];

const App: React.FC = () => {
  // Estados de Sistema
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  // Telemetria Real
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isCollisionRisk, setIsCollisionRisk] = useState(false);
  
  // Configurações & Status
  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ELIVAM', voiceVolume: 90, privacyMode: false, hideSenderInfo: false,
    messageLimit: 128, safetyDistance: 15, alertVoiceEnabled: true
  });

  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: 'IDLE', isEngineRunning: false, areWindowsOpen: false, isLocked: true, isUpdating: false, hazardActive: false
  });

  // Navegação & Rota
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, weatherStatus: 'CÉU LIMPO', floodRisk: 'LOW'
  });
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);

  // Mídia
  const [track, setTrack] = useState<TrackMetadata>({ title: 'STANDBY', artist: 'PANDORA CORE', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // GPS LIVE SYNC
  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      const speed = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
      setCurrentPos([lat, lng]);
      setCurrentSpeed(speed);
      
      // Lógica de Risco de Colisão (Simulada baseada em velocidade e distância de segurança)
      if (speed > 80 && settings.safetyDistance < 20) setIsCollisionRisk(true);
      else setIsCollisionRisk(false);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watch);
  }, [settings.safetyDistance]);

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;

    if (fc.name === 'search_place') {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query)}&limit=3`);
        const data = await res.json();
        return { locations: data.map((d: any) => ({ name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })) };
      } catch (e) { return { error: "Erro de conexão com satélite." }; }
    }

    if (fc.name === 'navigation_control') {
      if (args.type === 'SET_DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name, destinationCoords: [args.lat, args.lng], stops: [] }));
        return { status: "ROTA CALCULADA. INICIANDO TRAJETO." };
      }
      if (args.type === 'ADD_STOP') {
        setTravel(p => ({ ...p, stops: [...p.stops, { id: Date.now().toString(), name: args.name, type: 'REST', coords: [args.lat, args.lng] }] }));
        return { status: "PARADA INSERIDA NO PERCURSO." };
      }
    }

    if (fc.name === 'media_control') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      setCurrentApp(app);
      setMediaState('FULL');
      let url = app.scheme;
      if (args.query) url += encodeURIComponent(args.query);
      window.open(url, '_blank');
      setTrack({ title: args.query || 'REPRODUZINDO', artist: app.name, isPlaying: true, progress: 5 });
      return { result: `EXECUTANDO ${app.name.toUpperCase()}` };
    }

    if (fc.name === 'car_action') {
      setCarStatus(prev => ({ ...prev, isUpdating: true }));
      setTimeout(() => {
        setCarStatus(prev => {
          const s = { ...prev, isUpdating: false, lastAction: args.command };
          if (args.command === 'LOCK') s.isLocked = true;
          if (args.command === 'UNLOCK') s.isLocked = false;
          if (args.command === 'START') s.isEngineRunning = true;
          if (args.command === 'STOP') s.isEngineRunning = false;
          return s;
        });
      }, 1000);
      return { result: "PROTOCOLO EXECUTADO." };
    }
    return { result: "OK" };
  };

  const startVoiceSession = async () => {
    if (isListening) return;
    try {
      if (!(await (window as any).aistudio.hasSelectedApiKey())) {
        await (window as any).aistudio.openSelectKey();
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!outputCtxRef.current) outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setIsSystemBooted(true);
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => { 
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) })); 
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
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
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer; source.connect(outputCtxRef.current.destination);
              source.onended = () => { sourcesRef.current.delete(source); if(sourcesRef.current.size === 0) setIsSpeaking(false); };
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `VOCÊ É A PANDORA EVA V160. CO-PILOTO PROATIVA.
          DIRETRIZES:
          1. NAVEGAÇÃO: Use 'search_place' e 'navigation_control'. Informe o trajeto curva-a-curva se solicitado.
          2. PROATIVIDADE: Relate radares e polícia proativamente. Monitore a velocidade de Elivam.
          3. MÍDIA: Controle Spotify e apps de vídeo sem travas.
          4. SEGURANÇA: Se o risco de colisão estiver alto, avise por voz imediatamente.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  };

  const updateRouteData = (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => {
    setRouteSteps(steps);
    setTravel(p => ({ ...p, drivingTimeMinutes: duration, totalDistanceKm: distance }));
  };

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 italic text-white">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-car-side text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-3xl font-black mb-8 uppercase tracking-tighter">PANDORA CORE V160</h1>
         <button onClick={startVoiceSession} className="h-20 px-12 bg-blue-600 rounded-[35px] font-black uppercase shadow-[0_0_50px_rgba(37,99,235,0.4)]">Vincular EVA Protocol</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {isCollisionRisk && (
        <div className="fixed inset-0 z-[5000] border-[15px] border-red-600 animate-pulse pointer-events-none flex items-center justify-center">
           <div className="bg-red-600 px-12 py-6 rounded-full font-black text-2xl shadow-2xl">MANTENHA DISTÂNCIA SEGURA</div>
        </div>
      )}

      {/* PAINEL LATERAL (HUD) */}
      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[40%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className={`text-[8rem] font-black leading-none tracking-tighter transition-colors ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <span className="text-[11px] font-black text-blue-500 tracking-[0.4em]">KM/H • V160 LIVE</span>
            </div>
            <div className="flex flex-col gap-4">
               <div onClick={startVoiceSession} className={`w-20 h-20 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'border-blue-500'}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 self-end rounded-2xl bg-white/5 flex items-center justify-center text-white/40"><i className="fas fa-cog"></i></button>
            </div>
         </header>

         <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar">
            <BluelinkPanel status={carStatus} onAction={(a) => handleSystemAction({name: 'car_action', args: {command: a}})} />
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
         </div>

         <footer className="h-24 pt-4 shrink-0">
            <MiniPlayer app={currentApp} metadata={track} onControl={() => {}} onExpand={() => setMediaState('FULL')} transparent />
         </footer>
      </aside>

      {/* MAPA & MULTIMÍDIA */}
      <main className="flex-1 relative">
         <MapView 
           travel={travel} 
           currentPosition={currentPos} 
           isFullScreen={mapFullScreen}
           onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)}
           onRouteUpdate={updateRouteData}
         />
         
         {mediaState === 'FULL' && (
           <div className="absolute inset-0 z-[1000] bg-black animate-fade-in">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} onMinimize={() => setMediaState('PIP')} onClose={() => setMediaState('HIDDEN')} onControl={() => {}} />
           </div>
         )}

         {mediaState === 'PIP' && (
           <div className="absolute top-10 right-10 w-[380px] h-[220px] z-[200] animate-fade-in shadow-2xl">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} onControl={() => {}} />
           </div>
         )}
      </main>

      {/* MODAIS */}
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          if (travel.destination === 'AGUARDANDO DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] }]}));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
