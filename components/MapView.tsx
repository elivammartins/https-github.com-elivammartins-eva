
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  viewMode: '2D' | '3D';
  onSetDestination: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: 17,
        fadeAnimation: true
      });

      // Estilo Waze: Usando tile-set mais colorido e claro
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const icon = L.divIcon({
        className: 'vehicle-waze',
        html: `
          <div style="position: relative;">
            <div style="width: 60px; height: 60px; background: #33CCFF; border: 5px solid white; border-radius: 50%; box-shadow: 0 10px 30px rgba(51,204,255,0.6); display: flex; align-items: center; justify-content: center;">
              <i class="fas fa-location-arrow" style="color: white; font-size: 26px; transform: rotate(-45deg);"></i>
            </div>
            <div style="position: absolute; top: -15px; left: 50%; transform: translateX(-50%); background: white; padding: 2px 8px; border-radius: 10px; font-weight: 900; font-size: 10px; color: #33CCFF; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">VOCÊ</div>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon }).addTo(mapRef.current);
    }

    const timer = setInterval(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 1500);
    return () => { 
      clearInterval(timer);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } 
    };
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current) vehicleMarkerRef.current.setLatLng(currentPosition);
    if (mapRef.current && !travel.destinationCoords) mapRef.current.panTo(currentPosition, { animate: true });
  }, [currentPosition, travel.destinationCoords]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords[1]},${travel.destinationCoords[0]}?overview=full&geometries=geojson&steps=true&languages=pt-BR`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

          // Rota estilo Waze: Azul brilhante e grossa
          routeLayerRef.current = L.geoJSON(route.geometry, { 
            style: { color: '#33CCFF', weight: 14, opacity: 0.9, lineCap: 'round', lineJoin: 'round' } 
          }).addTo(mapRef.current);
          
          mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [150, 150], animate: true });

          const steps: RouteStep[] = route.legs[0].steps.map((s: any) => ({
            instruction: s.maneuver.instruction,
            street: s.name || 'Via Local',
            distance: Math.round(s.distance),
            maneuver: s.maneuver.modifier || 'straight'
          }));

          if (onRouteUpdate) onRouteUpdate(steps, route.duration, route.distance);
        }
      } catch (e) { console.error("OSRM Erro:", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords]);

  return (
    <div className="w-full h-full relative">
       <div ref={mapContainerRef} className="w-full h-full grayscale-[0.2] saturate-[1.4]" />
       {/* Placas Waze Fake UI */}
       <div className="absolute top-10 right-10 flex flex-col gap-4 pointer-events-none">
          <div className="bg-white p-3 rounded-2xl shadow-xl flex items-center gap-3 border-b-4 border-emerald-500 animate-bounce">
             <i className="fas fa-camera text-blue-500 text-xl"></i>
             <span className="text-xs font-black text-slate-800 uppercase">Radar Próximo</span>
          </div>
       </div>
    </div>
  );
};

export default MapView;
