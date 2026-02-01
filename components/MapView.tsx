
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep, RouteSegment } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => void;
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

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="width: 60px; height: 60px; background: rgba(51,204,255,0.2); border: 3px solid #33CCFF; border-radius: 50%; box-shadow: 0 0 40px rgba(51,204,255,0.6); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
            <i class="fas fa-location-arrow" style="color: white; font-size: 24px; transform: rotate(-45deg);"></i>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
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
    const updateMarkers = () => {
      if (!mapRef.current) return;
      markersRef.current.forEach(m => mapRef.current.removeLayer(m));
      markersRef.current = [];

      // Exibir avisos de radares/polícia (mesmo sem rota)
      travel.warnings.forEach(w => {
        let iconHtml = '';
        if (w.type === 'RADAR') iconHtml = `<div class="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-lg animate-pulse"><i class="fas fa-camera text-white"></i></div>`;
        else if (w.type === 'POLICE') iconHtml = `<div class="bg-orange-600 w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-lg animate-bounce"><i class="fas fa-user-shield text-white"></i></div>`;
        
        if (iconHtml) {
          const m = L.marker(w.coords, {
             icon: L.divIcon({ className: 'warning-marker', html: iconHtml, iconSize: [40, 40] })
          }).addTo(mapRef.current);
          markersRef.current.push(m);
        }
      });
    };
    updateMarkers();

    const fetchRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      const coords = [`${currentPosition[1]},${currentPosition[0]}`, ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`), `${travel.destinationCoords[1]},${travel.destinationCoords[0]}`].join(';');
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
        const data = await res.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.geoJSON(route.geometry, { style: { color: '#33CCFF', weight: 10, opacity: 0.7 } }).addTo(mapRef.current);
          if (onRouteUpdate) onRouteUpdate([], Math.round(route.duration / 60), Math.round(route.distance / 1000), []);
        }
      } catch (e) {}
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.stops, travel.warnings]);

  return (
    <div className={`w-full h-full relative cursor-pointer`} onClick={onToggleFullScreen}>
       <div ref={mapContainerRef} className="w-full h-full" />
       <div className="absolute bottom-10 left-10 flex flex-col gap-4 pointer-events-none z-50">
          {travel.warnings.map(w => (
            <div key={w.id} className="bg-black/90 backdrop-blur-xl border border-white/10 p-5 rounded-3xl flex items-center gap-5 animate-slide-in shadow-2xl">
               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${w.type === 'RADAR' ? 'bg-blue-600' : 'bg-orange-600'}`}>
                  <i className={`fas ${w.type === 'RADAR' ? 'fa-camera' : 'fa-user-shield'}`}></i>
               </div>
               <div>
                  <h4 className="text-sm font-black text-white">{w.description}</h4>
                  <p className="text-[10px] text-white/40 font-bold tracking-widest">{w.distance} METROS • REDUZA</p>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
};

export default MapView;
