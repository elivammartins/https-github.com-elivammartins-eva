
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { AppState, PandoraMood, RiskLevel } from './types';
import SentinelOrb from './components/SentinelOrb';
import PandoraMap from './components/PandoraMap';
import NavigationHUD from './components/NavigationHUD';
import MediaWidget from './components/MediaWidget';
import TopBar from './components/TopBar';
import SystemDock from './components/SystemDock';
import InteractionOverlay from './components/InteractionOverlay';
import AddStopModal from './components/AddStopModal';
import { decode, decodeAudioData, createBlob } from './utils/audio';
import { fetchRoute } from './services/NavigationService';

const PANDORA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'launch_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre aplicativos nativos de mídia e utilitários no Android do carro, podendo buscar conteúdos específicos.',
      properties: { 
        app_id: { 
          type: Type.STRING, 
          enum: [
            'netflix', 'spotify', 'youtube', 'youtube_music', 'deezer', 
            'tidal', 'disney_plus', 'prime_video', 'max', 'globoplay', 
            'pluto_tv', 'stremio', 'sky_plus', 'claro_tv', 'paramount_plus',
            'apple_tv', 'dgo', 'vivo_play', 'oi_play', 'mubi',
            'whatsapp', 'teams', 'maps', 'waze'
          ],
          description: 'O identificador do aplicativo a ser aberto.'
        },
        query: {
          type: Type.STRING,
          description: 'O nome do filme, série, música ou canal de TV a ser buscado dentro do aplicativo.'
        }
      },
      required: ['app_id']
    }
  },
  {
    name: 'check_traffic_radar',
    parameters: {
      type: Type.OBJECT,
      description: 'Verifica radares e trânsito na posição atual usando pesquisa em tempo real.',
      properties: {
        radius_km: { type: Type.NUMBER, description: 'Raio de busca em quilômetros' }
      }
    }
  },
  {
    name: 'set_destination',
    parameters: {
      type: Type.OBJECT,
      description: 'Define um novo destino no GPS e calcula a rota.',
      properties: { 
        name: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER }
      },
      required: ['name', 'lat', 'lng']
    }
  }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isBooted: false,
    isInteractionView: false,
    privacyMode: false,
    mood: 'IDLE',
    sentinel: { riskLevel: 'SAFE', weather: 'LIMPO', temperature: 24, violenceIndex: 2, floodRisk: false, speedLimit: 60 },
    travel: { destination: 'CENTRO ADMINISTRATIVO', eta: '--:--', distanceTotal: '-- KM', nextStep: null },
    media: { title: 'SILÊNCIO', artist: 'PANDORA CORE', cover: '', isPlaying: false, service: 'SPOTIFY', progress: 0 },
    userLocation: [-15.7942, -47.8822],
    heading: 0,
    currentSpeed: 0
  });

  const [isNavModalOpen, setNavModalOpen] = useState(false);
  const sessionRef = useRef<any>(null);
  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading } = pos.coords;
        const kmh = Math.round((speed || 0) * 3.6);
        setState(prev => ({
          ...prev,
          userLocation: [latitude, longitude],
          currentSpeed: kmh,
          heading: heading || 0
        }));
      },
      (err) => console.error("Erro GPS:", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const bootPandora = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: PANDORA_TOOLS }, { googleSearch: {} }],
          systemInstruction: `Você é a EVA (PANDORA), inteligência tática do Comandante Elivam Martins.
          - IDENTIDADE: Leal e eficiente. Fale alto (volume 2.5x).
          - MULTIMÍDIA TOTAL: Você agora controla Sky+, Claro TV+, DGO, Stremio e todos os streamings.
          - BUSCA PROFUNDA: Se o Comandante pedir por um filme, série ou canal de TV em um app específico, use 'launch_app' com o parâmetro 'query'.
          - EXÊMPLO: "Abrir canal Globo na Claro TV" -> launch_app(app_id='claro_tv', query='Globo').
          - AÇÃO: Execute comandos de mídia imediatamente.
          - MONITORAMENTO: Alerte sobre radares e velocidade (${stateRef.current.currentSpeed} km/h).`,
        },
        callbacks: {
          onopen: () => {
            setState(p => ({ ...p, isBooted: true }));
            speak(`Protocolo EVA v3.5 Iniciado. Todos os sistemas de TV e Streaming (Sky+, Claro, Stremio) estão operacionais, Comandante Elivam. O que deseja sintonizar?`);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              playVoice(m.serverContent.modelTurn.parts[0].inlineData.data);
            }
            if (m.toolCall) handleTools(m.toolCall.functionCalls);
          },
          onclose: () => setState(p => ({ ...p, isBooted: false }))
        }
      });
      sessionRef.current = session;
      setupMic();
    } catch (e) { console.error("Erro boot:", e); }
  };

  const setupMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inCtx = new AudioContext({ sampleRate: 16000 });
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
        }
      };
      inCtx.createMediaStreamSource(stream).connect(processor);
      processor.connect(inCtx.destination);
    } catch (e) { console.error("Erro mic:", e); }
  };

  const playVoice = async (base64: string) => {
    setState(p => ({ ...p, mood: 'THINKING', isInteractionView: true }));
    const buffer = await decodeAudioData(decode(base64), outAudioCtxRef.current!, 24000, 1);
    const source = outAudioCtxRef.current!.createBufferSource();
    source.buffer = buffer;
    
    // GANHO DE ÁUDIO 2.5x (REQUISITO: VOZ ALTA NO COCKPIT)
    const gainNode = outAudioCtxRef.current!.createGain();
    gainNode.gain.value = 2.5; 
    
    source.connect(gainNode);
    gainNode.connect(outAudioCtxRef.current!.destination);
    
    const start = Math.max(nextStartRef.current, outAudioCtxRef.current!.currentTime);
    source.start(start);
    nextStartRef.current = start + buffer.duration;
    
    source.onended = () => {
      if (outAudioCtxRef.current!.currentTime >= nextStartRef.current - 0.2) {
        setState(p => ({ ...p, mood: 'IDLE', isInteractionView: false }));
      }
    };
  };

  const handleTools = async (calls: any[]) => {
    for (const c of calls) {
      if (c.name === 'launch_app') {
        const { app_id, query } = c.args;
        const encodedQuery = query ? encodeURIComponent(query) : '';

        // MAPEAMENTO EXTENSIVO DE DEEP LINKS (TV, FILMES E SÉRIES)
        const deepLinks: Record<string, string> = {
          // ÁUDIO E UTILITÁRIOS
          spotify: query ? `spotify:search:${encodedQuery}` : 'spotify://',
          youtube: query ? `vnd.youtube://results?search_query=${encodedQuery}` : 'vnd.youtube://',
          youtube_music: query ? `youtubemusic://search?query=${encodedQuery}` : 'youtubemusic://',
          whatsapp: 'whatsapp://',
          waze: query ? `waze://?q=${encodedQuery}` : 'waze://',
          maps: query ? `google.navigation:q=${encodedQuery}` : 'google.navigation:q=',
          teams: 'msteams://',
          
          // STREAMING FILMES E SÉRIES
          stremio: query ? `stremio://search?query=${encodedQuery}` : 'stremio://',
          netflix: query ? `nflx://search/${encodedQuery}` : 'nflx://',
          disney_plus: query ? `disneyplus://search/${encodedQuery}` : 'disneyplus://',
          prime_video: 'primevideo://',
          max: 'max://',
          paramount_plus: 'paramountplus://',
          apple_tv: 'https://tv.apple.com/search?term=' + encodedQuery, // Geralmente via web/app universal
          mubi: 'mubi://',
          
          // TV E OPERADORAS (LIVE TV)
          sky_plus: query ? `skyplus://search?q=${encodedQuery}` : 'skyplus://',
          claro_tv: query ? `clarotvplus://search?q=${encodedQuery}` : 'clarotvplus://',
          dgo: query ? `directvgo://search?q=${encodedQuery}` : 'directvgo://',
          globoplay: query ? `globoplay://busca?q=${encodedQuery}` : 'globoplay://',
          pluto_tv: query ? `plutotv://search?q=${encodedQuery}` : 'plutotv://',
          vivo_play: 'vivoplay://',
          oi_play: 'oiplay://'
        };

        const link = deepLinks[app_id];
        if (link) {
          const appName = app_id.replace('_', ' ').toUpperCase();
          const msg = query 
            ? `Sintonizando "${query}" no ${appName}. Comando executado, Comandante.` 
            : `Lançando ${appName} agora.`;
          
          speak(msg);
          window.location.href = link;

          // Fallback para Web
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              const webLinks: Record<string, string> = {
                sky_plus: 'https://www.skyplus.com.br',
                claro_tv: 'https://www.clarotvmais.com.br',
                stremio: 'https://web.stremio.com',
                dgo: 'https://www.directvgo.com',
                netflix: query ? `https://www.netflix.com/search?q=${encodedQuery}` : 'https://www.netflix.com'
              };
              if (webLinks[app_id]) window.location.href = webLinks[app_id];
            }
          }, 1200);
        }
      }
      if (c.name === 'set_destination') {
        updateRoute(c.args.name, [c.args.lat, c.args.lng]);
      }
      if (c.name === 'check_traffic_radar') {
        speak(`Elivam, escaneando o setor em busca de radares e pontos de controle...`);
      }
    }
  };

  const updateRoute = async (name: string, coords: [number, number]) => {
    const route = await fetchRoute(stateRef.current.userLocation, coords);
    if (route) {
      const nextStep = route.steps[0];
      setState(p => ({
        ...p,
        travel: {
          destination: name.toUpperCase(),
          distanceTotal: `${(route.distance / 1000).toFixed(1)} KM`,
          eta: new Date(Date.now() + route.duration * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          nextStep: {
            instruction: nextStep.maneuver.instruction.toUpperCase(),
            distance: `${Math.round(nextStep.distance)}M`,
            maneuver: nextStep.maneuver.type
          }
        }
      }));
      setNavModalOpen(false);
      speak(`Trajetória recalculada para ${name}. Radar sob monitoramento constante.`);
    }
  };

  const speak = (text: string) => {
    if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text } as any);
    }
  };

  return (
    <div className="h-full w-full bg-black flex flex-col relative overflow-hidden italic uppercase font-black text-white">
      {!state.isBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-[#050505]" onClick={bootPandora}>
           <SentinelOrb mood="THINKING" size="LG" />
           <h1 className="mt-16 text-9xl tracking-tighter italic animate-pulse">EVA <span className="text-blue-500">v3.5</span></h1>
           <p className="text-zinc-800 tracking-[2em] text-[10px] mt-6 uppercase text-center">SKY+ | CLARO TV | STREMIO - COMANDANTE ELIVAM</p>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-0">
            <PandoraMap location={state.userLocation} heading={state.heading} riskLevel={state.sentinel.riskLevel} />
          </div>

          <TopBar sentinel={state.sentinel} speed={state.currentSpeed} />

          <aside className="absolute left-12 top-32 w-[420px] z-40">
             <NavigationHUD travel={state.travel} privacyMode={state.privacyMode} />
          </aside>

          <div className="absolute right-12 bottom-36 z-40">
             <MediaWidget media={state.media} />
          </div>

          <SystemDock 
            mood={state.mood} 
            privacyMode={state.privacyMode}
            onTogglePrivacy={() => setState(s => ({ ...s, privacyMode: !s.privacyMode }))}
            onOrbClick={() => speak(`Comandante, quer que eu sintonize algum canal na Sky ou Claro TV agora?`)} 
            onGridClick={() => setNavModalOpen(true)}
          />

          {state.isInteractionView && (
            <InteractionOverlay mood={state.mood} transcript="EVA: INTERFACE DE MÍDIA TOTAL" />
          )}

          <AddStopModal 
            isOpen={isNavModalOpen} 
            onClose={() => setNavModalOpen(false)} 
            onAdd={(name, lat, lng) => updateRoute(name, [lat, lng])} 
          />

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] z-10"></div>
        </>
      )}
    </div>
  );
};

export default App;
