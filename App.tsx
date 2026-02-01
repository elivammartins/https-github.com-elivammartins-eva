
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, MediaViewState, AppSettings, CarStatus, StopInfo, StreamingCredential } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import EntertainmentHub from './components/EntertainmentHub';
import BluelinkPanel from './components/BluelinkPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
  { id: 'phone', name: 'Telefone', icon: 'fas fa-phone-alt', color: 'text-blue-500', category: 'COMM', scheme: 'tel:' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'skyplus', name: 'SKY+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'skyplus://watch?q=' },
  { id: 'clarotv', name: 'Claro TV+', icon: 'fas fa-play', color: 'text-red-500', category: 'VIDEO', scheme: 'clarotvplus://search?q=' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Localiza coordenadas exatas no DF ou Brasil via Google.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Traça a rota real no mapa e inicia navegação.',
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
    name: 'media_command',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre canais de TV ou filmes nos streamings configurados.',
      properties: {
        appId: { type: Type.STRING },
        contentName: { type: Type.STRING },
        action: { type: Type.STRING, enum: ['WATCH', 'SEARCH'] }
      },
      required: ['appId', 'contentName']
    }
  },
  {
    name: 'send_communication',
    parameters: {
      type: Type.OBJECT,
      description: 'Dispara mensagens reais via WhatsApp (Deep Link).',
      properties: {
        method: { type: Type.STRING, enum: ['WHATSAPP', 'PHONE'] },
        recipient: { type: Type.STRING },
        message: { type: Type.STRING }
      },
      required: ['method', 'recipient']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapFullScreen, setMapFullScreen] = useState(false);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [safetyDist, setSafetyDist] = useState(30);

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'Elivam', voiceVolume: 80, privacyMode: false, safetyDistance: 30, alertVoiceEnabled: true, preferredMusicApp: 'spotify', preferredVideoApp: 'stremio',
    credentials: []
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'SISTEMA PANDORA OMEGA', artist: 'MODO EXECUÇÃO ATIVO', isPlaying: false, progress: 0 });
  const [currentAudioApp, setCurrentAudioApp] = useState<MediaApp>(APP_DATABASE[0]);

  const outputCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (p.coords.heading !== null) setCurrentHeading(p.coords.heading);
      setSafetyDist(Math.max(5, Math.floor(35 - (p.coords.speed || 0))));
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (name === 'search_place') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Coordenadas exatas para: "${args.query}, Brasil". Responda: LAT: [valor], LNG: [valor].`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const matches = response.text?.match(/(-?\d+\.\d+)/g);
      if (matches && matches.length >= 2) return { name: args.query, lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
      return { error: "Local não encontrado na base Google." };
    }

    if (name === 'set_navigation') {
      if (args.type === 'DESTINATION') {
        setTravel(p => ({ ...p, destination: args.name.toUpperCase(), destinationCoords: [args.lat, args.lng] }));
      } else {
        setTravel(p => ({ ...p, stops: [...p.stops, { id: Date.now().toString(), name: args.name.toUpperCase(), type: 'REST', coords: [args.lat, args.lng] }] }));
      }
      return { result: "ROTA TRAÇADA NO MAPA." };
    }

    if (name === 'media_command') {
      const app = APP_DATABASE.find(a => a.id === args.appId);
      if (app) {
        window.open(app.scheme + encodeURIComponent(args.contentName), '_blank');
        return { result: `Executando ${args.contentName} em ${app.name}` };
      }
      return { error: "App não encontrado." };
    }

    if (name === 'send_communication') {
      const url = args.method === 'WHATSAPP' 
        ? `https://api.whatsapp.com/send?phone=${args.recipient}&text=${encodeURIComponent(args.message || '')}`
        : `tel:${args.recipient}`;
      window.open(url, '_blank');
      return { result: "Comando enviado para o dispositivo principal." };
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
          systemInstruction: `VOCÊ É A EVA CORE V160 - PROTOCOLO OMEGA.
          EXECUÇÃO REAL: Se Elivam pedir Globo ou SporTV, verifique na SKY+ e Claro TV+. Se houver em ambos, pergunte.
          STREAMING: Você tem acesso às credenciais no Vault: ${JSON.stringify(settings.credentials)}. Use-as para confirmar qual perfil acessar.
          ROTA: Se ele disser "Ir para tal lugar", 'search_place' -> 'set_navigation' OBRIGATORIAMENTE.
          USUÁRIO: ${settings.userName}.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, settings]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 animate-glow-blue flex items-center justify-center mb-10">
            <i className="fas fa-microchip text-7xl text-blue-500"></i>
         </div>
         <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">PANDORA OMEGA V160</h1>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase shadow-2xl">Iniciar Protocolo</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD RADARBOT 3D */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000]">
         <div className={`px-10 py-4 rounded-full border-2 backdrop-blur-3xl flex items-center gap-6 transition-all ${safetyDist < 12 ? 'bg-red-600 border-white animate-pulse scale-110 shadow-[0_0_50px_rgba(255,0,0,0.5)]' : 'bg-black/90 border-blue-500/50 shadow-2xl'}`}>
            <i className={`fas fa-circle-exclamation text-2xl ${safetyDist < 12 ? 'text-white' : 'text-blue-400'}`}></i>
            <span className="text-sm font-black tracking-[0.4em]">{safetyDist}M DISTÂNCIA SEGURA</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#08080a] border-r border-white/5 flex flex-col p-8 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-20 opacity-0' : 'w-[40%]'}`}>
         <header className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
               <span className="text-[10rem] font-black leading-none tracking-tighter">{currentSpeed}</span>
               <span className="text-xs font-black text-blue-500 tracking-[0.5em]">VELOCIDADE REAL • KM/H</span>
            </div>
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.5)]' : 'border-blue-500 shadow-2xl'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 space-y-8 overflow-y-auto no-scrollbar pb-10">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
         </div>

         <footer className="h-24 pt-6 border-t border-white/10 flex items-center justify-between">
            <MiniPlayer app={currentAudioApp} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            <button onClick={() => setIsSettingsOpen(true)} className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-xl hover:bg-white/10">
               <i className="fas fa-shield-alt"></i>
            </button>
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-900">
         <MapView travel={travel} currentPosition={currentPos} heading={currentHeading} isFullScreen={mapFullScreen} onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} onRouteUpdate={(steps, dur, dist, segs) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist, segments: segs}))} />
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n, destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
      }} />

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
    </div>
  );
};

export default App;
