
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { TravelInfo, SecurityTelemetry, HealthTelemetry, MapMode, MapLayer, SuggestedStop } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import CarSafetyWidget from './components/CarSafetyWidget';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const App: React.FC = () => {
  const [isSystemBooted, setIsSystemBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isEvaActive, setIsEvaActive] = useState(true);
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('3D');
  const [mapLayer, setMapLayer] = useState<MapLayer>('DARK');
  const [mapZoom, setMapZoom] = useState(17);
  const [time, setTime] = useState('00:00');
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([-15.7942, -47.8822]); 
  const [heading, setHeading] = useState(0);
  
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [suggestedStops, setSuggestedStops] = useState<SuggestedStop[]>([]);

  const [security, setSecurity] = useState<SecurityTelemetry>({ 
    violenceIndex: 'LOW', 
    policeNearby: false, 
    radarDistance: 1200, 
    radarLimit: 60, 
    lanePosition: 'CENTER', 
    vehicleAheadDistance: 120,
    isZigZagging: false
  });
  
  const laneHistory = useRef<string[]>([]);
  
  const [health, setHealth] = useState<HealthTelemetry>({ 
    heartRate: 72, 
    stressLevel: 'NORMAL', 
    fatigueIndex: 0, 
    respirationRate: 16, 
    lastBlinkRate: 12 
  });
  
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO VETOR', 
    stops: [], 
    drivingTimeMinutes: 0, 
    totalDistanceKm: 0, 
    hasTrafficAlert: false,
    destIsOpen: true
  });

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());

  // GPS E RELÓGIO
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (p) => {
          const { latitude, longitude, speed, heading: h } = p.coords;
          if (latitude && longitude) setCurrentPos([latitude, longitude]);
          if (speed !== null) setCurrentSpeed(Math.round(speed * 3.6));
          if (h !== null) setHeading(h);
        },
        null, { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // MOTOR SENTINELA: BIO-PADRÃO E ZIGUE-ZAGUE
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulação de movimento de faixa
      const nextLane = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'LEFT' : 'RIGHT') : 'CENTER';
      laneHistory.current = [...laneHistory.current.slice(-8), nextLane];
      const shifts = laneHistory.current.filter((l, i, arr) => i > 0 && l !== arr[i-1]).length;
      
      // Detecção real de zig-zag se houver muitas trocas bruscas em alta velocidade
      const isZigZag = shifts >= 4 && currentSpeed > 30;

      setSecurity(prev => ({ ...prev, lanePosition: nextLane as any, isZigZagging: isZigZag }));

      setHealth(prev => {
        // Cálculo de fadiga baseado em comportamento e tempo
        const zigzagPenalty = isZigZag ? 15 : 0;
        const respDrift = (prev.respirationRate < 11 || prev.respirationRate > 21) ? 6 : 0;
        
        let nextResp = prev.respirationRate;
        if (prev.fatigueIndex > 30) {
           nextResp = 10.5 + (Math.sin(Date.now() / 1100) * 3); // Sonolência
        } else {
           nextResp = 16 + (Math.sin(Date.now() / 2500) * 1.8); // Alerta
        }

        return {
          ...prev,
          fatigueIndex: Math.min(100, prev.fatigueIndex + 0.15 + zigzagPenalty + respDrift),
          respirationRate: parseFloat(nextResp.toFixed(1)),
          heartRate: 70 + Math.floor(Math.random() * 10)
        };
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [currentSpeed]);

  // PROTOCOLO DE INTERVENÇÃO PROATIVA
  useEffect(() => {
    if (sessionRef.current && isSystemBooted && isEvaActive) {
      const interval = setInterval(() => {
        if (health.fatigueIndex > 20 || security.isZigZagging) {
          const situation = security.isZigZagging ? "ZIGUE-ZAGUE" : "DRIFT RESPIRATÓRIO";
          sessionRef.current.sendRealtimeInput({ 
            text: `[SITUAÇÃO CRÍTICA: ${situation}] Fadiga em ${health.fatigueIndex.toFixed(0)}%. 
            AÇÃO: Use 'suggest_stop' para um local ABERTO. Fale com firmeza mas carinho: 'Ei parceiro, notei um comportamento instável. Marquei um lugar aberto aqui perto pra você esticar as pernas. Vamos nessa?'` 
          });
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isSystemBooted, isEvaActive, health.fatigueIndex, security.isZigZagging]);

  const executeReroute = useCallback((name: string, lat: number, lng: number, isOpen?: boolean, hours?: string) => {
    setTravel(prev => ({ 
      ...prev, 
      destination: name.toUpperCase(), 
      destinationCoords: [lat, lng],
      destIsOpen: isOpen ?? true,
      destHours: hours || "08:00 - 22:00"
    }));
    setSuggestedStops([]);
    setTranscription(`VETOR: ${name.toUpperCase()} | ${isOpen ? 'ABERTO' : 'FECHADO'}`);
    
    if (isOpen === false) {
      sessionRef.current?.sendRealtimeInput({ 
        text: `[PROTOCOLO FRUSTRAÇÃO ZERO] O motorista escolheu um local FECHADO (${name}). Avise-o IMEDIATAMENTE do horário (${hours}) e pergunte se quer que eu busque uma alternativa aberta.` 
      });
    }
  }, []);

  const handleUpdateMetrics = useCallback((dist: number, time: number) => {
    setTravel(prev => (prev.totalDistanceKm === dist && prev.drivingTimeMinutes === time) ? prev : { ...prev, totalDistanceKm: dist, drivingTimeMinutes: time });
  }, []);

  const startLiveSession = async () => {
    if (sessionRef.current) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const functionDeclarations = [
        {
          name: 'suggest_stop',
          parameters: {
            type: Type.OBJECT,
            description: 'Sugere parada. SÓ SUGIRA LOCAIS ABERTOS.',
            properties: { 
              name: { type: Type.STRING }, 
              lat: { type: Type.NUMBER }, 
              lng: { type: Type.NUMBER },
              type: { type: Type.STRING, enum: ['COFFEE', 'GAS', 'REST'] },
              isOpen: { type: Type.BOOLEAN, description: 'True se aberto agora' },
              hours: { type: Type.STRING, description: 'Horário de funcionamento' }
            },
            required: ['name', 'lat', 'lng', 'type', 'isOpen']
          }
        }
      ];

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          outputAudioTranscription: {},
          tools: [{ functionDeclarations }],
          systemInstruction: `VOCÊ É EVA VITA, SENTINELA DE TRAJETO.
          - FOCO EM SEGURANÇA: Se detectar zig-zag ou fadiga, intervenha.
          - FRUSTRAÇÃO ZERO: Nunca deixe o motorista ir a um local fechado sem avisar.
          - TOM: Parceira de missão, confiante e atenciosa.`,
        },
        callbacks: {
          onopen: () => {
             setIsListening(true); setIsSystemBooted(true);
             const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
             const processor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
             processor.onaudioprocess = (e) => {
               if (!isEvaActive) return; 
               const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
               sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
             };
             source.connect(processor);
             processor.connect(inputAudioContextRef.current!.destination);
             sessionPromise.then(s => s.sendRealtimeInput({ text: "EVA ONLINE. Relatório de prontidão OK." }));
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.serverContent?.outputTranscription) setTranscription(m.serverContent.outputTranscription.text);
            if (m.toolCall) {
              for (const fc of m.toolCall.functionCalls) {
                if (fc.name === 'suggest_stop') {
                  const stop = { id: Math.random().toString(), name: fc.args.name as string, lat: fc.args.lat as number, lng: fc.args.lng as number, type: fc.args.type as any, isOpen: fc.args.isOpen as boolean, openingHours: fc.args.hours as string };
                  setSuggestedStops([stop]);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ALERTA PROJETADO NO MAPA" } } }));
                }
              }
            }
            const parts = m.serverContent?.modelTurn?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                setIsSpeaking(true);
                const ctx = outputAudioContextRef.current!;
                if (ctx.state === 'suspended') await ctx.resume();
                const buffer = await decodeAudioData(decode(part.inlineData.data), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.onended = () => setIsSpeaking(false);
                source.start(Math.max(nextStartTimeRef.current, ctx.currentTime));
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime) + buffer.duration;
              }
            }
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error("EVA Erro:", e); }
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-sans italic uppercase select-none overflow-hidden flex flex-row">
      {!isSystemBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer bg-black" onClick={startLiveSession}>
          <div className="w-64 h-64 shadow-[0_0_150px_rgba(6,182,212,0.3)] rounded-full border-2 border-cyan-500/20">
            <Avatar isListening={false} isSpeaking={false} onAnimateClick={() => {}} />
          </div>
          <h1 className="mt-12 text-7xl font-black italic tracking-tighter text-white">EVA <span className="text-cyan-500">VITA</span></h1>
          <p className="text-zinc-600 font-bold tracking-[1.5em] text-[10px] mt-6 animate-pulse">SENTINELA V2.1 • ZERO TELA PRETA</p>
        </div>
      ) : (
        <React.Fragment>
          {/* PAINEL ESQUERDO: USANDO FLEX PARA EVITAR 'DISAPPEARING' DO MAPA */}
          {!isMapFullScreen && (
            <aside className="w-[32%] min-w-[380px] h-full bg-[#050505] border-r border-white/10 flex flex-col p-8 z-[50]">
               <div className="flex gap-4 mb-8">
                  <button onClick={() => setIsMapFullScreen(true)} className="flex-1 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl transition-all active:scale-95"><i className="fas fa-expand-arrows-alt"></i></button>
                  <button onClick={() => setIsAddStopModalOpen(true)} className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl"><i className="fas fa-search"></i></button>
               </div>
               
               <section className="mb-4 text-center">
                  <span className="text-[10rem] font-black leading-none text-white italic tracking-tighter">{currentSpeed}</span>
                  <span className="text-[10px] font-black text-cyan-500 block tracking-[0.5em] mt-[-15px]">KM/H REAL-TIME</span>
               </section>

               <div className="mb-6 p-6 bg-white/5 rounded-[40px] border border-white/10">
                  <CarSafetyWidget telemetry={security} speed={currentSpeed} />
               </div>

               <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className={`p-6 bg-white/5 rounded-3xl border transition-all duration-500 ${health.fatigueIndex > 18 || security.isZigZagging ? 'border-red-600 bg-red-600/10' : 'border-white/5'}`}>
                     <i className={`fas fa-eye text-2xl mb-1 ${health.fatigueIndex > 18 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}></i>
                     <p className="text-[8px] font-black text-white/30 mb-1">SENTINELA</p>
                     <p className="text-3xl font-black italic">{health.fatigueIndex.toFixed(0)}%</p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                     <i className={`fas fa-lungs text-2xl mb-1 ${health.respirationRate < 12 || health.respirationRate > 20 ? 'text-red-500 animate-bounce' : 'text-emerald-500'}`}></i>
                     <p className="text-[8px] font-black text-white/30 mb-1">RESPIRAÇÃO</p>
                     <p className="text-3xl font-black italic">{health.respirationRate}</p>
                  </div>
               </div>

               <footer className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                  <div className="flex flex-col">
                     <span className="text-6xl font-black italic tracking-tighter leading-none">{time}</span>
                     {security.isZigZagging && <span className="text-[9px] text-red-500 font-black animate-pulse">ALERTA ZIG-ZAG</span>}
                  </div>
                  <button onClick={() => setIsEvaActive(!isEvaActive)} className={`w-28 h-28 rounded-full border-4 transition-all duration-700 ${isEvaActive ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'border-red-600 grayscale opacity-40'}`}>
                    <Avatar isListening={isListening && isEvaActive && !isSpeaking} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
                  </button>
               </footer>
            </aside>
          )}

          {/* MAIN AREA: O MAPA SEMPRE OCUPA O RESTO */}
          <main className="flex-1 relative bg-black flex flex-col overflow-hidden">
            <MapView 
              travel={travel} currentPosition={currentPos} heading={heading} 
              isFullScreen={isMapFullScreen} mode={mapMode} layer={mapLayer} zoom={mapZoom}
              suggestedStops={suggestedStops}
              onUpdateMetrics={handleUpdateMetrics}
            />

            {/* ALERTA DE DESTINO FECHADO (HUD FLUTUANTE SEM BLUR PESADO) */}
            {!travel.destIsOpen && travel.destination !== 'AGUARDANDO VETOR' && (
              <div className="absolute top-8 left-8 z-[200] bg-red-600 border-2 border-white rounded-2xl p-5 flex items-center gap-5 shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-bounce">
                <i className="fas fa-door-closed text-3xl text-white"></i>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-white uppercase italic">LOCAL FECHADO AGORA</span>
                  <span className="text-[10px] font-bold text-white/80">HORÁRIO: {travel.destHours}</span>
                </div>
              </div>
            )}

            {/* TRANSCRIÇÃO DE VOZ (COMPACTA PARA EVITAR TELA PRETA) */}
            {isSpeaking && transcription && (
              <div className="absolute bottom-40 left-1/2 -translate-x-1/2 z-[210] w-[75%] pointer-events-none">
                <div className="bg-black/80 border border-cyan-500/50 rounded-[30px] p-6 shadow-2xl">
                  <p className="text-white text-2xl font-black italic text-center tracking-tight leading-tight uppercase">{transcription}</p>
                </div>
              </div>
            )}

            {/* BOTÕES DE CONTROLE RÁPIDO DO MAPA */}
            <div className="absolute right-8 top-1/4 flex flex-col gap-4 z-[150]">
               <button onClick={() => setMapMode(m => m === '2D' ? '3D' : '2D')} className="w-16 h-16 rounded-2xl bg-black/90 border border-white/20 text-white font-black text-xs">{mapMode}</button>
               {isMapFullScreen && (
                 <button onClick={() => setIsMapFullScreen(false)} className="w-16 h-16 rounded-2xl bg-black/90 border border-white/20 text-white"><i className="fas fa-compress-alt"></i></button>
               )}
            </div>

            {/* BARRA DE NAVEGAÇÃO INFERIOR */}
            {isMapFullScreen && (
               <div className={`absolute bottom-0 left-0 right-0 h-36 border-t border-white/10 z-[100] flex items-center justify-between px-20 transition-colors duration-500 ${travel.destIsOpen ? 'bg-black/95' : 'bg-red-950/95'}`}>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-cyan-500 tracking-[0.4em] mb-2">PROJEÇÃO VITA • {travel.destination}</span>
                    <span className={`text-6xl font-black italic tracking-tighter ${travel.destIsOpen ? 'text-white' : 'text-red-500 animate-pulse'}`}>
                      {travel.drivingTimeMinutes} MIN <span className="text-blue-500 opacity-40">/ {travel.totalDistanceKm} KM</span>
                    </span>
                  </div>
                  <div className="flex gap-6">
                     <button onClick={() => setIsAddStopModalOpen(true)} className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 text-white text-3xl"><i className="fas fa-map-pin"></i></button>
                     <button onClick={() => setIsMapFullScreen(false)} className="w-20 h-20 rounded-3xl bg-white/10 border border-white/20 text-white text-3xl"><i className="fas fa-th-large"></i></button>
                  </div>
               </div>
            )}
          </main>
        </React.Fragment>
      )}
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={(name, lat, lng, open, hours) => {
        executeReroute(name, lat, lng, open, hours);
        setIsAddStopModalOpen(false);
        setIsMapFullScreen(true);
      }} />
    </div>
  );
};

export default App;
