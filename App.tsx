
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, RouteStep, MediaViewState, RouteWarning } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import EntertainmentHub from './components/EntertainmentHub';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-purple-500', category: 'AUDIO', scheme: 'deezer://www.deezer.com/search/' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'https://www.netflix.com/search?q=' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-white', category: 'VIDEO', scheme: 'https://globoplay.globo.com/busca/?q=' },
  { id: 'max', name: 'Max', icon: 'fas fa-star', color: 'text-blue-600', category: 'VIDEO', scheme: 'https://www.max.com/search/' },
  { id: 'waze', name: 'Waze', icon: 'fab fa-waze', color: 'text-[#33CCFF]', category: 'NAV', scheme: 'waze://?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'system_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Executa comandos de sistema no Android Auto.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'NAVIGATE', 'MINIMIZE', 'MAXIMIZE', 'CLOSE_MEDIA', 'EXIT'] },
        target: { type: Type.STRING, description: 'App alvo (netflix, youtube, globoplay, max, etc).' },
        params: { type: Type.STRING, description: 'STRING DE BUSCA TÉCNICA: O Nome oficial e completo da obra/episódio conforme consta no catálogo original do streaming.' }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('EVA CORE V100 ACTIVE');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [pipPos, setPipPos] = useState({ x: 20, y: window.innerHeight - 320 });
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO DESTINO', 
    stops: [], warnings: [], currentLimit: 60,
    nextInstruction: { instruction: 'AGUARDANDO GPS', street: 'PANDORA CORE', distance: 0, maneuver: 'straight' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA V100', artist: 'SISTEMA ONLINE', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const handleSystemAction = async (fc: any) => {
    const { action, target, params } = fc.args;
    let finalQuery = params || target || "";

    if (action === 'EXIT') { setIsSystemBooted(false); stopVoiceSession(); return { status: "Saindo." }; }
    if (action === 'MINIMIZE') { setMediaState('PIP'); return { status: "Minimizado." }; }
    if (action === 'MAXIMIZE') { setMediaState('FULL'); return { status: "Expandido." }; }

    if (action === 'NAVIGATE') {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalQuery)}&limit=1`);
        const data = await res.json();
        if (data[0]) {
          const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setTravel(p => ({ ...p, destination: finalQuery.toUpperCase(), destinationCoords: coords }));
          window.open(`waze://?q=${encodeURIComponent(finalQuery)}&navigate=yes`, '_system');
          return { status: `GPS: ${finalQuery}.` };
        }
      } catch (e) { return { status: "Erro GPS." }; }
    }

    const app = APP_DATABASE.find(a => a.name.toLowerCase().includes(target.toLowerCase()) || a.id === target.toLowerCase());
    
    if (app) {
      setCurrentApp(app);
      setMediaState('FULL');
      setTrack(p => ({ ...p, title: finalQuery.toUpperCase(), artist: app.name, isPlaying: true }));
      
      const finalUrl = `${app.scheme}${encodeURIComponent(finalQuery)}`;
      window.open(finalUrl, '_system');
      
      setStatusLog(`PLAYER: ${finalQuery.toUpperCase()}`);
      return { status: `Lançando busca técnica: ${finalQuery}.` };
    }

    return { status: "Concluído." };
  };

  const startVoiceSession = async () => {
    if (isListening && sessionRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setStatusLog("EVA: CORE CONNECTED"); setIsSystemBooted(true);
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
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
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: res } } }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer; source.connect(outputCtxRef.current.destination);
              source.onended = () => { 
                sourcesRef.current.delete(source); if(sourcesRef.current.size === 0) setIsSpeaking(false); 
              };
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => { if (isSystemBooted) setTimeout(startVoiceSession, 200); },
          onerror: () => { if (isSystemBooted) setTimeout(startVoiceSession, 500); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA V100, assistente de IA para Android Auto.
          PROTOCOLOS DE BUSCA TÉCNICA (MUITO IMPORTANTE):
          1. Sua base de conhecimento contém os nomes oficiais de episódios e temporadas de séries.
          2. Quando o motorista pedir algo como "Episódio primeiro" ou "Episódio 1", você deve IGNORAR a palavra "episódio" dita por ele e RESOLVER o nome oficial no catálogo.
             EXEMPLO: Motorista diz "Stranger Things episódio primeiro".
             VOCÊ RESOLVE: "Stranger Things Capítulo Um: O Desaparecimento de Will Byers".
             VOCÊ CHAMA system_action: params="Stranger Things Capítulo Um: O Desaparecimento de Will Byers".
          3. NUNCA envie apenas "episódio 1" ou "episódio um" se o catálogo oficial usar outro termo (como "Capítulo Um", "Parte 1", etc).
          4. Se o catálogo oficial usa o formato "S01E01", use-o no params. O objetivo é que o motor de busca do app (Netflix, YouTube, Max, Globoplay) encontre o vídeo EXATO.
          5. Antes de abrir, diga o nome oficial: "Entendido. Iniciando 'Capítulo Um: O Desaparecimento de Will Byers' de Stranger Things no Netflix."
          6. Se o motorista não souber o app, use Netflix para séries e YouTube para vídeos genéricos.
          7. Mantenha as respostas curtas e focadas na execução.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setStatusLog("CORE OFFLINE"); }
  };

  const stopVoiceSession = () => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    setIsListening(false); setIsSpeaking(false);
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 font-sans italic">
         <div className="w-64 h-64 rounded-full border-4 border-blue-500/30 p-2 mb-10 animate-pulse">
            <div className="w-full h-full rounded-full bg-blue-600/20 flex items-center justify-center border-4 border-blue-500 shadow-[0_0_100px_rgba(37,99,235,0.4)]">
               <i className="fas fa-microchip text-7xl text-white"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black text-white uppercase mb-4 tracking-tighter">EVA CORE V100</h1>
         <button onClick={startVoiceSession} className="w-full max-w-sm h-20 bg-blue-600 rounded-[30px] text-white font-black text-xl shadow-2xl uppercase">BOOT SYSTEM</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic">
      <div className="absolute inset-0 z-0">
        <MapView 
          travel={travel} currentPosition={currentPos} viewMode="2D" 
          onSetDestination={() => setIsAddStopModalOpen(true)} 
          onRouteUpdate={(steps, duration, distance) => {
            setTravel(p => ({ 
              ...p, 
              allSteps: steps, 
              nextInstruction: steps[0],
              drivingTimeMinutes: Math.round(duration / 60),
              totalDistanceKm: Math.round(distance / 1000)
            }));
          }} 
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
      </div>

      {mediaState === 'FULL' && (
        <div className="absolute inset-0 z-[100] bg-black">
           <EntertainmentHub speed={currentSpeed} currentApp={currentApp} onMinimize={() => setMediaState('PIP')} onClose={() => setMediaState('HIDDEN')} />
        </div>
      )}

      {mediaState === 'PIP' && (
        <div 
          style={{ transform: `translate(${pipPos.x}px, ${pipPos.y}px)` }}
          className="absolute z-[200] w-80 h-48 bg-black rounded-3xl border-2 border-blue-500 shadow-2xl overflow-hidden cursor-move"
          onTouchMove={(e) => setPipPos({ x: e.touches[0].clientX - 160, y: e.touches[0].clientY - 96 })}
        >
           <EntertainmentHub speed={currentSpeed} currentApp={currentApp} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} />
        </div>
      )}

      <div className={`relative z-10 h-full w-full flex flex-col p-6 pointer-events-none transition-opacity duration-700 ${mediaState === 'FULL' ? 'opacity-0' : 'opacity-100'}`}>
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-10 rounded-[60px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-[10rem] font-black italic tracking-tighter leading-none ${currentSpeed > 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{currentSpeed}</span>
            <div className="font-black text-blue-500 uppercase text-xs mt-2 tracking-widest">KM/H • HUD ACTIVE</div>
          </div>

          <div className="flex-1 mx-8">
            <div className="bg-blue-600/90 backdrop-blur-xl p-8 rounded-[50px] border border-blue-400/40 shadow-2xl flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-5xl">
                 <i className={`fas fa-arrow-turn-up ${travel.nextInstruction?.maneuver?.includes('right') ? 'rotate-90' : travel.nextInstruction?.maneuver?.includes('left') ? '-rotate-90' : ''}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-white/70 uppercase">Em {travel.nextInstruction?.distance || 0}m</span>
                <h2 className="text-3xl font-black text-white uppercase truncate leading-none mb-1">{travel.nextInstruction?.instruction || 'Siga o Trecho'}</h2>
                <p className="text-lg font-bold text-blue-100 uppercase opacity-80 truncate">{travel.nextInstruction?.street || 'Rota Pandora V100'}</p>
              </div>
            </div>
          </div>

          <div className="bg-black/80 backdrop-blur-3xl p-4 rounded-[40px] border border-white/10 flex flex-col gap-4">
             {APP_DATABASE.slice(0, 7).map(app => (
               <button key={app.id} onClick={() => { setCurrentApp(app); setMediaState('FULL'); window.open(app.scheme, '_system'); }} className={`w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl ${app.color} active:scale-90 transition-all`}><i className={app.icon}></i></button>
             ))}
             <button onClick={() => stopVoiceSession()} className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 text-2xl flex items-center justify-center"><i className="fas fa-power-off"></i></button>
          </div>
        </header>

        <main className="flex-1 flex justify-end items-center pt-8">
           <div className="w-full max-w-[460px] pointer-events-auto h-[75%]">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        <footer className="h-[140px] mt-4 flex items-center gap-8 pointer-events-auto bg-black/80 backdrop-blur-3xl rounded-[55px] border border-white/10 px-10 shadow-2xl">
           <div onClick={startVoiceSession} className={`relative w-28 h-28 cursor-pointer transition-all ${isListening ? 'scale-110 shadow-[0_0_80px_rgba(37,99,235,0.4)]' : 'scale-100'}`}>
              <div className="w-full h-full rounded-full border-4 border-blue-500/30 overflow-hidden bg-black">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
           </div>
           <div className="flex-1">
              <MiniPlayer app={currentApp} metadata={track} onControl={(a) => handleSystemAction({ args: { action: a, target: currentApp.id } })} onExpand={() => setMediaState('FULL')} transparent />
           </div>
           <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-8 min-w-[200px]">
              <span className="text-[14px] font-black text-blue-500 tracking-widest uppercase truncate">{statusLog}</span>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.6em]">PANDORA V100 CORE</p>
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
