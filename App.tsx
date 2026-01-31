
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, RouteStep } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'youtube-music:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-white', category: 'AUDIO', scheme: 'deezer:' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'vnd.youtube:' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'nflx:' },
  { id: 'prime', name: 'Prime Video', icon: 'fab fa-amazon', color: 'text-blue-400', category: 'VIDEO', scheme: 'primevideo:' },
  { id: 'hbo', name: 'HBO Max', icon: 'fas fa-tv', color: 'text-purple-600', category: 'VIDEO', scheme: 'hbomax:' },
  { id: 'disney', name: 'Disney+', icon: 'fas fa-sparkles', color: 'text-blue-600', category: 'VIDEO', scheme: 'disneyplus:' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-orange-500', category: 'VIDEO', scheme: 'globoplay:' },
  { id: 'skytv', name: 'SkyTV+', icon: 'fas fa-satellite-dish', color: 'text-blue-500', category: 'TV', scheme: 'skytv:' },
  { id: 'clarotv', name: 'ClaroTV+', icon: 'fas fa-tv', color: 'text-red-500', category: 'TV', scheme: 'clarotv:' },
  { id: 'teams', name: 'Teams', icon: 'fab fa-microsoft', color: 'text-indigo-500', category: 'MEETING', scheme: 'msteams:' },
  { id: 'zoom', name: 'Zoom', icon: 'fas fa-video', color: 'text-blue-400', category: 'MEETING', scheme: 'zoomus:' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'system_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Executa comandos de sistema, mídia, navegação e abertura de apps.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'CLOSE', 'PLAY', 'PAUSE', 'NEXT', 'PREV', 'NAVIGATE', 'MAXIMIZE', 'MINIMIZE'] },
        target: { type: Type.STRING, description: 'Nome do app (ex: Netflix) ou destino.' },
        params: { type: Type.STRING, description: 'Informação adicional como música ou rua.' }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(!!process.env.API_KEY);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('V100 SENTINEL: ESCUTA CALIBRADA');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO ROTA', 
    stops: [], 
    warnings: [], 
    currentLimit: 60,
    nextInstruction: { instruction: 'AGUARDANDO GPS', street: 'SENTINEL V100', distance: 0, maneuver: 'straight' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'SISTEMA EVA V100', artist: 'PRONTA', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const checkKey = async () => {
      if (!process.env.API_KEY) {
        if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
          setHasApiKey(true);
        }
      }
    };
    checkKey();
  }, []);

  const handleSystemAction = (fc: any) => {
    const { action, target, params } = fc.args;
    const app = APP_DATABASE.find(a => a.name.toLowerCase().includes(target.toLowerCase()) || a.id === target.toLowerCase());
    
    if (action === 'NAVIGATE') {
      const q = encodeURIComponent(params || target);
      window.location.href = `waze://?q=${q}&navigate=yes`;
      setTravel(p => ({ ...p, destination: (params || target).toUpperCase() }));
      return { status: "Navegação disparada no Waze." };
    }

    if (app) {
      if (action === 'OPEN') window.location.href = app.scheme;
      setStatusLog(`${action}: ${app.name}`);
      return { status: `Ação ${action} executada no ${app.name}` };
    }

    return { status: "Comando processado via MediaSession API" };
  };

  const startVoiceSession = async () => {
    try {
      // Otimização para ruído de motor: Forçar cancelamento de eco e redução de ruído
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (!outputCtxRef.current) {
        outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true);
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = handleSystemAction(fc);
                sessionPromise.then(s => s.sendToolResponse({ 
                  functionResponses: { id: fc.id, name: fc.name, response: { result: res } } 
                }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtxRef.current.destination);
              source.onended = () => { 
                sourcesRef.current.delete(source); 
                if(sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            setIsListening(false);
            setIsSpeaking(false);
          },
          onerror: (e) => {
            console.error("Live Error:", e);
            if (e.message?.includes("entity was not found")) setHasApiKey(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA V100 SENTINEL.
          PERSONALIDADE: Descolada, inteligente, ultra-precisa e focada em segurança. Você fala como uma IA de elite.
          AMBIENTE: Você está em um carro em movimento. Ignore ruídos de motor, vento e estrada. Foque APENAS na voz do motorista.
          MISSÃO:
          1. Controle Universal: Você abre e controla apps (Spotify, Netflix, Waze, Teams, etc).
          2. Navegação: Narre manobras curva-a-curva proativamente.
          3. Resiliência: Se o áudio estiver ruim por causa do barulho do carro, use o contexto para entender o que o motorista quer.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    }, null, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  const getSpeedStyle = () => {
    if (currentSpeed > (travel.currentLimit || 60) + 5) return 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]';
    if (currentSpeed > (travel.currentLimit || 60) - 5) return 'text-yellow-400';
    return 'text-white';
  };

  if (!hasApiKey) {
    return (
      <div className="h-screen bg-black flex items-center justify-center p-10 flex-col gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-blue-600/20 border border-blue-500 flex items-center justify-center mb-4">
          <i className="fas fa-lock text-3xl text-blue-500"></i>
        </div>
        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Ativação Sentinel V100</h1>
        <button 
          onClick={() => (window as any).aistudio.openSelectKey()} 
          className="px-10 py-5 bg-blue-600 rounded-3xl font-black text-white italic hover:bg-blue-500 transition-all active:scale-95"
        >
          SELECIONAR API KEY
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic selection:bg-blue-500">
      
      {/* LAYER DE MAPA - TRANSPARÊNCIA MÁXIMA */}
      <div className="absolute inset-0 z-0">
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} 
          onRouteUpdate={(steps) => setTravel(p => ({ ...p, allSteps: steps, nextInstruction: steps[0] }))} 
        />
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 h-full w-full flex flex-col p-6 pointer-events-none">
        
        {/* WIDGETS HUD V100 */}
        <header className="flex justify-between items-start pointer-events-auto">
          {/* VELOCÍMETRO GIGANTE */}
          <div className="bg-black/60 backdrop-blur-3xl p-10 rounded-[60px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-[10rem] font-black italic tracking-tighter leading-none transition-all duration-300 ${getSpeedStyle()}`}>
              {currentSpeed}
            </span>
            <div className="flex gap-4 items-center mt-2">
              <span className="text-xs font-black text-blue-500 tracking-[0.4em]">KM/H</span>
              <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
              <span className="text-xs font-black text-white/40 uppercase">Limite {travel.currentLimit}</span>
            </div>
          </div>

          {/* PRÓXIMA MANOBRA HUD */}
          <div className="flex-1 mx-8">
            <div className="bg-blue-600/90 backdrop-blur-3xl p-8 rounded-[50px] border border-blue-400/40 shadow-2xl flex items-center gap-8 animate-in fade-in slide-in-from-top duration-700">
              <div className="w-24 h-24 rounded-3xl bg-white/15 flex items-center justify-center text-5xl text-white shadow-inner">
                 <i className={`fas fa-arrow-turn-up ${travel.nextInstruction?.maneuver === 'right' ? 'rotate-90' : travel.nextInstruction?.maneuver === 'left' ? '-rotate-90' : ''}`}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[14px] font-black text-white/70 tracking-widest uppercase">Em {travel.nextInstruction?.distance || 0} Metros</span>
                  <div className="h-6 px-3 rounded-full bg-white/10 flex items-center gap-2 border border-white/10">
                    <i className="fas fa-satellite text-[10px] text-blue-300"></i>
                    <span className="text-[10px] font-black uppercase">V100 Active</span>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                  {travel.nextInstruction?.instruction || 'Siga em Frente'}
                </h2>
                <p className="text-lg font-bold text-blue-100 uppercase mt-1 opacity-80">{travel.nextInstruction?.street || 'Via Principal'}</p>
              </div>
            </div>
          </div>

          {/* SHORTCUTS DE APPS */}
          <div className="bg-black/60 backdrop-blur-3xl p-4 rounded-[40px] border border-white/10 flex flex-col gap-4">
             <button className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-500 text-2xl flex items-center justify-center"><i className="fab fa-spotify"></i></button>
             <button className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 text-2xl flex items-center justify-center"><i className="fab fa-youtube"></i></button>
             <button className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl flex items-center justify-center"><i className="fas fa-grid-2"></i></button>
          </div>
        </header>

        {/* LISTA DE TRAJETO CURVA-A-CURVA */}
        <main className="flex-1 flex justify-end items-center pt-8">
           <div className="w-full max-w-[460px] pointer-events-auto h-[75%]">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        {/* FOOTER: CONTROLE E AVATAR */}
        <footer className="h-[140px] mt-4 flex items-center gap-8 pointer-events-auto bg-black/50 backdrop-blur-3xl rounded-[55px] border border-white/10 px-10 shadow-2xl">
           <div 
             onClick={() => isListening ? sessionRef.current?.close() : startVoiceSession()}
             className={`relative w-28 h-28 transition-all duration-500 cursor-pointer ${isListening ? 'scale-110' : 'scale-100'}`}
           >
              <div className="w-full h-full rounded-full border-4 border-blue-500/30 overflow-hidden bg-black relative shadow-[0_0_60px_rgba(37,99,235,0.4)]">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-1 -right-1 w-10 h-10 rounded-full border-4 border-black flex items-center justify-center shadow-lg ${isListening ? 'bg-red-600' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-sm`}></i>
              </div>
           </div>

           <div className="flex-1">
              <MiniPlayer app={APP_DATABASE[0]} metadata={track} onControl={() => {}} onExpand={() => {}} transparent />
           </div>

           <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-8">
              <span className="text-[14px] font-black text-blue-500 tracking-widest">{statusLog}</span>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.6em]">PANDORA EVA V100</p>
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
