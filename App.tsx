
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
  { id: 'engine', name: 'Status', icon: 'fas fa-microchip', color: 'text-orange-500', category: 'METRICS' },
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
        setApiErrorMessage("ERRO: API_KEY não detectada. Verifique as variáveis de ambiente no Vercel e faça um REDEPLOY.");
        return;
      }

      setStatusLog('CONECTANDO...');
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
          onerror: (e: any) => { 
            setApiErrorMessage(`ERRO API: ${e.message}`);
            cleanupAudioResources();
          },
          onclose: () => { 
            setStatusLog('PANDORA: PRONTA'); 
            cleanupAudioResources(); 
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'Você é a EVA, assistente veicular inteligente da Pandora. Responda de forma curta e prestativa em Português Brasileiro.'
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { 
      setApiErrorMessage(`ERRO HARDWARE: ${err.message}`);
      cleanupAudioResources();
    }
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
    <div className="h-full w-full bg-black text-white flex flex-col overflow-hidden relative font-sans italic select-none">
      
      {/* Background Mapa */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${activeApp === 'nav' ? 'opacity-100' : 'opacity-20 blur-sm'}`}>
        <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => {}} />
      </div>

      {/* Header HUD */}
      <header className="h-[60px] bg-black/80 backdrop-blur-lg border-b border-white/5 flex items-center px-6 gap-4 z-[50] shrink-0">
        <div className="flex items-center gap-3 pr-4 border-r border-white/10 shrink-0">
           <div className={`w-2 h-2 rounded-full ${gpsLocked ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-600 animate-pulse'}`}></div>
           <span className="text-[10px] font-black uppercase tracking-widest text-white/50">PANDORA V67</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1 items-center">
          {MEDIA_APPS.map(app => (
            <button key={app.id} onClick={() => setActiveApp(app.id)} className={`h-10 px-4 shrink-0 rounded-xl border flex items-center gap-2 transition-all ${activeApp === app.id ? 'bg-blue-600/30 border-blue-500 text-blue-400' : 'bg-white/5 border-white/5 text-white/30'}`}>
              <i className={`${app.icon} text-xs`}></i>
              <span className="text-[9px] font-black uppercase">{app.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Focus Area */}
      <main className="flex-1 relative z-10 p-6 flex flex-col items-center justify-between pointer-events-none">
        
        {/* Velocímetro */}
        <div className="w-full flex justify-start pointer-events-auto">
          <div className="bg-black/90 backdrop-blur-2xl p-6 rounded-[40px] border border-white/10 shadow-2xl flex flex-col items-center">
              <span className="text-[10px] font-black text-blue-500 uppercase mb-1">KM/H</span>
              <span className="text-6xl font-black leading-none italic tracking-tighter">{currentSpeed}</span>
          </div>
        </div>

        {/* EVA Avatar - O centro de comando */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div 
              onClick={() => isListening ? cleanupAudioResources() : startVoiceSession()}
              className={`relative w-56 h-56 lg:w-72 lg:h-72 rounded-full flex items-center justify-center transition-all duration-500 cursor-pointer ${isListening ? 'scale-110' : 'scale-100 hover:scale-105'}`}
            >
               <div className={`absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping-slow ${isListening || isSpeaking ? 'opacity-100' : 'opacity-0'}`}></div>
               <div className="w-full h-full rounded-full border-2 border-white/10 overflow-hidden shadow-[0_0_80px_rgba(37,99,235,0.2)] bg-black relative">
                  <Avatar isListening={isListening} isSpeaking={isSpeaking} videoUrl={veoVideoUrl} onAnimateClick={() => {}} />
                  {isListening && (
                    <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 h-6 items-end">
                       {[1,2,3,4,5].map(i => (
                         <div key={i} className="w-1 bg-white rounded-full animate-wave" style={{ animationDelay: `${i*0.1}s` }}></div>
                       ))}
                    </div>
                  )}
               </div>
               <div className={`absolute -bottom-4 bg-white text-black px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all ${isListening ? 'bg-red-600 text-white animate-pulse' : ''}`}>
                  {statusLog}
               </div>
            </div>
        </div>

        {/* Navigation Info */}
        {activeApp === 'nav' && (
          <div className="w-full max-w-[340px] pointer-events-auto self-end">
             <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
          </div>
        )}
      </main>

      {/* Player Footer */}
      <footer className="h-[100px] bg-black border-t border-white/5 px-8 flex items-center justify-between z-[50] shrink-0">
         <div className="flex-1 max-w-[300px]">
            <MiniPlayer app={MEDIA_APPS[1]} metadata={track} onControl={() => {}} onExpand={() => setActiveApp('spotify')} transparent />
         </div>
         <div className="flex items-center gap-4">
            <button onClick={() => setIsVeoModalOpen(true)} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl opacity-50 hover:opacity-100 transition-opacity">
               <i className="fas fa-video"></i>
            </button>
            <button onClick={() => setIsAddStopModalOpen(true)} className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xl opacity-50 hover:opacity-100 transition-opacity">
               <i className="fas fa-map-pin"></i>
            </button>
         </div>
      </footer>

      {/* Error Overlay */}
      {apiErrorMessage && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 text-center animate-fade-in">
          <div className="max-w-md flex flex-col gap-6">
             <i className="fas fa-exclamation-triangle text-5xl text-red-600"></i>
             <h2 className="text-2xl font-black uppercase italic">Falha no Sistema</h2>
             <p className="text-xs font-bold text-white/60 uppercase italic tracking-widest leading-relaxed">{apiErrorMessage}</p>
             <button onClick={() => window.location.reload()} className="h-16 bg-white text-black rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">Recarregar Core</button>
             <button onClick={() => setApiErrorMessage(null)} className="text-[10px] font-black text-white/30 uppercase underline">Fechar e Ignorar</button>
          </div>
        </div>
      )}

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }));
          setIsAddStopModalOpen(false);
          setActiveApp('nav');
      }} />
      <VeoModal isOpen={isVeoModalOpen} onClose={() => setIsVeoModalOpen(false)} onVideoGenerated={setVeoVideoUrl} />

      <style>{`
        @keyframes ping-slow { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes wave { 0%, 100% { height: 20%; } 50% { height: 100%; } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-ping-slow { animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-wave { animation: wave 0.5s ease-in-out infinite; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;
