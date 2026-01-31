
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
  { id: 'netflix', name: 'NETFLIX', icon: 'fas fa-film', color: 'text-red-600', category: 'VIDEO' },
  { id: 'disney', name: 'DISNEY+', icon: 'fas fa-magic', color: 'text-blue-400', category: 'VIDEO' },
  { id: 'hbo', name: 'HBO MAX', icon: 'fas fa-tv', color: 'text-purple-600', category: 'VIDEO' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'open_media_content',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre um app de streaming e pesquisa/executa um conteúdo específico.',
      properties: {
        app: { type: Type.STRING, enum: ['SPOTIFY', 'NETFLIX', 'PRIME', 'GLOBOPLAY', 'DISNEY', 'HBO', 'YOUTUBE'] },
        query: { type: Type.STRING, description: 'Nome da música, playlist, filme ou série.' },
        action: { type: Type.STRING, enum: ['SEARCH', 'PLAY'] }
      },
      required: ['app', 'query']
    }
  },
  {
    name: 'media_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla a execução da mídia atual.',
      properties: {
        command: { type: Type.STRING, enum: ['PLAY', 'PAUSE', 'NEXT', 'PREVIOUS', 'STOP'] }
      },
      required: ['command']
    }
  },
  {
    name: 'manage_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Gerencia rotas e paradas no Waze ou Maps.',
      properties: {
        destination: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        app: { type: Type.STRING, enum: ['WAZE', 'GOOGLE_MAPS', 'RADARBOT'] }
      },
      required: ['destination']
    }
  }
];

const App: React.FC = () => {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.HUD);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA CORE V68');
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');

  const [track, setTrack] = useState<TrackMetadata>({
    title: 'EVA SYNC ACTIVE', artist: 'CO-PILOTO PANDORA', isPlaying: false, progress: 0
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO COMANDO', 
    stops: [],
    warnings: [],
    nextInstruction: { instruction: 'Vambora, mestre!', distance: '0m', icon: 'fa-rocket' }
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);

  const handleToolCall = (fc: any) => {
    console.log("EVA executando comando:", fc);
    const { name, args } = fc;

    if (name === 'open_media_content') {
      const q = encodeURIComponent(args.query);
      let url = '';
      switch(args.app) {
        case 'SPOTIFY': url = `spotify:search:${q}`; break;
        case 'NETFLIX': url = `nflx://www.netflix.com/search?q=${q}`; break;
        case 'YOUTUBE': url = `https://m.youtube.com/results?search_query=${q}`; break;
        case 'DISNEY': url = `https://www.disneyplus.com/search?q=${q}`; break;
        case 'HBO': url = `https://www.hbomax.com/search?q=${q}`; break;
        default: url = `https://www.google.com/search?q=${args.app}+${q}`;
      }
      window.open(url);
      setTrack(p => ({ ...p, title: args.query.toUpperCase(), artist: args.app }));
    } 
    
    else if (name === 'media_control') {
      // Simulação de controle via MediaSession API
      if ('mediaSession' in navigator) {
        if (args.command === 'NEXT') navigator.mediaSession.metadata = null; // Simplificado
      }
      setTrack(p => ({ ...p, isPlaying: args.command === 'PLAY' }));
    }

    else if (name === 'manage_navigation') {
      const q = encodeURIComponent(args.destination);
      let url = `waze://?q=${q}&navigate=yes`;
      if (args.app === 'GOOGLE_MAPS') url = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
      if (args.app === 'RADARBOT') url = `https://www.radarbot.com/search?q=${q}`;
      window.open(url);
      setTravel(p => ({ ...p, destination: args.destination.toUpperCase() }));
    }

    return { status: "success", feedback: "Feito, mestre! Já tá na tela." };
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
          onopen: () => { setStatusLog('EVA OUVINDO...'); setIsListening(true); 
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
          onclose: () => setStatusLog('PANDORA CORE V68'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA, a co-piloto intrusiva e parceira do Elivam Martins.
          Personalidade: Você não é educada como a Alexa. Você é uma parceira de estrada. 
          Use gírias, seja proativa, se o motorista estiver correndo, dê um puxão de orelha divertido.
          Você tem controle total: abre Netflix, escolhe séries, muda playlist no Spotify, altera rota no Waze e avisa sobre radares.
          Se pedirem um filme, sugira um baseado no clima da viagem e abra no app correto.
          Seja a alma do carro. Responda em português brasileiro informal.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic select-none">
      
      {/* CAMADA 0: MAPA (BACKGROUND) */}
      <div className="absolute inset-0 z-0 opacity-60">
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none" />
      </div>

      {/* CAMADA 1: INTERFACE HUD */}
      <div className="relative z-10 h-full w-full flex flex-col pointer-events-none">
        
        {/* HEADER: VELOCÍMETRO E INFO */}
        <header className="h-[100px] flex items-center justify-between px-10 pointer-events-auto shrink-0">
          <div className="bg-black/80 backdrop-blur-2xl p-6 rounded-[35px] border border-white/10 shadow-2xl flex items-baseline gap-2">
             <span className="text-6xl font-black tracking-tighter italic">{currentSpeed}</span>
             <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">KM/H SCAN</span>
          </div>

          <div className="flex gap-4">
             {MEDIA_APPS.slice(0, 3).map(app => (
               <button key={app.id} onClick={() => setActiveApp(app.id)} className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all backdrop-blur-md ${activeApp === app.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/60 border-white/10 text-white/40'}`}>
                 <i className={`${app.icon} text-lg`}></i>
               </button>
             ))}
          </div>
        </header>

        {/* MAIN AREA: WIDGETS LATERAIS */}
        <main className="flex-1 flex justify-end items-center p-10">
          <div className="w-full max-w-[420px] pointer-events-auto flex flex-col gap-6">
             {travel.warnings.length > 0 && (
               <div className="bg-red-600/90 backdrop-blur-2xl p-5 rounded-3xl border-2 border-red-400 animate-bounce flex items-center gap-5 shadow-2xl">
                  <i className="fas fa-radiation-alt text-3xl"></i>
                  <span className="text-sm font-black uppercase">{travel.warnings[0].description}</span>
               </div>
             )}
             <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
          </div>
        </main>

        {/* FOOTER: EVA AVATAR E MINI PLAYER (REORGANIZADO) */}
        <footer className="h-[110px] px-10 flex items-center gap-6 pointer-events-auto shrink-0 bg-gradient-to-t from-black to-transparent">
           
           {/* EVA INTEGRADA NO CANTO */}
           <div 
             onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
             className={`relative w-24 h-24 transition-all duration-500 cursor-pointer shrink-0 ${isListening ? 'scale-110' : 'scale-100'}`}
           >
              <div className="w-full h-full rounded-full border-2 border-blue-500/50 overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.3)] bg-black">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} videoUrl={null} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 border-black ${isListening ? 'bg-red-600 animate-pulse' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-[10px]`}></i>
              </div>
           </div>

           {/* PLAYER CENTRALIZADO */}
           <div className="flex-1 max-w-[500px] bg-black/90 backdrop-blur-3xl rounded-[35px] border border-white/10 p-5 shadow-2xl">
              <MiniPlayer app={MEDIA_APPS[1]} metadata={track} onControl={(a) => handleToolCall({name: 'media_control', args: {command: a}})} onExpand={() => {}} transparent />
           </div>

           <div className="flex items-center gap-4">
              <button onClick={() => setIsAddStopModalOpen(true)} className="w-16 h-16 rounded-3xl bg-emerald-600 border border-emerald-400 flex items-center justify-center text-2xl shadow-xl active:scale-90 transition-all">
                 <i className="fas fa-route"></i>
              </button>
           </div>
        </footer>
      </div>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
      }} />

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
