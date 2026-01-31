
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, RouteStep, MediaViewState, AppSettings, CarAction, CarStatus, IncomingMessage } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import EntertainmentHub from './components/EntertainmentHub';
import SettingsMenu from './components/SettingsMenu';
import BluelinkPanel from './components/BluelinkPanel';
import { decode, decodeAudioData, createBlob } from './utils/audio';

// Declare global types for AI Studio API key management
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'AUDIO', scheme: 'https://wa.me/' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'car_control',
    parameters: {
      type: Type.OBJECT,
      description: 'Controle do HB20 Bluelink.',
      properties: { command: { type: Type.STRING, enum: ['START', 'STOP', 'LOCK', 'UNLOCK', 'WINDOWS_UP', 'WINDOWS_DOWN', 'HAZARD_LIGHTS', 'HORN_LIGHTS'] } },
      required: ['command']
    }
  },
  {
    name: 'communication_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Gerencia Telefone e WhatsApp.',
      properties: {
        type: { type: Type.STRING, enum: ['CALL', 'WHATSAPP_SEND', 'WHATSAPP_READ'] },
        target: { type: Type.STRING, description: 'Nome do contato ou número.' },
        content: { type: Type.STRING, description: 'Conteúdo da mensagem se for envio.' }
      },
      required: ['type', 'target']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const [carStatus, setCarStatus] = useState<CarStatus>({
    lastAction: '', isEngineRunning: false, areWindowsOpen: false, isLocked: true, isUpdating: false, hazardActive: false
  });

  const [settings, setSettings] = useState<AppSettings>({
    userName: 'ALPHA', voiceVolume: 90, privacyMode: false, messageLimit: 128, playerProfiles: []
  });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], currentLimit: 60,
    nextInstruction: { instruction: 'AGUARDANDO GPS', street: 'SISTEMA ATIVO', distance: 0, maneuver: 'straight' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA COCKPIT V140', artist: 'Sua Co-Piloto', isPlaying: false, progress: 0 });
  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const checkApiKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    // Guideline: Assume successful selection after triggering openSelectKey to avoid race condition
    setHasApiKey(true);
  };

  const handleCommunication = (args: any) => {
    const { type, target, content } = args;
    if (type === 'CALL') {
      window.location.href = `tel:${target}`;
      return { status: `LIGANDO PARA ${target}` };
    }
    if (type === 'WHATSAPP_SEND') {
      window.location.href = `https://wa.me/${target}?text=${encodeURIComponent(content)}`;
      return { status: "MENSAGEM ENVIADA" };
    }
    if (type === 'WHATSAPP_READ') {
       if (settings.privacyMode) return { status: "MODO PRIVACIDADE ATIVO. NÃO POSSO LER AGORA." };
       return { status: "LENDO MENSAGEM: " + content };
    }
    return { status: "OK" };
  };

  const handleSystemAction = async (fc: any) => {
    if (fc.name === 'communication_action') return handleCommunication(fc.args);
    if (fc.name === 'car_control') {
      setCarStatus(prev => ({ ...prev, isUpdating: true }));
      setTimeout(() => setCarStatus(p => ({ ...p, isUpdating: false, lastAction: fc.args.command })), 1500);
      return { status: "COMANDO ENVIADO" };
    }
    return { status: "ERRO" };
  };

  const startVoiceSession = async () => {
    if (isListening) return;
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("Chave API não configurada.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Create new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey });
      if (!outputCtxRef.current) outputCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setIsSystemBooted(true);
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            // Guideline: Solely rely on sessionPromise resolves to send input
            scriptProcessor.onaudioprocess = (e) => { sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) })); };
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
              source.onended = () => { sourcesRef.current.delete(source); if(sourcesRef.current.size === 0) setIsSpeaking(false); };
              // Guideline: Use a cursor (nextStartTime) for gapless audio playback
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onerror: (e: any) => {
             // Guideline: Reset key selection if entity not found
             if (e?.message?.includes("Requested entity was not found.")) {
               setHasApiKey(false);
             }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `Você é a EVA. Regras de Comunicação:
          1. PRIVACIDADE: Se o 'privacyMode' estiver ativo (você sabe pelo contexto), NÃO diga nomes de remetentes ou conteúdos de mensagens recebidas. Apenas diga: "Você tem uma nova mensagem privada".
          2. LEITURA: Se for ler, respeite o 'messageLimit' de 128 caracteres se solicitado.
          3. TELEFONE: Você pode fazer chamadas e enviar WhatsApps usando 'communication_action'.
          Seja sempre parceira e animada.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); setIsSystemBooted(true); }
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
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-10 font-sans italic text-white">
         <div className="w-56 h-56 rounded-full border-4 border-blue-500/20 p-2 mb-12 animate-pulse flex items-center justify-center shadow-[0_0_80px_rgba(59,130,246,0.2)]">
            <div className="w-full h-full rounded-full bg-blue-600/10 flex items-center justify-center border-2 border-blue-500/50">
               <i className="fas fa-car-side text-6xl text-blue-400"></i>
            </div>
         </div>
         <h1 className="text-3xl font-black mb-4 tracking-tighter uppercase">PANDORA CORE V140</h1>
         
         {!hasApiKey ? (
           <div className="flex flex-col items-center gap-4">
              <p className="text-[10px] text-white/50 uppercase tracking-widest text-center max-w-xs mb-4">
                Para usar as funcionalidades avançadas de vídeo e voz, selecione uma chave API de um projeto com faturamento ativo.
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 block mt-2 underline">Documentação de Faturamento</a>
              </p>
              <button onClick={handleSelectKey} className="w-full max-w-xs h-20 bg-emerald-600 rounded-[30px] text-white font-black text-xl shadow-2xl uppercase tracking-widest active:scale-95 transition-transform">SELECIONAR CHAVE API</button>
           </div>
         ) : (
           <button onClick={startVoiceSession} className="w-full max-w-xs h-20 bg-blue-600 rounded-[30px] text-white font-black text-xl shadow-2xl uppercase tracking-widest active:scale-95 transition-transform">CONECTAR HB20</button>
         )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic">
      {/* COCKPIT SIDEBAR (40%) */}
      <aside className="w-[40%] h-full z-20 bg-[#0a0a0c] border-r border-white/5 flex flex-col p-6 overflow-hidden relative">
         {/* INDICADOR PRIVACIDADE */}
         {settings.privacyMode && (
           <div className="absolute top-4 left-4 flex items-center gap-2 text-blue-400 bg-blue-600/10 px-3 py-1 rounded-full border border-blue-500/20 animate-pulse">
              <i className="fas fa-ghost text-[10px]"></i>
              <span className="text-[8px] font-black uppercase">Modo Furtivo Ativo</span>
           </div>
         )}

         <header className="flex items-center justify-between mb-8 mt-4">
            <div className="flex flex-col">
               <span className={`text-[8.5rem] font-black leading-none tracking-tighter ${currentSpeed > 60 ? 'text-red-500' : 'text-white'}`}>{currentSpeed}</span>
               <span className="text-[11px] font-black text-blue-500 tracking-[0.5em] uppercase px-1">KM/H • HUD ACTIVE</span>
            </div>
            <div onClick={startVoiceSession} className={`w-28 h-28 rounded-full border-4 transition-all duration-500 overflow-hidden bg-black cursor-pointer ${isListening ? 'border-red-500 scale-105 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : 'border-blue-500 shadow-[0_0_40px_rgba(59,130,246,0.3)]'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
         </header>

         <div className="flex-1 space-y-6 overflow-y-auto custom-scroll pb-10">
            {/* Notificação de Mensagem (Simulada se houver uma nova) */}
            <div className={`p-6 rounded-[40px] border transition-all duration-500 ${settings.privacyMode ? 'bg-zinc-900 border-white/5' : 'bg-emerald-600/20 border-emerald-500/40'}`}>
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white text-xl">
                      <i className="fab fa-whatsapp"></i>
                   </div>
                   <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-white uppercase">{settings.privacyMode ? 'Privacidade Ativa' : 'Nova Mensagem'}</h4>
                      <p className="text-[10px] text-white/50 truncate font-bold uppercase">
                         {settings.privacyMode ? 'Conteúdo Oculto' : 'Toque ou peça para a EVA ler'}
                      </p>
                   </div>
                </div>
            </div>

            <BluelinkPanel status={carStatus} onAction={(a: CarAction) => handleSystemAction({name: 'car_control', args: {command: a}})} />
            
            <div className="bg-white/5 p-8 rounded-[40px] border border-white/5">
               <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-4xl shadow-lg"><i className="fas fa-location-arrow -rotate-45"></i></div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Próxima Manobra</p>
                     <h4 className="text-2xl font-black text-white uppercase truncate leading-tight">{travel.nextInstruction?.instruction || 'Siga o Mapa'}</h4>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
               {APP_DATABASE.map(app => (
                 <button key={app.id} onClick={() => { setCurrentApp(app); setMediaState('FULL'); if(app.id !== 'whatsapp') window.location.href = app.scheme; }} className={`aspect-square rounded-3xl bg-white/5 flex items-center justify-center text-2xl ${app.color} active:scale-90 transition-all border border-white/5`}><i className={app.icon}></i></button>
               ))}
               <button onClick={() => setIsSettingsOpen(true)} className="aspect-square rounded-3xl bg-white/5 text-white flex items-center justify-center text-2xl border border-white/5"><i className="fas fa-gear"></i></button>
            </div>
         </div>

         <footer className="h-24 pt-4 border-t border-white/5 shrink-0">
            <MiniPlayer app={currentApp} metadata={track} onControl={() => {}} onExpand={() => setMediaState('FULL')} transparent />
         </footer>
      </aside>

      {/* MAPA WAZE (DIREITA 60%) */}
      <main className="flex-1 relative bg-zinc-900">
         <MapView travel={travel} currentPosition={currentPos} viewMode="2D" onSetDestination={() => setIsAddStopModalOpen(true)} />
         
         <div className="absolute bottom-8 right-8 flex flex-col gap-4 pointer-events-auto">
            <button onClick={() => setIsAddStopModalOpen(true)} className="w-20 h-20 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center text-2xl active:scale-90 transition-transform">
               <i className="fas fa-search-location"></i>
            </button>
         </div>

         {mediaState === 'FULL' && (
           <div className="absolute inset-0 z-[100] bg-black">
              <EntertainmentHub speed={currentSpeed} currentApp={currentApp} onMinimize={() => setMediaState('PIP')} onClose={() => setMediaState('HIDDEN')} />
           </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => { setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] })); setIsAddStopModalOpen(false); }} />
      <SettingsMenu isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onUpdate={setSettings} mediaApps={APP_DATABASE} />
    </div>
  );
};

export default App;
