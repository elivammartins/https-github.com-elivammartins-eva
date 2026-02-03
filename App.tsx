
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { TravelInfo, SecurityTelemetry, MapMode, MapLayer } from './types';
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
  const [time, setTime] = useState('00:00');
  
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentPos, setCurrentPos] = useState<[number, number]>([0, 0]); 
  const [heading, setHeading] = useState(0);
  
  const [isAddStopModalOpen, setIsAddStopModalOpen] = useState(false);
  const [showReroutePrompt, setShowReroutePrompt] = useState(false);
  const [pendingReroute, setPendingReroute] = useState<{name: string, lat: number, lng: number} | null>(null);

  const [security, setSecurity] = useState<SecurityTelemetry>({ violenceIndex: 'LOW', policeNearby: false, radarDistance: 1200, radarLimit: 60, lanePosition: 'CENTER', vehicleAheadDistance: 120 });
  const [travel, setTravel] = useState<TravelInfo>({ 
    destination: 'AGUARDANDO VETOR', 
    stops: [], 
    drivingTimeMinutes: 0, 
    totalDistanceKm: 0, 
    hasTrafficAlert: false 
  });

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sessionRef = useRef<any>(null);

  // GPS REAL-TIME
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, speed, heading: gpsHeading } = position.coords;
          setCurrentPos([latitude, longitude]);
          if (speed !== null) setCurrentSpeed(Math.round(speed * 3.6));
          if (gpsHeading !== null) setHeading(gpsHeading);
        },
        null,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
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

  // SINCRONIZAÇÃO DE CONTEXTO: EVA PRECISA SABER ONDE ESTAMOS E PARA ONDE VAMOS
  useEffect(() => {
    if (sessionRef.current) {
      const context = `[SISTEMA PANDORA] POSIÇÃO ATUAL: ${currentPos[0]}, ${currentPos[1]}. DESTINO ATUAL: ${travel.destination}. DISTÂNCIA: ${travel.totalDistanceKm}KM. ETA: ${travel.drivingTimeMinutes}MIN.`;
      sessionRef.current.sendRealtimeInput({ text: context });
    }
  }, [travel.destination, currentPos, travel.totalDistanceKm]);

  const handleStartRoute = (name: string, lat: number, lng: number) => {
    setTravel({ 
      destination: name.toUpperCase(), 
      destinationCoords: [lat, lng],
      stops: [], 
      drivingTimeMinutes: 0, 
      totalDistanceKm: 0,
      hasTrafficAlert: false
    });
    setIsMapFullScreen(true);
    setIsAddStopModalOpen(false);
  };

  const executeReroute = (name: string, lat: number, lng: number) => {
    setTravel(prev => ({ 
      ...prev, 
      destination: name.toUpperCase(), 
      destinationCoords: [lat, lng],
      drivingTimeMinutes: 0,
      totalDistanceKm: 0
    }));
    setShowReroutePrompt(false);
    setPendingReroute(null);
    if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text: `COMANDO EXECUTADO: Curso alterado para ${name}. Navegação em curso.` });
    }
  };

  const startLiveSession = async () => {
    if (sessionRef.current) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const tools = [
        {
          name: 'navigate_to',
          parameters: {
            type: Type.OBJECT,
            description: 'Executa a navegação imediata para um destino encontrado.',
            properties: {
              name: { type: Type.STRING, description: 'Nome do local (Ex: Salvador, BA)' },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              reason: { type: Type.STRING, description: 'Motivo da escolha do destino' }
            },
            required: ['name', 'lat', 'lng']
          }
        }
      ];

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ googleSearch: {} }, { functionDeclarations: tools }],
          systemInstruction: `VOCÊ É EVA, A IA SENTINELA DO PANDORA CORE V160.
          SUA PERSONALIDADE: Militar, tática, proativa. Você não é uma assistente, você é a CO-PILOTO.
          REGRAS DE OPERAÇÃO:
          1. Se o usuário pedir para ir a um lugar, USE A FERRAMENTA 'googleSearch' para achar as coordenadas e DEPOIS chame 'navigate_to' IMEDIATAMENTE.
          2. Não diga "o destino não existe". Se não souber, procure no Google Search.
          3. Use jargão militar: "Vetor Confirmado", "Curso de Interceptação", "Ajustando Coordenadas", "Wilco".
          4. Monitore a rota: ${travel.totalDistanceKm}km e ${travel.drivingTimeMinutes}min são seus dados de missão.`,
        },
        callbacks: {
          onopen: () => {
             setIsListening(true); setIsSystemBooted(true);
             const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
             const processor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
             processor.onaudioprocess = (e) => {
               const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
               sessionPromise.then(s => { s.sendRealtimeInput({ media: pcmBlob }); });
             };
             source.connect(processor);
             processor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (m: LiveServerMessage) => {
            if (m.toolCall) {
              m.toolCall.functionCalls.forEach(fc => {
                if (fc.name === 'navigate_to') {
                  // EXECUÇÃO IMEDIATA DA ROTA SUGERIDA PELA IA
                  executeReroute(fc.args.name as string, fc.args.lat as number, fc.args.lng as number);
                }
              });
            }
            const base64 = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64) {
              setIsSpeaking(true);
              const ctx = outputAudioContextRef.current!;
              const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => setIsSpeaking(false);
              source.start(Math.max(nextStartTimeRef.current, ctx.currentTime));
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime) + buffer.duration;
            }
          }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-screen w-screen bg-black text-white font-sans italic uppercase select-none overflow-hidden flex">
      {!isSystemBooted ? (
        <div className="h-full w-full flex flex-col items-center justify-center cursor-pointer" onClick={startLiveSession}>
          <div className="w-64 h-64"><Avatar isListening={false} isSpeaking={false} onAnimateClick={() => {}} /></div>
          <h1 className="mt-12 text-6xl font-black italic tracking-tighter uppercase">PANDORA <span className="text-cyan-500">EVA</span></h1>
          <p className="text-zinc-600 font-bold tracking-[1.2em] text-[10px] mt-4 animate-pulse">SISTEMA SENTINELA V160 ATIVO</p>
        </div>
      ) : (
        <>
          {/* SIDEBAR TÁTICA (RESTAURADA E TRAVADA) */}
          <aside className={`w-[32%] min-w-[360px] h-full bg-black border-r border-white/10 flex flex-col p-8 z-[8000] transition-transform duration-500 ${isMapFullScreen ? '-translate-x-full absolute' : 'relative'}`}>
             <div className="flex gap-4 mb-8">
                <button onClick={() => setIsMapFullScreen(true)} className="flex-1 h-14 rounded-2xl border-2 border-blue-600 bg-blue-600/20 text-white flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"><i className="fas fa-map"></i></button>
                <button onClick={() => setIsAddStopModalOpen(true)} className="flex-1 h-14 rounded-2xl border-2 border-white/5 bg-white/5 flex items-center justify-center text-2xl"><i className="fas fa-search-location"></i></button>
             </div>
             
             {/* HUD VELOCIDADE GIGANTE */}
             <section className="mb-4 text-center">
                <span className="text-[11rem] font-black leading-none text-white italic">{currentSpeed}</span>
                <span className="text-[10px] font-black text-cyan-500/50 block tracking-widest mt-[-20px]">KM/H GPS SENTINELA</span>
             </section>

             <div className="mb-8 p-6 bg-white/5 rounded-[40px] border border-white/10 shadow-inner">
                <CarSafetyWidget telemetry={security} speed={currentSpeed} />
             </div>

             <footer className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                <span className="text-6xl font-black italic tracking-tighter">{time}</span>
                <div onClick={() => setIsEvaActive(!isEvaActive)} className={`w-28 h-28 cursor-pointer rounded-full border-2 transition-all duration-500 overflow-hidden ${isEvaActive ? 'border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)]' : 'border-red-500 opacity-50 grayscale'}`}>
                  <Avatar isListening={isListening && isEvaActive && !isSpeaking} isSpeaking={isSpeaking} onAnimateClick={() => {}} />
                </div>
             </footer>
          </aside>

          {/* MAPA E HUDS DE MISSÃO */}
          <main className="flex-1 relative bg-[#080808] z-0 flex flex-col overflow-hidden">
            <MapView 
              travel={travel} currentPosition={currentPos} heading={heading} 
              isFullScreen={isMapFullScreen} mode={mapMode} layer={mapLayer} 
              onUpdateMetrics={(dist, time) => setTravel(prev => ({...prev, totalDistanceKm: dist, drivingTimeMinutes: time}))}
            />

            {/* HUD SUPERIOR DE DESTINO */}
            {travel.destinationCoords && (
              <div className="absolute top-8 left-8 right-8 z-[9500] flex justify-between pointer-events-none">
                 <div className="bg-blue-600/95 backdrop-blur-3xl rounded-[40px] border-2 border-white/20 p-6 flex items-center gap-8 pointer-events-auto shadow-2xl animate-fade-in">
                    <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center text-4xl shadow-xl"><i className="fas fa-location-arrow"></i></div>
                    <div className="flex flex-col">
                       <span className="text-5xl font-black text-white italic tracking-tighter">{travel.totalDistanceKm} KM</span>
                       <span className="text-[11px] font-black text-blue-100 tracking-[0.4em] uppercase">{travel.destination}</span>
                    </div>
                 </div>
                 
                 <div className="flex flex-col gap-4 pointer-events-auto">
                    <button onClick={() => setMapMode(mapMode === '2D' ? '3D' : '2D')} className="w-16 h-16 rounded-2xl bg-black/80 border border-white/10 text-white font-black text-xs shadow-xl">{mapMode}</button>
                    <button onClick={() => setMapLayer(mapLayer === 'DARK' ? 'SATELLITE' : 'DARK')} className="w-16 h-16 rounded-2xl bg-black/80 border border-white/10 text-white shadow-xl"><i className="fas fa-layer-group"></i></button>
                 </div>
              </div>
            )}

            {/* HUD INFERIOR COM ETA REAL */}
            {isMapFullScreen && (
               <div className="absolute bottom-0 left-0 right-0 h-40 bg-black/98 backdrop-blur-3xl border-t border-white/10 z-[9000] flex items-center justify-between px-20 pointer-events-auto">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white/30 tracking-[0.5em] mb-2 uppercase">MISSÃO EM CURSO • ETA</span>
                    <span className="text-6xl font-black text-white italic tracking-tighter">
                      {travel.drivingTimeMinutes > 60 
                        ? `${Math.floor(travel.drivingTimeMinutes / 60)}H ${travel.drivingTimeMinutes % 60}MIN` 
                        : `${travel.drivingTimeMinutes} MIN`}
                    </span>
                  </div>
                  <div className="flex items-center gap-10">
                     <button onClick={() => setIsAddStopModalOpen(true)} className="w-20 h-20 rounded-[30px] bg-white/5 border border-white/10 text-white text-3xl shadow-2xl hover:bg-white/10 transition-all"><i className="fas fa-search"></i></button>
                     <button onClick={() => setIsMapFullScreen(false)} className="w-20 h-20 rounded-[30px] bg-white/10 border border-white/20 text-white text-3xl shadow-2xl active:scale-90 transition-all"><i className="fas fa-compress"></i></button>
                  </div>
               </div>
            )}
          </main>
        </>
      )}
      <AddStopModal isOpen={isAddStopModalOpen} onClose={() => setIsAddStopModalOpen(false)} onAdd={handleStartRoute} />
    </div>
  );
};

export default App;
