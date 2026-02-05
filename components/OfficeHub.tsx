
import React, { useState, useEffect } from 'react';
import { MeetingInfo } from '../types';

interface Props {
  meetings: MeetingInfo[];
  onUpdate: (meetings: MeetingInfo[]) => void;
}

const OfficeHub: React.FC<Props> = ({ meetings, onUpdate }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Configuração REAL do Azure AD (Necessário Client ID do Azure Portal)
  const msalConfig = {
    auth: {
      clientId: "INSERT_REAL_CLIENT_ID_HERE", // Comandante, insira o ID gerado no Azure
      authority: "https://login.microsoftonline.com/common",
      redirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: true,
    }
  };

  const login = async () => {
    setIsAuthenticating(true);
    // @ts-ignore
    const msalInstance = new msal.PublicClientApplication(msalConfig);
    try {
      const response = await msalInstance.loginPopup({
        scopes: ["User.Read", "Calendars.Read"]
      });
      setUser(response.account);
      fetchCalendar(response.accessToken);
    } catch (e) {
      console.error("Erro MSAL:", e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchCalendar = async (token: string) => {
    try {
      // Busca reuniões reais do dia de hoje
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${now.toISOString()}&endDateTime=${endOfDay.toISOString()}&$select=subject,start,end,onlineMeeting,organizer&$top=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const data = await response.json();
      const mapped: MeetingInfo[] = data.value.map((event: any) => ({
        id: event.id,
        subject: event.subject,
        start: new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        end: event.end.dateTime,
        organizer: event.organizer.emailAddress.name,
        joinUrl: event.onlineMeeting?.joinUrl
      }));
      
      onUpdate(mapped);
    } catch (e) {
      console.error("Erro Graph API:", e);
    }
  };

  const nextMeeting = meetings[0];

  return (
    <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-6 flex flex-col gap-6 shadow-2xl h-full relative overflow-hidden">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#464775] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <i className="fab fa-microsoft"></i>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white/30 tracking-[0.4em] uppercase">Office Hub</span>
            <span className="text-[9px] font-bold text-emerald-500 uppercase">{user ? user.username : 'Não Sincronizado'}</span>
          </div>
        </div>
        {!user ? (
          <button 
            onClick={login}
            disabled={isAuthenticating}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[9px] font-black hover:bg-white/10 transition-all uppercase"
          >
            {isAuthenticating ? 'Autenticando...' : 'Fazer Login'}
          </button>
        ) : (
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center relative z-10">
        {nextMeeting ? (
          <div className="space-y-4 animate-fade-in">
            <div className="space-y-1">
              <h4 className="text-2xl font-black italic text-white uppercase tracking-tighter leading-none truncate">
                {nextMeeting.subject}
              </h4>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest italic">
                Início: {nextMeeting.start} • Org: {nextMeeting.organizer}
              </p>
            </div>

            <button 
              onClick={() => nextMeeting.joinUrl && window.open(nextMeeting.joinUrl)}
              className="w-full h-14 bg-[#464775] hover:bg-[#5a5b94] rounded-2xl flex items-center justify-center gap-3 text-white font-black text-[11px] tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
            >
              <i className="fas fa-video"></i> ENTRAR NO TEAMS
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-20">
            <i className="fas fa-calendar-check text-4xl"></i>
            <p className="text-[10px] font-black tracking-widest uppercase">Agenda Limpa para Hoje</p>
          </div>
        )}
      </div>

      {/* Grid Decorativo */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
         <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
      </div>
    </div>
  );
};

export default OfficeHub;
