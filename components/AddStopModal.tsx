
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
        // Busca local reforçada como primeira camada
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

  const handleWazeStyleSearch = async () => {
    if (query.length < 3) return;
    setIsAiSearching(true);
    setError(null);
    setSuggestions([]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Prompt agressivo para encontrar coordenadas no Google Search (Base Waze)
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Encontre no Google Maps o endereço exato: "${query}, Brasília, Distrito Federal, Brasil". 
        Retorne apenas: NOME: [Nome Completo], COORDS: [LAT, LNG]. 
        Ignore locais fora do Distrito Federal.`,
        config: { tools: [{ googleSearch: {} }] }
      });

      const resultText = response.text || "";
      const coords = resultText.match(/(-?\d+\.\d+)/g);

      if (coords && coords.length >= 2) {
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        
        // Verifica se está no DF (Aprox: -16 a -15 Lat, -48 a -47 Lng)
        if (lat < -15 && lat > -17) {
           onAdd(query.toUpperCase(), lat, lng);
        } else {
           setError("O endereço parece estar fora de Brasília. Tente especificar o Setor ou Quadra.");
        }
      } else {
        // Fallback final Nominatim se a IA falhar no parsing
        const fallbackRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Brasília DF')}&limit=1&countrycodes=br`);
        const data = await fallbackRes.json();
        if (data && data[0]) {
          onAdd(data[0].display_name.split(',')[0], parseFloat(data[0].lat), parseFloat(data[0].lon));
        } else {
          setError("WAZE BASE: Não conseguimos localizar esse ponto exato. Tente o nome de um comércio próximo.");
        }
      }
    } catch (e) {
      setError("ERRO DE SINCRONIA: Tente simplificar a busca (Ex: 'Gama Shopping').");
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
              <i className="fas fa-satellite text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black italic text-white tracking-tighter uppercase">Busca Google/Waze Base</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 shrink-0 flex gap-4 bg-black/50">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleWazeStyleSearch()}
            placeholder="EX: QUADRA 43 GAMA / CASA 02..."
            className="flex-1 h-16 bg-black border border-white/10 rounded-2xl px-6 text-xl font-black focus:border-blue-500 outline-none text-white uppercase italic"
          />
          <button 
            onClick={handleWazeStyleSearch}
            disabled={isAiSearching || query.length < 3}
            className={`w-20 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl active:scale-90 transition-all ${isAiSearching ? 'bg-blue-600/20' : 'bg-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.4)]'}`}
          >
            {isAiSearching ? <i className="fas fa-circle-notch animate-spin text-2xl"></i> : <i className="fas fa-search-location text-2xl"></i>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-3 no-scrollbar mt-4">
          {error && (
            <div className="p-8 bg-red-600/10 border border-red-500/30 rounded-[35px] text-red-500 text-xs font-black text-center mb-6 animate-shake">
               <i className="fas fa-exclamation-circle mb-2 text-2xl block"></i>
               {error}
            </div>
          )}

          {isAiSearching && (
             <div className="p-10 text-center space-y-6">
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                   <div className="bg-blue-600 h-full w-1/2 animate-shimmer"></div>
                </div>
                <p className="text-blue-500 text-[11px] font-black tracking-[0.5em] animate-pulse">SINCRONIZANDO COM GOOGLE MAPS ENGINE...</p>
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
               <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center text-white/20 text-4xl border border-white/5 shadow-inner">
                  <i className="fas fa-map-marked-alt"></i>
               </div>
               <p className="text-white/20 italic text-sm font-black uppercase tracking-widest">Aguardando comando de busca profunda.</p>
               <button onClick={handleWazeStyleSearch} className="px-12 py-5 bg-blue-600 rounded-[30px] text-white font-black text-xs shadow-2xl active:scale-95 transition-all">FORÇAR BUSCA GOOGLE MAPS</button>
            </div>
          )}
        </div>
      </div>
      <style>{`
         @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
         @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
         .animate-shimmer { animation: shimmer 2s infinite linear; }
         .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default AddStopModal;
