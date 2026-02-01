
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, MediaViewState, AppSettings, CarStatus, StopInfo, RouteWarning, RouteSegment, RouteStep } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import EntertainmentHub from './components/EntertainmentHub';
import BluelinkPanel from './components/BluelinkPanel';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?phone=' },
  { id: 'phone', name: 'Telefone', icon: 'fas fa-phone-alt', color: 'text-blue-500', category: 'COMM', scheme: 'tel:' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://www.youtube.com/results?search_query=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Localiza endereços no DF (Gama, Setores, Quadras) via Google Search.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'send_communication',
    parameters: {
      type: Type.OBJECT,
      description: 'Envia mensagens de WhatsApp ou faz ligações.',
      properties: {
        method: { type: Type.STRING, enum: ['WHATSAPP', 'PHONE'] },
        recipient: { type: Type.STRING, description: 'Nome ou número' },
        message: { type: Type.STRING }
      },
      required: ['method', 'recipient']
    }
  },
  {
    name: 'media_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps de música ou vídeo.',
      properties: {
        appId: { type: Type.STRING, enum: ['spotify', 'youtube', 'netflix', 'ytmusic'] },
        query: { type: Type.STRING }
      },
      required: ['appId']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  // Fix: Added missing mapFullScreen state
  const [mapFullScreen, setMapFullScreen] = useState(false);
  
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

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'PRIME PROTOCOL 160', artist: 'EVA CORE', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentAudioApp, setCurrentAudioApp] = useState<MediaApp>(APP_DATABASE[0]);

  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      const lat = p.coords.latitude;
      const lng = p.coords.longitude;
      setCurrentPos([lat, lng]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      // Simulação de radar baseada em movimento
      setSafetyDist(Math.max(5, Math.floor(30 - (p.coords.speed || 0))));
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const args = fc.args;
    // Guideline: Create new GoogleGenAI instance before API call
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    if (fc.name === 'search_place') {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Ache a COORDENADA LAT/LNG exata de: "${args.query}, Brasília, DF". Responda: LAT: [valor], LNG: [valor].`,
          config: { tools: [{ googleSearch: {} }] }
        });
        const text = response.text || "";
        const matches = text.match(/(-?\d+\.\d+)/g);
        if (matches && matches.length >= 2) {
          return { name: args.query.toUpperCase(), lat: parseFloat(matches[0]), lng: parseFloat(matches[1]) };
        }
        // Fallback local
        const fRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(args.query + ' DF Brasil')}&limit=1`);
        const data = await fRes.json();
        if (data[0]) return { name: data[0].display_name.split(',')[0], lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        return { error: "Local não encontrado." };
      } catch (e) { return { error: "Falha de busca." }; }
    }

    if (fc.name === 'send_communication') {
      const url = args.method === 'WHATSAPP' 
        ? `https://api.whatsapp.com/send?phone=${args.recipient}&text=${encodeURIComponent(args.message || '')}`
        : `tel:${args.recipient}`;
      window.open(url, '_blank');
      return { result: "Comunicação iniciada no dispositivo." };
    }

    if (fc.name === 'media_action') {
      const app = APP_DATABASE.find(a => a.id === args.appId) || APP_DATABASE[0];
      window.open(app.scheme + encodeURIComponent(args.query || ''), '_blank');
      return { result: `Abrindo ${app.name}` };
    }

    return { result: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Guideline: Create new GoogleGenAI instance before API call
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
              }); 
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
          systemInstruction: `VOCÊ É A EVA CORE V160. SEU MOTOR É O GOOGLE SEARCH.
          CAPACIDADES: Você PODE abrir WhatsApp, fazer ligações e abrir apps. 
          BUSCA: Se Elivam pedir um lugar no Gama ou Brasília, use 'search_place'. 
          NUNCA diga 'estou tentando encontrar' por mais de 10 segundos sem dar um feedback real.
          Se a busca falhar, peça para ele dizer um ponto comercial próximo.`
        }
      });
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white">
         <div className="w-64 h-64 rounded-full border-4 border-blue-600/30 p-2 animate-glow-blue flex items-center justify-center mb-10">
            <i className="fas fa-microchip text-7xl text-blue-500"></i>
         </div>
         <h1 className="text-5xl font-black mb-8 tracking-tighter uppercase">EVA CORE V160</h1>
         <button onClick={startVoiceSession} className="h-24 px-20 bg-blue-600 rounded-[50px] font-black uppercase shadow-[0_0_80px_rgba(37,99,235,0.6)] text-xl">Iniciar Protocolo Prime</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      {/* RADAR DE DISTÂNCIA REATIVADO */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[5000]">
         <div className={`px-10 py-4 rounded-full border-2 backdrop-blur-3xl flex items-center gap-6 transition-all ${safetyDist < 10 ? 'bg-red-600 border-white animate-pulse' : 'bg-black/90 border-blue-500/50 shadow-2xl'}`}>
            <i className={`fas fa-bullseye text-2xl ${safetyDist < 10 ? 'text-white' : 'text-blue-400'}`}></i>
            <span className="text-lg font-black tracking-[0.3em]">{safetyDist}M DISTÂNCIA SEGURA</span>
         </div>
      </div>

      <aside className={`h-full z-20 bg-[#08080a] border-r border-white/10 flex flex-col p-8 transition-all duration-700 ${mapFullScreen ? 'w-0 -ml-20 opacity-0' : 'w-[40%]'}`}>
         <header className="flex items-center justify-between mb-10">
            <div className="flex flex-col">
               <span className={`text-[9rem] font-black leading-none tracking-tighter ${currentSpeed > 80 ? 'text-red-600' : 'text-white'}`}>{currentSpeed}</span>
               <span className="text-xs font-black text-blue-500 tracking-[0.5em] mt-2">VELOCIDADE REAL • KM/H</span>
            </div>
            <div onClick={startVoiceSession} className={`w-28 h-28 rounded-full border-4 cursor-pointer overflow-hidden transition-all ${isListening ? 'border-red-600 scale-110 shadow-[0_0_50px_rgba(220,38,38,0.5)]' : 'border-blue-600 shadow-2xl'}`}>
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
            <BluelinkPanel status={carStatus} onAction={() => {}} />
         </div>

         <footer className="h-28 pt-6 border-t border-white/10">
            <MiniPlayer app={currentAudioApp} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
         </footer>
      </aside>

      <main className="flex-1 relative bg-[#0a0a0c]">
         {/* Fix: Passed missing mapFullScreen and setMapFullScreen */}
         <MapView travel={travel} currentPosition={currentPos} isFullScreen={mapFullScreen} onToggleFullScreen={() => setMapFullScreen(!mapFullScreen)} onRouteUpdate={(steps, dur, dist, segs) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist, segments: segs}))} />
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
