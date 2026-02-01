
import React, { useState, useEffect, useRef } from 'react';
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
      description: 'Busca coordenadas de um local.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'navigation_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Define destinos ou adiciona paradas.',
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
    name: 'communication_action',
    parameters: {
      type: Type.OBJECT,
      description: 'WhatsApp e Chamadas Telefônicas.',
      properties: {
        type: { type: Type.STRING, enum: ['CALL', 'WHATSAPP_SEND', 'WHATSAPP_READ'] },
        target: { type: Type.STRING },
        content: { type: Type.STRING }
      },
      required: ['type', 'target']
    }
  },
  {
    name: 'media_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Controle de Mídia e Streaming.',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'ytmusic', 'youtube', 'netflix'] },
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'SEARCH', 'NEXT', 'PREV'] },
        query: { type: Type.STRING }
      },
      required: ['appId', 'action']
    }
  },
  {
    name: 'car_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Execução direta Bluelink.',
      properties: { command: { type: Type.STRING, enum: ['LOCK', 'UNLOCK', 'START', 'STOP', 'WINDOWS_UP', 'WINDOWS_DOWN', 'HAZARD_LIGHTS'] } },
      required: ['command']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isCollisionRisk, setIsCollisionRisk] = useState(false);
  const [driveTimeCounter, setDriveTimeCounter] = useState(0);
  
  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ELIVAM', voiceVolume: 90, privacyMode: false, hideSenderInfo: false,
    messageLimit: 128, safetyDistance: 15, alertVoiceEnabled: true
  });

  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: 'READY', isEngineRunning: false, areWindowsOpen: false, isLocked: true, isUpdating: false, hazardActive: false
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, weatherStatus: 'SINCRONIZANDO...', floodRisk: 'LOW'
  });
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA CORE V160', artist: 'PANDORA', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  // GPS REAL & PROATIVIDADE DE RADARES (MESMO SEM ROTA)
  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      const speed = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
      setCurrentPos([lat, lng]);
      setCurrentSpeed(speed);

      // Radar Virtual Próximo (Simulação de POI em tempo real)
      if (speed > 40 && travel.warnings.length === 0) {
        setTravel(prev => ({
          ...prev,
          warnings: [{ id: 'radar-local', type: 'RADAR', distance: 300, description: 'RADAR FIXO 60KM/H - PERÍMETRO ATUAL', coords: [lat + 0.001, lng + 0.001], speedLimit: 60 }]
        }));
      }
    }, null, { enableHighAccuracy: true });

    const driveTimer = setInterval(() => {
      setDriveTimeCounter(prev => prev + 1);
    }, 60000); // Incrementa a cada minuto

    return () => {
      navigator.geolocation.clearWatch(geo);
      clearInterval(driveTimer);
    };
  }, [travel.warnings.length]);

  // PROTOCOLO ANTI-FADIGA
  useEffect(() => {
    if (driveTimeCounter >= 120) { // 2 horas de direção
       // EVA sugeriria parada aqui via lógica de Live API
    }
  }, [driveTimeCounter]);

  const requestAllPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      navigator.geolocation.getCurrentPosition(() => {});
      startVoiceSession();
    } catch (e) {
      console.error("Permissões negadas.");
      startVoiceSession();
    }
  };

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;

    if (fc.name === 'search_place') {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query)}&limit=3`);
      const data = await res.json();
      return { locations: data.map((d: any) => ({ name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })) };
    }

    if (fc.name === 'navigation_control') {
      if (args.type === 'SET_DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name, destinationCoords: [args.lat, args.lng], stops: [] }));
        return { result: `DESTINO ${args.name} CONFIGURADO NO GPS.` };
      }
      if (args.type === 'ADD_STOP') {
        setTravel(p => ({ ...p, stops: [...p.stops, { id: Date.now().toString(), name: args.name, type: 'REST', coords: [args.lat, args.lng] }] }));
        return { result: "PARADA ADICIONADA AO TRAJETO." };
      }
    }

    if (fc.name === 'communication_action') {
      const app = args.type === 'CALL' ? APP_DATABASE.find(a => a.id === 'phone') : APP_DATABASE.find(a => a.id === 'whatsapp');
      if (app) {
        let url = app.scheme;
        if (args.type === 'WHATSAPP_SEND') url += `?text=${encodeURIComponent(args.content || '')}`;
        else if (args.type === 'CALL') url += args.target;
        window.open(url, '_blank');
      }
      return { result: "AÇÃO DE COMUNICAÇÃO EXECUTADA." };
    }

    if (fc.name === 'car_control') {
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
      }, 500);
      return { result: `COMANDO ${args.command} EXECUTADO VIA BLUELINK.` };
    }

    if (fc.name === 'media_action') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      setCurrentApp(app);
      if (args.action === 'OPEN' || args.action === 'SEARCH') {
        setMediaState('FULL');
        window.open(app.scheme + encodeURIComponent(args.query || ''), '_blank');
      }
      return { result: `APP ${app.name} ATIVADO.` };
    }

    return { result: "OK" };
  };

  const startVoiceSession = async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
              sessionPromise.then(s => { sessionRef.current = s; s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }); }); 
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
          MISSÃO: SEGURANÇA TOTAL DE ELIVAM MARTINS.
          1. RADAR E POLÍCIA: Avise vocalmente sobre radares e viaturas mesmo sem rota ativa.
          2. COMUNICAÇÃO: Controle WhatsApp e Telefone. Se Elivam pedir para ligar, use 'communication_action'.
          3. FADIGA: Se o motorista estiver dirigindo por muito tempo, sugira paradas de café ou descanso.
          4. VEÍCULO: Use 'car_control' para Bluelink imediato.
          5. MÍDIA: Controle players de vídeo (YouTube/Netflix) liberados em movimento.`
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
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 italic text-white animate-fade-in">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center shadow-2xl">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-microchip text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-3xl font-black mb-4 uppercase tracking-tighter">EVA CORE V160</h1>
         <p className="text-white/40 mb-10 text-[10px] tracking-[0.4em] font-bold text-center">AGUARDANDO AUTORIZAÇÃO DE PROTOCOLO</p>
         <button onClick={requestAllPermissions} className="h-20 px-12 bg-blue-600 rounded-[35px] font-black uppercase shadow-[0_0_50px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all active:scale-95">Autorizar & Sincronizar</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD DE EMERGÊNCIA / FADIGA */}
      {driveTimeCounter > 120 && (
         <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[5000] bg-orange-600 px-8 py-3 rounded-full flex items-center gap-4 animate-bounce shadow-2xl">
            <i className="fas fa-coffee"></i>
            <span className="text-xs font-black">SUGESTÃO: PAUSA PARA DESCANSO</span>
         </div>
      )}

      {/* PAINEL LATERAL HUD */}
      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[38%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className={`text-[8rem] font-black leading-none tracking-tighter transition-colors ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-blue-500 tracking-[0.4em]">KM/H • EVA LIVE</span>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               </div>
            </div>
            <div className="flex flex-col gap-4">
               <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.5)]' : 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 self-end rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40"><i className="fas fa-cog"></i></button>
            </div>
         </header>

         <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
            <BluelinkPanel status={carStatus} onAction={(a) => handleSystemAction({name: 'car_control', args: {command: a}})} />
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
         </div>

         <footer className="h-24 pt-4 shrink-0 border-t border-white/5">
            <MiniPlayer app={currentApp} metadata={track} onControl={() => {}} onExpand={() => setMediaState('FULL')} transparent />
         </footer>
      </aside>

      {/* ÁREA DE MAPA E CONTEÚDO */}
      <main className="flex-1 relative bg-zinc-900">
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
           <div className="absolute top-10 right-10 w-[400px] h-[240px] z-[200] animate-fade-in shadow-2xl">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} onControl={() => {}} />
           </div>
         )}
      </main>

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          if (travel.destination === 'SEM DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] }]}));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
