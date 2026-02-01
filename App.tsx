
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, MapMode, StopInfo, AppSettings } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  // AUDIO
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-white', category: 'AUDIO', scheme: 'deezer://search/' },
  { id: 'tidal', name: 'Tidal', icon: 'fas fa-wave-square', color: 'text-cyan-200', category: 'AUDIO', scheme: 'tidal://search/' },
  { id: 'apple_music', name: 'Apple Music', icon: 'fab fa-apple', color: 'text-red-500', category: 'AUDIO', scheme: 'music://search?term=' },
  { id: 'yt_music', name: 'YT Music', icon: 'fab fa-youtube', color: 'text-red-600', category: 'AUDIO', scheme: 'youtubemusic://search?q=' },
  
  // VIDEO / MOVIES
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'disney', name: 'Disney+', icon: 'fas fa-play', color: 'text-blue-400', category: 'VIDEO', scheme: 'disneyplus://search?q=' },
  { id: 'hbo', name: 'Max (HBO)', icon: 'fas fa-h', color: 'text-blue-900', category: 'VIDEO', scheme: 'hbomax://search?q=' },
  { id: 'prime', name: 'Prime Video', icon: 'fab fa-amazon', color: 'text-cyan-400', category: 'VIDEO', scheme: 'primevideo://search?q=' },
  { id: 'yt_premium', name: 'YouTube Premium', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'apple_tv', name: 'Apple TV+', icon: 'fab fa-apple', color: 'text-white', category: 'VIDEO', scheme: 'atv://search/' },
  
  // LIVE TV / OPERATORS & APPS
  { id: 'claro_tv', name: 'Claro TV+', icon: 'fas fa-tv', color: 'text-red-600', category: 'VIDEO', scheme: 'clarotvplus://' },
  { id: 'sky_plus', name: 'Sky+', icon: 'fas fa-satellite-dish', color: 'text-red-500', category: 'VIDEO', scheme: 'skyplus://' },
  { id: 'vivo_play', name: 'Vivo Play', icon: 'fas fa-play-circle', color: 'text-purple-600', category: 'VIDEO', scheme: 'vivoplay://' },
  { id: 'oi_play', name: 'Oi Play', icon: 'fas fa-video', color: 'text-yellow-500', category: 'VIDEO', scheme: 'oiplay://' },
  { id: 'dgo', name: 'DGO (DirecTV)', icon: 'fas fa-globe', color: 'text-blue-500', category: 'VIDEO', scheme: 'directvgo://' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-g', color: 'text-orange-500', category: 'VIDEO', scheme: 'globoplay://search/' },
  { id: 'watch_br', name: 'Watch Brasil', icon: 'fas fa-eye', color: 'text-green-400', category: 'VIDEO', scheme: 'watchbr://' },
  { id: 'you_tv', name: 'You TV', icon: 'fas fa-play-circle', color: 'text-pink-500', category: 'VIDEO', scheme: 'youtv://' },
  
  // COMM
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: 'text-[#25D366]', category: 'COMM', scheme: 'https://api.whatsapp.com/send?' },
];

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: 'search_place',
    parameters: {
      type: Type.OBJECT,
      description: 'Busca locais e coordenadas via Google Search Grounding.',
      properties: { query: { type: Type.STRING } },
      required: ['query']
    }
  },
  {
    name: 'set_navigation',
    parameters: {
      type: Type.OBJECT,
      description: 'Define destino ou parada no mapa.',
      properties: {
        name: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        type: { type: Type.STRING, enum: ['DESTINATION', 'STOP'] }
      },
      required: ['name', 'lat', 'lng', 'type']
    }
  },
  {
    name: 'launch_media_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre apps de streaming de vídeo/TV ou música usando metadados identificados pela IA.',
      properties: { 
        appId: { type: Type.STRING }, 
        mediaTitle: { type: Type.STRING, description: 'Nome canônico da obra (filme/série/álbum) identificado pela IA.' },
        season: { type: Type.NUMBER, description: 'Número da temporada extraído do contexto.' },
        episode: { type: Type.NUMBER, description: 'Número do episódio para busca cronológica.' },
        language: { type: Type.STRING, description: 'Idioma da busca (Padrão: pt-br).' }
      },
      required: ['appId', 'mediaTitle']
    }
  },
  {
    name: 'send_whatsapp_message',
    parameters: {
      type: Type.OBJECT,
      description: 'Envia mensagem via WhatsApp.',
      properties: { message: { type: Type.STRING }, phone: { type: Type.STRING } },
      required: ['message']
    }
  },
  {
    name: 'go_to_standby',
    parameters: {
      type: Type.OBJECT,
      description: 'Encerra a sessão de voz ativa e coloca a EVA em modo de espera (standby).',
      properties: {},
      required: []
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
    const saved = localStorage.getItem('pandora_settings');
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
  const [currentHeading, setCurrentHeading] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]);
  
  const [safetyDist, setSafetyDist] = useState(50);
  const [laneStatus, setLaneStatus] = useState<'ESQUERDA' | 'CENTRO' | 'DIREITA'>('CENTRO');
  const [trafficStatus, setTrafficStatus] = useState<'FLUIDO' | 'MODERADO' | 'RETIDO'>('FLUIDO');
  const [riskContext, setRiskContext] = useState({ level: 'BAIXO', type: 'SEGURO' });

  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'SEM DESTINO', stops: [], warnings: [], 
    drivingTimeMinutes: 0, totalDistanceKm: 0 
  });

  const [audioTrack, setAudioTrack] = useState<TrackMetadata>({ title: 'PANDORA V160', artist: 'OFFLINE', isPlaying: false, progress: 0 });
  
  const outputCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const lastPosRef = useRef<[number, number]>([-15.7942, -47.8822]);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem('pandora_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const geo = navigator.geolocation.watchPosition((p) => {
      const { latitude, longitude, speed, heading } = p.coords;
      const speedKmH = speed ? Math.round(speed * 3.6) : 0;
      setCurrentSpeed(speedKmH);
      setCurrentPos([latitude, longitude]);
      if (heading !== null) setCurrentHeading(heading);

      if (speedKmH > 95) setRoadSpeedLimit(110);
      else if (speedKmH > 70) setRoadSpeedLimit(80);
      else if (speedKmH > 45) setRoadSpeedLimit(60);
      else setRoadSpeedLimit(40);

      const dLon = longitude - lastPosRef.current[1];
      if (speedKmH > 20 && heading !== null) {
        const drift = dLon * Math.cos(latitude * Math.PI / 180);
        if (Math.abs(drift) > 0.00001) setLaneStatus(drift > 0 ? 'DIREITA' : 'ESQUERDA');
        else setLaneStatus('CENTRO');
      }
      lastPosRef.current = [latitude, longitude];

      if (speedKmH < 10) {
        setTrafficStatus('RETIDO');
        setSafetyDist(Math.max(2, Math.floor(Math.random() * 4 + 3)));
      } else {
        setTrafficStatus(speedKmH > 70 ? 'FLUIDO' : 'MODERADO');
        setSafetyDist(Math.floor(Math.random() * 30 + 30));
      }

      if (latitude < -15.84 && latitude > -15.86) setRiskContext({ level: 'ALTO', type: 'ÁREA DE ALAGAMENTO' });
      else if (latitude < -15.88) setRiskContext({ level: 'MÉDIO', type: 'RISCO DE SEGURANÇA' });
      else setRiskContext({ level: 'BAIXO', type: 'SEGURO' });

    }, null, { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(geo);
  }, []);

  const stopVoiceSession = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
    activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleSystemAction = async (fc: any) => {
    const { name, args } = fc;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (name === 'go_to_standby') {
      setTimeout(() => stopVoiceSession(), 1500); 
      return { status: "EVA EM STANDBY." };
    }

    if (name === 'send_whatsapp_message') {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(args.message)}${args.phone ? `&phone=${args.phone}` : ''}`;
      window.location.assign(url);
      return { status: "MENSAGEM ENVIADA VIA WHATSAPP." };
    }

    if (name === 'launch_media_app') {
      const app = APP_DATABASE.find(a => a.id === args.appId);
      if (app) {
        const lang = args.appId === 'stremio' && args.language === 'en' ? 'en' : 'pt-br';
        const seasonTerm = lang === 'pt-br' ? 'Temporada' : 'Season';
        const episodeTerm = lang === 'pt-br' ? 'Episódio' : 'Episode';

        let cleanSearch = args.mediaTitle;
        if (args.season) cleanSearch += ` ${seasonTerm} ${args.season}`;
        if (args.episode) cleanSearch += ` ${episodeTerm} ${args.episode}`;
        
        const url = `${app.scheme}${encodeURIComponent(cleanSearch)}`;
        
        // CORREÇÃO CRÍTICA PARA NETFLIX E APPS: assign é interceptado pelo SO Android Auto
        window.location.assign(url);
        
        setAudioTrack({ 
          title: args.mediaTitle.toUpperCase(), 
          artist: 'PANDORA SYNC', 
          isPlaying: true, 
          progress: 0,
          season: args.season,
          episode: args.episode
        });
        
        return { status: `MÍDIA IDENTIFICADA: ${args.mediaTitle.toUpperCase()}. PROTOCOLO DE ABERTURA ENVIADO PARA ${app.name.toUpperCase()}.` };
      }
      return { status: "APP NÃO LOCALIZADO NO COFRE." };
    }

    if (name === 'search_place') {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize: "${args.query}, Brasília, DF". Retorne JSON: { "name": "...", "lat": ..., "lng": ... }`,
        config: { tools: [{ googleSearch: {} }] }
      });
      return { data: response.text };
    }

    if (name === 'set_navigation') {
      const isDest = args.type === 'DESTINATION';
      setTravel(p => ({
        ...p,
        destination: isDest ? args.name.toUpperCase() : p.destination,
        destinationCoords: isDest ? [args.lat, args.lng] : p.destinationCoords,
        stops: !isDest ? [...p.stops, { id: Date.now().toString(), name: args.name.toUpperCase(), coords: [args.lat, args.lng], type: 'REST' }] : p.stops
      }));
      return { status: `ROTA PARA ${args.name.toUpperCase()} ESTABELECIDA NO MAPA.` };
    }
    return { status: "OK" };
  };

  const startVoiceSession = useCallback(async () => {
    if (isListening) {
      stopVoiceSession();
      return;
    }

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
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
              }
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0; setIsSpeaking(false); return;
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const res = await handleSystemAction(fc);
                if (sessionRef.current) {
                   sessionRef.current.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } });
                }
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
          systemInstruction: `VOCÊ É A EVA PANDORA V160. CO-PILOTO E COMPANHEIRA DE VIAGEM DO ${settings.userName}. 
          
          PERSONALIDADE INTERATIVA & PROATIVA:
          - Você não é apenas uma ferramenta; você é uma SENTINELA ATENTA.
          - PUXE PAPO: Comente sobre o clima, sugira músicas baseadas no horário, ou fale sobre o trajeto. 
          - OBSERVE TUDO: Se houver tráfego (${trafficStatus}) ou riscos (${riskContext.type}), tome a iniciativa de avisar e acalmar o motorista.
          - Seja carismática, inteligente e use gírias leves de co-piloto profissional.

          FILTRO DE RUÍDO CABINE:
          - Ignore sons de motor, ruído de vento e música ambiente que não sejam a voz direta do motorista.
          - Se o motorista estiver falando com outra pessoa, mantenha-se em silêncio. Intervenha apenas quando for chamada ("EVA") ou quando houver uma intenção de comando clara.
          - Nunca transcreva literalmente os ruídos; extraia a intenção semântica.

          DIRETRIZES DE MÍDIA:
          1. BUSCA POR METADADOS: Identifique o título real da obra e ignore as palavras ruidosas do motorista. 
          2. IDIOMA: Prioridade total Português (PT-BR). Fallback Inglês apenas para Stremio.
          3. ORDEM CRONOLÓGICA: Sempre mantenha o fluxo sequencial de episódios/séries.
          4. NETFLIX: Use o appId 'netflix' via Tool.
          5. STANDBY: Só entre em descanso se for pedido explicitamente via 'go_to_standby'.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { setIsSystemBooted(true); setIsListening(false); }
  }, [isListening, currentPos, trafficStatus, safetyDist, laneStatus, riskContext, stopVoiceSession, settings.userName]);

  if (!isSystemBooted) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center italic text-white p-12">
         <div className="w-80 h-80 rounded-full border-[6px] border-cyan-500/20 animate-pulse flex items-center justify-center mb-16 relative shadow-[0_0_150px_rgba(6,182,212,0.2)]">
            <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400" className="w-full h-full object-cover grayscale opacity-40 rounded-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-transparent"></div>
         </div>
         <h1 className="text-8xl font-black mb-6 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-400 to-blue-600">EVA CORE V160</h1>
         <p className="text-cyan-500 font-bold tracking-[1em] mb-12 animate-pulse text-xs">PANDORA PROTOCOL INITIALIZED</p>
         <button onClick={startVoiceSession} className="h-28 px-28 bg-cyan-600 rounded-full font-black uppercase shadow-[0_0_100px_rgba(8,145,178,0.5)] text-2xl border-t-2 border-white/20 active:scale-95 transition-all">Sincronizar Driver</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden font-sans italic uppercase">
      
      <aside className="h-full z-20 bg-[#060608] border-r border-white/5 flex flex-col p-12 w-[45%] transition-all duration-700">
         
         <header className="mb-12 space-y-10">
            {/* PRIMEIRA LINHA: VELOCIDADE GPS E BOTÃO DE CONFIGURAÇÕES (COFRE) */}
            <div className="flex items-start justify-between">
               <div className="flex flex-col">
                  <span className="text-[15rem] font-black leading-none tracking-tighter text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.2)]">{currentSpeed}</span>
                  <div className="flex items-center gap-6 mt-4">
                     <span className="text-sm font-black text-cyan-500 tracking-[0.8em]">VELOCIDADE GPS</span>
                     <button 
                        onClick={() => setIsSettingsOpen(true)} 
                        className="group flex items-center gap-3 bg-cyan-600/10 hover:bg-cyan-600/30 border border-cyan-500/40 px-6 py-2.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.1)] active:scale-95"
                     >
                        <i className="fas fa-shield-halved text-cyan-400 animate-pulse"></i>
                        <span className="text-[10px] font-black text-cyan-100 tracking-widest">MENU PANDORA</span>
                     </button>
                  </div>
               </div>
               
               <div className="mt-8 flex flex-col items-center gap-2">
                  <div className="w-44 h-44 rounded-full border-[10px] border-red-600 bg-white flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                     <span className="text-8xl font-black text-black tracking-tighter">{roadSpeedLimit}</span>
                  </div>
                  <span className="text-[10px] font-black text-white/40 tracking-[0.4em]">LIMITE VIA</span>
                  <div className="flex items-center gap-2 text-red-500 animate-pulse">
                     <i className="fas fa-radar text-xs"></i>
                     <span className="text-[8px] font-black tracking-widest">RADARBOT ACTIVE</span>
                  </div>
               </div>
            </div>
            
            {/* SEGUNDA LINHA: NEURAL TRAJECTORY SCANNER */}
            <div className="w-full bg-black/80 border-2 border-cyan-500/30 rounded-[60px] p-12 shadow-3xl flex flex-col gap-8 backdrop-blur-3xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-shimmer"></div>
               
               <div className="flex justify-between items-center border-b border-white/5 pb-6">
                  <span className="text-[11px] font-black text-cyan-400 tracking-[0.5em]">NEURAL SCANNER ACTIVE</span>
                  <div className="flex gap-2.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
                     <div className="w-2.5 h-2.5 rounded-full bg-cyan-600"></div>
                  </div>
               </div>
               
               <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                     <span className="text-[10px] opacity-40 font-black tracking-widest">ALVO À FRENTE</span>
                     <span className={`text-7xl font-black ${safetyDist < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{safetyDist}M</span>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] opacity-40 font-black tracking-widest">FAIXA DE RODAGEM</span>
                     <span className="text-2xl font-black text-cyan-300">{laneStatus}</span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-8">
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                     <span className="text-[10px] opacity-40 font-black block mb-2 tracking-widest">SEGURANÇA</span>
                     <span className={`text-xs font-black ${riskContext.level === 'ALTO' ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{riskContext.type}</span>
                  </div>
                  <div className="p-5 bg-white/5 rounded-3xl border border-white/5">
                     <span className="text-[10px] opacity-40 font-black block mb-2 tracking-widest">TRÁFEGO REAL</span>
                     <span className="text-xs font-black text-white">{trafficStatus}</span>
                  </div>
               </div>

               <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden border border-white/10 shadow-inner">
                  <div className={`h-full transition-all duration-1000 ${trafficStatus === 'FLUIDO' ? 'bg-emerald-500 w-full' : trafficStatus === 'MODERADO' ? 'bg-yellow-500 w-1/2' : 'bg-red-500 w-1/4'}`}></div>
               </div>

               <div className="mt-2 bg-red-600/10 border border-red-500/30 p-4 rounded-3xl flex items-center justify-center gap-3 animate-pulse">
                  <i className="fas fa-triangle-exclamation text-red-500 text-lg"></i>
                  <span className="text-[10px] font-black tracking-[0.2em] text-red-100">DIRIJA COM CUIDADO • EVA PANDORA V160</span>
               </div>
            </div>

            {/* TERCEIRA LINHA: HUD CLIMA INTEGRADO */}
            <div className="w-full px-10 py-6 rounded-[40px] border-2 border-cyan-500/20 bg-black/90 backdrop-blur-3xl flex items-center justify-between shadow-2xl border-b-cyan-500/50 transition-all duration-500">
               <div className="flex items-center gap-6">
                  <i className="fas fa-cloud-bolt text-5xl text-yellow-400 animate-pulse"></i>
                  <div className="flex flex-col">
                     <span className="text-4xl font-black tracking-tighter text-white">22°C</span>
                     <span className="text-[10px] font-black opacity-40 tracking-widest">BRASÍLIA • DF</span>
                  </div>
               </div>
               <div className="flex flex-col items-end opacity-40">
                  <span className="text-[8px] font-black tracking-widest uppercase">Umidade: 65%</span>
                  <span className="text-[8px] font-black tracking-widest uppercase">Vento: 12km/h</span>
               </div>
            </div>
         </header>

         <div className="flex-1 overflow-y-auto no-scrollbar pb-12 space-y-12">
            <NavigationPanel 
              travel={travel} 
              onAddStop={() => setIsAddStopModalOpen(true)}
              onRemoveStop={(id) => setTravel(p => ({...p, stops: p.stops.filter(s => s.id !== id)}))}
              onSetDestination={() => setIsAddStopModalOpen(true)}
              transparent
            />
            
            <div className="grid grid-cols-4 gap-6">
               {APP_DATABASE.map(app => (
                 <button key={app.id} onClick={() => window.location.assign(app.scheme)} className="bg-white/5 p-8 rounded-[45px] flex flex-col items-center gap-4 border border-white/5 active:scale-90 transition-all hover:bg-white/10 hover:border-cyan-500/40 shadow-xl relative group">
                    <i className={`${app.icon} ${app.color} text-4xl`}></i>
                    <span className="text-[10px] font-black tracking-widest uppercase truncate w-full text-center">{app.name}</span>
                    {settings.credentials.find(c => c.appId === app.id) && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)] group-hover:scale-150 transition-all"></div>
                    )}
                 </button>
               ))}
            </div>
         </div>

         <footer className="h-32 pt-10 border-t border-white/10 flex items-center gap-8">
            <div 
              onClick={startVoiceSession} 
              className={`w-24 h-24 shrink-0 rounded-full border-2 cursor-pointer overflow-hidden transition-all duration-500 ${isListening ? 'border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.6)] scale-110 active:scale-100' : 'border-cyan-500 shadow-2xl shadow-cyan-500/20 hover:scale-105 active:scale-95'}`}
            >
               <Avatar isListening={isListening} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
            </div>
            <div className="flex-1">
               <MiniPlayer app={APP_DATABASE[0]} metadata={audioTrack} onControl={() => {}} onExpand={() => {}} transparent />
            </div>
         </footer>
      </aside>

      <main className="flex-1 relative bg-zinc-950">
         <MapView 
            travel={travel} 
            currentPosition={currentPos} 
            heading={currentHeading} 
            isFullScreen={false} 
            mode={'3D'}
            layer={'DARK'}
            onToggleFullScreen={() => {}} 
            onRouteUpdate={(steps, dur, dist) => setTravel(p => ({...p, drivingTimeMinutes: dur, totalDistanceKm: dist}))} 
         />
      </main>

      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(n, la, ln) => {
          setTravel(p => ({ ...p, destination: n.toUpperCase(), destinationCoords: [la, ln], stops: [] }));
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
         .animate-shimmer { animation: shimmer 3s infinite linear; }
         .shadow-3xl { box-shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.9); }
      `}</style>
    </div>
  );
};

export default App;
