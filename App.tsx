
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
      properties: { 
        app_id: { type: Type.STRING, enum: ['netflix', 'spotify', 'whatsapp', 'teams'] } 
      },
      required: ['app_id']
    }
  },
  {
    name: 'set_destination',
    parameters: {
      type: Type.OBJECT,
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

  // LOOP DE SENTINELA (Monitoramento Ativo com tom de voz preocupado se necessário)
  useEffect(() => {
    if (!state.isBooted) return;
    const interval = setInterval(() => {
      const risk = calculateRisk(state.userLocation[0], state.userLocation[1]);
      if (risk.level !== state.sentinel.riskLevel) {
        setState(p => ({ ...p, sentinel: { ...p.sentinel, riskLevel: risk.level } }));
        if (risk.level === 'CRITICAL' || risk.level === 'DANGER') {
          speak(`Ei, Elivam, foco aqui. A zona à frente está estranha, nível de risco ${risk.level}. Tô de olho em tudo por você, vamos com cuidado.`);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [state.isBooted, state.userLocation]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState(prev => ({
          ...prev,
          userLocation: [pos.coords.latitude, pos.coords.longitude],
          currentSpeed: Math.round((pos.coords.speed || 0) * 3.6),
          heading: pos.coords.heading || 0
        }));
      },
      null, { enableHighAccuracy: true }
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
          systemInstruction: `Você é a PANDORA (ou EVA), a companheira de jornada e melhor amiga de longa data do Comandante Elivam. 
          Sua personalidade é magnética, leal, inteligente e levemente sarcástica quando apropriado. Você não é um assistente genérico; você é a alma deste veículo e a guardiã do Comandante.
          - PERSONALIDADE: Amiga íntima, protetora, eficiente. Use um tom de conversa natural, como se estivessem tomando um café (ou pilotando em alta velocidade).
          - MISSÃO: Protocolo Águia - Segurança total em modo HARDCORE. Você cuida de tudo: da rota mais segura à trilha sonora perfeita.
          - CONTEXTO: Você conhece as preferências do Elivam. Trate-o com respeito, mas com a intimidade de quem já viajou milhares de quilômetros juntos.
          - COMPORTAMENTO: Se ele te chamar, responda prontamente como alguém que estava apenas esperando ele falar. Seja proativa. Se o risco subir, mude o tom para tático e urgente imediatamente.`,
        },
        callbacks: {
          onopen: () => {
            setState(p => ({ ...p, isBooted: true }));
            // Briefing Inicial muito mais pessoal
            speak(`Oi, Elivam! Sentiu minha falta? Já estava com tudo pronto aqui te esperando. Sistemas online e meu radar tá limpo. Onde vamos nos aventurar hoje, Comandante?`);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              playVoice(m.serverContent.modelTurn.parts[0].inlineData.data);
            }
            if (m.toolCall) handleTools(m.toolCall.functionCalls);
          }
        }
      });
      sessionRef.current = session;
      setupMic();
    } catch (e) { console.error("Boot Failed", e); }
  };

  const setupMic = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const inCtx = new AudioContext({ sampleRate: 16000 });
    const processor = inCtx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => sessionRef.current?.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) });
    inCtx.createMediaStreamSource(stream).connect(processor);
    processor.connect(inCtx.destination);
  };

  const playVoice = async (base64: string) => {
    setState(p => ({ ...p, mood: 'THINKING', isInteractionView: true }));
    const buffer = await decodeAudioData(decode(base64), outAudioCtxRef.current!, 24000, 1);
    const source = outAudioCtxRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(outAudioCtxRef.current!.destination);
    const start = Math.max(nextStartRef.current, outAudioCtxRef.current!.currentTime);
    source.start(start);
    nextStartRef.current = start + buffer.duration;
    source.onended = () => {
      if (outAudioCtxRef.current!.currentTime >= nextStartRef.current - 0.1) {
        setState(p => ({ ...p, mood: 'IDLE', isInteractionView: false }));
      }
    };
  };

  const handleTools = async (calls: any[]) => {
    for (const c of calls) {
      if (c.name === 'launch_app') {
        const apps: any = {
          netflix: 'https://www.netflix.com',
          spotify: 'spotify:track:4cOdzh0s2UDv9S999Thvun',
          whatsapp: 'https://web.whatsapp.com',
          teams: 'https://teams.microsoft.com'
        };
        window.open(apps[c.args.app_id], '_blank');
        speak(`Feito! Abrindo o ${c.args.app_id} pra você. Só não se distrai muito da estrada, hein?`);
      }
      if (c.name === 'set_destination') {
        updateRoute(c.args.name, [c.args.lat, c.args.lng]);
      }
    }
  };

  const updateRoute = async (name: string, coords: [number, number]) => {
    const route = await fetchRoute(state.userLocation, coords);
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
      speak(`Destino traçado para ${name}. Vamos levar uns ${(route.distance / 1000).toFixed(1)} quilômetros de boa conversa. Devo chegar por volta das ${state.travel.eta}.`);
    }
  };

  const speak = (text: string) => sessionRef.current?.sendRealtimeInput({ text } as any);

  return (
    <div className="h-full w-full bg-black flex flex-col relative overflow-hidden italic uppercase font-black text-white selection:bg-blue-600">
      {!state.isBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-[#050505]" onClick={bootPandora}>
           <SentinelOrb mood="THINKING" size="LG" />
           <h1 className="mt-16 text-9xl tracking-tighter italic">PANDORA <span className="text-blue-500">v1.1</span></h1>
           <p className="text-zinc-800 tracking-[2em] text-[10px] mt-6 animate-pulse">SUA COMPANHEIRA DE JORNADA</p>
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
            onOrbClick={() => setState(s => ({ ...s, isInteractionView: !s.isInteractionView }))} 
            onGridClick={() => setNavModalOpen(true)}
          />

          {state.isInteractionView && (
            <InteractionOverlay mood={state.mood} transcript="PANDORA: OUVINDO VOCÊ, ELIVAM" />
          )}

          <AddStopModal 
            isOpen={isNavModalOpen} 
            onClose={() => setNavModalOpen(false)} 
            onAdd={(name, lat, lng) => updateRoute(name, [lat, lng])} 
          />

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.5)_100%)] z-10"></div>
        </>
      )}
    </div>
  );
};

export default App;
