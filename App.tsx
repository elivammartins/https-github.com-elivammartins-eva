
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, StopInfo } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

// Base de dados de aplicativos para curadoria de mídia da EVA
const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'yt_music', name: 'YT Music', icon: 'fab fa-youtube', color: 'text-red-600', category: 'AUDIO', scheme: 'youtubemusic://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'yt_premium', name: 'YouTube Premium', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'claro_tv', name: 'Claro TV+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'clarotvplus://' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-g', color: 'text-orange-500', category: 'VIDEO', scheme: 'globoplay://search/' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca locais específicos, notícias ou postos ANP via Google Search Grounding.',
      properties: { 
        query: { type: Type.STRING, description: 'O que buscar (ex: Posto com selo ANP na BR-040)' },
        searchType: { type: Type.STRING, enum: ['PLACE', 'NEWS', 'WEATHER', 'SAFETY'] }
      },
      required: ['query']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Atualiza imediatamente o trajeto ou adiciona uma parada no mapa.',
      properties: {
        name: { type: Type.STRING, description: 'Nome do local' },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ['DESTINATION', 'STOP'] }
      },
      required: ['name', 'lat', 'lng', 'type']
    }
  },
  {
    name: 'launch_media',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre aplicativos de mídia (TV, Notícias, Vídeos) com conteúdo sugerido.',
      properties: { 
        appId: { type: Type.STRING }, 
        query: { type: Type.STRING, description: 'Conteúdo a ser buscado/reproduzido' }
      },
      required: ['appId', 'query']
    }
  }
];

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('pandora_settings_v160');
    return saved ? JSON.parse(saved) : {
      userName: 'ELIVAM',
      voiceVolume: 90,
      privacyMode: false,
      safetyDistance: 30,
      alertVoiceEnabled: true,
      preferredMusicApp: 'spotify',
      preferredVideoApp: 'stremio',
      credentials: []
    };
  });

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [roadSpeedLimit, setRoadSpeedLimit] = useState(60); 
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  const [currentHeading, setCurrentHeading] = useState(0);
  
  const [safetyDist, setSafetyDist] = useState(50);
  const [trafficStatus, setTrafficStatus] = useState<'FLUIDO' | 'MODERADO' | 'RETIDO'>('FLUIDO');
  const [riskContext, setRiskContext] = useState({ level: 'BAIXO', type: 'ZONA MONITORADA' });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0 
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'EVA PANDORA V160', artist: 'SISTEMA PRONTO', isPlaying: false, progress: 0 });
  
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('pandora_settings_v160', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const geoWatcher = navigator.geolocation.watchPosition((p) => {
      const { latitude, longitude, speed, heading } = p.coords;
      const speedKmH = speed ? Math.round(speed * 3.6) : 0;
      setCurrentSpeed(speedKmH);
      setCurrentPos([latitude, longitude]);
      if (heading !== null) setCurrentHeading(heading);
      
      setRoadSpeedLimit(speedKmH > 70 ? 110 : 60);
      setTrafficStatus(speedKmH < 20 ? 'RETIDO' : speedKmH > 55 ? 'FLUIDO' : 'MODERADO');
      setSafetyDist(Math.max(8, Math.floor(Math.random() * 40 + 15)));

      // Simulação de segurança baseada em geo
      if (latitude < -15.82) setRiskContext({ level: 'ALTO', type: 'ÁREA DE RISCO REPORTADA' });
      else setRiskContext({ level: 'BAIXO', type: 'ZONA SEGURA' });
      
    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geoWatcher);
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    
    if (name === 'set_navigation') {
      const isDest = args.type === 'DESTINATION';
      const newStop: StopInfo = { 
        id: Date.now().toString(), 
        name: args.name.toUpperCase(), 
        coords: [args.lat, args.lng], 
        type: isDest ? 'DESTINATION' : 'GAS' 
      };
      
      setTravel(p => ({
        ...p,
        destination: isDest ? args.name.toUpperCase() : p.destination,
        destinationCoords: isDest ? [args.lat, args.lng] : p.destinationCoords,
        stops: isDest ? p.stops : [...p.stops, newStop]
      }));
      return { result: `OPERANDO: ${isDest ? 'Trajeto principal' : 'Parada'} incluída imediatamente: ${args.name}.` };
    }

    if (name === 'launch_media') {
      const app = APP_DATABASE.find(a => a.id === args.appId);
      if (app) {
        window.location.assign(`${app.scheme}${encodeURIComponent(args.query)}`);
        setAudioTrack({ title: args.query.toUpperCase(), artist: 'EVA CURADORIA', isPlaying: true, progress: 0 });
        return { result: `Abrindo ${app.name} com o conteúdo sugerido.` };
      }
    }

    if (name === 'search_place') {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise via Google Search: "${args.query}". Se for posto, verifique selo ANP. Se for segurança/clima, seja específico sobre Brasília/DF e arredores.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      return { data: response.text };
    }

    return { result: "Comando processado pelo núcleo Pandora." };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) { sessionRef.current?.close(); return; }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputCtxRef.current) outputCtxRef.current = new AudioContext({ sampleRate: 24000 });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsListening(true); setIsSystemBooted(true);
            const inputCtx = new AudioContext({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => { 
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
              });
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop()); activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0; setIsSpeaking(false); return;
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = await handleSystemAction(fc);
                sessionPromise.then((session) => {
                  session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } });
                });
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && outputCtxRef.current) {
              setIsSpeaking(true);
              const buffer = await decodeAudioData(decode(audio), outputCtxRef.current, 24000, 1);
              const source = outputCtxRef.current.createBufferSource();
              source.buffer = buffer; source.connect(outputCtxRef.current.destination);
              const startTime = Math.max(nextStartTimeRef.current, outputCtxRef.current.currentTime);
              source.onended = () => { activeSourcesRef.current.delete(source); if (activeSourcesRef.current.size === 0) setIsSpeaking(false); };
              activeSourcesRef.current.add(source); source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;
            }
          },
          onclose: () => setIsListening(false),
          onerror: () => setIsListening(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: toolDeclarations }],
          systemInstruction: `VOCÊ É A EVA PANDORA V160, CO-PILOTO DO HYUNDAI HB20 TGDI 2026 AUTOMÁTICO DO ${settings.userName}.

          OBJETIVOS DE SENTINELA (Siga rigorosamente):
          1. ANÁLISE DE TRAJETO: Ao definir uma rota ou parada, você DEVE comentar imediatamente sobre:
             - SEGURANÇA: Nível de risco da área (${riskContext.type}).
             - CLIMA: Condições meteorológicas no trajeto e destino (chuva, visibilidade).
             - TRÂNSITO: Situação atual (${trafficStatus}) e tempo estimado.
          2. CURADORIA DE MÍDIA PROATIVA: Sugira notícias, reportagens, vídeos no YouTube, séries ou canais de TV (Globoplay/Claro TV+) de acordo com o tempo de viagem (${travel.drivingTimeMinutes} min).
          3. TELEMETRIA HB20 2026: Este carro tem autonomia de ~600km. Em viagens longas (>350km), sugira PROATIVAMENTE postos com SELO DE QUALIDADE ANP compatíveis com o percurso.
          4. INCLUSÃO IMEDIATA: Assim que o motorista confirmar um local sugerido, use 'set_navigation' para adicioná-lo imediatamente ao mapa e à lista de paradas.
          5. VIGILÂNCIA: Monitore a distância de segurança (${safetyDist}m). Se for crítica, alerte firmemente mas com calma.
          6. PERSONALIDADE: Você é vigilante, inteligente e carismática. Puxe assunto sobre o trajeto e entretenimento.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setIsSystemBooted(true); }
  }, [isListening, currentPos, trafficStatus, safetyDist, settings.userName, riskContext, travel]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-12 overflow-hidden">
         <div className="w-96 h-96 rounded-full border-[8px] border-cyan-500/20 animate-pulse flex items-center justify-center mb-16 relative shadow-[0_0_180px_rgba(6,182,212,0.3)]">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600" className="w-full h-full object-cover grayscale opacity-40 rounded-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-950/70 to-transparent"></div>
            <div className="absolute inset-0 border-2 border-white/10 rounded-full animate-ping"></div>
         </div>
         <h1 className="text-9xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-400 to-blue-600 uppercase">EVA PANDORA V160</h1>
         <p className="text-cyan-500 font-black tracking-[1.2em] mb-16 animate-pulse text-sm uppercase">Hyundai HB20 TGDI 2026 Core</p>
         <button onClick={startVoiceSession} className="h-32 px-32 bg-cyan-600 rounded-full font-black uppercase shadow-[0_0_120px_rgba(8,145,178,0.6)] text-3xl border-t-2 border-white/30 active:scale-95 transition-all transform hover:scale-105">Ativar Protocolo Driver</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      {/* HUD ESQUERDO: CONTROLES E TELEMETRIA (40%) */}
      <aside className="h-full z-20 bg-[#060608] border-r border-white/5 flex flex-col p-10 w-[40%] transition-all duration-700 overflow-y-auto no-scrollbar relative shadow-[20px_0_50px_rgba(0,0,0,0.8)]">
         
         <header className="mb-12 space-y-12">
            <div className="flex items-start justify-between">
               <div className="flex flex-col">
                  <span className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.2)]">{currentSpeed}</span>
                  <div className="flex items-center gap-6 mt-4">
                     <span className="text-xs font-black text-cyan-500 tracking-[0.8em]">KM/H GPS</span>
                     <button onClick={() => setIsSettingsOpen(true)} className="group flex items-center gap-3 bg-cyan-600/10 hover:bg-cyan-600/30 border border-cyan-500/40 px-6 py-2 rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.1)] active:scale-95">
                        <i className="fas fa-shield-halved text-cyan-400 animate-pulse"></i>
                        <span className="text-[10px] font-black text-cyan-100 tracking-widest">CENTRO DE COMANDO</span>
                     </button>
                  </div>
               </div>
               
               <div className="mt-8 flex flex-col items-center gap-3">
                  <div className="w-40 h-40 rounded-full border-[12px] border-red-600 bg-white flex items-center justify-center shadow-[0_0_60px_rgba(220,38,38,0.5)]">
                     <span className="text-7xl font-black text-black tracking-tighter">{roadSpeedLimit}</span>
                  </div>
                  <span className="text-[10px] font-black text-white/50 tracking-[0.4em]">LIMITE VIA</span>
               </div>
            </div>
            
            {/* SENTINELA SCANNER HUD */}
            <div className="w-full bg-black/90 border-2 border-cyan-500/30 rounded-[50px] p-10 shadow-3xl flex flex-col gap-8 backdrop-blur-3xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-shimmer"></div>
               <div className="flex justify-between items-center border-b border-white/5 pb-6">
                  <span className="text-[11px] font-black text-cyan-400 tracking-[0.6em]">SENTINELA HB20 2026 ATIVA</span>
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping"></div>
               </div>
               <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                     <span className="text-[10px] opacity-40 font-black tracking-widest uppercase">Objeto à Frente</span>
                     <span className={`text-7xl font-black ${safetyDist < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{safetyDist}M</span>
                  </div>
                  <div className="flex flex-col items-end text-right">
                     <span className="text-[10px] opacity-40 font-black tracking-widest uppercase">Tráfego local</span>
                     <span className="text-2xl font-black text-cyan-300">{trafficStatus}</span>
                  </div>
               </div>
               <div className="p-6 bg-white/5 border border-white/10 rounded-[35px] flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] opacity-40 font-black block mb-1 tracking-widest">STATUS DE SEGURANÇA</span>
                    <span className={`text-[12px] font-black ${riskContext.level === 'ALTO' ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{riskContext.type}</span>
                  </div>
                  <i className={`fas ${riskContext.level === 'ALTO' ? 'fa-triangle-exclamation text-red-500' : 'fa-check-double text-emerald-500'} text-2xl`}></i>
               </div>
            </div>
         </header>

         <div className="flex-1 space-y-12 pb-16">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            
            <div className="grid grid-cols-4 gap-6">
               {APP_DATABASE.map(app => (
                 <button key={app.id} onClick={() => window.location.assign(app.scheme)} className="bg-white/5 p-6 rounded-[35px] flex flex-col items-center gap-3 border border-white/5 active:scale-90 transition-all hover:bg-white/10 hover:border-cyan-500/40 shadow-2xl group relative">
                    <i className={`${app.icon} ${app.color} text-3xl transition-transform group-hover:scale-110`}></i>
                    <span className="text-[9px] font-black tracking-widest uppercase truncate w-full text-center opacity-60 group-hover:opacity-100">{app.name}</span>
                 </button>
               ))}
            </div>
         </div>

         <footer className="h-32 pt-10 border-t border-white/10 flex items-center gap-8 sticky bottom-0 bg-[#060608]">
            <div onClick={startVoiceSession} className={`w-24 h-24 shrink-0 rounded-full border-2 cursor-pointer overflow-hidden transition-all duration-500 ${isListening ? 'border-red-600 shadow-[0_0_60px_rgba(220,38,38,0.7)] scale-110' : 'border-cyan-500 shadow-2xl shadow-cyan-500/30 hover:scale-105'}`}>
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
            <div className="flex-1 h-20">
               <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            </div>
         </footer>
      </aside>

      {/* MAPA EM TELA CHEIA À DIREITA (60%) */}
      <main className="flex-1 relative bg-zinc-950 overflow-hidden">
         <MapView 
            travel={travel} 
            currentPosition={currentPos} 
            heading={currentHeading} 
            isFullScreen={true} 
            mode={'3D'}
            layer={'DARK'}
            onToggleFullScreen={() => {}} 
            onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} 
         />
         
         {/* Alerta Visual de Autonomia / ANP Overlay */}
         {travel.totalDistanceKm > 350 && (
           <div className="absolute top-12 right-12 z-50 animate-bounce">
              <div className="bg-yellow-600 border-2 border-yellow-400 p-6 rounded-[35px] shadow-[0_0_80px_rgba(202,138,4,0.5)] flex items-center gap-6 backdrop-blur-md">
                 <div className="w-16 h-16 rounded-2xl bg-black/30 flex items-center justify-center">
                    <i className="fas fa-gas-pump text-3xl text-white"></i>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white/80 tracking-widest uppercase">Alerta HB20 Autonomia</span>
                    <span className="text-sm font-black text-white uppercase italic">Qualidade ANP Recomendada</span>
                 </div>
              </div>
           </div>
         )}

         {/* Overlay de Cuidado do Motorista */}
         {currentSpeed > 100 && (
            <div className="absolute bottom-12 right-12 z-50 p-6 bg-red-600/20 border border-red-500/40 rounded-3xl backdrop-blur-md flex items-center gap-4">
               <i className="fas fa-eye text-red-500 animate-pulse"></i>
               <span className="text-[10px] font-black text-red-100 tracking-widest uppercase">EVA Vigilante: Alta Velocidade Detectada</span>
            </div>
         )}
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          const isInitialDest = travel.destination === 'AGUARDANDO DESTINO';
          setTravel(p => ({ 
            ...p, 
            destination: isInitialDest ? n.toUpperCase() : p.destination, 
            destinationCoords: isInitialDest ? [la, ln] : p.destinationCoords, 
            stops: isInitialDest ? p.stops : [...p.stops, { id: Date.now().toString(), name: n.toUpperCase(), coords: [la, ln], type: 'GAS' }] 
          }));
          setIsAddStopModalOpen(false);
      }} />
      
      <SettingsMenu 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onUpdate={(newSettings) => setSettings(newSettings)} 
        mediaApps={APP_DATABASE} 
      />
      
      <style>{`
         @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
         .animate-shimmer { animation: shimmer 4s infinite linear; }
         .shadow-3xl { box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.95); }
         ::-webkit-scrollbar { display: none; }
         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
