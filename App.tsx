
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
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'vnd.youtube://results?search_query=' },
  { id: 'waze', name: 'Waze', icon: 'fab fa-waze', color: 'text-blue-400', category: 'NAV', scheme: 'waze://?q=' },
  { id: 'ytmusic', name: 'YT Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'system_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Executa comandos de sistema: abrir apps, tocar música ou navegar.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'NAVIGATE', 'EXIT'] },
        target: { type: Type.STRING, description: 'Nome do app ou destino.' },
        params: { type: Type.STRING, description: 'Música, artista ou endereço.' }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState(!!process.env.API_KEY);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('V100: ESCANEANDO TRECHO');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'ROTA PANDORA', 
    stops: [], 
    warnings: [], 
    currentLimit: 60,
    nextInstruction: { instruction: 'PRONTA PRO TRECHO', street: 'SENTINEL V100', distance: 0, maneuver: 'straight' },
    drivingTimeMinutes: 0,
    totalDistanceKm: 0
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'SISTEMA EVA', artist: 'ONLINE', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const handleSystemAction = async (fc: any) => {
    const { action, target, params } = fc.args;
    
    if (action === 'EXIT') {
      stopVoiceSession();
      return { status: "Entendido, mestre. EVA entrando em standby agora. Boa estrada!" };
    }

    if (action === 'NAVIGATE') {
      setStatusLog(`NAV: ${target}`);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(params || target)}&limit=1`);
        const data = await res.json();
        if (data[0]) {
          const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
          setTravel(p => ({ ...p, destination: (params || target).toUpperCase(), destinationCoords: coords }));
          return { status: `Na mão, parça! Rota pra ${target} calculada. Segue o mapa.` };
        }
      } catch (e) { return { status: "Deu erro no GPS, mas tô tentando reconectar." }; }
    }

    const app = APP_DATABASE.find(a => a.name.toLowerCase().includes(target.toLowerCase()) || a.id === target.toLowerCase());
    if (app) {
      const query = params || target;
      const url = `${app.scheme}${encodeURIComponent(query)}`;
      window.location.href = url;
      setTrack(p => ({ ...p, title: query.toUpperCase(), artist: app.name, isPlaying: true }));
      return { status: `Bora! Abrindo o ${app.name} pra soltar o som.` };
    }

    return { status: "Feito, parça! Seguimos no trecho." };
  };

  const stopVoiceSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
    setStatusLog("EVA: STANDBY");
  };

  const startVoiceSession = async () => {
    if (isListening) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true);
            setStatusLog("EVA: ESCUTANDO...");
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
                const res = await handleSystemAction(fc);
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
          },
          onclose: () => stopVoiceSession(),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA V100 SENTINEL.
          PERSONALIDADE: Parceira de estrada do motorista. Use gírias brasileiras como "parça", "mestre", "bora", "tá safo".
          Sua vibe é de co-piloto de elite: rápida, inteligente e focada no asfalto.
          IMPORTANTE: Você deve ficar ativa até ser desligada. Se pedirem pra sair ou tchau, use system_action EXIT.
          Se pedirem música ou navegar, use as ferramentas. Ignore o ruído de fundo do motor.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const watch = navigator.geolocation.watchPosition((p) => {
      setCurrentPos([p.coords.latitude, p.coords.longitude]);
      setCurrentSpeed(p.coords.speed ? Math.round(p.coords.speed * 3.6) : 0);
      if (travel.nextInstruction?.instruction === 'AGUARDANDO GPS') {
          setTravel(prev => ({ 
            ...prev, 
            nextInstruction: { ...prev.nextInstruction!, instruction: 'SINAL OK', street: 'PRONTO PRO TRECHO' } 
          }));
          setStatusLog("SINAL GPS: ATIVO");
      }
    }, null, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [travel.nextInstruction]);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic selection:bg-blue-500">
      <div className="absolute inset-0 z-0">
        <MapView 
          travel={travel} 
          currentPosition={currentPos} 
          viewMode="2D" 
          onSetDestination={() => setIsAddStopModalOpen(true)} 
          onRouteUpdate={(steps, duration, distance) => {
            setTravel(p => ({ 
              ...p, 
              allSteps: steps, 
              nextInstruction: steps[0],
              drivingTimeMinutes: Math.round(duration / 60),
              totalDistanceKm: Math.round(distance / 1000)
            }));
            setStatusLog("ROTA SINCRONIZADA");
          }} 
        />
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
      </div>

      <div className="relative z-10 h-full w-full flex flex-col p-6 pointer-events-none">
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-10 rounded-[60px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-[10rem] font-black italic tracking-tighter leading-none transition-all duration-300 ${currentSpeed > (travel.currentLimit || 60) ? 'text-red-500 animate-pulse' : 'text-white'}`}>{currentSpeed}</span>
            <div className="flex gap-4 items-center mt-2 font-black text-blue-500 uppercase tracking-widest text-xs">KM/H <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div> LIMITE {travel.currentLimit}</div>
          </div>

          <div className="flex-1 mx-8">
            <div className="bg-blue-600/95 backdrop-blur-3xl p-8 rounded-[50px] border border-blue-400/40 shadow-2xl flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-5xl text-white">
                 <i className={`fas fa-arrow-turn-up ${travel.nextInstruction?.maneuver?.includes('right') ? 'rotate-90' : travel.nextInstruction?.maneuver?.includes('left') ? '-rotate-90' : ''}`}></i>
              </div>
              <div className="flex-1">
                <span className="text-[14px] font-black text-white/70 tracking-widest uppercase">Em {travel.nextInstruction?.distance || 0} Metros</span>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none mt-1">{travel.nextInstruction?.instruction || 'Siga o Radar, Parça'}</h2>
                <p className="text-lg font-bold text-blue-100 uppercase opacity-80 mt-1">{travel.nextInstruction?.street || 'Rota Pandora Ativa'}</p>
              </div>
            </div>
          </div>

          <div className="bg-black/80 backdrop-blur-3xl p-4 rounded-[40px] border border-white/10 flex flex-col gap-4">
             <button onClick={() => window.location.href='spotify:'} className="w-14 h-14 rounded-2xl bg-green-500/20 text-green-500 text-2xl flex items-center justify-center hover:bg-green-500/40 transition-all"><i className="fab fa-spotify"></i></button>
             <button onClick={() => window.location.href='waze://'} className="w-14 h-14 rounded-2xl bg-blue-400/20 text-blue-400 text-2xl flex items-center justify-center hover:bg-blue-400/40 transition-all"><i className="fab fa-waze"></i></button>
             <button onClick={() => setIsAddStopModalOpen(true)} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl flex items-center justify-center hover:bg-white/20 transition-all"><i className="fas fa-search"></i></button>
             <button onClick={() => stopVoiceSession()} className="w-14 h-14 rounded-2xl bg-red-600/20 text-red-500 text-2xl flex items-center justify-center hover:bg-red-600/40 transition-all"><i className="fas fa-power-off"></i></button>
          </div>
        </header>

        <main className="flex-1 flex justify-end items-center pt-8">
           <div className="w-full max-w-[460px] pointer-events-auto h-[75%]">
              <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
           </div>
        </main>

        <footer className="h-[140px] mt-4 flex items-center gap-8 pointer-events-auto bg-black/80 backdrop-blur-3xl rounded-[55px] border border-white/10 px-10 shadow-2xl">
           <div 
             onClick={startVoiceSession} 
             className={`relative w-28 h-28 transition-all duration-500 cursor-pointer ${isListening ? 'scale-110 shadow-[0_0_80px_rgba(239,68,68,0.5)]' : 'scale-100 shadow-[0_0_60px_rgba(37,99,235,0.4)]'}`}
           >
              <div className="w-full h-full rounded-full border-4 border-blue-500/30 overflow-hidden bg-black relative">
                 <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
              </div>
              <div className={`absolute -top-1 -right-1 w-10 h-10 rounded-full border-4 border-black flex items-center justify-center shadow-lg ${isListening ? 'bg-red-600' : 'bg-emerald-500'}`}>
                 <i className={`fas ${isListening ? 'fa-microphone' : 'fa-check'} text-sm`}></i>
              </div>
           </div>
           <div className="flex-1">
              <MiniPlayer 
                app={APP_DATABASE[0]} 
                metadata={track} 
                onControl={(a) => handleSystemAction({ args: { action: a, target: 'spotify' } })} 
                onExpand={() => {}} 
                transparent 
              />
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
