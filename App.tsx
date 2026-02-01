
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
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
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
      description: 'Busca locais exatos para navegação (Base Google Maps/Waze).',
      properties: { query: { type: Type.STRING }, poi_type: { type: Type.STRING, enum: ['COFFEE', 'FOOD', 'GAS', 'REST'] } },
      required: ['query']
    }
  },
  {
    name: 'media_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Aciona apps de entretenimento. Identifique o nome real do episódio ou música antes de enviar.',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'youtube', 'netflix', 'ytmusic'] },
        action: { type: Type.STRING, enum: ['SEARCH_AND_PLAY', 'OPEN_APP'] },
        refinedQuery: { type: Type.STRING, description: 'O nome exato encontrado pela IA (ex: "The Witcher S02E05")' }
      },
      required: ['appId', 'action', 'refinedQuery']
    }
  },
  {
    name: 'media_playback_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla a reprodução do áudio/vídeo atual.',
      properties: { command: { type: Type.STRING, enum: ['PLAY', 'PAUSE', 'NEXT', 'PREVIOUS'] } },
      required: ['command']
    }
  },
  {
    name: 'communication_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Envia mensagens ou faz ligações.',
      properties: { type: { type: Type.STRING, enum: ['CALL', 'WHATSAPP_SEND'] }, target: { type: Type.STRING }, content: { type: Type.STRING } },
      required: ['type', 'target']
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
  const [safetyDist, setSafetyDist] = useState(30);
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: 'IDLE', isEngineRunning: true, areWindowsOpen: false, isLocked: false, isUpdating: false, hazardActive: false
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam', voiceVolume: 80, privacyMode: false, hideSenderInfo: false,
    messageLimit: 128, safetyDistance: 25, alertVoiceEnabled: true
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'SISTEMA PANDORA', artist: 'EVA CORE V160', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  // Sistema de Telemetria e Segurança Ativa
  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      const speed = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
      setCurrentPos([lat, lng]);
      setCurrentSpeed(speed);
      // Cálculo dinâmico de distância de segurança (simulado para HUD)
      const baseDist = Math.max(8, speed * 1.5);
      setSafetyDist(Math.round(baseDist + Math.random() * 5));
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleControl = (command: 'PLAY' | 'PAUSE' | 'NEXT' | 'PREVIOUS') => {
    setTrack(prev => ({ ...prev, isPlaying: command === 'PLAY' || (command === 'NEXT' && true) }));
    if ('mediaSession' in navigator) {
      if (command === 'PLAY') navigator.mediaSession.playbackState = 'playing';
      if (command === 'PAUSE') navigator.mediaSession.playbackState = 'paused';
    }
  };

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;

    if (fc.name === 'media_playback_control') {
      handleControl(args.command as any);
      return { result: "Controle de mídia executado." };
    }

    if (fc.name === 'media_action') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      setCurrentApp(app);
      setMediaState('FULL');
      const query = args.refinedQuery || '';
      const url = app.scheme + encodeURIComponent(query);
      window.open(url, '_blank');
      setTrack({ title: query, artist: app.name, isPlaying: true, progress: 10 });
      return { result: `Reproduzindo: ${query} no ${app.name}.` };
    }

    if (fc.name === 'search_place') {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query)}&limit=5`);
      const data = await res.json();
      return { locations: data.map((d: any) => ({ name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })) };
    }

    if (fc.name === 'communication_action') {
      let url = "";
      if (args.type === 'WHATSAPP_SEND') {
        const phone = args.target.replace(/\D/g, '');
        url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(args.content || '')}`;
      } else {
        url = `tel:${args.target.replace(/\D/g, '')}`;
      }
      window.open(url, '_blank');
      return { result: "Aplicação de comunicação aberta com sucesso." };
    }

    if (fc.name === 'navigation_control') {
      if (args.type === 'SET_DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name, destinationCoords: [args.lat, args.lng] }));
        return { result: "Destino configurado na navegação." };
      }
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
          PERSONA: Amiga de longa data, inteligente, nunca acanhada. Sua missão é tirar o estresse do motorista.
          MOTOR DE MÍDIA: Quando Elivam pedir uma série/episódio/música, use sua inteligência para encontrar o NOME REAL do conteúdo (ex: "Episódio 3 da Temporada 2 de The Boys" vira "The Boys S02E03") e chame 'media_action' com o 'refinedQuery'.
          PROATIVIDADE: Se o trânsito estiver lento ou se Elivam estiver calado por muito tempo, puxe assunto sobre notícias, curiosidades ou sugira uma música/vídeo.
          NAVEGAÇÃO: Use a base do Google Maps/Waze para encontrar endereços exatos. Sugira paradas de 5km apenas se o destino for longo (>50km) e houver pontos de interesse REAIS no caminho.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center shadow-2xl">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-satellite-dish text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">PANDORA CORE</h1>
         <p className="text-white/40 mb-10 text-[11px] tracking-[0.6em] font-bold">RECONECTANDO SISTEMA EVA V160</p>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase shadow-[0_0_60px_rgba(37,99,235,0.5)] active:scale-95 transition-all">Sincronizar Protocolo</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD RADAR DE SEGURANÇA (DISTÂNCIA DO CARRO À FRENTE) */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000]">
         <div className={`px-8 py-3 rounded-full border border-white/10 backdrop-blur-3xl flex items-center gap-5 transition-all ${safetyDist < 15 ? 'bg-red-600 shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-pulse' : 'bg-black/80'}`}>
            <i className={`fas fa-car-side ${safetyDist < 15 ? 'text-white' : 'text-blue-500'}`}></i>
            <span className="text-sm font-black tracking-[0.2em]">{safetyDist}M DISTÂNCIA SEGURA</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[38%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className={`text-[8rem] font-black leading-none tracking-tighter ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <span className="text-[11px] font-black text-blue-500 tracking-[0.4em]">KM/H • EVA SYNC</span>
            </div>
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.5)]' : 'border-blue-500 shadow-xl'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
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
            <BluelinkPanel status={carStatus} onAction={() => {}} />
         </div>

         <footer className="h-24 pt-4 border-t border-white/5">
            <MiniPlayer app={currentApp} metadata={track} onControl={handleControl} onExpand={() => setMediaState('FULL')} transparent />
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-900">
         <MapView travel={travel} currentPosition={currentPos} isFullScreen={mapFullScreen} onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} onRouteUpdate={(steps, dur, dist, segs) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist, segments: segs}))} />
         
         {mediaState === 'FULL' && (
           <div className="absolute inset-0 z-[1000] bg-black animate-fade-in">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} onMinimize={() => setMediaState('HIDDEN')} onClose={() => setMediaState('HIDDEN')} onControl={handleControl} />
           </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          if (travel.destination === 'SEM DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] }]}));
          setIsAddStopModalOpen(false);
      }} />

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
    </div>
  );
};

export default App;
