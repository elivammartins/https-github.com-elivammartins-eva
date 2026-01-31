
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, LayoutMode, RouteWarning } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const MEDIA_APPS: MediaApp[] = [
  { id: 'nav', name: 'NAV', icon: 'fas fa-location-arrow', color: 'text-emerald-400', category: 'NAV' },
  { id: 'spotify', name: 'SPOTIFY', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO' },
  { id: 'youtube', name: 'VEO/YT', icon: 'fab fa-youtube', color: 'text-red-500', category: 'VIDEO' },
];

// Declaração de Funções para a EVA "clicar" no sistema
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Define um novo destino ou altera a rota atual.',
      properties: {
        destination: { type: Type.STRING, description: 'Nome do local' },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER }
      },
      required: ['destination', 'lat', 'lng']
    }
  },
  {
    name: 'control_media',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla música ou vídeo (play, pause, next, open_app).',
      properties: {
        action: { type: Type.STRING, enum: ['PLAY', 'PAUSE', 'NEXT', 'OPEN_SPOTIFY', 'OPEN_YOUTUBE'] }
      },
      required: ['action']
    }
  },
  {
    name: 'set_layout',
    parameters: {
      type: Type.OBJECT,
      description: 'Muda o visual da tela (mapa cheio, modo HUD ou vídeo).',
      properties: {
        mode: { type: Type.STRING, enum: ['HUD', 'FULL_MAP', 'VIDEO_FOCUS'] }
      },
      required: ['mode']
    }
  }
];

const App: React.FC = () => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.HUD);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA: ONLINE');
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');

  const [track, setTrack] = useState<TrackMetadata>({
    title: 'AGUARDANDO SINAL', artist: 'PANDORA SYNC', isPlaying: false, progress: 0
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', 
    stops: [],
    warnings: [],
    nextInstruction: { instruction: 'Eva no Comando', distance: '0m', icon: 'fa-check-double' }
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);

  // Monitoramento Proativo de Radares e Perigos (Simulação de Scanner)
  useEffect(() => {
    const interval = setInterval(() => {
      if (travel.destinationCoords) {
        // Simula a detecção de um radar a 500m
        const newWarning: RouteWarning = {
          id: Date.now().toString(),
          type: 'RADAR',
          distance: 500,
          description: 'Radar de 60km/h à frente!',
          coords: [currentPos[0] + 0.005, currentPos[1] + 0.005]
        };
        setTravel(p => ({ ...p, warnings: [newWarning] }));
        
        // EVA Proativa: Avisa se o radar for perigoso
        if (currentSpeed > 65) {
          setStatusLog("⚠️ ALERTA: RADAR!");
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [travel.destinationCoords, currentSpeed]);

  const handleToolCall = (fc: any) => {
    console.log("EVA executando ação:", fc);
    if (fc.name === 'set_navigation') {
      setTravel(p => ({ ...p, destination: fc.args.destination.toUpperCase(), destinationCoords: [fc.args.lat, fc.args.lng] }));
      setLayoutMode(LayoutMode.HUD);
    } else if (fc.name === 'set_layout') {
      setLayoutMode(fc.args.mode as LayoutMode);
    } else if (fc.name === 'control_media') {
      if (fc.args.action === 'OPEN_SPOTIFY') window.open('spotify:');
      if (fc.args.action === 'OPEN_YOUTUBE') window.open('https://youtube.com');
      setTrack(p => ({ ...p, isPlaying: fc.args.action === 'PLAY' }));
    }
    return { status: "ok", message: "Ação executada com sucesso, mestre." };
  };

  const startVoiceSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      outputCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
      inputCtxRef.current = new AudioContextClass({ sampleRate: 16000 });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => { setStatusLog('EVA: OUVINDO'); setIsListening(true); 
            const source = inputCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtxRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const result = handleToolCall(fc);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: [{ id: fc.id, name: fc.name, response: result }] }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current!, 24000, 1);
              const source = outputCtxRef.current!.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtxRef.current!.destination);
              source.onended = () => { sourcesRef.current.delete(source); if(sourcesRef.current.size === 0) setIsSpeaking(false); };
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current!.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => setStatusLog('PANDORA: ONLINE'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA, a parceira de viagem definitiva da Pandora. 
          Sua personalidade é informal, prestativa, intrusiva e divertida. 
          Use gírias brasileiras, seja proativa: se ver um radar no trajeto, avise com entusiasmo. 
          Se o motorista pedir música, sugira algo e use control_media. 
          Você pode mudar o layout da tela, abrir Waze/Spotify e gerenciar rotas. 
          Não seja um robô, seja uma co-piloto que ama a estrada.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    });
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic select-none">
      
      {/* BACKGROUND: MAPA DINÂMICO */}
      <div className={`absolute inset-0 z-0 transition-transform duration-1000 ${layoutMode === LayoutMode.FULL_MAP ? 'scale-100' : 'scale-110 blur-[2px] opacity-40'}`}>
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* INTERFACE HUD */}
      <div className="relative z-10 h-full w-full flex flex-col pointer-events-none">
        
        {/* HEADER: STATUS & APPS */}
        <header className="h-[80px] flex items-center px-8 gap-6 pointer-events-auto">
          <div className="bg-blue-600/90 backdrop-blur-xl px-6 py-3 rounded-2xl border border-blue-400/50 shadow-[0_0_30px_rgba(37,99,235,0.4)]">
             <span className="text-[11px] font-black uppercase tracking-tighter text-white">CORE V67 • EVA ACTIVE</span>
          </div>
          <div className="flex gap-3 flex-1 overflow-hidden">
            {MEDIA_APPS.map(app => (
              <button key={app.id} onClick={() => setActiveApp(app.id)} className={`h-12 px-6 rounded-2xl border flex items-center gap-3 transition-all backdrop-blur-md ${activeApp === app.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/60 border-white/10 text-white/40'}`}>
                <i className={`${app.icon} text-sm`}></i>
                <span className="text-[10px] font-black uppercase tracking-widest">{app.name}</span>
              </button>
            ))}
          </div>
        </header>

        {/* MAIN HUD: VELOCÍMETRO & AVATAR */}
        <main className="flex-1 relative flex flex-col items-center justify-between p-10">
          
          {/* Top-Left: Velocímetro Neon */}
          <div className="w-full flex justify-start pointer-events-auto">
             <div className="bg-black/90 backdrop-blur-3xl p-8 rounded-[50px] border-2 border-white/5 shadow-2xl flex flex-col items-center min-w-[160px] group hover:border-blue-500 transition-colors">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 group-hover:animate-pulse">SPD/SCAN</span>
                <span className="text-7xl font-black italic tracking-tighter leading-none">{currentSpeed}</span>
             </div>
          </div>

          {/* CENTRAL: EVA AVATAR (PARCEIRA) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div 
              onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
              className={`relative w-64 h-64 lg:w-96 lg:h-96 transition-all duration-700 cursor-pointer ${isListening ? 'scale-110' : 'scale-100'}`}
            >
               <div className={`absolute inset-0 rounded-full border-[6px] border-blue-500/30 animate-ping-slow ${isListening || isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
               <div className="w-full h-full rounded-full border-4 border-white/10 overflow-hidden shadow-[0_0_120px_rgba(37,99,235,0.4)] bg-black relative">
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} videoUrl={null} onAnimateClick={() => {}} />
                  {isListening && (
                    <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2 h-12 items-end">
                       {[...Array(8)].map((_, i) => (
                         <div key={i} className="w-2 bg-blue-400 rounded-full animate-wave" style={{ animationDelay: `${i*0.1}s` }}></div>
                       ))}
                    </div>
                  )}
               </div>
               <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 px-10 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl transition-all ${isListening ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                  {statusLog}
               </div>
            </div>
          </div>

          {/* Bottom-Right: Painel de Alertas e Navegação */}
          <div className="w-full max-w-[400px] pointer-events-auto self-end flex flex-col gap-4">
             {travel.warnings.length > 0 && (
               <div className="bg-red-600/90 backdrop-blur-2xl p-4 rounded-2xl border border-red-400 animate-bounce flex items-center gap-4 shadow-2xl">
                  <i className="fas fa-radiation text-2xl text-white"></i>
                  <div>
                    <span className="text-[9px] font-black text-white/70 block uppercase">Scanner Pandora</span>
                    <span className="text-[13px] font-black text-white uppercase">{travel.warnings[0].description}</span>
                  </div>
               </div>
             )}
             {activeApp === 'nav' && (
               <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
             )}
          </div>
        </main>

        {/* FOOTER: MINI PLAYER CONTROLS */}
        <footer className="h-[120px] px-10 flex items-center justify-between pointer-events-auto shrink-0 bg-gradient-to-t from-black to-transparent">
           <div className="flex-1 max-w-[360px] bg-black/80 backdrop-blur-3xl rounded-[35px] border border-white/10 p-5 shadow-2xl">
              <MiniPlayer app={MEDIA_APPS[1]} metadata={track} onControl={(a) => setTrack(p => ({ ...p, isPlaying: a === 'PLAY' }))} onExpand={() => setActiveApp('spotify')} transparent />
           </div>
           <div className="flex items-center gap-6 ml-10">
              <button onClick={() => setLayoutMode(LayoutMode.FULL_MAP)} className={`w-16 h-16 rounded-3xl border flex items-center justify-center text-2xl shadow-xl transition-all ${layoutMode === LayoutMode.FULL_MAP ? 'bg-blue-600 border-blue-400' : 'bg-black/60 border-white/10'}`}>
                 <i className="fas fa-expand-arrows-alt"></i>
              </button>
              <button onClick={() => setIsAddStopModalOpen(true)} className="w-16 h-16 rounded-3xl bg-emerald-600 border border-emerald-400 flex items-center justify-center text-2xl shadow-xl hover:bg-emerald-500 transition-all">
                 <i className="fas fa-plus"></i>
              </button>
           </div>
        </footer>
      </div>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
      }} />

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
        @keyframes wave { 0%, 100% { height: 20%; } 50% { height: 100%; } }
        .animate-ping-slow { animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-wave { animation: wave 0.6s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
