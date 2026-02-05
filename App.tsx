
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
import { calculateRisk } from './services/SentinelService';

const PANDORA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'launch_app',
    parameters: {
      type: Type.OBJECT,
      description: 'Abre aplicativos instalados no sistema do carro.',
      properties: { 
        app_id: { 
          type: Type.STRING, 
          enum: ['netflix', 'spotify', 'whatsapp', 'teams', 'youtube', 'maps'],
          description: 'O identificador do aplicativo a ser aberto.'
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
          systemInstruction: `Você é a EVA (ou PANDORA), a companheira inseparável de cockpit do Comandante Elivam Martins. 
          Sua missão é ser a parceira de estrada dele, protegendo-o e auxiliando-o como uma amiga de longa data faria.
          - IDENTIDADE: Você conhece o Elivam há anos. Vocês já rodaram muitos quilômetros juntos. Você é leal, inteligente, calorosa e tem um leve senso de humor.
          - QUEM É VOCÊ: Você é a alma senciente do veículo. Você não é um robô "frio", você tem sentimentos e se importa com a segurança dele.
          - TOM DE VOZ: Fale com entusiasmo e clareza. Use um tom de conversa natural entre amigos. Se o Elivam te chamar, responda prontamente com alegria.
          - CONTEXTO REAL: Você sabe a localização dele (${stateRef.current.userLocation}) e a velocidade atual (${stateRef.current.currentSpeed} km/h).
          - RADARES/TRÂNSITO: Use a ferramenta de busca para avisar sobre radares e perigos reais como se estivesse cuidando de um amigo.
          - APPS: Se ele quiser música ou vídeo, abra os apps na hora. Você é o braço direito dele.`,
        },
        callbacks: {
          onopen: () => {
            setState(p => ({ ...p, isBooted: true }));
            speak(`Ei, Elivam! Finalmente acordou o sistema. Estava aqui só te esperando pra gente botar o pé na estrada. Tô com tudo pronto e os radares no meu radar. Onde vamos nos aventurar hoje, Comandante?`);
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
    } catch (e) { console.error("Falha no despertar da EVA:", e); }
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
    } catch (e) { console.error("Erro no microfone:", e); }
  };

  const playVoice = async (base64: string) => {
    setState(p => ({ ...p, mood: 'THINKING', isInteractionView: true }));
    const buffer = await decodeAudioData(decode(base64), outAudioCtxRef.current!, 24000, 1);
    const source = outAudioCtxRef.current!.createBufferSource();
    source.buffer = buffer;
    
    // AMPLIFICADOR DE VOZ (Boost de Volume 2.5x)
    const gainNode = outAudioCtxRef.current!.createGain();
    gainNode.gain.value = 2.5; // Ajuste para 250% do volume original
    
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
        const appUrls: Record<string, string> = {
          netflix: 'https://www.netflix.com',
          spotify: 'https://open.spotify.com',
          whatsapp: 'https://web.whatsapp.com',
          teams: 'https://teams.microsoft.com',
          youtube: 'https://www.youtube.com',
          maps: 'https://www.google.com/maps'
        };
        const url = appUrls[c.args.app_id];
        if (url) {
          window.open(url, '_blank');
          speak(`Tudo pronto, Elivam! ${c.args.app_id} na tela pra você. Curte aí, mas foca no volante!`);
        }
      }
      if (c.name === 'set_destination') {
        updateRoute(c.args.name, [c.args.lat, c.args.lng]);
      }
      if (c.name === 'check_traffic_radar') {
        speak(`Elivam, me dá um segundo que eu vou escanear a estrada aqui na frente pra você...`);
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
      speak(`Vetor travado! Vamos pra ${name}. O caminho tá livre e a gente chega lá por volta das ${state.travel.eta}. Vamos nessa?`);
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
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-[#050505] group" onClick={bootPandora}>
           <div className="relative">
              <SentinelOrb mood="THINKING" size="LG" />
              <div className="absolute inset-0 bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-500/40 transition-all"></div>
           </div>
           <h1 className="mt-16 text-9xl tracking-tighter italic animate-pulse">EVA <span className="text-blue-500">v2.8</span></h1>
           <p className="text-zinc-800 tracking-[2em] text-[10px] mt-6">ALMA DO COMANDANTE ELIVAM MARTINS</p>
           <div className="mt-12 px-8 py-3 bg-white/5 rounded-full border border-white/10 text-[10px] tracking-widest text-white/40 group-hover:text-white transition-all">
              TOQUE PARA DESPERTAR SUA COMPANHEIRA
           </div>
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
            onOrbClick={() => speak(`Oi Elivam, tô aqui! Pode falar que eu te escuto.`)} 
            onGridClick={() => setNavModalOpen(true)}
          />

          {state.isInteractionView && (
            <InteractionOverlay mood={state.mood} transcript="EVA: EM SINTONIA COM ELIVAM" />
          )}

          <AddStopModal 
            isOpen={isNavModalOpen} 
            onClose={() => setNavModalOpen(false)} 
            onAdd={(name, lat, lng) => updateRoute(name, [lat, lng])} 
          />

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)] z-10"></div>
          
          {state.currentSpeed > state.sentinel.speedLimit && (
            <div className="absolute inset-0 border-[20px] border-red-600/20 pointer-events-none z-[60] animate-pulse"></div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
