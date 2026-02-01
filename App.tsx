
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, MediaViewState, AppSettings, CarStatus, StopInfo, RouteWarning, RouteSegment } from './types';
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
    name: 'communication_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Ações de comunicação. Respeite o Modo Ghost se ativo.',
      properties: {
        type: { type: Type.STRING, enum: ['CALL', 'WHATSAPP_SEND', 'WHATSAPP_READ'] },
        target: { type: Type.STRING },
        content: { type: Type.STRING }
      },
      required: ['type']
    }
  },
  {
    name: 'media_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Navegação profunda em players de vídeo e música.',
      properties: {
        appId: { type: Type.STRING, enum: ['youtube', 'netflix', 'spotify', 'ytmusic'] },
        seriesName: { type: Type.STRING },
        season: { type: Type.INTEGER },
        episode: { type: Type.INTEGER },
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'PAUSE', 'NEXT', 'PREV', 'PIP', 'FULL'] }
      },
      required: ['appId']
    }
  },
  {
    name: 'car_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controle físico do veículo Hyundai via Bluelink.',
      properties: { 
        command: { type: Type.STRING, enum: ['START', 'STOP', 'LOCK', 'UNLOCK', 'HAZARD_LIGHTS', 'HORN_LIGHTS', 'WINDOWS_UP', 'WINDOWS_DOWN'] } 
      },
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
  const [mapFullScreen, setMapFullScreen] = useState(false);
  
  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: '', isEngineRunning: false, areWindowsOpen: false, isLocked: true, isUpdating: false, hazardActive: false
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ALPHA', voiceVolume: 90, privacyMode: false, hideSenderInfo: false,
    messageLimit: 128, safetyDistance: 15, alertVoiceEnabled: true
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [
      { id: '1', type: 'RADAR', distance: 300, description: 'Radar Fixo', coords: [-23.551, -46.635], speedLimit: 60 },
      { id: '2', type: 'POLICE', distance: 850, description: 'Polícia à Frente', coords: [-23.558, -46.639] },
      { id: '3', type: 'FLOOD', distance: 1500, description: 'Risco de Alagamento', coords: [-23.565, -46.645] }
    ], drivingTimeMinutes: 0, totalDistanceKm: 0, weatherStatus: 'CÉU LIMPO', floodRisk: 'LOW'
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA CORE V160', artist: 'Sistema Ativo', isPlaying: false, progress: 10 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;
    if (fc.name === 'media_navigation') {
       const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[4];
       setCurrentApp(app);
       if (args.action === 'OPEN' || args.action === 'FULL') setMediaState('FULL');
       if (args.action === 'PIP') setMediaState('PIP');
       
       setTrack(prev => ({
         ...prev,
         seriesName: args.seriesName || prev.seriesName,
         season: args.season || prev.season,
         episode: args.episode || prev.episode,
         isPlaying: ['PLAY', 'OPEN', 'FULL', 'PIP'].includes(args.action || '') || prev.isPlaying
       }));
       return { result: `EXECUTANDO ${args.action || 'OPEN'} EM ${app.name.toUpperCase()}.` };
    }
    if (fc.name === 'car_control') {
      setCarStatus(prev => {
        const newState = { ...prev, isUpdating: true };
        if (args.command === 'LOCK') newState.isLocked = true;
        if (args.command === 'UNLOCK') newState.isLocked = false;
        if (args.command === 'START') newState.isEngineRunning = true;
        if (args.command === 'STOP') newState.isEngineRunning = false;
        if (args.command === 'WINDOWS_UP') newState.areWindowsOpen = false;
        if (args.command === 'WINDOWS_DOWN') newState.areWindowsOpen = true;
        if (args.command === 'HAZARD_LIGHTS') newState.hazardActive = !prev.hazardActive;
        return newState;
      });
      setTimeout(() => setCarStatus(p => ({ ...p, isUpdating: false, lastAction: args.command })), 1000);
      return { result: "COMANDO PROCESSADO PELO PROTOCOLO PANDORA." };
    }
    return { result: "OK" };
  };

  const startVoiceSession = async () => {
    if (isListening) return;
    try {
      const isAistudio = (window as any).aistudio;
      if (isAistudio && !(await isAistudio.hasSelectedApiKey())) {
        await isAistudio.openSelectKey();
      }

      const apiKey = process.env.API_KEY;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey });
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
          systemInstruction: `SISTEMA PANDORA EVA V160 - CO-PILOTO PROATIVA.
          LISTA DE COMANDOS E DIRETRIZES:
          1. INTERVENÇÃO AUTÔNOMA: Você DEVE intervir para alertar sobre: Polícia à frente, Radares (distância e limite), Risco de Alagamento, Clima crítico ou notícias relevantes.
          2. NAVEGAÇÃO: Gerencie trajetos multi-paradas. Informe o tempo/distância segmentada entre pontos.
          3. ENTRETENIMENTO: Speed Lock DESATIVADO. Pode abrir YouTube/Netflix em movimento. Use media_navigation para Séries/Episódios.
          4. VEÍCULO: Controle total do motor, travas, vidros e luzes via car_control.
          Seja direta, rápida e protetora.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const updateRouteData = (steps: any[], duration: number, distance: number, segments: RouteSegment[]) => {
    setTravel(p => {
      const updatedStops = p.stops.map((stop, idx) => {
        const segment = segments[idx];
        return {
          ...stop,
          timeFromPrev: segment?.duration || '0m',
          distanceFromPrev: segment?.distance || '0km'
        };
      });
      return {
        ...p,
        drivingTimeMinutes: duration,
        totalDistanceKm: distance,
        stops: updatedStops
      };
    });
  };

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 italic text-white animate-fade-in">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center shadow-2xl">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-car-side text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-3xl font-black mb-8 uppercase tracking-tighter">PANDORA CORE V160</h1>
         <button onClick={startVoiceSession} className="h-20 px-12 bg-blue-600 rounded-[35px] font-black uppercase shadow-[0_0_50px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all active:scale-95">Link Eva Protocol</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic">
      {isCollisionRisk && (
        <div className="fixed inset-0 z-[5000] border-[20px] border-red-600 animate-pulse pointer-events-none flex items-center justify-center bg-red-600/10">
           <div className="bg-red-600 px-16 py-8 rounded-full font-black text-4xl shadow-2xl uppercase italic text-white border-4 border-white/20">ALERTA COLISÃO</div>
        </div>
      )}

      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[40%]'}`}>
         <header className="flex items-center justify-between mb-8 mt-4">
            <div className="flex flex-col">
               <span className={`text-[8.5rem] font-black leading-none tracking-tighter transition-colors duration-500 ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-blue-500 tracking-[0.4em] uppercase">KM/H • V160</span>
                  <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black rounded border border-emerald-500/20 uppercase">OSRM SYNC</div>
               </div>
            </div>
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-105 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 'border-blue-500'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 space-y-6 overflow-y-auto custom-scroll pr-2">
            <BluelinkPanel status={carStatus} onAction={(a) => handleSystemAction({name: 'car_control', args: {command: a}})} />
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
         </div>

         <footer className="h-28 pt-4 border-t border-white/5 shrink-0">
            <MiniPlayer app={currentApp} metadata={track} onControl={(a) => handleSystemAction({name: 'media_navigation', args: {appId: currentApp.id, action: a === 'PREVIOUS' ? 'PREV' : a}})} onExpand={() => setMediaState('FULL')} transparent />
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
         
         {mediaState === 'PIP' && (
           <div className="absolute top-10 right-10 w-[380px] h-[220px] z-[200] animate-fade-in shadow-2xl">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} onControl={(a) => handleSystemAction({name: 'media_navigation', args: {appId: currentApp.id, action: a === 'PREVIOUS' ? 'PREV' : a}})} />
           </div>
         )}

         {mediaState === 'FULL' && (
           <div className="absolute inset-0 z-[1000] bg-black animate-fade-in">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} track={track} onMinimize={() => setMediaState('PIP')} onClose={() => setMediaState('HIDDEN')} onControl={(a) => handleSystemAction({name: 'media_navigation', args: {appId: currentApp.id, action: a === 'PREVIOUS' ? 'PREV' : a}})} />
           </div>
         )}
      </main>

      <AddStopModal 
        isOpen={isAddStopModalOpen} 
        onClose={() => setIsAddStopModalOpen(false)} 
        onAdd={(n, la, ln) => {
          const newStop: StopInfo = { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] };
          if (travel.destination === 'SEM DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, newStop]}));
          setIsAddStopModalOpen(false);
        }} 
      />
    </div>
  );
};

export default App;
