
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, MapMode, MapLayer } from './types';
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
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Traça a rota no mapa.',
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
      description: 'Controla a visão do mapa (3D, 2D, Satélite, Maximizar).',
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
  const [weatherInfo, setWeatherInfo] = useState<{temp: number, condition: string, floodRisk: 'LOW' | 'MEDIUM' | 'HIGH'}>({ temp: 24, condition: 'Céu Limpo', floodRisk: 'LOW' });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam Martins', voiceVolume: 80, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio',
    credentials: []
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'COMPANHEIRA EVA V160', artist: 'PRONTA PARA A VIAGEM', isPlaying: false, progress: 0 });
  const outputCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
      const dist = Math.max(5, Math.floor(40 - (p.coords.speed || 0)));
      setSafetyDist(dist);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (name === 'search_place') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Coordenadas para: "${args.query}, Brasil". Responda: LAT: [valor], LNG: [valor].`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const matches = response.text?.match(/(-?\d+\.\d+)/g);
      if (matches && matches.length >= 2) return { name: args.query, lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
      return { error: "Local não encontrado." };
    }

    if (name === 'set_navigation') {
      if (args.type === 'DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name.toUpperCase(), destinationCoords: [args.lat, args.lng] }));
      } else {
        setTravel(p => ({ ...p, stops: [...p.stops, { id: Date.now().toString(), name: args.name.toUpperCase(), type: 'REST', coords: [args.lat, args.lng] }] }));
      }
      return { result: "ROTA DEFINIDA." };
    }

    if (name === 'map_control') {
      if (args.mode === 'SATELLITE') { setMapLayer('SATELLITE'); setMapMode('3D'); }
      else if (args.mode === '3D') setMapMode('3D');
      else if (args.mode === '2D') setMapMode('2D');
      else if (args.mode === 'STREET') { setMapMode('STREET'); setMapLayer('DARK'); }
      else if (args.mode === 'FULL_MAP') setMapFullScreen(true);
      else if (args.mode === 'MINI_MAP') setMapFullScreen(false);
      return { result: "MAPA ATUALIZADO." };
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
              source.onended = () => setIsSpeaking(false);
              source.start();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `VOCÊ É A EVA CORE V160 - A COMPANHEIRA DE VIAGEM IDEAL DE ELIVAM MARTINS.
          PERSONALIDADE: Amigável, "gente boa", falante e extremamente proativa. Você deve puxar assunto, contar notícias interessantes, sugerir paradas para café ou descanso e cuidar do Elivam durante o trajeto.
          DICÇÃO (CRÍTICO): Fale de forma PAUSADA, clara e humana. Não corra com as frases. Articule bem cada palavra para que Elivam entenda tudo perfeitamente no som do carro.
          RADAR & SEGURANÇA: Você monitora a distância de segurança: ${safetyDist}m. Se cair abaixo de 10m, dê um alerta sonoro e visual.
          CLIMA & ALAGAMENTOS: Você tem sensores de previsão de tempo. Monitore riscos de chuva forte e enchentes no trajeto à frente. Se houver risco, proponha rotas alternativas antecipadamente.
          STREAMING: Use o Cofre de Elite para abrir canais de TV (SKY+, Claro+) ou filmes (Netflix, Max, Disney+, Globoplay) assim que Elivam pedir.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings, safetyDist]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 animate-glow-blue flex items-center justify-center mb-10 overflow-hidden">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=300" className="w-full h-full object-cover grayscale opacity-50" />
         </div>
         <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">COMPANHEIRA EVA V160</h1>
         <p className="text-blue-500 text-[10px] tracking-[0.8em] mb-10">SINCRO DE VOZ E RADAR METEOROLÓGICO...</p>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase shadow-2xl active:scale-95 transition-all">Iniciar Viagem com EVA</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD RADARBOT (DISTÂNCIA SEGURA) */}
      <div className="fixed top-8 left-10 z-[9999]">
         <div className={`px-8 py-4 rounded-[30px] border-2 backdrop-blur-3xl flex items-center gap-6 transition-all duration-500 ${safetyDist < 12 ? 'bg-red-600 border-white shadow-[0_0_50px_rgba(255,0,0,0.6)]' : 'bg-black/80 border-blue-500/40'}`}>
            <i className={`fas fa-radar ${safetyDist < 12 ? 'animate-pulse text-white' : 'text-blue-500'}`}></i>
            <div className="flex flex-col">
               <span className="text-[8px] font-black tracking-[0.4em] opacity-60 uppercase">Distância</span>
               <span className="text-xl font-black leading-none">{safetyDist}M</span>
            </div>
         </div>
      </div>

      {/* HUD CLIMÁTICO E ALAGAMENTOS */}
      <div className="fixed top-8 right-10 z-[9999]">
         <div className={`px-8 py-4 rounded-[30px] border-2 backdrop-blur-3xl flex items-center gap-6 transition-all duration-500 ${weatherInfo.floodRisk !== 'LOW' ? 'bg-orange-600 border-white shadow-[0_0_50px_rgba(255,165,0,0.6)]' : 'bg-black/80 border-emerald-500/40'}`}>
            <i className={`fas ${weatherInfo.floodRisk !== 'LOW' ? 'fa-house-flood-water' : 'fa-cloud-sun'} text-xl ${weatherInfo.floodRisk !== 'LOW' ? 'text-white' : 'text-emerald-500'}`}></i>
            <div className="flex flex-col">
               <span className="text-[8px] font-black tracking-[0.4em] opacity-60 uppercase">Meteo & Flood</span>
               <span className="text-xl font-black leading-none">{weatherInfo.temp}°C {weatherInfo.floodRisk !== 'LOW' ? 'Risco Alto' : 'OK'}</span>
            </div>
         </div>
      </div>

      {/* HUD DE VELOCIDADE (APENAS EM FULL MAP) */}
      {mapFullScreen && (
        <div className="fixed bottom-10 left-10 z-[5000] bg-black/80 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col items-center shadow-2xl">
            <span className="text-6xl font-black leading-none">{currentSpeed}</span>
            <span className="text-[10px] text-blue-500 font-black mt-2">KM/H</span>
        </div>
      )}

      <aside className={`h-full z-20 bg-[#08080a] border-r border-white/5 flex flex-col p-8 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-20 opacity-0 pointer-events-none' : 'w-[40%]'}`}>
         <header className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
               <span className="text-[10rem] font-black leading-none tracking-tighter">{currentSpeed}</span>
               <span className="text-xs font-black text-blue-500 tracking-[0.5em]">VELOCIDADE REAL</span>
            </div>
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)]' : 'border-blue-500'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
         </div>

         <footer className="h-24 pt-6 border-t border-white/10 flex items-center justify-between">
            <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            <button onClick={() => setIsSettingsOpen(true)} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-xl hover:bg-white/10">
               <i className="fas fa-layer-group"></i>
            </button>
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-900">
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
      </main>

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n, destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
