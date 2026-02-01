
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, isFullScreen, onToggleFullScreen, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: 17
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="width: 50px; height: 50px; background: #33CCFF; border: 4px solid white; border-radius: 50%; box-shadow: 0 0 30px rgba(51,204,255,0.8); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
            <i class="fas fa-location-arrow" style="color: white; font-size: 20px; transform: rotate(-45deg);"></i>
          </div>
        `,
        iconSize: [50, 50], iconAnchor: [25, 25]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
    }

    const timer = setInterval(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 500);
    return () => { 
      clearInterval(timer);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } 
    };
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current) vehicleMarkerRef.current.setLatLng(currentPosition);
    if (mapRef.current && !isFullScreen) {
       mapRef.current.panTo(currentPosition, { animate: true });
    }
  }, [currentPosition, isFullScreen]);

  useEffect(() => {
    const fetchMultiRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;

      // Limpar marcadores antigos
      markersRef.current.forEach(m => mapRef.current.removeLayer(m));
      markersRef.current = [];

      // Montar coordenadas da rota: [atual] -> [paradas] -> [destino]
      const coords = [
        `${currentPosition[1]},${currentPosition[0]}`,
        ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`),
        `${travel.destinationCoords[1]},${travel.destinationCoords[0]}`
      ].join(';');

      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&languages=pt-BR`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

          routeLayerRef.current = L.geoJSON(route.geometry, { 
            style: { color: '#33CCFF', weight: 12, opacity: 0.8, lineCap: 'round' } 
          }).addTo(mapRef.current);
          
          if (!isFullScreen) mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [100, 100] });

          // Adicionar marcadores de parada e radares
          travel.stops.forEach(s => {
             const m = L.marker(s.coords, {
                icon: L.divIcon({ className: 'stop-m', html: `<i class="fas fa-circle-dot text-blue-600 text-xl shadow-lg"></i>`, iconSize: [20, 20] })
             }).addTo(mapRef.current);
             markersRef.current.push(m);
          });

          travel.warnings.filter(w => w.type === 'RADAR').forEach(w => {
            const m = L.marker(w.coords, {
               icon: L.divIcon({ className: 'radar-m', html: `<i class="fas fa-camera text-red-500 text-xl animate-pulse"></i>`, iconSize: [24, 24] })
            }).addTo(mapRef.current);
            markersRef.current.push(m);
          });

          if (onRouteUpdate) onRouteUpdate([], Math.round(route.duration / 60), Math.round(route.distance / 1000));
        }
      } catch (e) { console.error("OSRM Multi Error:", e); }
    };
    fetchMultiRoute();
  }, [travel.destinationCoords, travel.stops, travel.warnings]);

  return (
    <div className={`w-full h-full relative cursor-pointer group`} onClick={onToggleFullScreen}>
       <div ref={mapContainerRef} className="w-full h-full" />
       
       <div className="absolute top-10 left-10 pointer-events-none z-50">
          <div className="flex flex-col gap-4">
             <div className="px-6 py-3 bg-white text-slate-900 rounded-2xl shadow-2xl flex items-center gap-4 border-b-4 border-blue-600">
                <i className="fas fa-compass text-2xl animate-spin-slow"></i>
                <span className="text-xs font-black uppercase tracking-widest">{isFullScreen ? 'FULL NAVIGATION' : 'COCKPIT VIEW'}</span>
             </div>
             {isFullScreen && (
               <div className="bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 text-white animate-fade-in">
                  <p className="text-[10px] font-black uppercase text-blue-400 mb-1">Status Pandora</p>
                  <p className="text-xs font-bold uppercase">Toque para voltar ao painel</p>
               </div>
             )}
          </div>
       </div>

       <div className="absolute bottom-10 left-10 flex gap-4 pointer-events-none">
          {travel.warnings.slice(0, 2).map(w => (
            <div key={w.id} className="bg-red-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] flex items-center gap-3 animate-bounce shadow-2xl">
               <i className="fas fa-triangle-exclamation"></i>
               {w.description.toUpperCase()} - {w.distance}M
            </div>
          ))}
       </div>
       <style>{`
          .animate-spin-slow { animation: spin 8s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
       `}</style>
    </div>
  );
};

export default MapView;
