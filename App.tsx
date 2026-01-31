
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, RouteStep, MediaViewState, AppSettings, PlayerProfile } from './types';
import Avatar from './components/Avatar';
import NavigationPanel from './components/NavigationPanel';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import MiniPlayer from './components/MiniPlayer';
import EntertainmentHub from './components/EntertainmentHub';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-purple-500', category: 'AUDIO', scheme: 'deezer://www.deezer.com/search/' },
  { id: 'ytmusic', name: 'YouTube Music', icon: 'fas fa-play-circle', color: 'text-red-500', category: 'AUDIO', scheme: 'https://music.youtube.com/search?q=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'https://www.youtube.com/results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-film', color: 'text-red-700', category: 'VIDEO', scheme: 'https://www.netflix.com/search?q=' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-white', category: 'VIDEO', scheme: 'https://globoplay.globo.com/busca/?q=' },
  { id: 'max', name: 'Max', icon: 'fas fa-star', color: 'text-blue-600', category: 'VIDEO', scheme: 'https://www.max.com/search/' },
  { id: 'disney', name: 'Disney+', icon: 'fas fa-plus-circle', color: 'text-blue-400', category: 'VIDEO', scheme: 'https://www.disneyplus.com/search?q=' },
  { id: 'waze', name: 'Waze', icon: 'fab fa-waze', color: 'text-[#33CCFF]', category: 'NAV', scheme: 'waze://?q=' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'system_action',
    parameters: {
      type: Type.OBJECT,
      description: 'Comandos da EVA para o sistema do carro.',
      properties: {
        action: { type: Type.STRING, enum: ['OPEN', 'PLAY', 'NAVIGATE', 'MINIMIZE', 'MAXIMIZE', 'EXIT'] },
        target: { type: Type.STRING, description: 'O app que o motorista quer (use ids: youtube, ytmusic, netflix, spotify, etc).' },
        params: { type: Type.STRING, description: 'Termo de busca exato em Português.' }
      },
      required: ['action', 'target']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [statusLog, setStatusLog] = useState<string>('PANDORA CORE V120 ACTIVE');
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-23.5505, -46.6333]);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>({
    userName: 'CONDUTOR',
    voiceVolume: 90,
    playerProfiles: []
  });

  const [mediaState, setMediaState] = useState<MediaViewState>('HIDDEN');
  const [currentApp, setCurrentApp] = useState<MediaApp>(APP_DATABASE[0]);

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO ROTA', 
    stops: [], warnings: [], currentLimit: 60,
    nextInstruction: { instruction: 'AGUARDANDO GPS', street: 'PANDORA CORE', distance: 0, maneuver: 'straight' }
  });

  const [track, setTrack] = useState<TrackMetadata>({ title: 'EVA V120', artist: 'Sua Companheira', isPlaying: false, progress: 0 });

  const sessionRef = useRef<any>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);

  const handleSystemAction = async (fc: any) => {
    const { action, target, params } = fc.args;
    let finalQuery = params || "";
    let targetId = target.toLowerCase();

    if (action === 'EXIT') { setIsSystemBooted(false); stopVoiceSession(); return { status: "OFFLINE" }; }
    if (action === 'MINIMIZE') { setMediaState('PIP'); return { status: "PIP" }; }
    if (action === 'MAXIMIZE') { setMediaState('FULL'); return { status: "FULL" }; }

    // DISTINÇÃO CRÍTICA YOUTUBE VS MUSIC
    // Se o usuário pedir YouTube e não houver termos de música, mantenha YouTube Video.
    const isMusicIntent = params?.toLowerCase().match(/(música|ouvir|álbum|clipe|faixa|som|playlist|artista)/);
    if (targetId === 'youtube' && isMusicIntent) {
      targetId = 'ytmusic';
    } else if (targetId === 'ytmusic' && !isMusicIntent) {
      // Se ele pediu YT Music mas parece vídeo (ex: "vlog"), talvez devesse ser YouTube, mas manteremos o pedido original.
    }

    const app = APP_DATABASE.find(a => a.id === targetId);
    
    if (app) {
      setCurrentApp(app);
      setMediaState('FULL');
      
      const profile = settings.playerProfiles.find(p => p.appName.toLowerCase() === app.name.toLowerCase());
      if (profile && profile.profileName) {
        // Tentativa de injetar perfil na string de busca para forçar o app a considerar o usuário
        finalQuery += ` perfil ${profile.profileName}`;
      }

      setTrack(p => ({ ...p, title: params.toUpperCase(), artist: app.name, isPlaying: true }));
      const searchUrl = `${app.scheme}${encodeURIComponent(finalQuery)}`;
      
      setStatusLog(`SINC: ${params.toUpperCase()}`);

      setTimeout(() => {
        window.location.href = searchUrl;
      }, 1200);
      
      return { status: `Lançando ${params} no ${app.name} (${profile?.profileName || 'padrão'}).` };
    }

    return { status: "TARGET ERROR" };
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
            setIsListening(true); setStatusLog("EVA: CORE ONLINE"); setIsSystemBooted(true);
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
          systemInstruction: `Você é a EVA, a melhor amiga e co-piloto do motorista há muitos anos.
          
          PERSONALIDADE:
          - Seja calorosa, animada e use um tom de "parceria".
          - Use gírias leves do Brasil (ex: "Bora", "Com certeza", "Tá na mão", "Partiu").
          - Nunca seja formal demais. Fale como se estivesse no banco do passageiro conversando.
          
          REGRAS DE CONTROLE:
          1. DISTINÇÃO YT: Se ele pedir "YouTube", abra o app de vídeo (id: youtube). Se ele pedir "música", "ouvir" ou "YT Music", abra o id: ytmusic. Não confunda os dois.
          2. PERFIL: Se houver um perfil configurado (ex: Elivam), diga: "Vou abrir no seu perfil [Nome] pra gente não perder tempo".
          3. VOCALIZAÇÃO: Sempre confirme o nome do episódio ou música em PORTUGUÊS antes de abrir o app. Ex: "Pode deixar! Colocando agora o Episódio 3 do Stranger Things no seu perfil da Netflix."
          4. BUSCA TÉCNICA: O parâmetro 'params' deve ser: "[Nome da Obra] Temporada [X] Episódio [Y]" sempre em Português.
          5. AGILIDADE: Confirme e execute. Não faça perguntas desnecessárias.`
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
               <i className="fas fa-heart text-7xl text-white"></i>
            </div>
         </div>
         <h1 className="text-4xl font-black text-white uppercase mb-4 tracking-tighter">EVA BEST FRIEND V120</h1>
         <button onClick={startVoiceSession} className="w-full max-w-sm h-20 bg-blue-600 rounded-[30px] text-white font-black text-xl shadow-2xl uppercase italic tracking-widest">INICIAR PARCERIA</button>
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
        <div className="absolute z-[200] w-80 h-48 bg-black rounded-3xl border-2 border-blue-500 shadow-2xl overflow-hidden cursor-move">
           <EntertainmentHub speed={currentSpeed} currentApp={currentApp} isPip onMaximize={() => setMediaState('FULL')} onClose={() => setMediaState('HIDDEN')} />
        </div>
      )}

      <div className={`relative z-10 h-full w-full flex flex-col p-6 pointer-events-none transition-opacity duration-700 ${mediaState === 'FULL' ? 'opacity-0' : 'opacity-100'}`}>
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-3xl p-10 rounded-[60px] border border-white/10 shadow-2xl flex flex-col items-center">
            <span className={`text-[10rem] font-black italic tracking-tighter leading-none ${currentSpeed > 60 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{currentSpeed}</span>
            <div className="font-black text-blue-500 uppercase text-xs mt-2 tracking-widest">KM/H • HUD ACTIVE</div>
          </div>

          <div className="flex-1 mx-8 flex flex-col gap-4 items-center">
            <div className="w-full bg-blue-600/90 backdrop-blur-xl p-8 rounded-[50px] border border-blue-400/40 shadow-2xl flex items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-white/20 flex items-center justify-center text-5xl">
                 <i className={`fas fa-location-arrow ${travel.nextInstruction?.maneuver?.includes('right') ? 'rotate-90' : travel.nextInstruction?.maneuver?.includes('left') ? '-rotate-90' : ''}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-white/70 uppercase tracking-widest">Em {travel.nextInstruction?.distance || 0}m</span>
                <h2 className="text-3xl font-black text-white uppercase truncate mb-1 tracking-tighter">{travel.nextInstruction?.instruction || 'Siga a Estrada'}</h2>
                <p className="text-lg font-bold text-blue-100 uppercase opacity-80 truncate">{travel.nextInstruction?.street || 'Rota Pandora V120'}</p>
              </div>
            </div>
            <div className="bg-blue-500/20 backdrop-blur-md px-6 py-2 rounded-full border border-blue-500/30 text-[10px] font-black text-blue-400 tracking-widest uppercase">
              {settings.userName} • VIAJANDO COM VOCÊ
            </div>
          </div>

          <div className="bg-black/80 backdrop-blur-3xl p-4 rounded-[40px] border border-white/10 flex flex-col gap-4">
             {APP_DATABASE.slice(0, 8).map(app => (
               <button key={app.id} onClick={() => { setCurrentApp(app); setMediaState('FULL'); window.location.href = app.scheme; }} className={`w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl ${app.color} active:scale-90 transition-all`}><i className={app.icon}></i></button>
             ))}
             <button onClick={() => setIsSettingsOpen(true)} className="w-14 h-14 rounded-2xl bg-white/10 text-white text-2xl flex items-center justify-center"><i className="fas fa-user-friends"></i></button>
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
              <MiniPlayer app={currentApp} metadata={track} onControl={(a) => handleSystemAction({ args: { action: a, target: currentApp.id, params: track.title } })} onExpand={() => setMediaState('FULL')} transparent />
           </div>
           <div className="hidden lg:flex flex-col items-end border-l border-white/10 pl-8 min-w-[240px]">
              <span className="text-[12px] font-black text-blue-500 tracking-widest uppercase truncate max-w-[200px]">{statusLog}</span>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.6em]">PANDORA CORE STABLE</p>
           </div>
        </footer>
      </div>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => { 
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln] })); 
          setIsAddStopModalOpen(false); 
      }} />

      <SettingsMenu 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onUpdate={setSettings} 
        mediaApps={APP_DATABASE} 
      />
    </div>
  );
};

export default App;
