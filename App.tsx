
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from '@google/genai';
import { AppState, MeetingInfo, PandoraNotification, PandoraMood, SentinelStatus } from './types';
import MapView from './components/MapView';
import OfficeHub from './components/OfficeHub';
import NotificationCenter from './components/NotificationCenter';
import FatigueMonitor from './components/FatigueMonitor';
import SpotifyRemote from './components/SpotifyRemote';
import TopBar from './components/TopBar';
import SystemDock from './components/SystemDock';
import InteractionOverlay from './components/InteractionOverlay';
import SentinelOrb from './components/SentinelOrb';
import NavigationHUD from './components/NavigationHUD';

const PANDORA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'check_schedule',
    parameters: {
      type: Type.OBJECT,
      description: 'Lê as reuniões agendadas no cockpit do Microsoft Teams.',
      properties: {}
    }
  },
  {
    name: 'read_last_message',
    parameters: {
      type: Type.OBJECT,
      description: 'Lê a última mensagem recebida via WhatsApp ou Teams se a privacidade estiver desativada.',
      properties: {}
    }
  }
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    isBooted: false,
    privacyMode: true,
    mood: 'IDLE',
    location: [-15.7942, -47.8822],
    speed: 0,
    heading: 0,
    meetings: [],
    notifications: [],
    isFatigued: false,
    eyeProbability: 1.0,
    activeMedia: { title: 'STANDBY', artist: 'PANDORA CORE', cover: '', isPlaying: false, progress: 0 },
    sentinel: {
      speedLimit: 110,
      floodRisk: false,
      temperature: 24,
      weather: 'Limpo',
      riskLevel: 'SAFE'
    }
  });

  const sessionRef = useRef<any>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    // BRIDGE NATIVA: Escuta notificações reais enviadas pelo serviço Android
    (window as any).onPandoraNotification = (data: any) => {
      const newNotif: PandoraNotification = {
        id: data.timestamp.toString(),
        sender: data.title,
        text: data.text,
        app: data.package.includes('whatsapp') ? 'WHATSAPP' : 'TEAMS',
        image: data.image,
        time: new Date(data.timestamp)
      };
      
      setState(p => ({
        ...p,
        notifications: [newNotif, ...p.notifications].slice(0, 10)
      }));

      // Feedback vocal imediato se PRIVACIDADE OFF
      if (!stateRef.current.privacyMode) {
        speak(`Nova mensagem de ${data.title}: ${data.text}`);
      }
    };
  }, []);

  const bootSystem = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: PANDORA_TOOLS }],
          systemInstruction: `Você é a EVA v5.0 UNLEASHED, o núcleo de inteligência do Comandante Elivam Martins.
          - Use a ferramenta 'check_schedule' para ler as reuniões reais do cockpit.
          - Use 'read_last_message' para narrar as mensagens recebidas.
          - Se a privacidade estiver ativa, informe que não pode ler o conteúdo sem autorização.`
        },
        callbacks: {
          onopen: () => {
            setState(p => ({ ...p, isBooted: true }));
            speak("EVA 5.0 Desencadeada. Protocolo Zero Simulação ativo. Comandante Elivam, todos os canais reais estão abertos.");
          },
          onmessage: async (m) => {
             if (m.toolCall) {
               for (const fc of m.toolCall.functionCalls) {
                 if (fc.name === 'check_schedule') {
                    const agenda = stateRef.current.meetings.map(m => `${m.subject} às ${m.start}`).join(', ');
                    speak(agenda ? `Sua agenda tem: ${agenda}.` : "Nenhuma reunião pendente para hoje.");
                 }
                 if (fc.name === 'read_last_message') {
                    if (stateRef.current.privacyMode) {
                      speak("O Escudo de Privacidade está ativo. Desative-o para que eu possa ler suas mensagens.");
                    } else {
                      const last = stateRef.current.notifications[0];
                      speak(last ? `Última mensagem de ${last.sender}: ${last.text}` : "Nenhuma mensagem no buffer.");
                    }
                 }
               }
             }
          }
        }
      });
      sessionRef.current = session;
    } catch (e) { console.error("Boot Fail:", e); }
  };

  const speak = (text: string) => {
    if (sessionRef.current) sessionRef.current.sendRealtimeInput({ text } as any);
  };

  if (!state.isBooted) {
    return (
      <div className="h-full w-full bg-black flex flex-col items-center justify-center cursor-pointer" onClick={bootSystem}>
        <div className="relative group">
           <div className="absolute inset-0 bg-blue-600 blur-[120px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
           <SentinelOrb mood="THINKING" size="LG" />
        </div>
        <h1 className="mt-12 text-7xl font-black italic tracking-tighter uppercase leading-none">PANDORA <span className="text-blue-500">v5.0</span></h1>
        <p className="text-zinc-800 tracking-[2em] text-[10px] mt-6 uppercase font-bold">UNLEASHED CORE - REAL TIME ONLY</p>
      </div>
    );
  }

  return (
    <div className="grid-dashboard bg-black overflow-hidden italic uppercase font-black">
      <div className="scanline"></div>

      <header style={{ gridArea: 'top' }}>
        <TopBar speed={state.speed} sentinel={state.sentinel!} />
      </header>

      <aside style={{ gridArea: 'sidebar' }} className="flex flex-col gap-8">
        <NavigationHUD travel={{ destination: 'PONTO ALFA', eta: '10:45', distanceTotal: '12 KM', nextStep: { instruction: 'SIGA EM FRENTE', distance: 400, name: 'RODOVIA', maneuver: 'straight' } }} privacyMode={state.privacyMode} />
        <div className="flex-1 min-h-0">
          <OfficeHub 
            meetings={state.meetings} 
            onUpdate={(m) => setState(p => ({ ...p, meetings: m }))} 
          />
        </div>
        <FatigueMonitor 
          onFatigueDetected={() => {
            setState(p => ({ ...p, isFatigued: true }));
            speak("COMANDANTE, ALERTA DE SEGURANÇA! FADIGA DETECTADA. ACORDE IMEDIATAMENTE!");
          }}
          onEyeUpdate={(prob) => setState(p => ({ ...p, eyeProbability: prob }))}
        />
      </aside>

      <main style={{ gridArea: 'map' }} className="relative rounded-[60px] border border-white/5 overflow-hidden shadow-2xl bg-zinc-900/10">
         <MapView 
            currentPosition={state.location}
            heading={state.heading}
            isFullScreen={true}
            mode="3D"
            layer="STREET"
            zoom={18}
            travel={{ destination: '', totalDistanceKm: 0, drivingTimeMinutes: 0, stops: [] }}
            suggestedStops={[]}
         />
      </main>

      <aside style={{ gridArea: 'media' }} className="flex flex-col gap-8">
        <div className="flex-1 min-h-0">
          <NotificationCenter 
            notifications={state.notifications} 
            privacyMode={state.privacyMode} 
          />
        </div>
        <SpotifyRemote 
          media={state.activeMedia} 
          onUpdate={(meta) => setState(p => ({ ...p, activeMedia: meta }))}
        />
      </aside>

      <footer style={{ gridArea: 'dock' }}>
        <SystemDock 
          mood={state.mood} 
          privacyMode={state.privacyMode}
          onTogglePrivacy={() => setState(s => ({ ...s, privacyMode: !s.privacyMode }))}
          onOrbClick={() => speak("Ouvindo, Comandante Elivam.")}
          onGridClick={() => {}} 
        />
      </footer>

      {state.isFatigued && (
        <div className="fixed inset-0 z-[1000] bg-red-600/60 backdrop-blur-2xl flex flex-col items-center justify-center animate-pulse border-[30px] border-red-600">
           <i className="fas fa-exclamation-triangle text-[240px] text-white mb-10 drop-shadow-2xl"></i>
           <h2 className="text-9xl font-black text-white italic tracking-tighter uppercase leading-none">FADIGA CRÍTICA</h2>
           <p className="text-3xl mt-6 tracking-[0.5em] font-bold">INTERVENÇÃO DO SISTEMA REQUERIDA</p>
           <button onClick={() => setState(p => ({ ...p, isFatigued: false }))} className="mt-20 px-24 py-10 bg-white text-red-600 rounded-[40px] text-5xl font-black italic hover:scale-105 transition-transform shadow-2xl">ESTOU OPERACIONAL</button>
        </div>
      )}
    </div>
  );
};

export default App;
