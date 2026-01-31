
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
  { id: 'prime', name: 'PRIME', icon: 'fas fa-play-circle', color: 'text-blue-300', category: 'VIDEO' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'control_media_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps de streaming e executa ou pesquisa conteúdos. Use "PLAY" para tentar rodar direto ou "SEARCH" para buscar.',
      properties: {
        app: { type: Type.STRING, enum: ['SPOTIFY', 'NETFLIX', 'PRIME', 'GLOBOPLAY', 'DISNEY', 'HBO', 'YOUTUBE'] },
        query: { type: Type.STRING, description: 'Conteúdo: nome de música, filme, série ou artista.' },
        action: { type: Type.STRING, enum: ['PLAY', 'SEARCH'] }
      },
      required: ['app', 'query', 'action']
    }
  },
  {
    name: 'media_transport',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla a reprodução: pausar, passar, voltar ou parar.',
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
      description: 'Altera o destino no Waze ou Google Maps.',
      properties: {
        destination: { type: Type.STRING },
        app: { type: Type.STRING, enum: ['WAZE', 'GOOGLE_MAPS'] }
      },
      required: ['destination']
    }
  }
];

const App: React.FC = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA CORE V70');
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');

  const [track, setTrack] = useState<TrackMetadata>({
    title: 'EVA SYNC', artist: 'SISTEMA PANDORA', isPlaying: false, progress: 0
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO DEFINIDO', 
    stops: [],
    warnings: [],
    nextInstruction: { instruction: 'Eva no Comando', distance: '0m', icon: 'fa-check-double' }
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);

  const handleToolCall = (fc: any) => {
    console.log("EVA Executando:", fc);
    const { name, args } = fc;

    if (name === 'control_media_app') {
      const q = encodeURIComponent(args.query);
      let url = '';
      
      switch(args.app) {
        case 'SPOTIFY': 
          url = args.action === 'PLAY' ? `spotify:play:search:${q}` : `spotify:search:${q}`; 
          break;
        case 'NETFLIX': 
          url = `nflx://www.netflix.com/search?q=${q}`; 
          break;
        case 'YOUTUBE': 
          url = args.action === 'PLAY' 
            ? `https://www.youtube.com/embed?listType=search&list=${q}&autoplay=1` 
            : `vnd.youtube://results?search_query=${q}`;
          break;
        case 'HBO': url = `hbomax://search?q=${q}`; break;
        case 'DISNEY': url = `disneyplus://search?q=${q}`; break;
        case 'PRIME': url = `https://www.primevideo.com/search?phrase=${q}`; break;
        case 'GLOBOPLAY': url = `https://globoplay.globo.com/busca/?q=${q}`; break;
      }
      
      // Abrindo em nova aba/janela para disparar o Deep Link do Android
      const win = window.open(url, '_blank');
      if (win) win.focus();
      
      setTrack(p => ({ ...p, title: args.query.toUpperCase(), artist: args.app, isPlaying: true }));
    } 
    
    else if (name === 'media_transport') {
      setTrack(p => ({ ...p, isPlaying: args.command === 'PLAY' }));
      // Feedback visual simples do comando
      setStatusLog(`MÍDIA: ${args.command}`);
    }

    else if (name === 'update_navigation') {
      const q = encodeURIComponent(args.destination);
      const url = args.app === 'GOOGLE_MAPS' 
        ? `https://www.google.com/maps/dir/?api=1&destination=${q}`
        : `waze://?q=${q}&navigate=yes`;
      window.open(url, '_blank');
      setTravel(p => ({ ...p, destination: args.destination.toUpperCase() }));
    }

    return { status: "success", info: "Comando enviado para o sistema." };
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
          onopen: () => { setStatusLog('EVA OUVINDO'); setIsListening(true); 
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
          onclose: () => { setStatusLog('PANDORA CORE V70'); setIsListening(false); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA, co-piloto e braço direito do Elivam Martins. 
          Sua personalidade: informal, parceira, usa gírias de estrada.
          Seu avatar fica no rodapé, mas você tem controle total.
          Você pode abrir e selecionar conteúdos no Netflix, Spotify, YouTube, Prime e HBO.
          Use "control_media_app" com "PLAY" se o usuário quiser ouvir ou ver algo agora.
          Use "media_transport" para pausar, passar ou voltar.
          Você também controla a navegação pelo Waze e Google Maps.
          Sempre responda em Português (Brasil) de forma natural.`
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
      
      {/* BACKGROUND: MAPA FULL (Imersivo) */}
      <div className="absolute inset-0 z-0 opacity-40">
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
      </div>

      {/* CAMADA DE INTERFACE HUD */}
      <div className="relative z-10 h-full w-full flex flex-col pointer-events-none p-6">
        
        {/* HEADER: VELOCIDADE E APPS RÁPIDOS */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-6 rounded-[35px] border border-white/10 shadow-2xl flex items-baseline gap-2">
             <span className="text-6xl font-black italic tracking-tighter leading-none">{currentSpeed}</span>
             <span className="text-[10px] font-black text-blue-500 uppercase">KM/H</span>
          </div>

          <div className="flex gap-3">
             {MEDIA_APPS.slice(0, 5).map(app => (
               <button key={app.id} onClick={() => setActiveApp(app.id)} className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all backdrop-blur-md ${activeApp === app.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/60 border-white/10 text-white/40'}`}>
                 <i className={`${app.icon} text-lg`}></i>
               </button>
             ))}
          </div>
        </header>

        {/* MIDDLE: PAINEL DE NAVEGAÇÃO À DIREITA */}
        <main className="flex-1 flex justify-end items-center">
           <div className="w-full max-w-[400px] pointer-events-auto">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        {/* FOOTER: ÚLTIMA LINHA (AVATAR + PLAYER) */}
        <footer className="h-[120px] mt-4 flex items-center gap-6 pointer-events-auto bg-black/60 backdrop-blur-xl rounded-[40px] border border-white/10 px-6 shadow-2xl">
           
           {/* AVATAR DA EVA (INTEGRADO NO RODAPÉ) */}
           <div 
             onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
             className={`relative w-24 h-24 transition-all duration-500 cursor-pointer shrink-0 ${isListening ? 'scale-105' : 'scale-100'}`}
           >
              <div className="w-full h-full rounded-full border-2 border-blue-500/30 overflow-hidden bg-black relative shadow-[0_0_30px_rgba(37,99,235,0.3)]">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-1 -right-1 w-7 h-7 rounded-full border-4 border-black flex items-center justify-center ${isListening ? 'bg-red-600' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-[9px]`}></i>
              </div>
           </div>

           {/* PLAYER CENTRALIZADO */}
           <div className="flex-1">
              <MiniPlayer 
                app={MEDIA_APPS.find(a => a.id === activeApp) || MEDIA_APPS[1]} 
                metadata={track} 
                onControl={(cmd) => handleToolCall({ name: 'media_transport', args: { command: cmd } })} 
                onExpand={() => {}} 
                transparent 
              />
           </div>

           {/* BOTÃO DE STATUS / LOG */}
           <div className="hidden lg:flex flex-col items-end shrink-0">
              <span className="text-[10px] font-black text-blue-500 tracking-widest">{statusLog}</span>
              <span className="text-[8px] font-bold text-white/30 uppercase">Pandora V70 Active</span>
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
