
import React from 'react';
import { StopRecommendation } from '../types';

interface RecommendationCardProps {
  stops: StopRecommendation[];
  onSelect: (stop: StopRecommendation) => void;
  onClose: () => void;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ stops, onSelect, onClose }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'GAS': return 'fa-gas-pump text-yellow-500';
      case 'FOOD': return 'fa-utensils text-green-500';
      case 'REST': return 'fa-bed text-purple-500';
      case 'COFFEE': return 'fa-coffee text-orange-400';
      default: return 'fa-map-marker-alt text-blue-500';
    }
  };

  if (stops.length === 0) return null;

  return (
    <div className="absolute inset-0 bg-black/90 z-20 flex flex-col p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
          <i className="fas fa-search-location text-blue-500"></i>
          Paradas Recomendadas
        </h2>
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-2xl text-white hover:bg-gray-700"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2">
        {stops.map((stop, index) => (
          <div 
            key={index}
            onClick={() => onSelect(stop)}
            className="bg-[#1c1c1e] border border-gray-800 p-5 rounded-3xl flex items-center justify-between hover:bg-[#2c2c2e] transition-colors cursor-pointer active:scale-95"
          >
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center text-3xl">
                <i className={`fas ${getIcon(stop.type)}`}></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{stop.name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-blue-400 font-medium">{stop.distance}</span>
                  <div className="flex items-center text-yellow-500 text-sm">
                    <i className="fas fa-star mr-1"></i> {stop.rating}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-gray-500 text-2xl">
              <i className="fas fa-chevron-right"></i>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationCard;
