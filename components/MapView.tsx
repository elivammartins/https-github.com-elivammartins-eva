
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep, RouteSegment, MapMode, MapLayer } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  heading: number;
  isFullScreen: boolean;
  mode: MapMode;
  layer: MapLayer;
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, heading, isFullScreen, mode, layer, onToggleFullScreen, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, attributionControl: false, center: currentPosition, zoom: 17
      });

      // Camadas de Mapa
      layersRef.current.DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      layersRef.current.SATELLITE = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');

      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div id="nav-arrow-waze" class="nav-container" style="transform: rotate(${heading}deg);">
            <div class="glow-effect"></div>
            <svg width="60" height="60" viewBox="0 0 100 100">
               <path d="M50 0 L100 100 L50 80 L0 100 Z" fill="#33CCFF" stroke="white" stroke-width="2" />
            </svg>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
    }
  }, []);

  // Update Perspective & Layers
  useEffect(() => {
    if (!mapRef.current) return;

    // Layer Switch
    Object.values(layersRef.current).forEach(l => mapRef.current.removeLayer(l));
    layersRef.current[layer].addTo(mapRef.current);

    // Mode Adjustments
    const mapEl = mapContainerRef.current;
    if (mapEl) {
      if (mode === '3D' || mode === 'STREET') {
        mapEl.style.transform = 'perspective(800px) rotateX(45deg) scale(1.2)';
        mapRef.current.setZoom(mode === 'STREET' ? 19 : 17);
      } else {
        mapEl.style.transform = 'perspective(800px) rotateX(0deg) scale(1)';
        mapRef.current.setZoom(15);
      }
    }
  }, [mode, layer]);

  // Vehicle Update
  useEffect(() => {
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const arrow = document.getElementById('nav-arrow-waze');
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
    }
    if (mapRef.current) {
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), { animate: true });
    }
  }, [currentPosition, heading]);

  // Route Engine (Ultra-Fast)
  useEffect(() => {
    const fetchRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      
      const waypoints = [
        `${currentPosition[1]},${currentPosition[0]}`, 
        ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`), 
        `${travel.destinationCoords[1]},${travel.destinationCoords[0]}`
      ].join(';');

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, { 
            style: { color: '#33CCFF', weight: 12, opacity: 0.8, lineJoin: 'round' } 
          }).addTo(mapRef.current);

          if (onRouteUpdate) onRouteUpdate([], Math.round(data.routes[0].duration/60), Math.round(data.routes[0].distance/1000), []);
        }
      } catch (e) { console.error("OSRM Failure", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.stops]);

  return (
    <div className="w-full h-full overflow-hidden relative bg-black">
      <div ref={mapContainerRef} className="w-full h-full transition-all duration-1000 ease-in-out origin-bottom" />
      
      {/* MAP CONTROLS FLOATING */}
      <div className="absolute top-10 right-10 z-[100] flex flex-col gap-4">
         <button onClick={onToggleFullScreen} className="w-16 h-16 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 text-white shadow-2xl flex items-center justify-center">
            <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'}`}></i>
         </button>
      </div>

      <style>{`
        .nav-container { position: relative; width: 60px; height: 60px; transition: transform 0.3s ease; filter: drop-shadow(0 0 10px rgba(51,204,255,0.6)); }
        .glow-effect { position: absolute; top: 50%; left: 50%; width: 20px; height: 20px; background: #33CCFF; filter: blur(20px); transform: translate(-50%, -50%); opacity: 0.5; }
        .vehicle-marker { pointer-events: none !important; }
      `}</style>
    </div>
  );
};

export default MapView;
