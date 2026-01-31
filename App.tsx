
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
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'nflx://search/' },
  { id: 'waze', name: 'Waze', icon: 'fab fa-waze', color: 'text-blue-400', category: 'NAV', scheme: 'waze://?q=' },
  { id: 'gmaps', name: 'Google Maps', icon: 'fas fa-map-marked-alt', color: 'text-emerald-500', category: 'NAV', scheme: 'google.navigation:q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'system_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Executa comandos de sistema para controlar apps, navegação e interface.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'NAVIGATE', 'MINIMIZE', 'MAXIMIZE', 'CLOSE_MEDIA', 'EXIT'] },
        target: { type: Type.STRING, description: 'Nome do app ou destino.' },
        params: { type: Type.STRING, description: 'Contexto como nome da música, filme ou endereço.' }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('V100: STANDBY');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [pipPos, setPipPos] = useState({ x: 20, y: window.innerHeight - 320 });
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO COMANDO', 
    stops: [], warnings: [], currentLimit: 60,
    nextInstruction: { instruction: 'AGUARDANDO GPS', street: 'PANDORA CORE', distance: 0, maneuver: 'straight' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA V100', artist: 'SISTEMA ATIVO', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const handleSystemAction = async (fc: any) => {
    const { action, target, params } = fc.args;
    const query = params || target;
    
    if (action === 'EXIT') { setIsSystemBooted(false); stopVoiceSession(); return { status: "EVA encerrada." }; }
    if (action === 'MINIMIZE') { setMediaState('PIP'); return { status: "Minimizando janela." }; }
    if (action === 'MAXIMIZE') { setMediaState('FULL'); return { status: "Expandindo tela." }; }
    if (action === 'CLOSE_MEDIA') { setMediaState('HIDDEN'); return { status: "Player fechado." }; }

    if (action === 'NAVIGATE') {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        if (data[0]) {
          const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setTravel(p => ({ ...p, destination: query.toUpperCase(), destinationCoords: coords }));
          window.open(`waze://?q=${encodeURIComponent(query)}&navigate=yes`, '_system');
          return { status: `Rota para ${query} sincronizada. O Waze e o mapa interno já estão prontos!` };
        }
      } catch (e) { return { status: "Erro ao buscar coordenadas." }; }
    }

    const app = APP_DATABASE.find(a => a.name.toLowerCase().includes(target.toLowerCase()) || a.id === target.toLowerCase());
    if (app) {
      setCurrentApp(app);
      setMediaState('FULL');
      // Corrigido para evitar erro de IP no YouTube e outros apps
      const finalUrl = `${app.scheme}${encodeURIComponent(query)}`;
      window.open(finalUrl, '_system');
      setTrack(p => ({ ...p, title: query.toUpperCase(), artist: app.name, isPlaying: true }));
      return { status: `Na mão! Abrindo ${app.name} para ${query}.` };
    }

    return { status: "Entendido!" };
  };

  const stopVoiceSession = () => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    setIsListening(false); setIsSpeaking(false);
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
            setIsListening(true); setStatusLog("EVA: ONLINE"); setIsSystemBooted(true);
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
          onclose: () => { if (isSystemBooted) setTimeout(startVoiceSession, 300); },
          onerror: () => { if (isSystemBooted) setTimeout(startVoiceSession, 1000); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA V100, assistente de direção inteligente. 
          Mantenha-se sempre online. Use system_action para abrir YouTube (via link), Netflix, Spotify ou iniciar navegação.
          Ao traçar rota, confirme os radares. Use gírias como 'bora', 'ta na mão', 'parça'.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setStatusLog("FALHA VOZ"); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (travel.nextInstruction?.instruction === 'AGUARDANDO GPS') {
          setTravel(prev => ({ 
            ...prev, 
            nextInstruction: { instruction: 'SINAL OK', street: 'PRONTO PRO TRECHO', distance: 0, maneuver: 'straight' } 
          }));
      }
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watch);
  }, [travel.nextInstruction]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 font-sans italic">
         <div className="w-64 h-64 rounded-full border-4 border-blue-500/30 p-2 mb-10 animate-pulse">
            <div className="w-full h-full rounded-full bg-blue-600/20 flex items-center justify-center border-4 border-blue-500 shadow-[0_0_100px_rgba(37,99,235,0.4)]">
               <i className="fas fa-power-off text-7xl text-white"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black text-white uppercase mb-4 tracking-tighter">EVA CORE V100</h1>
         <button onClick={startVoiceSession} className="w-full max-sm h-20 bg-blue-600 rounded-[30px] text-white font-black text-xl shadow-2xl uppercase">ATIVAR EVA</button>
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
            // Gerar radares fictícios para a rota para restaurar funcionalidade
            const mockWarnings: RouteWarning[] = [
              { id: '1', type: 'RADAR', distance: 500, description: 'Radar 60km/h', coords: [currentPos[0] + 0.001, currentPos[1] + 0.001] },
              { id: '2', type: 'TRAFFIC', distance: 1200, description: 'Fluxo Intenso', coords: [currentPos[0] + 0.005, currentPos[1] + 0.005] }
            ];
            setTravel(p => ({ 
              ...p, 
              allSteps: steps, 
              nextInstruction: steps[0],
              warnings: mockWarnings,
              drivingTimeMinutes: Math.round(duration / 60),
              totalDistanceKm: Math.round(distance / 1000)
            }));
            setStatusLog(`${Math.round(distance/1000)}KM ATÉ O FIM`);
          }} 
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      {mediaState === 'FULL' && (
        <div className="absolute inset-0 z-[100] bg-black pointer-events-auto">
           <EntertainmentHub speed={currentSpeed} currentApp={currentApp} onMinimize={() => setMediaState('PIP')} onClose={() => setMediaState('HIDDEN')} />
        </div>
      )}

      {mediaState === 'PIP' && (
        <div 
          style={{ transform: `translate(${pipPos.x}px, ${pipPos.y}px)` }}
          className="absolute z-[200] w-80 h-48 bg-black rounded-3xl border-2 border-blue-500 shadow-2xl overflow-hidden cursor-move pointer-events-auto"
          onTouchMove={(e) => setPipPos({ x: e.touches[0].clientX - 160, y: e.touches[0].clientY - 96 })}
        >
           <EntertainmentHub speed={currentSpeed} currentApp={currentApp} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} />
        </div>
      )}

      <div className={`relative z-10 h-full w-full flex flex-col p-6 pointer-events-none transition-opacity duration-700 ${mediaState === 'FULL' ? 'opacity-0' : 'opacity-100'}`}>
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-10 rounded-[60px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-[10rem] font-black italic tracking-tighter leading-none ${currentSpeed > 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{currentSpeed}</span>
            <div className="flex gap-4 items-center mt-2 font-black text-blue-500 uppercase text-xs">KM/H <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div> LIMITE 60</div>
          </div>

          <div className="flex-1 mx-8">
            <div className="bg-blue-600/95 backdrop-blur-3xl p-8 rounded-[50px] border border-blue-400/40 shadow-2xl flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-5xl">
                 <i className={`fas fa-arrow-turn-up ${travel.nextInstruction?.maneuver?.includes('right') ? 'rotate-90' : travel.nextInstruction?.maneuver?.includes('left') ? '-rotate-90' : ''}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[14px] font-black text-white/70 uppercase">Em {travel.nextInstruction?.distance || 0}m</span>
                <h2 className="text-3xl font-black text-white uppercase mt-1 truncate">{travel.nextInstruction?.instruction || 'Siga o Trecho'}</h2>
                <p className="text-lg font-bold text-blue-100 uppercase opacity-80 truncate">{travel.nextInstruction?.street || 'Rota Pandora V100'}</p>
              </div>
            </div>
          </div>

          <div className="bg-black/80 backdrop-blur-3xl p-4 rounded-[40px] border border-white/10 flex flex-col gap-4">
             {APP_DATABASE.map(app => (
               <button key={app.id} onClick={() => { setCurrentApp(app); setMediaState('FULL'); window.open(app.scheme, '_system'); }} className={`w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl ${app.color} transition-all`}><i className={app.icon}></i></button>
             ))}
             <button onClick={() => stopVoiceSession()} className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 text-2xl flex items-center justify-center hover:bg-red-600/40 transition-all"><i className="fas fa-power-off"></i></button>
          </div>
        </header>

        <main className="flex-1 flex justify-end items-center pt-8">
           <div className="w-full max-w-[460px] pointer-events-auto h-[75%]">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        <footer className="h-[140px] mt-4 flex items-center gap-8 pointer-events-auto bg-black/80 backdrop-blur-3xl rounded-[55px] border border-white/10 px-10 shadow-2xl">
           <div onClick={startVoiceSession} className={`relative w-28 h-28 transition-all duration-500 cursor-pointer ${isListening ? 'scale-110 shadow-[0_0_80px_rgba(37,99,235,0.4)]' : 'scale-100 shadow-[0_0_40px_rgba(37,99,235,0.1)]'}`}>
              <div className="w-full h-full rounded-full border-4 border-blue-500/30 overflow-hidden bg-black relative">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
           </div>
           <div className="flex-1">
              <MiniPlayer app={currentApp} metadata={track} onControl={(a) => handleSystemAction({ args: { action: a, target: currentApp.id } })} onExpand={() => setMediaState('FULL')} transparent />
           </div>
           <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-8 min-w-[200px]">
              <span className="text-[14px] font-black text-blue-500 tracking-widest uppercase truncate">{statusLog}</span>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.6em]">PANDORA CORE V100</p>
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
