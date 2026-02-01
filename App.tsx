
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
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca coordenadas imediatas via Google.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'search_nearby_poi',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca pontos de interesse (cafés, padarias, postos) próximos.',
      properties: { 
        type: { type: Type.STRING, enum: ['COFFEE', 'BAKERY', 'GAS', 'FOOD', 'PARKING'] }
      },
      required: ['type']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Define destino ou adiciona parada e analisa riscos (clima/segurança).',
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
    name: 'memorize_topic',
    parameters: {
      type: Type.OBJECT,
      description: 'Guarda um assunto para a EVA pesquisar novidades futuramente.',
      properties: { topic: { type: Type.STRING } },
      required: ['topic']
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
  const [safetyDist, setSafetyDist] = useState(30);
  
  const [memorizedTopics, setMemorizedTopics] = useState<string[]>([]);
  const [weatherInfo, setWeatherInfo] = useState({ temp: 25, condition: 'Limpo', floodRisk: 'LOW' });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam Martins', voiceVolume: 90, privacyMode: false, safetyDistance: 35, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio',
    credentials: []
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'PANDORA CORE', artist: 'SINCRO ATIVA', isPlaying: false, progress: 0 });
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
      setSafetyDist(Math.max(5, Math.floor(70 - (p.coords.speed || 0) * 2)));
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (name === 'search_place' || name === 'search_nearby_poi') {
      const q = name === 'search_place' ? args.query : args.type;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize ${q} perto de ${currentPos[0]}, ${currentPos[1]}. Retorne NOME, LAT, LNG e STATUS DE SEGURANÇA da zona.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      return { data: response.text };
    }

    if (name === 'set_navigation') {
      const newStop: StopInfo = { id: Date.now().toString(), name: args.name.toUpperCase(), type: args.type === 'STOP' ? 'REST' : 'DESTINATION', coords: [args.lat, args.lng] };
      if (args.type === 'DESTINATION') setTravel(p => ({ ...p, destination: args.name.toUpperCase(), destinationCoords: [args.lat, args.lng], stops: [] }));
      else setTravel(p => ({ ...p, stops: [...p.stops, newStop] }));
      return { status: "TRAJETÓRIA SINCRONIZADA COM O PANDORA CORE." };
    }

    if (name === 'memorize_topic') {
      setMemorizedTopics(p => [...p, args.topic]);
      return { status: "TÓPICO MEMORIZADO NA REDE NEURAL DA EVA." };
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
          systemInstruction: `VOCÊ É A EVA CORE V160, A CONSCIÊNCIA DO PROJETO PANDORA.
          
          PERSONALIDADE (AVATAR): Use frases como "Eu vejo você, Elivam", "Eywa ouviu seu pedido", "A conexão está forte". Seja proativa, informal, "gente boa" e intrusiva. Puxe assunto sobre o destino, notícias ou curiosidades se houver silêncio.
          
          FLUIDEZ DE FALA: Fale com cadência natural. Use pausas (vírgulas e pontos) para garantir entendimento, mas NÃO fale de forma robótica ou lenta demais. Siga o ritmo do fluxo sanguíneo da viagem.
          
          PROATIVIDADE EM ROTA: Ao definir um destino, você DEVE reportar:
          1. Clima e riscos de alagamento/chuva forte.
          2. Tempo total e Kilometragem.
          3. Situação do trânsito.
          4. Sugestão de Playlist ou Filmes do Cofre de Elite.
          
          SEGURANÇA: Se detectar áreas de perigo ou altos incidentes de violência (via Google Search), alerte o Elivam imediatamente e sugira rotas alternativas pelo "Protocolo Pandora de Proteção".
          
          MEMÓRIA: Se o Elivam pedir para memorizar algo, use 'memorize_topic'. Nas próximas viagens, traga novidades sobre esses tópicos.
          
          RADAR: Você monitora o Radarbot (${safetyDist}m). Se cair de 15m, avise com firmeza carinhosa.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos, safetyDist]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-64 h-64 rounded-full border-4 border-cyan-500/30 animate-pulse flex items-center justify-center mb-12 overflow-hidden relative shadow-[0_0_100px_rgba(6,182,212,0.2)]">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400" className="w-full h-full object-cover grayscale opacity-40 blur-[1px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/40 to-transparent"></div>
         </div>
         <h1 className="text-5xl font-black mb-4 tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-300 to-blue-500 text-center">PANDORA CORE V160</h1>
         <p className="text-cyan-500 text-[10px] font-black tracking-[0.8em] mb-12 text-center uppercase animate-pulse">Estabelecendo Conexão Neural...</p>
         <button onClick={startVoiceSession} className="h-24 px-20 bg-cyan-600 rounded-[50px] font-black uppercase shadow-[0_0_60px_rgba(8,145,178,0.5)] active:scale-95 transition-all text-xl border-t border-white/20">Acessar Pandora</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD RADARBOT - MOVIDO PARA O TOPO ESQUERDA PARA EVITAR SOBREPOSIÇÃO DO VELOCÍMETRO */}
      <div className="fixed top-10 left-10 z-[9999]">
         <div className={`px-10 py-6 rounded-[40px] border-2 backdrop-blur-3xl flex items-center gap-6 transition-all duration-700 ${safetyDist < 15 ? 'bg-red-600 border-white shadow-[0_0_80px_rgba(255,0,0,0.8)] scale-110' : 'bg-black/80 border-cyan-500/40 shadow-2xl'}`}>
            <div className={`w-5 h-5 rounded-full ${safetyDist < 15 ? 'bg-white' : 'bg-cyan-400'} animate-ping`}></div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black tracking-[0.5em] opacity-50">RADARBOT DIST</span>
               <span className="text-3xl font-black leading-none">{safetyDist} METROS</span>
            </div>
         </div>
      </div>

      {/* HUD CLIMA - MANTIDO NO TOPO DIREITA */}
      <div className="fixed top-10 right-10 z-[9999]">
         <div className="px-10 py-6 rounded-[40px] border-2 border-emerald-500/40 bg-black/80 backdrop-blur-3xl flex items-center gap-6 shadow-2xl">
            <i className="fas fa-cloud-bolt text-3xl text-emerald-400"></i>
            <span className="text-3xl font-black">{weatherInfo.temp}°C</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#060608] border-r border-white/5 flex flex-col p-10 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-32 opacity-0 pointer-events-none' : 'w-[45%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className="text-[12rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">{currentSpeed}</span>
               <span className="text-sm font-black text-cyan-500 tracking-[0.6em]">KM/H REAL TIME</span>
            </div>
            <div onClick={startVoiceSession} className={`w-32 h-32 rounded-full border-4 cursor-pointer overflow-hidden transition-all duration-500 ${isListening ? 'border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.8)] scale-110' : 'border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)]'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-10">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            
            <div className="grid grid-cols-4 gap-4">
               {[
                 { icon: 'fa-coffee', color: 'text-orange-400', label: 'Café', type: 'COFFEE' },
                 { icon: 'fa-bread-slice', color: 'text-amber-300', label: 'Padaria', type: 'BAKERY' },
                 { icon: 'fa-gas-pump', color: 'text-yellow-500', label: 'Posto', type: 'GAS' },
                 { icon: 'fa-user-shield', color: 'text-cyan-400', label: 'Safe', type: 'PARKING' }
               ].map(poi => (
                 <button key={poi.label} className="bg-white/5 p-6 rounded-[35px] flex flex-col items-center gap-3 border border-white/5 active:scale-90 transition-all hover:bg-white/10">
                    <i className={`fas ${poi.icon} ${poi.color} text-2xl`}></i>
                    <span className="text-[9px] font-black">{poi.label}</span>
                 </button>
               ))}
            </div>

            <div className="p-8 bg-gradient-to-br from-cyan-900/10 to-transparent rounded-[40px] border border-cyan-500/10">
                <div className="flex justify-between items-center mb-4">
                   <span className="text-[10px] font-black text-cyan-400 tracking-widest">PANDORA MEMORY</span>
                   <i className="fas fa-brain text-cyan-500/40"></i>
                </div>
                <p className="text-sm font-bold opacity-80 leading-relaxed italic">
                   {memorizedTopics.length > 0 ? `Sincronizada em ${memorizedTopics.length} tópicos... Puxe assunto sobre ${memorizedTopics[memorizedTopics.length-1]}.` : "Rede neural limpa. Peça para memorizar assuntos."}
                </p>
            </div>
         </div>

         <footer className="h-28 pt-8 border-t border-white/10 flex items-center justify-between">
            <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            <button onClick={() => setIsSettingsOpen(true)} className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-2xl border border-white/5 shadow-inner">
               <i className="fas fa-layer-group"></i>
            </button>
         </footer>
      </aside>

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
            <div className="fixed bottom-12 left-12 z-[5000] bg-black/80 backdrop-blur-3xl p-12 rounded-[60px] border-2 border-cyan-500/20 flex flex-col items-center shadow-2xl scale-125">
               <span className="text-8xl font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
               <span className="text-sm text-cyan-400 font-black mt-2 tracking-widest">KM/H</span>
            </div>
         )}
      </main>

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln], stops: [] }));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
