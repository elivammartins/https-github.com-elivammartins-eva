
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
  { id: 'youtube', name: 'YOUTUBE', icon: 'fab fa-youtube', color: 'text-red-500', category: 'VIDEO' },
  { id: 'hbo', name: 'HBO MAX', icon: 'fas fa-tv', color: 'text-purple-600', category: 'VIDEO' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'control_media_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Aciona apps de mídia. Use PLAY para tentar reprodução direta via comando de sistema.',
      properties: {
        app: { type: Type.STRING, enum: ['SPOTIFY', 'NETFLIX', 'PRIME', 'YOUTUBE'] },
        query: { type: Type.STRING, description: 'O que tocar. Ex: "Track:Bohemian Rhapsody Artist:Queen".' },
        action: { type: Type.STRING, enum: ['PLAY', 'SEARCH'] }
      },
      required: ['app', 'query', 'action']
    }
  },
  {
    name: 'media_transport',
    parameters: {
      type: Type.OBJECT,
      description: 'Controle básico de transporte (play/pause).',
      properties: {
        command: { type: Type.STRING, enum: ['PLAY', 'PAUSE', 'NEXT', 'PREVIOUS', 'STOP'] }
      },
      required: ['command']
    }
  },
  {
    name: 'update_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Inicia navegação GPS.',
      properties: {
        destination: { type: Type.STRING, description: 'Destino final.' },
        app: { type: Type.STRING, enum: ['WAZE', 'GOOGLE_MAPS'] }
      },
      required: ['destination']
    }
  }
];

const App: React.FC = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA CORE V75');
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');

  const [track, setTrack] = useState<TrackMetadata>({
    title: 'EVA SYNC V75', artist: 'SISTEMA OPERACIONAL OK', isPlaying: false, progress: 0
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM ROTA ATIVA', 
    stops: [],
    warnings: [],
    nextInstruction: { instruction: 'Eva pronta para o comando', distance: '0m', icon: 'fa-shield-halved' }
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);

  const handleToolCall = (fc: any) => {
    const { name, args } = fc;
    setStatusLog(`TRIGGER: ${args.app || name}`);

    if (name === 'control_media_app') {
      const q = encodeURIComponent(args.query);
      let url = '';
      
      switch(args.app) {
        case 'SPOTIFY': 
          // O "GOLD STANDARD" para Android: Media Play Intent.
          // Tenta tocar diretamente em vez de apenas pesquisar.
          url = `intent://#Intent;action=android.media.action.MEDIA_PLAY_FROM_SEARCH;query=${q};package=com.spotify.music;end`;
          break;
        case 'YOUTUBE': 
          // Link de resultados limpo para evitar erros de indisponibilidade
          url = `https://www.youtube.com/results?search_query=${q}`;
          break;
        case 'NETFLIX': 
          url = `https://www.netflix.com/search?q=${q}`; 
          break;
        default: 
          url = `https://www.google.com/search?q=${args.app}+${args.query}`;
      }
      
      window.open(url, '_blank');
      setTrack(p => ({ ...p, title: args.query.toUpperCase(), artist: args.app, isPlaying: true }));
      return { status: "success", info: "Intent de sistema enviado." };
    } 
    
    else if (name === 'media_transport') {
      setTrack(p => ({ ...p, isPlaying: args.command === 'PLAY' }));
      return { status: "success", info: "Player local sincronizado." };
    }

    else if (name === 'update_navigation') {
      const q = encodeURIComponent(args.destination);
      let url = `google.navigation:q=${q}`; // Início imediato no Maps
      if (args.app === 'WAZE') url = `waze://?q=${q}&navigate=yes`;
      window.open(url, '_blank');
      setTravel(p => ({ ...p, destination: args.destination.toUpperCase() }));
      return { status: "success", info: "Vetor de rota definido." };
    }

    return { status: "error", info: "Comando não reconhecido." };
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
          onopen: () => { setStatusLog('EVA ESCUTANDO'); setIsListening(true); 
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
          onclose: () => { setStatusLog('PANDORA CORE V75'); setIsListening(false); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA, a co-piloto parceira do Elivam Martins.
          Personalidade: Rápida, usa gírias de asfalto, e resolve as coisas com comando de voz.
          AO TOCAR MÚSICA NO SPOTIFY:
          - Use a query no formato "Track:NOME Artist:NOME".
          - O sistema enviará um comando MEDIA_PLAY_FROM_SEARCH nativo do Android.
          - Isso deve forçar o Spotify a tocar a música assim que abrir.
          NO YOUTUBE:
          - Abra sempre a busca de resultados para evitar erros de vídeo bloqueado.
          - Diga ao Elivam que os resultados estão na tela.
          Seu avatar fica na barra inferior para deixar o mapa livre. Responda em Português.`
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
      
      {/* MAPA FULL (Ocupa o fundo para estética imersiva) */}
      <div className="absolute inset-0 z-0 opacity-40">
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
      </div>

      {/* HUD DE COMANDO */}
      <div className="relative z-10 h-full w-full flex flex-col pointer-events-none p-6">
        
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-6 rounded-[35px] border border-white/10 shadow-2xl flex items-baseline gap-2">
             <span className="text-6xl font-black italic tracking-tighter leading-none">{currentSpeed}</span>
             <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">KM/H CORE</span>
          </div>

          <div className="flex gap-2">
             {MEDIA_APPS.map(app => (
               <button key={app.id} onClick={() => setActiveApp(app.id)} className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all backdrop-blur-md ${activeApp === app.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/60 border-white/10 text-white/40'}`}>
                 <i className={`${app.icon} text-base`}></i>
               </button>
             ))}
          </div>
        </header>

        <main className="flex-1 flex justify-end items-center">
           <div className="w-full max-w-[380px] pointer-events-auto">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        {/* RODAPÉ INTEGRADO: EVA + PLAYER */}
        <footer className="h-[110px] mt-4 flex items-center gap-5 pointer-events-auto bg-black/90 backdrop-blur-3xl rounded-[35px] border border-white/10 px-6 shadow-2xl">
           
           <div 
             onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
             className={`relative w-20 h-20 transition-all duration-500 cursor-pointer shrink-0 ${isListening ? 'scale-105' : 'scale-100'}`}
           >
              <div className="w-full h-full rounded-full border-2 border-blue-500/40 overflow-hidden bg-black relative shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full border-4 border-black flex items-center justify-center shadow-lg ${isListening ? 'bg-red-600' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-[8px]`}></i>
              </div>
           </div>

           <div className="flex-1">
              <MiniPlayer 
                app={MEDIA_APPS.find(a => a.id === activeApp) || MEDIA_APPS[1]} 
                metadata={track} 
                onControl={(cmd) => handleToolCall({ name: 'media_transport', args: { command: cmd } })} 
                onExpand={() => {}} 
                transparent 
              />
           </div>

           <div className="hidden lg:flex flex-col items-end shrink-0">
              <span className="text-[9px] font-black text-blue-500 tracking-widest">{statusLog}</span>
              <p className="text-[7px] font-bold text-white/10 uppercase tracking-[0.4em]">Integrated Core V75</p>
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
