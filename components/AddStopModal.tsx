
import React, { useState, useEffect } from 'react';

interface AddressSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'WORK' | 'SHOP' | 'FOOD' | 'HOME' | 'GENERAL';
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
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`);
        const data = await response.json();
        
        const mapped = data.map((item: any) => {
          const type = item.type === 'office' ? 'WORK' : 
                       item.type === 'shop' ? 'SHOP' : 
                       item.type === 'restaurant' ? 'FOOD' : 'GENERAL';
          return {
            name: item.display_name.split(',')[0].toUpperCase(),
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type
          };
        });
        
        setSuggestions(mapped);
      } catch (err) {
        console.error("Search Error:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchRealData, 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-8 italic uppercase animate-fade-in">
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative bg-[#0c0c0e] w-full max-w-3xl rounded-[60px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-scale-up h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-[#18181b] shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <i className="fas fa-search text-2xl"></i>
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white uppercase">PARA ONDE VAMOS?</h2>
          </div>
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-2xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-10 shrink-0">
          <div className="relative group">
            <input 
              autoFocus
              type="text" 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Digite o endereço ou local..."
              className="w-full h-20 bg-white/5 border-2 border-white/5 rounded-[30px] px-10 text-2xl font-black focus:border-blue-600 outline-none text-white uppercase italic transition-all"
            />
            {loading && <i className="fas fa-circle-notch animate-spin absolute right-8 top-1/2 -translate-y-1/2 text-blue-500 text-2xl"></i>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-4 no-scrollbar">
          {suggestions.length > 0 ? suggestions.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => onAdd(item.name, item.lat, item.lng)}
              className="w-full p-8 bg-white/5 hover:bg-blue-600/10 rounded-[40px] border border-white/5 flex items-center gap-8 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-16 h-16 rounded-2xl bg-black/50 border border-white/5 flex items-center justify-center text-2xl text-white/40 shrink-0">
                 <i className={`fas ${
                   item.type === 'WORK' ? 'fa-briefcase' : 
                   item.type === 'FOOD' ? 'fa-utensils' : 
                   item.type === 'SHOP' ? 'fa-shopping-cart' : 'fa-map-marker-alt'
                 }`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-black text-white truncate italic uppercase leading-none mb-1">{item.name}</p>
                <p className="text-[10px] text-white/30 truncate font-bold uppercase tracking-widest">{item.address}</p>
              </div>
            </button>
          )) : query.length > 2 && !loading && (
            <div className="text-center py-20 opacity-20">
               <i className="fas fa-map-marked-alt text-8xl mb-6"></i>
               <p className="text-xs font-black tracking-[0.4em]">Nenhum vetor identificado no DF</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddStopModal;
