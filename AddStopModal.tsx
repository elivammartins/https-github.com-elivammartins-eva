
import React, { useState, useEffect } from 'react';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 italic uppercase animate-fade-in">
      {/* Backdrop de fechamento */}
      <div 
        className="fixed inset-0 bg-black/90 backdrop-blur-xl cursor-pointer" 
        onClick={onClose} 
      />
      
      <div 
        className="relative bg-[#0c0c0e] w-full max-w-2xl rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-[#1c1c1e] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <i className="fas fa-search text-2xl"></i>
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Vetor de Rota</h2>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white border border-white/5">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 shrink-0">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o destino..."
            className="w-full h-16 bg-black/40 border border-white/10 rounded-2xl px-6 text-xl font-bold focus:border-blue-500 outline-none text-white uppercase italic"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-2 no-scrollbar">
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
        </div>
      </div>
    </div>
  );
};

export default AddStopModal;
