
import React, { useState, useEffect } from 'react';

interface AddressSuggestion {
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: 'WORK' | 'SHOP' | 'FOOD' | 'HOME' | 'GENERAL';
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
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1`);
        const data = await response.json();
        
        const mapped = data.map((item: any) => {
          const type = item.type === 'office' ? 'WORK' : 
                       item.type === 'shop' ? 'SHOP' : 
                       item.type === 'restaurant' ? 'FOOD' : 'GENERAL';
          
          // Simulação Inteligente de Status de Funcionamento (Protocolo Sentinela)
          const currentHour = new Date().getHours();
          const randomIsOpen = currentHour > 8 && currentHour < 22 ? Math.random() > 0.2 : false;

          return {
            name: item.display_name.split(',')[0].toUpperCase(),
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type,
            isOpen: randomIsOpen,
            hours: randomIsOpen ? "08:00 - 22:00" : "FECHADO AGORA (Abre às 08:00)"
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
      
      <div className="relative bg-[#0c0c0e] w-full max-w-3xl rounded-[60px] border border-white/10 flex flex-col shadow-2xl overflow-hidden h-[85dvh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-[#18181b] shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
              <i className="fas fa-search text-2xl"></i>
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">DEFINIR VETOR</h2>
          </div>
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-2xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-10 shrink-0">
          <input 
            autoFocus
            type="text" 
            value={query} 
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite o local..."
            className="w-full h-20 bg-white/5 border-2 border-white/5 rounded-[30px] px-10 text-2xl font-black focus:border-blue-600 outline-none text-white uppercase italic"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-4 no-scrollbar">
          {suggestions.map((item, idx) => (
            <button 
              key={idx}
              onClick={() => onAdd(item.name, item.lat, item.lng, item.isOpen, item.hours)}
              className={`w-full p-8 bg-white/5 hover:bg-white/10 rounded-[40px] border flex items-center gap-8 text-left transition-all active:scale-[0.98] ${item.isOpen ? 'border-white/5' : 'border-red-600/30'}`}
            >
              <div className={`w-16 h-16 rounded-2xl bg-black/50 border flex items-center justify-center text-2xl shrink-0 ${item.isOpen ? 'border-white/5 text-white/40' : 'border-red-600 text-red-500'}`}>
                 <i className={`fas ${
                   item.type === 'WORK' ? 'fa-briefcase' : 
                   item.type === 'FOOD' ? 'fa-utensils' : 
                   item.type === 'SHOP' ? 'fa-shopping-cart' : 'fa-map-marker-alt'
                 }`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                   <p className="text-xl font-black text-white truncate italic uppercase leading-none">{item.name}</p>
                   <span className={`text-[9px] font-black px-3 py-1 rounded-full ${item.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-600 text-white'}`}>
                      {item.isOpen ? 'ABERTO' : 'FECHADO'}
                   </span>
                </div>
                <p className="text-[10px] text-white/30 truncate font-bold uppercase tracking-widest">{item.address}</p>
                <p className={`text-[9px] font-black mt-2 ${item.isOpen ? 'text-white/20' : 'text-red-400 animate-pulse'}`}>
                  {item.hours}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddStopModal;
