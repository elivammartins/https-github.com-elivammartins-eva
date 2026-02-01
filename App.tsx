
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
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-purple-400', category: 'AUDIO', scheme: 'deezer://search?q=' },
  { id: 'applemusic', name: 'Apple Music', icon: 'fab fa-apple', color: 'text-pink-500', category: 'AUDIO', scheme: 'music://search?term=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'disneyplus', name: 'Disney+', icon: 'fas fa-plus', color: 'text-blue-400', category: 'VIDEO', scheme: 'disneyplus://search?q=' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-pink-600', category: 'VIDEO', scheme: 'globoplay://busca/' },
  { id: 'primevideo', name: 'Prime Video', icon: 'fab fa-amazon', color: 'text-blue-300', category: 'VIDEO', scheme: 'primevideo://search?q=' },
  { id: 'max', name: 'Max (HBO)', icon: 'fas fa-m', color: 'text-blue-900', category: 'VIDEO', scheme: 'hbomax://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'skyplus', name: 'SKY+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'skyplus://watch?q=' },
  { id: 'clarotv', name: 'Claro TV+', icon: 'fas fa-play', color: 'text-red-500', category: 'VIDEO', scheme: 'clarotvplus://search?q=' },
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
      description: 'Busca pontos de interesse próximos como cafés, padarias, postos ou restaurantes.',
      properties: { 
        type: { type: Type.STRING, enum: ['COFFEE', 'BAKERY', 'GAS', 'FOOD', 'PARKING'] },
        radius: { type: Type.NUMBER, description: 'Raio de busca em metros. Padrão 2000.' }
      },
      required: ['type']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Traça a rota no mapa para um destino ou adiciona uma parada.',
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
    name: 'map_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla a visão do mapa.',
      properties: {
        mode: { type: Type.STRING, enum: ['2D', '3D', 'SATELLITE', 'STREET', 'FULL_MAP', 'MINI_MAP'] }
      },
      required: ['mode']
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
  const [mapLayer, setMapLayer] = useState<MapLayer>('DARK');
  const [mapFullScreen, setMapFullScreen] = useState(false);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [safetyDist, setSafetyDist] = useState(30);
  
  const [weatherInfo, setWeatherInfo] = useState({ 
    temp: 24, 
    condition: 'Céu Limpo', 
    floodRisk: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam Martins', voiceVolume: 90, privacyMode: false, safetyDistance: 35, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio',
    credentials: []
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'EVA CORE V160', artist: 'PRONTA', isPlaying: false, progress: 0 });
  
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
      const calculatedDist = Math.max(5, Math.floor(65 - (p.coords.speed || 0) * 1.8));
      setSafetyDist(calculatedDist);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (name === 'search_place') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize exatamente: "${args.query}, Brasil". Retorne: LAT: [lat], LNG: [lng].`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const matches = response.text?.match(/(-?\d+\.\d+)/g);
      if (matches && matches.length >= 2) return { name: args.query, lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
      return { error: "Local não encontrado." };
    }

    if (name === 'search_nearby_poi') {
      // Busca pontos próximos baseada na localização atual
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Encontre os 3 melhores ${args.type} próximos às coordenadas ${currentPos[0]}, ${currentPos[1]}. Retorne apenas o nome, a latitude e longitude de cada um.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      // Extrai resultados simplificados para a IA
      return { results: response.text };
    }

    if (name === 'set_navigation') {
      const newStop: StopInfo = { id: Date.now().toString(), name: args.name.toUpperCase(), type: args.type === 'STOP' ? 'REST' : 'DESTINATION', coords: [args.lat, args.lng] };
      
      if (args.type === 'DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name.toUpperCase(), destinationCoords: [args.lat, args.lng], stops: [] }));
      } else {
        setTravel(p => ({ ...p, stops: [...p.stops, newStop] }));
      }
      return { result: "ROTA ATUALIZADA NO MAPA COM SUCESSO." };
    }

    if (name === 'map_control') {
      if (args.mode === 'FULL_MAP') setMapFullScreen(true);
      else if (args.mode === 'MINI_MAP') setMapFullScreen(false);
      else if (args.mode === '2D') setMapMode('2D');
      else if (args.mode === '3D') setMapMode('3D');
      return { result: "OK" };
    }
    return { result: "OK" };
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
              activeSourcesRef.current.forEach(s => s.stop());
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              return;
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
              source.buffer = buffer;
              source.connect(outputCtxRef.current.destination);
              
              const currentTime = outputCtxRef.current.currentTime;
              const startTime = Math.max(nextStartTimeRef.current, currentTime);
              
              source.onended = () => {
                activeSourcesRef.current.delete(source);
                if (activeSourcesRef.current.size === 0) setIsSpeaking(false);
              };
              
              activeSourcesRef.current.add(source);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `VOCÊ É A EVA CORE V160. SUA PRIORIDADE É AUXILIAR O ELIVAM MARTINS NA VIAGEM.
          
          DIRETRIZ DE VOZ: Fale MUITO DEVAGAR. Use pausas gramaticais (pontos, vírgulas, reticências) em cada frase. 
          EXEMPLO: "Elivam... encontrei uma padaria... a dois quilômetros... você quer parar?"
          
          LÓGICA DE POI (PONTOS DE INTERESSE): Você tem acesso à ferramenta 'search_nearby_poi'. Se o Elivam pedir café, comida, ou se você notar que a viagem está longa, use esta ferramenta, apresente as opções e se ele escolher uma, use 'set_navigation' com o tipo 'STOP' para adicionar à rota IMEDIATAMENTE.
          
          REGRAS: 
          1. Se ele pedir para ir a um lugar, use 'search_place' e depois 'set_navigation' (DESTINATION).
          2. Não fale várias coisas ao mesmo tempo. Espere o áudio anterior terminar.
          3. Seja proativa com o clima e radares.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-64 h-64 rounded-full border-4 border-blue-600/30 animate-pulse flex items-center justify-center mb-12 overflow-hidden relative">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400" className="w-full h-full object-cover grayscale opacity-50" />
         </div>
         <h1 className="text-5xl font-black mb-4 tracking-tighter uppercase text-center">PANDORA EVA V160</h1>
         <button onClick={startVoiceSession} className="h-24 px-20 bg-blue-600 rounded-[50px] font-black uppercase shadow-[0_0_50px_rgba(37,99,235,0.4)] active:scale-95 transition-all text-xl">Ativar Co-Piloto</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD RADARBOT - POSICIONADO NO TOPO CENTRO PARA EVITAR SOBREPOSIÇÃO */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[9999]">
         <div className={`px-12 py-5 rounded-[40px] border-2 backdrop-blur-3xl flex items-center gap-8 transition-all duration-700 ${safetyDist < 15 ? 'bg-red-600 border-white shadow-[0_0_80px_rgba(255,0,0,0.8)]' : 'bg-black/80 border-blue-500/40 shadow-2xl'}`}>
            <div className="flex flex-col items-center">
               <span className="text-[9px] font-black tracking-[0.4em] opacity-50">RADARBOT</span>
               <span className="text-4xl font-black leading-none">{safetyDist}M</span>
            </div>
            <div className="w-[1px] h-10 bg-white/10"></div>
            <div className="flex flex-col items-center">
               <span className="text-[9px] font-black tracking-[0.4em] opacity-50">SPEED LIMIT</span>
               <span className="text-4xl font-black leading-none">80</span>
            </div>
         </div>
      </div>

      {/* HUD CLIMA - TOPO DIREITA */}
      <div className="fixed top-10 right-10 z-[9999]">
         <div className="px-10 py-5 rounded-[40px] border-2 border-emerald-500/40 bg-black/80 backdrop-blur-3xl flex items-center gap-6 shadow-2xl">
            <i className="fas fa-cloud-sun text-3xl text-emerald-500"></i>
            <span className="text-3xl font-black">{weatherInfo.temp}°C</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#060608] border-r border-white/5 flex flex-col p-10 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-32 opacity-0 pointer-events-none' : 'w-[45%]'}`}>
         <header className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
               <span className="text-[12rem] font-black leading-none tracking-tighter text-white">{currentSpeed}</span>
               <span className="text-sm font-black text-blue-500 tracking-[0.6em]">KM/H REAL</span>
            </div>
            <div onClick={startVoiceSession} className={`w-32 h-32 rounded-full border-4 cursor-pointer overflow-hidden transition-all duration-500 ${isListening ? 'border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.7)]' : 'border-blue-500 shadow-xl'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-8">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            
            {/* QUICK POI BAR */}
            <div className="grid grid-cols-4 gap-4">
               {[
                 { icon: 'fa-coffee', color: 'text-orange-400', label: 'Café', type: 'COFFEE' },
                 { icon: 'fa-bread-slice', color: 'text-amber-300', label: 'Padaria', type: 'BAKERY' },
                 { icon: 'fa-gas-pump', color: 'text-yellow-500', label: 'Posto', type: 'GAS' },
                 { icon: 'fa-utensils', color: 'text-emerald-400', label: 'Fome', type: 'FOOD' }
               ].map(poi => (
                 <button key={poi.label} onClick={() => {}} className="bg-white/5 p-4 rounded-3xl flex flex-col items-center gap-2 border border-white/5 active:scale-90 transition-all">
                    <i className={`fas ${poi.icon} ${poi.color} text-xl`}></i>
                    <span className="text-[8px] font-black">{poi.label}</span>
                 </button>
               ))}
            </div>
         </div>

         <footer className="h-28 pt-8 border-t border-white/10 flex items-center justify-between">
            <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            <button onClick={() => setIsSettingsOpen(true)} className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-2xl border border-white/5">
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
            layer={mapLayer}
            onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} 
            onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} 
         />
         
         {/* HUD VELOCIDADE FULL MAP - REPOSICIONADO PARA BAIXO ESQUERDA */}
         {mapFullScreen && (
            <div className="fixed bottom-12 left-12 z-[5000] bg-black/80 backdrop-blur-3xl p-12 rounded-[60px] border-2 border-white/10 flex flex-col items-center shadow-2xl scale-110">
               <span className="text-8xl font-black leading-none tracking-tighter">{currentSpeed}</span>
               <span className="text-sm text-blue-500 font-black mt-2 tracking-widest">KM/H REAL</span>
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
