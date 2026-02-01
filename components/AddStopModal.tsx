
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface AddressSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, lat: number, lng: number) => void;
}

const AddStopModal: React.FC<AddStopModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.length < 3) return;
    setIsAiSearching(true);
    setError(null);
    setSuggestions([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout de 8 segundos

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize exatamente: "${query}, Brasília, DF". Retorne apenas: NOME: [nome], LAT: [lat], LNG: [lng].`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const text = response.text || "";
      const coords = text.match(/(-?\d+\.\d+)/g);

      if (coords && coords.length >= 2) {
        onAdd(query.toUpperCase(), parseFloat(coords[0]), parseFloat(coords[1]));
        clearTimeout(timeoutId);
      } else {
        // Fallback rápido
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Brasília DF')}&limit=1`);
        const data = await res.json();
        if (data[0]) onAdd(data[0].display_name.split(',')[0], parseFloat(data[0].lat), parseFloat(data[0].lon));
        else setError("Local não identificado na base Google.");
      }
    } catch (e: any) {
      setError("TEMPO EXCEDIDO: Verifique sua conexão de satélite.");
    } finally {
      setIsAiSearching(false);
      clearTimeout(timeoutId);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-8 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl cursor-pointer" onClick={onClose} />
      
      <div className="relative bg-[#0c0c0e] w-full max-w-3xl rounded-[60px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-[#18181b]">
          <h2 className="text-3xl font-black italic text-white tracking-tighter uppercase">Protocolo de Busca DF</h2>
          <button onClick={onClose} className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-10 flex gap-6 bg-black/40">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="EX: QUADRA 43 GAMA..."
            className="flex-1 h-20 bg-zinc-900 border-2 border-white/10 rounded-3xl px-8 text-2xl font-black focus:border-blue-600 outline-none text-white uppercase italic"
          />
          <button 
            onClick={handleSearch}
            disabled={isAiSearching || query.length < 3}
            className={`w-24 h-20 rounded-3xl flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all ${isAiSearching ? 'bg-zinc-800' : 'bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)]'}`}
          >
            {isAiSearching ? <i className="fas fa-circle-notch animate-spin text-3xl"></i> : <i className="fas fa-location-arrow text-3xl"></i>}
          </button>
        </div>

        <div className="px-10 pb-12 min-h-[200px] flex flex-col justify-center">
          {error && (
            <div className="p-10 bg-red-600/10 border border-red-500/30 rounded-[40px] text-red-500 text-sm font-black text-center animate-shake">
               <i className="fas fa-satellite-dish mb-4 text-4xl block"></i>
               {error}
            </div>
          )}

          {isAiSearching && (
             <div className="text-center space-y-8 py-10">
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                   <div className="bg-blue-600 h-full w-1/3 animate-shimmer"></div>
                </div>
                <p className="text-blue-500 text-sm font-black tracking-[0.6em] animate-pulse">VARRENDO SATÉLITES GOOGLE BASE...</p>
             </div>
          )}
          
          {!isAiSearching && !error && (
             <div className="text-center opacity-20 py-10">
                <i className="fas fa-search-location text-7xl mb-6"></i>
                <p className="text-xs font-black tracking-widest">Aguardando coordenadas de destino...</p>
             </div>
          )}
        </div>
      </div>
      <style>{`
         @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
         .animate-shimmer { animation: shimmer 2s infinite linear; }
      `}</style>
    </div>
  );
};

export default AddStopModal;
