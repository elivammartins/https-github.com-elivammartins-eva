
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
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'nflx://www.netflix.com/search?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Localiza qualquer endereço em Brasília/Gama usando base do Google. Essencial para Quadras e Conjuntos.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'media_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps nativos (Spotify, Netflix, YouTube).',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'youtube', 'netflix', 'ytmusic'] },
        action: { type: Type.STRING, enum: ['SEARCH_AND_PLAY', 'OPEN_APP'] },
        refinedQuery: { type: Type.STRING }
      },
      required: ['appId', 'action', 'refinedQuery']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [safetyDist, setSafetyDist] = useState(30);
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0, segments: []
  });

  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: 'IDLE', isEngineRunning: true, areWindowsOpen: false, isLocked: false, isUpdating: false, hazardActive: false
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'BASE GOOGLE ATIVA', artist: 'SISTEMA EVA V160', isPlaying: false, progress: 0 });
  const [videoTrack, setVideoTrack] = useState<TrackMetadata>({ title: 'STANDBY', artist: 'STREAM ENGINE', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentAudioApp, setCurrentAudioApp] = useState<MediaApp>(APP_DATABASE[0]);
  const [currentVideoApp, setCurrentVideoApp] = useState<MediaApp>(APP_DATABASE[4]);
  const [mapFullScreen, setMapFullScreen] = useState(false);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (fc.name === 'search_place') {
      try {
        // Busca com Google Search Grounding - O único que encontra casas em Brasília
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Qual a latitude e longitude exata de: "${args.query}, Brasília, DF, Brasil"? Responda no formato: NOME: [Nome do Local], LAT: [Lat], LNG: [Lng].`,
          config: { tools: [{ googleSearch: {} }] }
        });

        const text = response.text || "";
        const latMatch = text.match(/(-?\d+\.\d+)/g);
        
        if (latMatch && latMatch.length >= 2) {
          const lat = parseFloat(latMatch[0]);
          const lng = parseFloat(latMatch[1]);
          // Filtro de segurança para garantir que estamos no DF (aprox)
          if (lat < -15 && lat > -17 && lng < -47 && lng > -49) {
            return { name: args.query.toUpperCase(), lat, lng };
          }
        }

        // Ultimo recurso: Nominatim reforçado
        const localRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query + ' Distrito Federal Brasil')}&limit=1&countrycodes=br`);
        const data = await localRes.json();
        if (data && data[0]) return { name: data[0].display_name.split(',')[0], lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        
        return { error: "Localização não encontrada nem na base Google. Verifique o endereço." };
      } catch (err) {
        console.error("Search Action Error:", err);
        return { error: "Erro de comunicação com satélites de busca." };
      }
    }

    if (fc.name === 'media_action') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      const query = args.refinedQuery || '';
      if (app.category === 'VIDEO') {
        setCurrentVideoApp(app); setVideoTrack({ title: query, artist: app.name, isPlaying: true, progress: 0 });
        setMediaState('FULL');
      } else {
        setCurrentAudioApp(app); setAudioTrack({ title: query, artist: app.name, isPlaying: true, progress: 0 });
      }
      window.open(app.scheme + encodeURIComponent(query), '_blank');
      return { result: "Aplicativo aberto." };
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
              sessionPromise.then(s => { 
                sessionRef.current = s; 
                s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }); 
              }).catch(() => { /* Previne erro se fechar rápido */ }); 
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                // Timeout de segurança para evitar travamento da IA
                const actionPromise = handleSystemAction(fc);
                const timeoutPromise = new Promise(res => setTimeout(() => res({ error: "TEMPO EXCEDIDO" }), 10000));
                
                const res: any = await Promise.race([actionPromise, timeoutPromise]);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer; source.connect(outputCtxRef.current.destination);
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if(sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
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
          systemInstruction: `VOCÊ É A EVA CORE V160. MOTOR DE BUSCA: GOOGLE MAPS/WAZE.
          LOCALIZAÇÃO: BRASÍLIA/GAMA. Se o Elivam falar 'Quadra X, Conjunto Y, Casa Z', use 'search_place'. 
          O Google Search Grounding é obrigatório para encontrar locais específicos no DF.
          Se houver erro ou demora, avise: 'Sistema de busca sobrecarregado, tentando protocolo secundário'.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-10">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-glow-blue flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-satellite-dish text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black mb-4 tracking-tighter uppercase">PANDORA EVA CORE</h1>
         <button onClick={startVoiceSession} className="h-20 px-16 bg-blue-600 rounded-[40px] font-black uppercase shadow-[0_0_60px_rgba(37,99,235,0.5)]">Sincronizar Protocolo</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* HUD RADAR DE SEGURANÇA */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000]">
         <div className={`px-8 py-3 rounded-full border border-white/10 backdrop-blur-3xl flex items-center gap-5 transition-all bg-black/80 shadow-2xl`}>
            <i className="fas fa-satellite text-blue-400 animate-pulse"></i>
            <span className="text-sm font-black tracking-[0.2em]">SISTEMA GOOGLE BASE ONLINE</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-10 opacity-0' : 'w-[38%]'}`}>
         <header className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
               <span className={`text-[8rem] font-black leading-none tracking-tighter ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <span className="text-[11px] font-black text-blue-500 tracking-[0.4em]">KM/H • EVA V160</span>
            </div>
            <div onClick={startVoiceSession} className={`w-24 h-24 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : 'border-blue-500 shadow-xl'}`}>
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
            <MiniPlayer app={currentAudioApp} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-900">
         <MapView travel={travel} currentPosition={currentPos} isFullScreen={mapFullScreen} onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} onRouteUpdate={(steps, dur, dist, segs) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist, segments: segs}))} />
         
         {mediaState === 'FULL' && (
           <div className="absolute inset-0 z-[1000] bg-black animate-fade-in">
              <EntertainmentHub speed={currentSpeed} currentApp={currentVideoApp} track={videoTrack} onMinimize={() => setMediaState('HIDDEN')} onClose={() => setMediaState('HIDDEN')} onControl={() => {}} />
           </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          if (travel.destination === 'SEM DESTINO') setTravel(p => ({...p, destination: n, destinationCoords: [la, ln]}));
          else setTravel(p => ({...p, stops: [...p.stops, { id: Date.now().toString(), name: n, type: 'REST', coords: [la, ln] }]}));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
