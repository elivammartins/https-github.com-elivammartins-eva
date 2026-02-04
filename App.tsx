
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
import { decode, decodeAudioData, createBlob } from './utils/audio';

const PANDORA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'toggle_privacy_shield',
    parameters: {
      type: Type.OBJECT,
      properties: { enabled: { type: Type.BOOLEAN } },
      required: ['enabled']
    }
  },
  {
    name: 'set_alert_status',
    parameters: {
      type: Type.OBJECT,
      properties: { 
        level: { type: Type.STRING, enum: ['SAFE', 'CAUTION', 'DANGER', 'CRITICAL'] },
        reason: { type: Type.STRING }
      },
      required: ['level']
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
    travel: { destination: 'CENTRO ADMINISTRATIVO', eta: '12:45', distanceTotal: '8.4 KM', nextStep: { instruction: 'SIGA O FLUXO À DIREITA', distance: '450M', maneuver: 'right' } },
    media: { title: 'SILÊNCIO', artist: 'PANDORA CORE', cover: '', isPlaying: false, service: 'SPOTIFY', progress: 30 },
    userLocation: [-15.7942, -47.8822],
    heading: 45,
    currentSpeed: 85
  });

  const sessionRef = useRef<any>(null);
  const outAudioCtxRef = useRef<AudioContext | null>(null);
  const nextStartRef = useRef(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState(prev => ({
          ...prev,
          userLocation: [pos.coords.latitude, pos.coords.longitude],
          currentSpeed: prev.isBooted ? Math.round((pos.coords.speed || 0) * 3.6) : 85,
          heading: pos.coords.heading || 45
        }));
      },
      null, { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [state.isBooted]);

  const bootPandora = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      outAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: PANDORA_TOOLS }, { googleSearch: {} }],
          systemInstruction: `VOCÊ É PANDORA v1.0. CO-PILOTO SENTIENTE DO COMANDANTE ELIVAM.
          PERSONA: Águia (proteção). Tom autoritário em perigo, empático em cruzeiro.
          AÇÕES: Intervir se detectar crimes ou alagamentos via googleSearch na rota.
          DOCK: Você controla o Privacy Shield e mídias.`,
        },
        callbacks: {
          onopen: () => {
            setState(p => ({ ...p, isBooted: true }));
            speak("Comandante Elivam, protocolos de sentinela v1.0 ativos. Visão da águia estabelecida.");
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

  const handleTools = (calls: any[]) => {
    calls.forEach(c => {
      if (c.name === 'toggle_privacy_shield') setState(p => ({ ...p, privacyMode: c.args.enabled }));
      if (c.name === 'set_alert_status') setState(p => ({ ...p, sentinel: { ...p.sentinel, riskLevel: c.args.level } }));
    });
  };

  const speak = (text: string) => sessionRef.current?.sendRealtimeInput({ text } as any);

  return (
    <div className="h-full w-full bg-black flex flex-col relative overflow-hidden italic uppercase font-black text-white selection:bg-blue-600">
      {!state.isBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-[#050505]" onClick={bootPandora}>
           <SentinelOrb mood="THINKING" size="LG" />
           <h1 className="mt-16 text-9xl tracking-tighter italic">PANDORA <span className="text-blue-500">v1.0</span></h1>
           <p className="text-zinc-800 tracking-[2em] text-[10px] mt-6 animate-pulse">SENTINEL OPERATING SYSTEM</p>
        </div>
      ) : (
        <>
          {/* ZONA 4: BACKGROUND MAP */}
          <div className="absolute inset-0 z-0">
            <PandoraMap location={state.userLocation} heading={state.heading} riskLevel={state.sentinel.riskLevel} />
          </div>

          {/* ZONA 1: TOP STATUS BAR */}
          <TopBar sentinel={state.sentinel} speed={state.currentSpeed} />

          {/* ZONA 2: SIDEBAR HUD */}
          <aside className="absolute left-12 top-32 w-[420px] z-40">
             <NavigationHUD travel={state.travel} privacyMode={state.privacyMode} />
          </aside>

          {/* ZONA 4: MEDIA PLAYER (FLOATING) */}
          <div className="absolute right-12 bottom-36 z-40">
             <MediaWidget media={state.media} />
          </div>

          {/* ZONA 3: SYSTEM DOCK */}
          <SystemDock 
            mood={state.mood} 
            privacyMode={state.privacyMode}
            onTogglePrivacy={() => setState(s => ({ ...s, privacyMode: !s.privacyMode }))}
            onOrbClick={() => setState(s => ({ ...s, isInteractionView: !s.isInteractionView }))} 
          />

          {/* INTERACTION OVERLAY */}
          {state.isInteractionView && (
            <InteractionOverlay mood={state.mood} transcript="PROCESSANDO AMBIENTE TÁTICO..." />
          )}

          {/* VIGNETTE & SCANLINES */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.5)_100%)] z-10"></div>
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]"></div>
        </>
      )}
    </div>
  );
};

export default App;
