
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

  useEffect(() => {
    const fetchLocalData = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        // Busca local reforçada com contexto DF
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Distrito Federal Brasil')}&limit=4&countrycodes=br`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          const mapped = data.map((item: any) => ({
            name: item.display_name.split(',')[0],
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          setSuggestions(mapped);
        } else {
          setSuggestions([]);
        }
      } catch (err) {
        console.error("Local search error", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchLocalData, 800);
    return () => clearTimeout(timer);
  }, [query]);

  const handleDeepSearch = async () => {
    if (query.length < 3) return;
    setIsAiSearching(true);
    setError(null);
    setSuggestions([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Protocolo de Busca Google Maps Grounding
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Localize no Google Maps o endereço exato em Brasília: "${query}". Retorne APENAS o nome e a latitude/longitude decimais separadas por vírgula.`,
        config: { tools: [{ googleMaps: {} }] }
      });

      const resultText = response.text || "";
      const coords = resultText.match(/(-?\d+\.\d+)/g);

      if (coords && coords.length >= 2) {
        onAdd(query.toUpperCase(), parseFloat(coords[0]), parseFloat(coords[1]));
      } else {
        // Tenta fallback nominatim reforçado
        const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Gama Brasília DF')}&limit=1&countrycodes=br`);
        const data = await fallbackRes.json();
        if (data && data[0]) {
          onAdd(data[0].display_name.split(',')[0], parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
          setError("GOOGLE MAPS: Localização não encontrada no Gama. Tente ser mais específico.");
        }
      }
    } catch (e) {
      setError("FALHA DE SINCRONIA: O satélite não respondeu. Tente novamente.");
    } finally {
      setIsAiSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl cursor-pointer" onClick={onClose} />
      
      <div className="relative bg-[#0c0c0e] w-full max-w-2xl rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#1c1c1e] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <i className="fas fa-satellite-dish text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black italic text-white tracking-tighter">PROTOCOLO DE ROTA DF</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 shrink-0 flex gap-4 bg-white/5">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDeepSearch()}
            placeholder="EX: QUADRA 43 GAMA..."
            className="flex-1 h-16 bg-black border border-white/10 rounded-2xl px-6 text-xl font-black focus:border-blue-500 outline-none text-white uppercase italic"
          />
          <button 
            onClick={handleDeepSearch}
            disabled={isAiSearching || query.length < 3}
            className={`w-20 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all ${isAiSearching ? 'bg-blue-600/20' : 'bg-blue-600'}`}
          >
            {isAiSearching ? <i className="fas fa-circle-notch animate-spin text-2xl"></i> : <i className="fas fa-location-arrow text-2xl"></i>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-3 no-scrollbar mt-4">
          {error && (
            <div className="p-8 bg-red-600/10 border border-red-500/30 rounded-[35px] text-red-500 text-xs font-black text-center mb-6 animate-pulse">
               <i className="fas fa-exclamation-triangle mb-2 text-2xl block"></i>
               {error}
            </div>
          )}

          {isAiSearching && (
             <div className="p-10 text-center space-y-4">
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                   <div className="bg-blue-600 h-full w-1/2 animate-shimmer"></div>
                </div>
                <p className="text-blue-500 text-[10px] font-black tracking-[0.4em] animate-pulse">CONSULTANDO BASE GOOGLE MAPS...</p>
             </div>
          )}
          
          {suggestions.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => onAdd(item.name, item.lat, item.lng)}
              className="w-full p-6 bg-white/5 hover:bg-blue-600/20 rounded-3xl border border-white/5 flex flex-col text-left transition-all active:scale-[0.98]"
            >
              <p className="text-lg font-black text-white truncate uppercase italic leading-none mb-2">{item.name}</p>
              <p className="text-[9px] text-white/30 truncate font-bold uppercase tracking-widest">{item.address}</p>
            </button>
          ))}
          
          {!loading && !isAiSearching && query.length >= 3 && suggestions.length === 0 && !error && (
            <div className="p-10 text-center flex flex-col items-center gap-6">
               <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-white/20 text-4xl border border-white/5">
                  <i className="fas fa-globe-americas"></i>
               </div>
               <p className="text-white/20 italic text-sm font-black uppercase tracking-widest">Nenhuma detecção na base local.</p>
               <button onClick={handleDeepSearch} className="px-12 py-5 bg-blue-600 rounded-[30px] text-white font-black text-xs shadow-[0_0_40px_rgba(37,99,235,0.4)]">FORÇAR BUSCA PROFUNDA GOOGLE</button>
            </div>
          )}
        </div>
      </div>
      <style>{`
         @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
         .animate-shimmer { animation: shimmer 1.5s infinite linear; }
      `}</style>
    </div>
  );
};

export default AddStopModal;
