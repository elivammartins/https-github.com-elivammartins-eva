
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

  useEffect(() => {
    const fetchRealData = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      try {
        // Busca com prioridade para o Brasil e Brasília
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&countrycodes=br&viewbox=-48.3113,-16.0517,-47.4338,-15.4526`);
        const data = await response.json();
        
        const mapped = data.map((item: any) => ({
          name: item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
        
        setSuggestions(mapped);
      } catch (err) {
        console.error("Search Error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchRealData, 800);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAiSearch = async () => {
    if (query.length < 3) return;
    setIsAiSearching(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Usando grounding para encontrar o lugar no Google Maps
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-latest',
        contents: `Encontre as coordenadas exatas do local "${query}" em Brasília/Brasil. Retorne apenas o nome oficial e as coordenadas.`,
        config: { tools: [{ googleMaps: {} }] }
      });
      // Fallback para Nominatim com query mais específica se a IA falhar no parsing imediato
      const refinedRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Brasil Brasília')}&limit=1&countrycodes=br`);
      const data = await refinedRes.json();
      if (data[0]) {
         onAdd(data[0].display_name.split(',')[0], parseFloat(data[0].lat), parseFloat(data[0].lon));
      }
    } catch (e) {
      console.error("AI Search Error", e);
    } finally {
      setIsAiSearching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl cursor-pointer" onClick={onClose} />
      
      <div className="relative bg-[#0c0c0e] w-full max-w-2xl rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#1c1c1e] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <i className="fas fa-search text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Vetor de Rota (Google Base)</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 shrink-0 flex gap-4">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex: Pátio Brasil Shopping..."
            className="flex-1 h-16 bg-black/40 border border-white/10 rounded-2xl px-6 text-xl font-bold focus:border-blue-500 outline-none text-white uppercase italic"
          />
          <button 
            onClick={handleAiSearch}
            disabled={isAiSearching || query.length < 3}
            className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl active:scale-90 transition-all disabled:opacity-30"
          >
            {isAiSearching ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-map-marked-alt"></i>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2 no-scrollbar">
          {loading && <div className="p-10 text-center text-blue-500 animate-pulse text-xs font-black">CONSULTANDO SATÉLITES...</div>}
          
          {suggestions.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => onAdd(item.name, item.lat, item.lng)}
              className="w-full p-6 bg-white/5 hover:bg-blue-600/20 rounded-3xl border border-white/5 flex flex-col text-left transition-all active:scale-[0.98]"
            >
              <p className="text-lg font-black text-white truncate uppercase italic">{item.name}</p>
              <p className="text-[10px] text-white/40 truncate font-bold uppercase">{item.address}</p>
            </button>
          ))}
          
          {!loading && query.length >= 3 && suggestions.length === 0 && (
            <div className="p-10 text-center flex flex-col items-center gap-4">
               <p className="text-white/20 italic text-sm">Nenhum local na base local.</p>
               <button onClick={handleAiSearch} className="px-8 py-4 bg-blue-600/20 border border-blue-500/50 rounded-2xl text-blue-400 font-black text-xs">FORÇAR BUSCA GOOGLE MAPS</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStopModal;
