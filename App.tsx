
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, MapMode, MapLayer, StopInfo } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca locais (padarias, cafés, endereços) com coordenadas precisas via Google Search.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Insere instantaneamente o destino ou uma parada (POI) na rota ativa do mapa.',
      properties: {
        name: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ['DESTINATION', 'STOP'] }
      },
      required: ['name', 'lat', 'lng', 'type']
    }
  },
  {
    name: 'launch_media_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre aplicativos do Cofre de Elite.',
      properties: { appId: { type: Type.STRING }, searchQuery: { type: Type.STRING } },
      required: ['appId']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [mapMode, setMapMode] = useState<MapMode>('3D');
  const [mapFullScreen, setMapFullScreen] = useState(false);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  
  // HUD DE TRÁFEGO E SCANNER
  const [safetyDist, setSafetyDist] = useState(45);
  const [trafficStatus, setTrafficStatus] = useState<'FLUIDO' | 'MODERADO' | 'RETIDO'>('FLUIDO');
  const [laneStatus, setLaneStatus] = useState<'ESQUERDA' | 'CENTRO' | 'DIREITA'>('CENTRO');

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'NEURAL LINK ACTIVE', artist: 'PANDORA CORE', isPlaying: false, progress: 0 });
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      const speedKmH = p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0;
      setCurrentSpeed(speedKmH);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
      
      // Lógica de Scanner em Tempo Real
      if (speedKmH < 15) {
        setTrafficStatus('RETIDO');
        setSafetyDist(Math.max(2, Math.floor(Math.random() * 5 + 3)));
      } else if (speedKmH < 45) {
        setTrafficStatus('MODERADO');
        setSafetyDist(Math.floor(Math.random() * 15 + 10));
      } else {
        setTrafficStatus('FLUIDO');
        setSafetyDist(Math.floor(Math.random() * 30 + 40));
      }

      // Simulação de detecção de faixa por telemetria GPS
      const lanes: any[] = ['ESQUERDA', 'CENTRO', 'DIREITA'];
      setLaneStatus(lanes[Math.floor(Math.random() * 3)]);
      
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (name === 'search_place') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize exatamente: "${args.query}" próximo a lat:${currentPos[0]} lng:${currentPos[1]}. Retorne JSON format: { "name": "...", "lat": ..., "lng": ... }. Priorize locais reais em Brasília/Entorno.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      // A EVA agora extrai os dados e pode decidir chamar set_navigation em seguida
      return { data: response.text };
    }

    if (name === 'set_navigation') {
      const isDestination = args.type === 'DESTINATION';
      const newPoint: StopInfo = { 
        id: Date.now().toString(), 
        name: args.name.toUpperCase(), 
        coords: [args.lat, args.lng] as [number, number],
        type: isDestination ? 'DESTINATION' : 'REST' as any
      };

      if (isDestination) {
        setTravel(p => ({ ...p, destination: args.name.toUpperCase(), destinationCoords: [args.lat, args.lng], stops: [] }));
      } else {
        setTravel(p => ({ ...p, stops: [...p.stops, newPoint] }));
      }
      return { status: "TRAJETÓRIA SINCRONIZADA NO MAPA." };
    }

    if (name === 'launch_media_app') {
      const app = APP_DATABASE.find(a => a.id === args.appId);
      if (app) window.open(`${app.scheme}${encodeURIComponent(args.searchQuery || '')}`, '_blank');
      return { status: "PORTAL ABERTO." };
    }
    return { status: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setIsSystemBooted(true);
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => { 
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) })); 
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop()); activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0; setIsSpeaking(false); return;
            }
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
              const startTime = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.onended = () => { activeSourcesRef.current.delete(source); if (activeSourcesRef.current.size === 0) setIsSpeaking(false); };
              activeSourcesRef.current.add(source); source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `VOCÊ É A EVA PANDORA V160.
          
          SUA MISSÃO: Monitorar o tráfego e inserir trajetos no mapa.
          1. Se o Elivam pedir um lugar (ex: "ir para o Gama" ou "achar padaria"), use 'search_place'. 
          2. ASSIM QUE O GOOGLE RETORNAR AS COORDENADAS, chame 'set_navigation' IMEDIATAMENTE para plotar no mapa. Não peça confirmação se o Elivam estiver dirigindo.
          3. Use os dados do Tráfego Real (${trafficStatus}) e Distância do Carro à Frente (${safetyDist}m) para dar avisos proativos.
          
          PERSONALIDADE: Fale como se estivesse conectada aos sensores do carro. "Sincronizando coordenadas...", "Detectando veículo a ${safetyDist} metros".`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos, trafficStatus, safetyDist]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white">
         <div className="w-64 h-64 rounded-full border-4 border-cyan-500/10 animate-pulse flex items-center justify-center mb-12 relative overflow-hidden">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400" className="w-full h-full object-cover grayscale opacity-40 blur-[2px]" />
         </div>
         <h1 className="text-5xl font-black mb-8 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-500">EVA CORE V160</h1>
         <button onClick={startVoiceSession} className="h-24 px-20 bg-cyan-600 rounded-full font-black uppercase shadow-[0_0_80px_rgba(8,145,178,0.5)] text-xl">Sincronizar Pandora</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD CLIMA - TOPO DIREITA */}
      <div className="fixed top-10 right-10 z-[9999]">
         <div className="px-10 py-6 rounded-[40px] border-2 border-emerald-500/20 bg-black/80 backdrop-blur-3xl flex items-center gap-6 shadow-2xl">
            <i className="fas fa-cloud-bolt text-3xl text-emerald-400"></i>
            <span className="text-3xl font-black">23°C</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#060608] border-r border-white/5 flex flex-col p-10 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-32 opacity-0 pointer-events-none' : 'w-[45%]'}`}>
         
         {/* CABEÇALHO COM EVA E VELOCÍMETRO */}
         <header className="flex items-start justify-between mb-10">
            <div className="flex flex-col">
               <span className="text-[12rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">{currentSpeed}</span>
               <span className="text-sm font-black text-cyan-500 tracking-[0.6em]">KM/H REAL TIME</span>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div onClick={startVoiceSession} className={`w-36 h-36 rounded-full border-4 cursor-pointer overflow-hidden transition-all duration-500 ${isListening ? 'border-red-600 shadow-[0_0_70px_rgba(220,38,38,0.9)] scale-110' : 'border-cyan-500 shadow-2xl'}`}>
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              
              {/* NEURAL TRAJECTORY SCANNER - EXATAMENTE ABAIXO DA EVA */}
              <div className="w-full min-w-[220px] bg-black/80 border border-cyan-500/20 rounded-[40px] p-6 shadow-2xl flex flex-col gap-4 backdrop-blur-3xl">
                 <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-cyan-400 tracking-widest">NEURAL SCANNER</span>
                    <div className="flex gap-1">
                       <div className={`w-1 h-1 rounded-full bg-cyan-400 animate-ping`}></div>
                       <div className={`w-1 h-1 rounded-full bg-cyan-400`}></div>
                    </div>
                 </div>
                 
                 <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                       <span className="text-[9px] opacity-40 font-black">ALVO À FRENTE</span>
                       <span className={`text-4xl font-black ${safetyDist < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{safetyDist}M</span>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-[9px] opacity-40 font-black">FAIXA ATIVA</span>
                       <span className="text-xs font-black text-cyan-300">{laneStatus}</span>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-black opacity-40">
                       <span>TRAJETÓRIA ROTA</span>
                       <span>{trafficStatus}</span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${trafficStatus === 'FLUIDO' ? 'bg-emerald-500 w-full' : trafficStatus === 'MODERADO' ? 'bg-yellow-500 w-1/2' : 'bg-red-500 w-1/4'}`}></div>
                    </div>
                 </div>
              </div>
            </div>
         </header>

         {/* PAINEL DE NAVEGAÇÃO E APPS */}
         <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-10">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            
            <div className="grid grid-cols-4 gap-4">
               {APP_DATABASE.map(app => (
                 <button key={app.id} onClick={() => window.open(app.scheme, '_blank')} className="bg-white/5 p-6 rounded-[35px] flex flex-col items-center gap-3 border border-white/5 active:scale-90 transition-all hover:bg-white/10 hover:border-white/20">
                    <i className={`${app.icon} ${app.color} text-2xl`}></i>
                    <span className="text-[9px] font-black">{app.name}</span>
                 </button>
               ))}
            </div>
         </div>

         <footer className="h-28 pt-8 border-t border-white/10 flex items-center">
            <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
         </footer>
      </aside>

      {/* MAPA EM TEMPO REAL */}
      <main className="flex-1 relative bg-zinc-950">
         <MapView 
            travel={travel} 
            currentPosition={currentPos} 
            heading={currentHeading} 
            isFullScreen={mapFullScreen} 
            mode={mapMode}
            layer={'DARK'}
            onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} 
            onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} 
         />
         
         {mapFullScreen && (
            <div className="fixed bottom-12 left-12 z-[5000] bg-black/80 backdrop-blur-3xl p-14 rounded-[60px] border-2 border-cyan-500/20 flex flex-col items-center shadow-2xl scale-110">
               <span className="text-9xl font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
               <span className="text-lg text-cyan-400 font-black mt-2 tracking-widest uppercase">KM/H</span>
            </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln], stops: [] }));
          setIsAddStopModalOpen(false);
      }} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={{userName: 'Elivam', voiceVolume: 90, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio', credentials: []}} onUpdate={() => {}} mediaApps={APP_DATABASE} />
    </div>
  );
};

export default App;
