
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { TravelInfo, MediaApp, AppSettings, LayoutMode, TrackMetadata } from './types';
import Avatar from './components/Avatar';
import SettingsMenu from './components/SettingsMenu';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import VeoModal from './components/VeoModal';
import MiniPlayer from './components/MiniPlayer';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const MEDIA_APPS: MediaApp[] = [
  { id: 'nav', name: 'Navegação', icon: 'fas fa-location-arrow', color: 'text-emerald-400', category: 'NAV' },
  { id: 'v2v', name: 'Telemetria', icon: 'fas fa-satellite-dish', color: 'text-blue-400', category: 'METRICS' },
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO' },
  { id: 'engine', name: 'Diagnóstico', icon: 'fas fa-microchip', color: 'text-orange-500', category: 'METRICS' },
];

const App: React.FC = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('EVA: PRONTA');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isVeoModalOpen, setIsVeoModalOpen] = useState(false);
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [activeApp, setActiveApp] = useState<string>('nav');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  
  const [track, setTrack] = useState<TrackMetadata>({
    title: 'AGUARDANDO STREAM', artist: 'PANDORA SYNC...', isPlaying: false, progress: 0, duration: 180
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'DEFINIR DESTINO', 
    destinationCoords: undefined,
    eta: '--:--', distanceRemaining: '0.0 KM', drivingTimeMinutes: 0, elapsedTimeMinutes: 0, stops: [],
    nextInstruction: { instruction: 'Sistema Pronto', distance: '0m', icon: 'fa-check-circle' }
  });

  const [settings, setSettings] = useState<AppSettings>({ 
    layoutMode: LayoutMode.STANDARD, columnASide: 'LEFT', mapStyle: '2D',
    pinnedAppSlot1: 'v2v', pinnedAppSlot2: 'engine', enabledAppIds: MEDIA_APPS.map(a => a.id),
    v2vThreshold: 20, v2vDistance: 45, v2vWarningEnabled: true, voiceVolume: 100, 
    outlookAccount: '', userName: 'Driver', showTurnByTurn: true, 
    audioPlayerMode: 'MINI'
  });

  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputCtxRef = useRef<AudioContext | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Detecta se estamos no AI Studio (Preview) ou Vercel (Standalone)
    setIsStandalone(!(window as any).aistudio);
  }, []);

  const cleanupAudioResources = async () => {
    if (sessionRef.current) { try { sessionRef.current.close(); } catch(e) {} sessionRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => { t.enabled = false; t.stop(); });
      streamRef.current = null;
    }
    if (inputCtxRef.current) { try { await inputCtxRef.current.close(); } catch(e) {} inputCtxRef.current = null; }
    if (outputCtxRef.current) { try { await outputCtxRef.current.close(); } catch(e) {} outputCtxRef.current = null; }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsListening(false);
    setIsSpeaking(false);
  };

  const handleAuthOrAction = async () => {
    if (isListening) {
      await cleanupAudioResources();
      setStatusLog('EVA: PRONTA');
      return;
    }

    const aistudio = (window as any).aistudio;
    if (aistudio) {
      const hasKey = await aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setStatusLog('CHAVE EXTERNA');
        await aistudio.openSelectKey();
        startVoiceSession();
        return;
      }
    }
    startVoiceSession();
  };

  const startVoiceSession = async () => {
    setApiErrorMessage(null);
    try {
      const apiKey = process.env.API_KEY;
      
      if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        setStatusLog('SEM CHAVE');
        setApiErrorMessage(isStandalone 
          ? "ERRO VERCEL: A variável de ambiente API_KEY não foi encontrada no painel da Vercel. Adicione-a e faça um novo deploy." 
          : "ERRO GOOGLE: Chave não selecionada no AI Studio. Clique em 'Trocar Projeto'.");
        return;
      }

      setStatusLog('HANDSHAKE...');
      await cleanupAudioResources();
      await new Promise(r => setTimeout(r, 400));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      outputCtxRef.current = new AudioContextClass({ sampleRate: 24000 });
      inputCtxRef.current = new AudioContextClass({ sampleRate: 16000 });

      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatusLog('EVA: ESCUTANDO');
            setIsListening(true);
            setApiErrorMessage(null);
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
            const errMsg = e.message || "Falha na conexão com Gemini Live API";
            setApiErrorMessage(errMsg);
            setStatusLog('ERRO API');
            cleanupAudioResources();
          },
          onclose: () => { 
            setStatusLog('EVA: PRONTA'); 
            cleanupAudioResources();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleMaps: {} }],
          systemInstruction: 'Você é a EVA. Assistente Pandora. Responda em PT-BR de forma curta e natural. Você auxilia o motorista.'
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { 
      setApiErrorMessage(err.message || "Erro de permissão de hardware.");
      setStatusLog('ERRO HARDWARE');
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
    <div className="h-full w-full bg-black text-white flex flex-col overflow-hidden relative font-sans italic">
      <div className={`absolute inset-0 transition-opacity duration-1000 ${activeApp === 'nav' ? 'opacity-100' : 'opacity-20 scale-95'}`}>
        <MapView travel={travel} currentPosition={currentPos} viewMode={settings.mapStyle === '3D' ? '3D' : '2D'} onSetDestination={() => {}} />
      </div>

      <header className="h-[65px] bg-black/90 border-b border-white/5 flex items-center px-5 gap-5 z-[500] pointer-events-auto shrink-0 relative">
        <div className="flex items-center gap-3 pr-5 border-r border-white/10 shrink-0">
           <div className={`w-2.5 h-2.5 rounded-full ${gpsLocked ? 'bg-emerald-500' : 'bg-red-600 animate-pulse'}`}></div>
           <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{isStandalone ? 'STANDALONE V64' : 'GOOGLE PREVIEW'}</span>
        </div>
        
        <div className="flex gap-3 overflow-x-auto no-scrollbar flex-1 items-center">
          {MEDIA_APPS.map(app => (
            <button key={app.id} onClick={() => setActiveApp(app.id)} className={`w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center transition-all ${activeApp === app.id ? 'bg-blue-600/30 border-blue-500 scale-105 shadow-lg' : 'bg-white/5 border-white/10 opacity-50'}`}>
              <i className={`${app.icon} text-xl ${app.color}`}></i>
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 relative z-10 pointer-events-none p-6 flex flex-col justify-between overflow-hidden">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
            <button onClick={handleAuthOrAction} className="bg-black/95 backdrop-blur-3xl px-8 py-3 rounded-full border border-white/10 flex items-center gap-4 shadow-2xl active:scale-95 transition-all">
               <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : isSpeaking ? 'bg-cyan-400 animate-pulse' : 'bg-blue-600'}`}></div>
               <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90 italic">{statusLog}</span>
            </button>
        </div>

        <div className="w-28 pointer-events-auto">
          <div className="bg-black/90 backdrop-blur-3xl p-5 rounded-[35px] border border-white/10 shadow-2xl flex flex-col items-center">
              <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">KM/H</span>
              <span className="text-5xl font-black leading-none italic">{currentSpeed}</span>
          </div>
        </div>

        {activeApp === 'nav' && (
          <div className="w-full max-w-[340px] pointer-events-auto self-end z-20">
             <NavigationPanel travel={travel} onAddStop={() => setIsAddStopModalOpen(true)} onSetDestination={() => setIsAddStopModalOpen(true)} onRemoveStop={() => {}} transparent />
          </div>
        )}
      </main>

      <footer className="h-[105px] bg-black border-t border-white/5 px-6 flex items-center justify-between z-[500] pointer-events-auto shrink-0 relative">
         <div className="flex-1 max-w-[300px]">
            <MiniPlayer app={MEDIA_APPS[2]} metadata={track} onControl={() => {}} onExpand={() => setActiveApp('spotify')} transparent />
         </div>

         <div className="flex items-center gap-6">
            <button onClick={handleAuthOrAction} className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl transition-all active:scale-90 shadow-[0_0_40px_rgba(59,130,246,0.4)] ${isListening ? 'bg-red-600' : 'bg-blue-600'}`}>
               <i className={`fas ${isListening ? 'fa-stop text-sm' : 'fa-microphone'}`}></i>
            </button>
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 active:scale-95 shadow-2xl relative cursor-pointer" onClick={() => setIsVeoModalOpen(true)}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} videoUrl={veoVideoUrl} onAnimateClick={() => {}} />
            </div>
         </div>
      </footer>

      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={MEDIA_APPS} />
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] }));
          setStatusLog('ROTA DEFINIDA');
          setActiveApp('nav');
      }} />
      <VeoModal isOpen={isVeoModalOpen} onClose={() => setIsVeoModalOpen(false)} onVideoGenerated={setVeoVideoUrl} />
      
      {apiErrorMessage && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[600] w-[90%] max-w-md bg-red-600/95 p-5 rounded-3xl shadow-[0_0_50px_rgba(220,38,38,0.5)] border border-white/20 animate-bounce pointer-events-auto">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i> ERRO DE CONFIGURAÇÃO
              </span>
              <button onClick={() => setApiErrorMessage(null)} className="text-white/40 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <p className="text-[9px] font-bold text-white/90 leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 uppercase italic">
              {apiErrorMessage}
            </p>
            <div className="flex gap-3">
              {isStandalone ? (
                <>
                  <button onClick={() => window.location.reload()} className="flex-1 h-12 bg-white text-red-600 rounded-2xl flex items-center justify-center text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Recarregar</button>
                  <a href="https://vercel.com/dashboard" target="_blank" className="flex-1 h-12 bg-black/40 rounded-2xl flex items-center justify-center text-[9px] font-black uppercase border border-white/10">Ir para Vercel</a>
                </>
              ) : (
                <button onClick={() => {
                  setApiErrorMessage(null);
                  (window as any).aistudio?.openSelectKey();
                }} className="flex-1 h-12 bg-white text-red-600 rounded-2xl flex items-center justify-center text-[9px] font-black uppercase shadow-lg active:scale-95 transition-all">Trocar Projeto</button>
              )}
            </div>
            <p className="text-[7px] text-center text-white/40 font-black uppercase tracking-widest italic">
              {isStandalone 
                ? "DICA: No Vercel, vá em Settings > Env Variables e crie API_KEY." 
                : "DICA: Use um projeto com faturamento ativo."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
