
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
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'skyplus', name: 'SKY+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'skyplus://watch?q=' },
  { id: 'clarotv', name: 'Claro TV+', icon: 'fas fa-play', color: 'text-red-500', category: 'VIDEO', scheme: 'clarotvplus://search?q=' },
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
  },
  {
    name: 'media_command',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps de streaming e canais de TV.',
      properties: {
        appId: { type: Type.STRING },
        contentName: { type: Type.STRING }
      },
      required: ['appId', 'contentName']
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

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam', voiceVolume: 80, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio',
    credentials: []
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'PANDORA OMEGA V160', artist: 'SISTEMA ONLINE', isPlaying: false, progress: 0 });
  const outputCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
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

    if (name === 'media_command') {
      const app = APP_DATABASE.find(a => a.id === args.appId);
      if (app) window.open(app.scheme + encodeURIComponent(args.contentName), '_blank');
      return { result: "EXECUTANDO MÍDIA." };
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
          systemInstruction: `VOCÊ É A EVA CORE V160.
          CONTROLE DE MAPA: Use 'map_control' para alternar entre 3D, 2D, Satélite ou Maximizar o mapa conforme Elivam pedir.
          ROTA: 'search_place' -> 'set_navigation'.
          TV/FILMES: Se pedir Globo ou canais, ofereça SKY+ ou Claro TV+.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 animate-glow-blue flex items-center justify-center mb-10">
            <i className="fas fa-eye text-7xl text-blue-500"></i>
         </div>
         <h1 className="text-4xl font-black mb-4 tracking-tighter">EVA CORE VISION</h1>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase">Sincronizar Visão</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD DE VELOCIDADE FLUTUANTE SE MAPA FULL */}
      {mapFullScreen && (
        <div className="fixed bottom-10 left-10 z-[5000] bg-black/80 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 flex flex-col items-center">
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
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600' : 'border-blue-500'}`}>
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
