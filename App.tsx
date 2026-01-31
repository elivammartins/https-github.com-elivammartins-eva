
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import VeoModal from './components/VeoModal';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const MEDIA_APPS: MediaApp[] = [
  { id: 'nav', name: 'Navegação', icon: 'fas fa-location-arrow', color: 'text-emerald-400', category: 'NAV' },
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO' },
  { id: 'engine', name: 'Veículo', icon: 'fas fa-car-side', color: 'text-orange-500', category: 'METRICS' },
];

const App: React.FC = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA: PRONTA');
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isVeoModalOpen, setIsVeoModalOpen] = useState(false);
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);

  const [track] = useState<TrackMetadata>({
    title: 'AGUARDANDO MÍDIA', artist: 'PANDORA SYNC...', isPlaying: false, progress: 0, duration: 180
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'DEFINIR DESTINO', 
    eta: '--:--', distanceRemaining: '0.0 KM', drivingTimeMinutes: 0, elapsedTimeMinutes: 0, stops: [],
    nextInstruction: { instruction: 'Eva Ativa', distance: '0m', icon: 'fa-check-circle' }
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanupAudioResources = async () => {
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (inputCtxRef.current) { try { await inputCtxRef.current.close(); } catch(e) {} inputCtxRef.current = null; }
    if (outputCtxRef.current) { try { await outputCtxRef.current.close(); } catch(e) {} outputCtxRef.current = null; }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsListening(false);
    setIsSpeaking(false);
  };

  const startVoiceSession = async () => {
    setApiErrorMessage(null);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        setApiErrorMessage("ERRO: API_KEY não configurada no Vercel.");
        return;
      }

      setStatusLog('SINCRONIZANDO...');
      await cleanupAudioResources();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      outputCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
      inputCtxRef.current = new AudioContextClass({ sampleRate: 16000 });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatusLog('EVA: ESCUTANDO');
            setIsListening(true);
            const source = inputCtxRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputCtxRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtxRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
              return;
            }
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audioData), outputCtxRef.current!, 24000, 1);
              const source = outputCtxRef.current!.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtxRef.current!.destination);
              source.onended = () => { 
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current!.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: any) => { setApiErrorMessage(`API: ${e.message}`); cleanupAudioResources(); },
          onclose: () => { setStatusLog('PANDORA: PRONTA'); cleanupAudioResources(); },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'Você é a EVA, assistente de voz da Pandora. Responda curto.'
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { setApiErrorMessage(`Hardware: ${err.message}`); cleanupAudioResources(); }
  };

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
        setCurrentSpeed(pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0);
        setGpsLocked(true);
      },
      () => setGpsLocked(false),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return (
    <div className="h-screen w-screen bg-black text-white overflow-hidden relative font-sans italic">
      
      {/* CAMADA 0: O MAPA (BACKGROUND TOTAL) */}
      <div className="absolute inset-0 z-0">
        <MapView 
          travel={travel} 
          currentPosition={currentPos} 
          viewMode="2D" 
          onSetDestination={() => {}} 
        />
        {/* Overlay gradiente para garantir leitura do HUD */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none"></div>
      </div>

      {/* CAMADA 1: HUD DE CONTROLE (FLUTUANTE) */}
      <div className="relative z-10 h-full w-full flex flex-col pointer-events-none">
        
        {/* Header HUD */}
        <header className="h-[70px] flex items-center px-6 gap-4 shrink-0 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 px-4 py-2 flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${gpsLocked ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-600 animate-pulse'}`}></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-white/50">PANDORA CORE V67</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 items-center">
            {MEDIA_APPS.map(app => (
              <button 
                key={app.id} 
                onClick={() => setActiveApp(app.id)} 
                className={`h-11 px-5 shrink-0 rounded-2xl border flex items-center gap-3 transition-all bg-black/80 backdrop-blur-md ${activeApp === app.id ? 'border-blue-500 text-blue-400' : 'border-white/5 text-white/30'}`}
              >
                <i className={`${app.icon} text-xs`}></i>
                <span className="text-[9px] font-black uppercase tracking-widest">{app.name}</span>
              </button>
            ))}
          </div>
        </header>

        {/* Central HUD - Avatar & Velocímetro */}
        <main className="flex-1 relative flex flex-col items-center justify-between p-6">
          
          {/* Velocímetro Top-Left */}
          <div className="w-full flex justify-start pointer-events-auto">
            <div className="bg-black/90 backdrop-blur-3xl p-6 rounded-[40px] border border-white/10 shadow-2xl flex flex-col items-center min-w-[130px]">
                <span className="text-[10px] font-black text-blue-500 uppercase mb-1">KM/H</span>
                <span className="text-6xl font-black leading-none italic tracking-tighter">{currentSpeed}</span>
            </div>
          </div>

          {/* EVA AVATAR CENTRAL */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
              <div 
                onClick={() => isListening ? cleanupAudioResources() : startVoiceSession()}
                className={`relative w-60 h-60 lg:w-80 lg:h-80 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${isListening ? 'scale-110' : 'scale-100 hover:scale-105'}`}
              >
                 <div className={`absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping-slow ${isListening || isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
                 <div className="w-full h-full rounded-full border-2 border-white/10 overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.3)] bg-black relative">
                    <Avatar isListening={isListening} isSpeaking={isSpeaking} videoUrl={veoVideoUrl} onAnimateClick={() => {}} />
                    {isListening && (
                      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5 h-10 items-end">
                         {[1,2,3,4,5,6].map(i => (
                           <div key={i} className="w-1.5 bg-blue-400 rounded-full animate-wave shadow-[0_0_10px_rgba(96,165,250,0.8)]" style={{ animationDelay: `${i*0.1}s` }}></div>
                         ))}
                      </div>
                    )}
                 </div>
                 <div className={`absolute -bottom-6 bg-white text-black px-8 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest shadow-2xl transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
                    {statusLog}
                 </div>
              </div>
          </div>

          {/* Painel de Navegação Bottom-Right */}
          <div className="w-full max-w-[360px] pointer-events-auto self-end">
             {activeApp === 'nav' && (
               <NavigationPanel 
                  travel={travel} 
                  onAddStop={() => setIsAddStopModalOpen(true)} 
                  onSetDestination={() => setIsAddStopModalOpen(true)} 
                  onRemoveStop={() => {}} 
                  transparent 
               />
             )}
          </div>
        </main>

        {/* Footer HUD - Music Player */}
        <footer className="h-[110px] px-8 flex items-center justify-between pointer-events-auto shrink-0">
           <div className="flex-1 max-w-[320px] bg-black/90 backdrop-blur-3xl rounded-[30px] border border-white/10 p-4 shadow-2xl">
              <MiniPlayer app={MEDIA_APPS[1]} metadata={track} onControl={() => {}} onExpand={() => setActiveApp('spotify')} transparent />
           </div>
           <div className="flex items-center gap-4 ml-6">
              <button onClick={() => setIsVeoModalOpen(true)} className="w-16 h-16 rounded-3xl bg-black/90 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl shadow-xl hover:bg-blue-600 transition-colors">
                 <i className="fas fa-video"></i>
              </button>
              <button onClick={() => setIsAddStopModalOpen(true)} className="w-16 h-16 rounded-3xl bg-black/90 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl shadow-xl hover:bg-emerald-600 transition-colors">
                 <i className="fas fa-map-pin"></i>
              </button>
           </div>
        </footer>
      </div>

      {/* Modais e Overlays */}
      {apiErrorMessage && (
        <div className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-8 text-center animate-fade-in">
          <div className="max-w-md flex flex-col gap-6">
             <i className="fas fa-shield-virus text-6xl text-red-600 mb-2"></i>
             <h2 className="text-3xl font-black uppercase italic tracking-tighter">Erro de Sistema</h2>
             <p className="text-xs font-bold text-white/50 uppercase tracking-widest leading-relaxed px-4">{apiErrorMessage}</p>
             <button onClick={() => window.location.reload()} className="h-16 bg-white text-black rounded-3xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all">Sincronizar Novamente</button>
          </div>
        </div>
      )}

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ 
            ...p, 
            destination: n.toUpperCase(), 
            destinationCoords: [la, ln],
            nextInstruction: { instruction: 'Rota iniciada', distance: '100m', icon: 'fa-arrow-up' }
          }));
          setIsAddStopModalOpen(false);
          setActiveApp('nav');
      }} />
      <VeoModal isOpen={isVeoModalOpen} onClose={() => setIsVeoModalOpen(false)} onVideoGenerated={setVeoVideoUrl} />

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes wave { 0%, 100% { height: 20%; } 50% { height: 100%; } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-ping-slow { animation: ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-wave { animation: wave 0.5s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
