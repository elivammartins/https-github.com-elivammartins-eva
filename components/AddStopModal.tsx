
import React, { useState, useEffect } from 'react';

interface AddressSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'CITY' | 'SHOP' | 'FOOD' | 'GENERAL';
  isOpen: boolean;
  hours: string;
}

interface AddStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, lat: number, lng: number, isOpen: boolean, hours: string) => void;
}

const AddStopModal: React.FC<AddStopModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRealData = async () => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`);
        const data = await response.json();
        
        const mapped = data.map((item: any) => {
          // Identificação de Vetores Geográficos (Cidades, Bairros, etc)
          const isGeoVector = 
            item.type === 'city' || 
            item.type === 'administrative' || 
            item.type === 'suburb' || 
            item.addresstype === 'city' ||
            item.addresstype === 'suburb' ||
            item.addresstype === 'village';
          
          const type = isGeoVector ? 'CITY' : 
                       (item.type === 'shop' || item.type === 'mall' ? 'SHOP' : 
                       (item.type === 'restaurant' || item.type === 'cafe' ? 'FOOD' : 'GENERAL'));
          
          const currentHour = new Date().getHours();
          // Lógica: Cidades e Bairros não fecham. Comércios seguem regra de horário.
          const isOpen = isGeoVector ? true : (currentHour >= 8 && currentHour < 21);

          return {
            name: item.display_name.split(',')[0].toUpperCase(),
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type,
            isOpen: isOpen,
            hours: isGeoVector ? "VETOR LIVRE (24H)" : "08:00 - 21:00"
          };
        });
        
        setSuggestions(mapped);
      } catch (err) {
        console.error("Erro na busca OSM:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchRealData, 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/98" onClick={onClose} />
      
      <div className="relative bg-[#0c0c0e] w-full max-w-2xl rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#151518] shrink-0">
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Definir Vetor</h2>
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white border border-white/10">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 shrink-0">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qual o destino comandante?"
            className="w-full h-20 bg-white/5 border border-white/10 rounded-3xl px-10 text-2xl font-black text-white outline-none focus:border-blue-500 uppercase italic placeholder:text-white/10 shadow-inner"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4 no-scrollbar">
          {loading && <div className="text-center py-10 animate-pulse text-blue-500 font-black">Escaneando Mapas...</div>}
          {suggestions.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => onAdd(item.name, item.lat, item.lng, item.isOpen, item.hours)}
              className={`w-full p-8 bg-white/5 hover:bg-white/10 rounded-[40px] border flex items-center gap-8 text-left transition-all active:scale-95 ${item.isOpen ? 'border-white/5 shadow-lg' : 'border-red-600/40 bg-red-600/5'}`}
            >
              <div className={`w-16 h-16 rounded-2xl bg-black border flex items-center justify-center text-2xl shrink-0 ${item.isOpen ? 'border-blue-500/50 text-blue-500' : 'border-red-600 text-red-500 animate-pulse'}`}>
                 <i className={`fas ${item.type === 'CITY' ? 'fa-city' : (item.type === 'FOOD' ? 'fa-utensils' : 'fa-map-marker-alt')}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                   <p className="text-xl font-black text-white truncate leading-none uppercase">{item.name}</p>
                   <span className={`text-[9px] font-black px-3 py-1 rounded-full ${item.isOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-red-600 text-white'}`}>
                      {item.isOpen ? 'VETOR LIVRE' : 'BLOQUEADO'}
                   </span>
                </div>
                <p className="text-[10px] text-white/30 truncate font-bold uppercase tracking-widest">{item.address}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddStopModal;
