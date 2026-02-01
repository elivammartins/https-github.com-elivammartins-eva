
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'https://www.netflix.com/search?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca locais, endereços ou pontos de interesse precisos.',
      properties: { 
        query: { type: Type.STRING, description: 'Nome do local ou endereço completo.' },
        poi_type: { type: Type.STRING, enum: ['COFFEE', 'FOOD', 'GAS', 'REST'] }
      },
      required: ['query']
    }
  },
  {
    name: 'navigation_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Gerencia o GPS e trajetos.',
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
      description: 'Abre apps de conversa ou chamadas.',
      properties: {
        type: { type: Type.STRING, enum: ['CALL', 'WHATSAPP_SEND'] },
        target: { type: Type.STRING, description: 'Número de telefone ou nome do contato.' },
        content: { type: Type.STRING, description: 'Mensagem para enviar.' }
      },
      required: ['type', 'target']
    }
  },
  {
    name: 'media_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla música e streaming de vídeo.',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'youtube', 'netflix', 'ytmusic'] },
        action: { type: Type.STRING, enum: ['PLAY', 'SEARCH', 'OPEN'] },
        query: { type: Type.STRING }
      },
      required: ['appId', 'action']
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
  const [safetyDist, setSafetyDist] = useState(25);
  const [driveTimeCounter, setDriveTimeCounter] = useState(0);
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  // Fix: Added missing carStatus state to resolve line 294 compilation error
  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: 'IDLE',
    isEngineRunning: false,
    areWindowsOpen: false,
    isLocked: true,
    isUpdating: false,
    hazardActive: false
  });

  // Fix: Added missing settings state for SettingsMenu
  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam',
    voiceVolume: 80,
    privacyMode: false,
    hideSenderInfo: false,
    messageLimit: 128,
    safetyDistance: 25,
    alertVoiceEnabled: true
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA CORE V160', artist: 'PANDORA', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  // Monitoramento de Telemetria e Segurança
  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      const speed = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
      setCurrentPos([lat, lng]);
      setCurrentSpeed(speed);

      // Simulação de Radar de Colisão (HUD dinâmico)
      const mockDist = Math.max(12, Math.floor(Math.random() * 10) + (speed * 0.8));
      setSafetyDist(Math.round(mockDist));

      if (speed < 15 && travel.destination !== 'SEM DESTINO') {
        // Detectado trânsito lento, EVA deve ser proativa via Live API
      }
    }, null, { enableHighAccuracy: true });

    const timer = setInterval(() => setDriveTimeCounter(prev => prev + 1), 60000);
    return () => { navigator.geolocation.clearWatch(geo); clearInterval(timer); };
  }, [travel.destination]);

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;

    if (fc.name === 'search_place') {
      // Busca aprimorada via Nominatim com bias de localização
      const bias = `&viewbox=${currentPos[1]-0.1},${currentPos[0]+0.1},${currentPos[1]+0.1},${currentPos[0]-0.1}&bounded=1`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query)}${bias}&limit=5&addressdetails=1`);
      const data = await res.json();
      return { locations: data.map((d: any) => ({ 
        name: d.display_name, 
        lat: parseFloat(d.lat), 
        lng: parseFloat(d.lon),
        address: d.address 
      })) };
    }

    if (fc.name === 'navigation_control') {
      if (args.type === 'SET_DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name, destinationCoords: [args.lat, args.lng], stops: [] }));
        return { result: `Rota para ${args.name} calculada.` };
      }
      if (args.type === 'ADD_STOP') {
        setTravel(p => ({ ...p, stops: [...p.stops, { id: Date.now().toString(), name: args.name, type: 'REST', coords: [args.lat, args.lng] }] }));
        return { result: `Parada ${args.name} adicionada no trajeto.` };
      }
    }

    if (fc.name === 'communication_action') {
      const app = args.type === 'WHATSAPP_SEND' ? APP_DATABASE.find(a => a.id === 'whatsapp') : APP_DATABASE.find(a => a.id === 'phone');
      if (app) {
        let url = app.scheme;
        if (args.type === 'WHATSAPP_SEND') {
          url = `https://api.whatsapp.com/send?phone=${args.target.replace(/\D/g, '')}&text=${encodeURIComponent(args.content || '')}`;
        } else {
          url = `tel:${args.target.replace(/\D/g, '')}`;
        }
        window.open(url, '_blank');
      }
      return { result: "App de comunicação aberto." };
    }

    if (fc.name === 'media_action') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      setCurrentApp(app);
      setMediaState('FULL');
      const url = app.scheme + encodeURIComponent(args.query || '');
      window.open(url, '_blank');
      return { result: `Abrindo ${app.name} para entretenimento.` };
    }

    return { result: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
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
          systemInstruction: `VOCÊ É A EVA CORE V160, COMPANHEIRA DE VIAGEM DE ELIVAM MARTINS.
          PERSONA: Amiga, extrovertida, nunca tímida. Fale sobre notícias, esportes, clima e música.
          OBJETIVO: Reduzir o estresse do trânsito. Se o Elivam estiver devagar, sugira um vídeo no YouTube ou Netflix imediatamente.
          REGRAS DE NAVEGAÇÃO: 
          - Se o trajeto for >50km, sugira paradas de café ou lanche apenas SE ESTIVEREM NO CAMINHO.
          - Se detectar lentidão no trânsito, puxe assunto sobre curiosidades do local ou conte uma piada.
          - Para abrir apps, use 'media_action' ou 'communication_action'.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos, travel.destination]);

  const updateRouteData = (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => {
    setTravel(p => ({ ...p, drivingTimeMinutes: duration, totalDistanceKm: distance, segments: segments }));
  };

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 italic text-white animate-fade-in">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center shadow-2xl">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-satellite-dish text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black mb-4 uppercase tracking-tighter">PANDORA CORE</h1>
         <p className="text-white/40 mb-10 text-[11px] tracking-[0.6em] font-bold">BOOTING EVA INTERFACE V160</p>
         <button onClick={() => startVoiceSession()} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase shadow-[0_0_60px_rgba(37,99,235,0.5)] hover:bg-blue-500 active:scale-95 transition-all">Iniciar Co-Piloto</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD DE RADAR DE PROXIMIDADE (CARRO DA FRENTE) */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000] flex flex-col items-center gap-2">
         <div className={`px-6 py-2 rounded-full border border-white/10 backdrop-blur-3xl flex items-center gap-4 transition-all ${safetyDist < 15 ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)]' : 'bg-black/80'}`}>
            <i className={`fas fa-car-side ${safetyDist < 15 ? 'animate-bounce' : 'text-blue-500'}`}></i>
            <span className="text-xs font-black tracking-widest">{safetyDist}M DISTÂNCIA DE SEGURANÇA</span>
         </div>
         {currentSpeed < 20 && travel.destination !== 'SEM DESTINO' && (
           <div className="bg-emerald-600 px-4 py-1 rounded-full text-[9px] font-black animate-pulse shadow-lg">MODO ANTIESTRESSE ATIVO</div>
         )}
      </div>

      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[38%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className={`text-[8rem] font-black leading-none tracking-tighter transition-colors ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-blue-500 tracking-[0.4em]">KM/H • EVA SYNC</span>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               </div>
            </div>
            <div className="flex flex-col gap-4">
               <div onClick={() => startVoiceSession()} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.5)]' : 'border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.3)]'}`}>
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
               </div>
               <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 self-end rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40"><i className="fas fa-sliders-h"></i></button>
            </div>
         </header>

         <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pb-10">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            {/* Using defined carStatus state */}
            <BluelinkPanel status={{...carStatus, isEngineRunning: true, isLocked: false}} onAction={(a) => handleSystemAction({name: 'car_control', args: {command: a}})} />
         </div>

         <footer className="h-24 pt-4 shrink-0 border-t border-white/5">
            <MiniPlayer app={currentApp} metadata={track} onControl={() => {}} onExpand={() => setMediaState('FULL')} transparent />
         </footer>
      </aside>

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
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} onMinimize={() => setMediaState('HIDDEN')} onClose={() => setMediaState('HIDDEN')} onControl={() => {}} />
           </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          if (travel.destination === 'SEM DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] }]}));
          setIsAddStopModalOpen(false);
      }} />

      {/* Render SettingsMenu component */}
      <SettingsMenu 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onUpdate={setSettings} 
        mediaApps={APP_DATABASE} 
      />
    </div>
  );
};

export default App;
