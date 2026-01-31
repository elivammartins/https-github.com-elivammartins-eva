
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, RouteStep } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const ALL_APPS: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-500', category: 'VIDEO' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-600', category: 'VIDEO' },
  { id: 'disney', name: 'Disney+', icon: 'fas fa-sparkles', color: 'text-blue-400', category: 'VIDEO' },
  { id: 'hbo', name: 'HBO Max', icon: 'fas fa-tv', color: 'text-purple-600', category: 'VIDEO' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-white', category: 'AUDIO' },
  { id: 'teams', name: 'Teams', icon: 'fab fa-microsoft', color: 'text-indigo-500', category: 'MEETING' },
  { id: 'zoom', name: 'Zoom', icon: 'fas fa-video', color: 'text-blue-500', category: 'MEETING' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'control_system',
    parameters: {
      type: Type.OBJECT,
      description: 'Controla apps de mídia, vídeo e reuniões.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'CLOSE', 'PLAY', 'PAUSE', 'NEXT', 'PREV', 'NAVIGATE'] },
        target: { type: Type.STRING, description: 'Nome do app, música ou destino.' },
        category: { type: Type.STRING, enum: ['AUDIO', 'VIDEO', 'MEETING', 'NAV'] }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('EVA V90: SENTINEL ATIVA');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO ROTA', 
    stops: [], 
    warnings: [], 
    currentLimit: 60,
    nextInstruction: { instruction: 'Prepare-se para iniciar', street: 'Ponto de Partida', distance: 0, maneuver: 'start' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'SISTEMA EVA V90', artist: 'PRONTA', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  // Check if API Key has been selected (mandatory for Veo and Gemini 3 Pro)
  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true); // Assume success to mitigate race condition
    }
  };

  const launchApp = (action: string, target: string, category: string) => {
    const q = encodeURIComponent(target);
    let url = '';

    if (action === 'NAVIGATE') {
      url = `waze://?q=${q}&navigate=yes`;
    } else {
      switch(target.toLowerCase()) {
        case 'spotify': url = 'spotify:'; break;
        case 'netflix': url = 'nflx:'; break;
        case 'youtube': url = 'vnd.youtube:'; break;
        case 'teams': url = 'msteams:'; break;
        default: url = `https://www.google.com/search?q=${q}`;
      }
    }
    
    setStatusLog(`EXECUTANDO: ${action} ${target}`);
    window.location.href = url;
  };

  const handleToolCall = (fc: any) => {
    const { args } = fc;
    launchApp(args.action, args.target, args.category);
    if (args.action === 'NAVIGATE') setTravel(p => ({ ...p, destination: args.target.toUpperCase() }));
    return { status: "success" };
  };

  const startVoiceSession = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Create a new instance right before use
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true);
            // Stream audio from the microphone to the model
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Process tool calls
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const result = handleToolCall(fc);
                sessionPromise.then(s => s.sendToolResponse({ 
                  functionResponses: { id: fc.id, name: fc.name, response: { result: result } } 
                }));
              }
            }
            
            // Process output audio with gapless playback
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtxRef.current.destination);
              
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            // Handle interruption
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            setIsListening(false);
            setIsSpeaking(false);
            inputAudioContext.close();
          },
          onerror: (e: any) => {
            console.error("Live API Error:", e);
            // Reset key selection if entity not found
            if ((e.message || "").includes("Requested entity was not found")) {
              setHasApiKey(false);
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA V90 SENTINEL.
          Sua missão é:
          1. Navegação Curva-a-Curva: Informe sempre o nome da rua e a distância para a próxima manobra.
          2. Controle Total: Você pode abrir e fechar qualquer player (Spotify, Netflix, Teams, etc) usando control_system.
          3. Tom de Voz: Seja uma co-piloto de elite, rápida, precisa e amigável.
          4. Segurança: Avise sobre radares e velocidade.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  if (!hasApiKey) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 text-center italic">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 rounded-full bg-blue-600/20 border border-blue-500 flex items-center justify-center mx-auto animate-pulse">
            <i className="fas fa-key text-4xl text-blue-500"></i>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter">EVA V90 SENTINEL</h1>
          <p className="text-white/60 text-sm font-bold uppercase tracking-widest">
            Para acessar o sistema de IA e os modelos de vídeo Veo, é necessário configurar sua chave de API paga do Google Cloud.
          </p>
          <div className="space-y-4">
            <button 
              onClick={handleOpenKey}
              className="w-full h-16 bg-blue-600 rounded-2xl text-white font-black text-lg shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:bg-blue-500 transition-all active:scale-95"
            >
              SELECIONAR API KEY
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[10px] text-blue-400 font-bold hover:underline"
            >
              SAIBA MAIS SOBRE FATURAMENTO E API KEYS
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic">
      
      {/* MAPA EM LAYER TOTAL */}
      <div className="absolute inset-0 z-0">
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} 
          onRouteUpdate={(steps) => setTravel(p => ({ ...p, allSteps: steps, nextInstruction: steps[0] }))} 
        />
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 h-full w-full flex flex-col p-6 pointer-events-none">
        
        {/* HEADER V90: VELOCÍMETRO E PRÓXIMA MANOBRA */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/40 backdrop-blur-3xl p-8 rounded-[45px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-9xl font-black italic tracking-tighter leading-none ${currentSpeed > (travel.currentLimit || 60) ? 'text-red-500 animate-pulse' : 'text-white'}`}>
              {currentSpeed}
            </span>
            <span className="text-xs font-black text-blue-500 tracking-[0.3em] mt-2">KM/H V90</span>
          </div>

          <div className="flex-1 mx-6">
            <div className="bg-blue-600/80 backdrop-blur-3xl p-6 rounded-[40px] border border-blue-400/30 shadow-2xl flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center text-4xl">
                 <i className={`fas fa-arrow-turn-up ${travel.nextInstruction?.maneuver === 'right' ? 'rotate-90' : travel.nextInstruction?.maneuver === 'left' ? '-rotate-90' : ''}`}></i>
              </div>
              <div>
                <p className="text-[12px] font-black text-white/60 tracking-widest uppercase">Próxima Manobra • {travel.nextInstruction?.distance || 0}m</p>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase leading-tight">
                  {travel.nextInstruction?.instruction || 'Siga em frente'}
                </h2>
                <p className="text-sm font-bold text-blue-200 uppercase">{travel.nextInstruction?.street || 'Via Atual'}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="bg-black/60 backdrop-blur-3xl p-4 rounded-[30px] border border-white/10 flex flex-col gap-3">
              <button className="w-12 h-12 rounded-xl bg-green-500/20 text-green-500 flex items-center justify-center"><i className="fab fa-spotify"></i></button>
              <button className="w-12 h-12 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center"><i className="fab fa-youtube"></i></button>
              <button className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center"><i className="fab fa-microsoft"></i></button>
            </div>
          </div>
        </header>

        {/* PAINEL LATERAL DE ROTA DETALHADA */}
        <main className="flex-1 flex justify-end items-center pt-8">
           <div className="w-full max-w-[440px] pointer-events-auto h-[75%]">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        {/* FOOTER: AVATAR E CONTROLES */}
        <footer className="h-[130px] mt-4 flex items-center gap-6 pointer-events-auto bg-black/40 backdrop-blur-3xl rounded-[45px] border border-white/10 px-8 shadow-2xl">
           <div 
             onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
             className={`relative w-24 h-24 transition-all duration-500 cursor-pointer ${isListening ? 'scale-110' : 'scale-100'}`}
           >
              <div className="w-full h-full rounded-full border-2 border-blue-500/40 overflow-hidden bg-black relative shadow-[0_0_40px_rgba(37,99,235,0.3)]">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full border-4 border-black flex items-center justify-center shadow-lg ${isListening ? 'bg-red-600' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-[10px]`}></i>
              </div>
           </div>

           <div className="flex-1">
              <MiniPlayer app={ALL_APPS[0]} metadata={track} onControl={(a) => setTrack(p => ({ ...p, isPlaying: a === 'PLAY' }))} onExpand={() => {}} transparent />
           </div>

           <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-6">
              <span className="text-[12px] font-black text-blue-500 tracking-widest">{statusLog}</span>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.5em]">SENTINEL CORE</p>
           </div>
        </footer>
      </div>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
      }} />
    </div>
  );
};

export default App;
